import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { createServer as createHttpServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '../../..')
const resourceDir = path.join(rootDir, 'resource')
const catalogPath = path.join(resourceDir, 'course-list.json')
const dictDir = process.env.ENGLISHPOD_DICT_DIR
  ? path.resolve(process.env.ENGLISHPOD_DICT_DIR)
  : path.join(resourceDir, 'dict')
const lookupPath = path.join(dictDir, 'lookup.json')
const lemmasPath = path.join(dictDir, 'lemmas.json')
const webDistDir = process.env.WEB_DIST_DIR
  ? path.resolve(process.env.WEB_DIST_DIR)
  : path.join(rootDir, 'apps', 'web', 'dist')

const staticContentTypes = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.ico', 'image/x-icon'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.ttf', 'font/ttf'],
  ['.map', 'application/json; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
])

const resourceTypes = new Map([
  ['dialog.mp3', 'audio/mpeg'],
  ['lesson.mp3', 'audio/mpeg'],
  ['review.mp3', 'audio/mpeg'],
  ['worksheet.pdf', 'application/pdf'],
  ['host.pdf', 'application/pdf'],
  ['subtitle.srt', 'text/plain; charset=utf-8'],
  ['subtitle.bilingual.srt', 'text/plain; charset=utf-8'],
  ['subtitle.zh.srt', 'text/plain; charset=utf-8'],
  ['transcript.txt', 'text/plain; charset=utf-8'],
])

const subtitleModeFiles = new Map([
  ['en', 'subtitle.srt'],
  ['bilingual', 'subtitle.bilingual.srt'],
  ['off', 'subtitle.bilingual.srt'],
  ['zh', 'subtitle.zh.srt'],
])

const YOUDAO_WORD_AUDIO_URL = 'https://dict.youdao.com/dictvoice'

function json(res, status, body, head = false) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(payload),
  })
  if (head) {
    res.end()
    return
  }
  res.end(payload)
}

function notFound(res, head = false) {
  json(res, 404, { error: 'Not found' }, head)
}

function methodNotAllowed(res, head = false) {
  json(res, 405, { error: 'Method not allowed' }, head)
}

function serviceUnavailable(res, message, head = false) {
  json(res, 503, { error: message }, head)
}

function fileEtag(fileStat) {
  return `"${fileStat.size.toString(16)}-${Math.trunc(fileStat.mtimeMs).toString(16)}"`
}

function fileHeaders(fileStat, contentType, cacheControl) {
  return {
    'accept-ranges': 'bytes',
    'cache-control': cacheControl,
    'content-type': contentType,
    etag: fileEtag(fileStat),
    'last-modified': fileStat.mtime.toUTCString(),
  }
}

function stripWord(word) {
  return Array.from(word)
    .filter((char) => /[a-z0-9]/i.test(char))
    .join('')
    .toLowerCase()
}

function normalizeAudioWord(inputWord) {
  let word
  try {
    word = decodeURIComponent(inputWord).trim().toLowerCase().replaceAll('’', "'")
  } catch {
    return null
  }

  // The endpoint is intentionally limited to subtitle word tokens. It must
  // never become a general-purpose URL proxy or receive a sentence.
  return /^[a-z0-9]+(?:['-][a-z0-9]+)*$/i.test(word) && word.length <= 80 ? word : null
}

async function sendDictionaryAudio(req, res, inputWord) {
  const word = normalizeAudioWord(inputWord)
  if (!word) {
    notFound(res, req.method === 'HEAD')
    return
  }

  const audioUrl = `${YOUDAO_WORD_AUDIO_URL}?audio=${encodeURIComponent(word)}&type=2`
  let response
  try {
    response = await fetch(audioUrl, {
      headers: { accept: 'audio/mpeg,audio/*;q=0.9,*/*;q=0.1' },
      signal: AbortSignal.timeout(5000),
    })
  } catch {
    serviceUnavailable(res, 'Word pronunciation is temporarily unavailable', req.method === 'HEAD')
    return
  }

  const contentType = response.headers.get('content-type') ?? ''
  if (!response.ok || !contentType.toLowerCase().startsWith('audio/')) {
    serviceUnavailable(res, 'Word pronunciation is temporarily unavailable', req.method === 'HEAD')
    return
  }

  const audio = Buffer.from(await response.arrayBuffer())
  res.writeHead(200, {
    'cache-control': 'public, max-age=86400',
    'content-length': audio.length,
    'content-type': contentType,
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  res.end(audio)
}

function inflectionCandidates(word) {
  const candidates = []
  const add = (candidate) => {
    if (candidate && candidate !== word && !candidates.includes(candidate)) {
      candidates.push(candidate)
    }
  }

  if (word.endsWith('ies') && word.length > 3) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('ves') && word.length > 3) {
    add(`${word.slice(0, -3)}f`)
    add(`${word.slice(0, -3)}fe`)
  }

  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 2) {
    add(word.slice(0, -1))
  }
  if (word.endsWith('es') && word.length > 3) {
    add(word.slice(0, -2))
  }

  if (word.endsWith('ied') && word.length > 3) add(`${word.slice(0, -3)}y`)
  if (word.endsWith('ed') && word.length > 3) {
    const stem = word.slice(0, -2)
    add(stem)
    add(`${stem}e`)
    if (/(bb|dd|gg|mm|nn|pp|rr|tt)$/.test(stem)) add(stem.slice(0, -1))
  }

  if (word.endsWith('ing') && word.length > 4) {
    const stem = word.slice(0, -3)
    add(stem)
    add(`${stem}e`)
    if (/(bb|dd|gg|mm|nn|pp|rr|tt)$/.test(stem)) add(stem.slice(0, -1))
  }

  return candidates
}

const MORPHOLOGY_MARKER = /(?:复数|过去式|过去分词|现在分词|第三人称单数|plural of|past tense|past participle|present participle)/i
const CONTRACTION_EXPANSIONS = {
  "i'm": ['i', 'am'],
  "you're": ['you', 'are'],
  "he's": ['he', 'is'],
  "she's": ['she', 'is'],
  "it's": ['it', 'is'],
  "we're": ['we', 'are'],
  "they're": ['they', 'are'],
  "i've": ['i', 'have'],
  "you've": ['you', 'have'],
  "we've": ['we', 'have'],
  "they've": ['they', 'have'],
  "let's": ['let', 'us'],
  "i'll": ['i', 'will'],
  "you'll": ['you', 'will'],
  "he'll": ['he', 'will'],
  "she'll": ['she', 'will'],
  "we'll": ['we', 'will'],
  "they'll": ['they', 'will'],
  "it'll": ['it', 'will'],
  "that'll": ['that', 'will'],
  "there'll": ['there', 'will'],
  "i'd": ['i', 'would'],
  "you'd": ['you', 'would'],
  "he'd": ['he', 'would'],
  "she'd": ['she', 'would'],
  "we'd": ['we', 'would'],
  "they'd": ['they', 'would'],
  "it'd": ['it', 'would'],
  "that'd": ['that', 'would'],
  "what'd": ['what', 'did'],
  "where'd": ['where', 'did'],
  "can't": ['can', 'not'],
  "won't": ['will', 'not'],
  "don't": ['do', 'not'],
  "doesn't": ['does', 'not'],
  "didn't": ['did', 'not'],
  "isn't": ['is', 'not'],
  "aren't": ['are', 'not'],
  "wasn't": ['was', 'not'],
  "weren't": ['were', 'not'],
  "haven't": ['have', 'not'],
  "hasn't": ['has', 'not'],
  "hadn't": ['had', 'not'],
  "wouldn't": ['would', 'not'],
  "shouldn't": ['should', 'not'],
  "couldn't": ['could', 'not'],
  "that's": ['that', 'is'],
  "what's": ['what', 'is'],
  "there's": ['there', 'is'],
  "who's": ['who', 'is'],
  "how's": ['how', 'is'],
  "here's": ['here', 'is'],
  "where's": ['where', 'is'],
  "when's": ['when', 'is'],
  "who've": ['who', 'have'],
  "might've": ['might', 'have'],
  "ain't": ['are', 'not'],
  "o'clock": ['of', 'the', 'clock'],
  "ma'am": ['madam'],
}
const AMBIGUOUS_CONTRACTION_EXPANSIONS = {
  "he's": [['he', 'is'], ['he', 'has']],
  "she's": [['she', 'is'], ['she', 'has']],
  "it's": [['it', 'is'], ['it', 'has']],
  "that's": [['that', 'is'], ['that', 'has']],
  "there's": [['there', 'is'], ['there', 'has']],
  "who's": [['who', 'is'], ['who', 'has']],
  "how's": [['how', 'is'], ['how', 'has']],
  "here's": [['here', 'is'], ['here', 'has']],
  "where's": [['where', 'is'], ['where', 'has']],
  "when's": [['when', 'is'], ['when', 'has']],
  "what's": [['what', 'is'], ['what', 'has']],
  "i'd": [['i', 'would'], ['i', 'had']],
  "you'd": [['you', 'would'], ['you', 'had']],
  "he'd": [['he', 'would'], ['he', 'had']],
  "she'd": [['she', 'would'], ['she', 'had']],
  "we'd": [['we', 'would'], ['we', 'had']],
  "they'd": [['they', 'would'], ['they', 'had']],
  "it'd": [['it', 'would'], ['it', 'had']],
  "that'd": [['that', 'would'], ['that', 'had']],
  "ain't": [['am', 'not'], ['is', 'not'], ['are', 'not']],
}

function hasMorphologicalTranslation(entry) {
  return Boolean(entry?.translation && MORPHOLOGY_MARKER.test(entry.translation))
}

function lookupContraction(word, lookup) {
  const parts = CONTRACTION_EXPANSIONS[word]
  if (!parts) return null
  const expansions = AMBIGUOUS_CONTRACTION_EXPANSIONS[word] ?? [parts]

  const resolved = expansions.map((expansion) => ({
    expansion,
    entries: expansion.map((part) => lookup[part] ?? lookup[stripWord(part)]),
  }))
  if (resolved.some(({ entries }) => entries.some((entry) => !entry))) return null

  return {
    found: true,
    query: word,
    matched: resolved.map(({ expansion }) => expansion.join(' ')).join(' / '),
    word: resolved.map(({ expansion }) => expansion.join(' ')).join(' / '),
    phonetic: '',
    pos: '',
    translation: resolved
      .map(({ expansion, entries }) => `${expansion.join(' ')}：${entries.map((entry) => entry.translation).join('；')}`)
      .join('\n'),
  }
}

function parseTime(value) {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/)
  if (!match) return 0
  const [, hours, minutes, seconds, millis] = match
  return (
    Number(hours) * 3600 +
    Number(minutes) * 60 +
    Number(seconds) +
    Number(millis) / 1000
  )
}

export function parseSrt(content) {
  return content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/)
      const id = lines.shift() ?? ''
      const timing = lines.shift() ?? ''
      const [startRaw, endRaw] = timing.split(/\s+-->\s+/)

      return {
        id,
        start: parseTime(startRaw ?? ''),
        end: parseTime(endRaw ?? ''),
        text: lines.join('\n').trim(),
      }
    })
}

let catalogState = null

async function readCatalog() {
  if (!catalogState) {
    catalogState = readFile(catalogPath, 'utf8')
      .then((content) => JSON.parse(content.replace(/^\uFEFF/, '')))
      .catch((error) => {
        catalogState = null
        throw error
      })
  }

  return catalogState
}

let dictionaryState = null
const subtitleCache = new Map()

async function readJsonFile(filePath) {
  const content = await readFile(filePath, 'utf8')
  return JSON.parse(content.replace(/^\uFEFF/, ''))
}

async function loadDictionary() {
  if (!dictionaryState) {
    dictionaryState = Promise.all([
      readJsonFile(lookupPath),
      readJsonFile(lemmasPath).catch(() => ({})),
    ])
      .then(([lookup, lemmas]) => ({ lookup, lemmas }))
      .catch((error) => {
        dictionaryState = null
        throw error
      })
  }

  return dictionaryState
}

async function readSubtitleFile(filePath) {
  if (!subtitleCache.has(filePath)) {
    subtitleCache.set(
      filePath,
      readFile(filePath, 'utf8').catch((error) => {
        subtitleCache.delete(filePath)
        throw error
      }),
    )
  }

  return subtitleCache.get(filePath)
}

async function lookupDictionary(inputWord) {
  const word = decodeURIComponent(inputWord).trim()
  if (!word) return { found: false, word: '' }

  const normalizedWord = word.toLowerCase()
  const strippedWord = stripWord(word)
  const possessiveMatch = normalizedWord.match(/^(.*?)[’']s$/)
  const possessiveBase = possessiveMatch ? possessiveMatch[1] : ''
  const possessiveStripped = stripWord(possessiveBase)
  const { lookup, lemmas } = await loadDictionary()
  const contraction = lookupContraction(normalizedWord, lookup)
  if (contraction) return { ...contraction, query: word }

  const candidates = []
  const addCandidate = (candidate) => {
    if (candidate && !candidates.includes(candidate)) candidates.push(candidate)
  }
  const addWithLemma = (candidate) => {
    addCandidate(candidate)
    addCandidate(lemmas[candidate])
  }

  const exactEntry = lookup[normalizedWord] ?? lookup[strippedWord]
  const mappedLemma = lemmas[normalizedWord] ?? lemmas[strippedWord]
  const inflections = inflectionCandidates(strippedWord)

  // Keep an explicit source mapping ahead of heuristic candidates. For
  // example, "buses" can be guessed as "buse" or "bus", but ECDICT's
  // mapping identifies "bus" as the correct base word.
  if (
    mappedLemma &&
    (!exactEntry ||
      hasMorphologicalTranslation(exactEntry) ||
      inflections.includes(mappedLemma) ||
      possessiveStripped === strippedWord)
  ) {
    addCandidate(mappedLemma)
  }

  // Prefer a real base word for standard inflections. This avoids cases
  // where an inflected row has a weak or unrelated definition, such as
  // "weeks" being treated as a surname instead of the plural of "week".
  if (!exactEntry || hasMorphologicalTranslation(exactEntry)) {
    for (const candidate of inflections) addWithLemma(candidate)
  }

  // Apostrophe-s words are normally possessives in subtitle text. Query the
  // noun itself before stripping punctuation, so "child's" does not become
  // the unrelated dictionary entry "childs".
  addCandidate(possessiveBase)
  addCandidate(possessiveStripped)

  addCandidate(normalizedWord)
  addCandidate(strippedWord)

  for (const candidate of candidates) {
    const entry = lookup[candidate]
    if (!entry) continue

    return {
      found: true,
      query: word,
      matched: entry.word,
      word: entry.word,
      phonetic: entry.phonetic,
      pos: entry.pos,
      translation: entry.translation,
    }
  }

  return { found: false, word }
}

function isLessonId(value) {
  return /^\d{4}$/.test(value)
}

function resourcePathFor(lessonId, fileName) {
  if (!isLessonId(lessonId) || !resourceTypes.has(fileName)) return null
  const fullPath = path.join(resourceDir, lessonId, fileName)
  const resolved = path.resolve(fullPath)
  const expectedRoot = path.resolve(resourceDir, lessonId) + path.sep
  return resolved.startsWith(expectedRoot) ? resolved : null
}

async function sendResource(req, res, lessonId, fileName) {
  const fullPath = resourcePathFor(lessonId, fileName)
  if (!fullPath) {
    notFound(res, req.method === 'HEAD')
    return
  }

  let fileStat
  try {
    fileStat = await stat(fullPath)
  } catch {
    notFound(res, req.method === 'HEAD')
    return
  }

  const contentType = resourceTypes.get(fileName)
  const range = req.headers.range

  if (range) {
    const match = range.match(/^bytes=(\d*)-(\d*)$/)
    if (!match) {
      res.writeHead(416)
      res.end()
      return
    }

    let start
    let end
    if (!match[1]) {
      const suffixLength = Number(match[2])
      if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) {
        res.writeHead(416, { 'content-range': `bytes */${fileStat.size}` })
        res.end()
        return
      }
      start = Math.max(fileStat.size - suffixLength, 0)
      end = fileStat.size - 1
    } else {
      start = Number(match[1])
      end = match[2] ? Number(match[2]) : fileStat.size - 1
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
        res.writeHead(416, { 'content-range': `bytes */${fileStat.size}` })
        res.end()
        return
      }
      end = Math.min(end, fileStat.size - 1)
    }

    if (start >= fileStat.size || start > end) {
      res.writeHead(416, { 'content-range': `bytes */${fileStat.size}` })
      res.end()
      return
    }

    res.writeHead(206, {
      ...fileHeaders(fileStat, contentType, 'public, max-age=86400'),
      'content-type': contentType,
      'content-length': end - start + 1,
      'content-range': `bytes ${start}-${end}/${fileStat.size}`,
    })
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    createReadStream(fullPath, { start, end }).pipe(res)
    return
  }

  res.writeHead(200, {
    ...fileHeaders(fileStat, contentType, 'public, max-age=86400'),
    'content-length': fileStat.size,
  })
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  createReadStream(fullPath).pipe(res)
}

async function sendStatic(req, res, pathname) {
  const relativePath = decodeURIComponent(pathname).replace(/^\/+/, '')
  const candidate = path.resolve(webDistDir, relativePath || 'index.html')
  const expectedRoot = path.resolve(webDistDir) + path.sep
  const filePath =
    candidate === path.resolve(webDistDir) || candidate.startsWith(expectedRoot)
      ? candidate
      : null

  let fileStat = null
  if (filePath) {
    try {
      fileStat = await stat(filePath)
    } catch {
      fileStat = null
    }
  }

  // SPA fallback: unknown non-asset routes return index.html
  const indexPath = path.join(webDistDir, 'index.html')
  const acceptsHtml = (req.headers.accept ?? '').includes('text/html')
  const isNavigation = !path.extname(relativePath) && acceptsHtml
  if (!fileStat && !isNavigation) return false

  const target = fileStat?.isFile() ? filePath : indexPath
  const contentType =
    staticContentTypes.get(path.extname(target).toLowerCase()) ??
    'application/octet-stream'

  let targetStat
  try {
    targetStat = await stat(target)
  } catch {
    return false
  }

  res.writeHead(200, {
    ...fileHeaders(
      targetStat,
      contentType,
      target === indexPath ? 'no-cache' : 'public, max-age=31536000, immutable',
    ),
    'content-length': targetStat.size,
  })
  if (req.method === 'HEAD') {
    res.end()
    return true
  }
  createReadStream(target).pipe(res)
  return true
}

async function route(req, res) {
  const head = req.method === 'HEAD'
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    methodNotAllowed(res, head)
    return
  }

  const url = new URL(req.url ?? '/', 'http://localhost')
  const parts = url.pathname.split('/').filter(Boolean)

  if (url.pathname === '/api/health') {
    json(res, 200, { ok: true }, head)
    return
  }

  if (url.pathname === '/api/courses') {
    json(res, 200, await readCatalog(), head)
    return
  }

  if (parts[0] === 'api' && parts[1] === 'dict' && parts.length === 3) {
    try {
      json(res, 200, await lookupDictionary(parts[2]), head)
    } catch {
      serviceUnavailable(
        res,
        'Dictionary is not built. Put ecdict.mini.csv in resource/dict and run: node tools/build-dict.mjs',
        head,
      )
    }
    return
  }

  if (parts[0] === 'api' && parts[1] === 'dict-audio' && parts.length === 3) {
    await sendDictionaryAudio(req, res, parts[2])
    return
  }

  if (parts[0] === 'api' && parts[1] === 'courses' && parts[2]) {
    const lessonId = parts[2]
    if (!isLessonId(lessonId)) {
      notFound(res, head)
      return
    }

    if (parts[3] === 'subtitles' && parts.length === 4) {
      const mode = url.searchParams.get('mode') ?? 'en'
      const subtitleFile = subtitleModeFiles.get(mode)
      const fullPath = subtitleFile ? resourcePathFor(lessonId, subtitleFile) : null
      if (!fullPath) {
        notFound(res, head)
        return
      }

      try {
        json(res, 200, parseSrt(await readSubtitleFile(fullPath)), head)
      } catch {
        notFound(res, head)
      }
      return
    }

    if (parts.length === 3) {
      const catalog = await readCatalog()
      const lesson = catalog.lessons.find((item) => item.id === lessonId)
      if (lesson) {
        json(res, 200, lesson, head)
      } else {
        notFound(res, head)
      }
      return
    }
  }

  if (
    parts[0] === 'api' &&
    parts[1] === 'resources' &&
    parts.length === 4
  ) {
    await sendResource(req, res, parts[2], parts[3])
    return
  }

  if (parts[0] !== 'api') {
    const served = await sendStatic(req, res, url.pathname)
    if (served) return
  }

  notFound(res, head)
}

export function createServer() {
  return createHttpServer((req, res) => {
    route(req, res).catch(() => {
      json(res, 500, { error: 'Internal server error' })
    })
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT ?? 4173)
  const host = process.env.HOST ?? '127.0.0.1'
  const server = createServer()
  const shutdown = () => {
    server.close(() => process.exit(0))
  }
  for (const signal of ['SIGINT', 'SIGTERM']) server.once(signal, shutdown)
  server.on('error', (error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  server.listen(port, host, () => {
    console.log(`EnglishPod API listening on http://${host}:${port}`)
  })
}
