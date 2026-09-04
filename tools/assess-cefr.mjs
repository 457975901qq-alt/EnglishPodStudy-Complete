import { readFile, writeFile } from 'node:fs/promises'

const ROOT = new URL('../', import.meta.url)
const COURSE_LIST_PATH = new URL('resource/course-list.json', ROOT)
const DICT_PATH = new URL('resource/dict/ecdict.mini.csv', ROOT)
const LEMMAS_PATH = new URL('resource/dict/lemmas.json', ROOT)
const OUTPUT_PATH = new URL('resource/cefr-assessment.json', ROOT)

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1']
const STOP_WORDS = new Set(`
  a an the and are as at be been being but by can could did do does for from get got had has have he her here hers him his how i if in into is it its just me more most my no not of on one only or our ours she so some than that their theirs them then there these they this to too us was we were what when where which who will with would you your yours
`.trim().split(/\s+/))

const RUBRIC = {
  name: 'CEFR-aligned listening estimate',
  version: '2026-09-03.1',
  weights: { lexical: 0.45, syntax: 0.25, speechRate: 0.2, discourse: 0.1 },
  bands: [
    { level: 'A1', min: 0, max: 20 },
    { level: 'A2', min: 20, max: 35 },
    { level: 'B1', min: 35, max: 50 },
    { level: 'B2', min: 50, max: 60 },
    { level: 'C1', min: 60, max: 101 },
  ],
  components: {
    lexical: 'Content-word difficulty estimated from ECDICT Oxford/frequency metadata; this is a proxy, not a CEFR vocabulary list.',
    syntax: 'Average words per subtitle cue and clause-marker density; subtitle cues are used as a reproducible spoken-unit proxy.',
    speechRate: 'Words per minute estimated from the final English subtitle timestamp.',
    discourse: 'Lexical density and type-token ratio as a light information-density proxy.',
  },
}

function parseCsv(content) {
  const rows = []
  let field = ''
  let row = []
  let quoted = false
  const text = content.replace(/^\uFEFF/, '')
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (quoted && char === '"' && next === '"') {
      field += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if (char === '\n' && !quoted) {
      row.push(field.replace(/\r$/, ''))
      if (row.some((value) => value !== '')) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field || row.length) {
    row.push(field)
    if (row.some((value) => value !== '')) rows.push(row)
  }
  return rows
}

function tokensFrom(text) {
  return (text.toLowerCase().match(/[a-z]+(?:['’][a-z]+)?(?:-[a-z]+)*/g) ?? [])
    .map((token) => token.replaceAll('’', "'"))
}

function parseTime(value) {
  const match = value.match(/^(\d{2}):(\d{2}):(\d{2}),(\d{3})$/)
  if (!match) return 0
  const [, hours, minutes, seconds, millis] = match
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds) + Number(millis) / 1000
}

function parseSrt(content) {
  return content
    .replace(/^\uFEFF/, '')
    .split(/\r?\n\r?\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const lines = block.split(/\r?\n/)
      lines.shift()
      const timing = lines.shift() ?? ''
      const [start, end] = timing.split(/\s+-->\s+/)
      return { start: parseTime(start ?? ''), end: parseTime(end ?? ''), text: lines.join(' ').trim() }
    })
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value))
}

function scale(value, low, high) {
  return clamp((value - low) / (high - low))
}

function frequencyDifficulty(entry) {
  if (!entry) return 0.7
  if (entry.oxford) return 0.1
  const rank = Number(entry.frq)
  if (!Number.isFinite(rank) || rank <= 0) return 0.55
  if (rank <= 1000) return 0.2
  if (rank <= 5000) return 0.4
  if (rank <= 10000) return 0.6
  if (rank <= 20000) return 0.78
  return 0.92
}

function confidenceFor(metrics) {
  const dictionaryCoverage = 1 - metrics.unknownContentWordRate
  if (dictionaryCoverage >= 0.9 && metrics.subtitleCues >= 12) return 'high'
  if (dictionaryCoverage >= 0.75 && metrics.subtitleCues >= 8) return 'medium'
  return 'low'
}

function levelForScore(score) {
  return RUBRIC.bands.find((band) => score >= band.min && score < band.max)?.level ?? 'C1'
}

async function loadDictionary() {
  const [csv, lemmasText] = await Promise.all([readFile(DICT_PATH, 'utf8'), readFile(LEMMAS_PATH, 'utf8')])
  const rows = parseCsv(csv)
  const header = rows.shift()
  const indexes = Object.fromEntries(header.map((name, index) => [name, index]))
  const dictionary = new Map()
  for (const row of rows) {
    const word = String(row[indexes.word] ?? '').trim().toLowerCase()
    if (!word || dictionary.has(word)) continue
    dictionary.set(word, { oxford: row[indexes.oxford] === '1', frq: row[indexes.frq] })
  }
  return { dictionary, lemmas: JSON.parse(lemmasText.replace(/^\uFEFF/, '')) }
}

function assessLesson(lesson, subtitles, dictionary, lemmas) {
  const text = subtitles.map((cue) => cue.text).join(' ')
  const words = tokensFrom(text)
  const contentWords = words.filter((word) => !STOP_WORDS.has(word.replace(/['-].*$/, '')))
  const uniqueContentWords = [...new Set(contentWords)]
  const dictionaryHits = contentWords.filter((word) => {
    const lemma = lemmas[word]
    return dictionary.has(word) || (lemma && dictionary.has(lemma))
  })
  const unknownContentWordRate = contentWords.length ? 1 - dictionaryHits.length / contentWords.length : 1
  const lexicalRaw = uniqueContentWords.length
    ? uniqueContentWords.reduce((total, word) => {
        const entry = dictionary.get(word) ?? dictionary.get(lemmas[word])
        return total + frequencyDifficulty(entry)
      }, 0) / uniqueContentWords.length
    : 0
  const sentenceWords = subtitles.map((cue) => tokensFrom(cue.text).length).filter((count) => count > 0)
  const totalWords = words.length
  const averageSentenceWords = sentenceWords.length
    ? sentenceWords.reduce((total, count) => total + count, 0) / sentenceWords.length
    : 0
  const clauseMarkers = (text.match(/[,;:]|\b(?:although|because|which|while|unless|that|who|where|if|when)\b/gi) ?? []).length
  const clauseDensity = totalWords ? (clauseMarkers / totalWords) * 100 : 0
  const maxEnd = subtitles.reduce((max, cue) => Math.max(max, cue.end), 0)
  const wordsPerMinute = maxEnd > 0 ? totalWords / (maxEnd / 60) : 0
  const lexicalDensity = totalWords ? contentWords.length / totalWords : 0
  const typeTokenRatio = contentWords.length ? uniqueContentWords.length / contentWords.length : 0
  const components = {
    lexical: scale(lexicalRaw, 0.18, 0.5),
    syntax: 0.65 * scale(averageSentenceWords, 6, 16) + 0.35 * scale(clauseDensity, 5, 12),
    speechRate: scale(wordsPerMinute, 120, 185),
    discourse: 0.6 * scale(lexicalDensity, 0.42, 0.58) + 0.4 * scale(typeTokenRatio, 0.25, 0.48),
  }
  const score = Object.entries(RUBRIC.weights).reduce((total, [name, weight]) => total + components[name] * weight * 100, 0)
  const metrics = {
    words: totalWords,
    uniqueWords: new Set(words).size,
    contentWords: contentWords.length,
    uniqueContentWords: uniqueContentWords.length,
    unknownContentWordRate: Number(unknownContentWordRate.toFixed(4)),
    subtitleCues: subtitles.length,
    averageCueWords: Number(averageSentenceWords.toFixed(2)),
    clauseDensityPer100Words: Number(clauseDensity.toFixed(2)),
    wordsPerMinute: Number(wordsPerMinute.toFixed(2)),
    lexicalDensity: Number(lexicalDensity.toFixed(4)),
    typeTokenRatio: Number(typeTokenRatio.toFixed(4)),
  }
  return {
    id: lesson.id,
    title: lesson.displayTitle,
    legacyLevel: lesson.levelCode,
    cefrLevel: levelForScore(score),
    score: Number(score.toFixed(2)),
    confidence: confidenceFor(metrics),
    components: Object.fromEntries(Object.entries(components).map(([name, value]) => [name, Number(value.toFixed(4))])),
    metrics,
  }
}

const catalog = JSON.parse((await readFile(COURSE_LIST_PATH, 'utf8')).replace(/^\uFEFF/, ''))
const { dictionary, lemmas } = await loadDictionary()
const assessments = []
for (const lesson of catalog.lessons) {
  const subtitlePath = new URL(`resource/${lesson.id}/subtitle.srt`, ROOT)
  const subtitles = parseSrt(await readFile(subtitlePath, 'utf8'))
  assessments.push(assessLesson(lesson, subtitles, dictionary, lemmas))
}

const result = {
  generatedAt: new Date().toISOString(),
  count: assessments.length,
  standard: {
    name: 'Council of Europe CEFR Companion Volume 2020',
    focus: 'listening comprehension descriptors',
    sources: [
      'https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors',
      'https://www.coe.int/en/web/common-european-framework-reference-languages/listening-comprehension',
    ],
  },
  methodology: RUBRIC,
  limitations: [
    'This is an auditable CEFR-aligned estimate from subtitles and timing, not an official CEFR certification or placement test.',
    'The dictionary frequency and Oxford flags are proxies; ECDICT is not a CEFR vocabulary inventory.',
    'A reliable CEFR placement should also use comprehension tasks, speaker/accent variation, and learner performance data.',
  ],
  levels: Object.fromEntries(CEFR_LEVELS.map((level) => [level, assessments.filter((item) => item.cefrLevel === level).length])),
  assessments,
}

if (process.argv.includes('--write')) {
  await writeFile(OUTPUT_PATH, JSON.stringify(result, null, 2) + '\n', 'utf8')
  console.log(`Wrote ${result.count} CEFR assessments to ${OUTPUT_PATH.pathname}`)
} else {
  const scores = assessments.map((item) => item.score).sort((a, b) => a - b)
  const percentile = (ratio) => scores[Math.min(scores.length - 1, Math.floor(scores.length * ratio))]
  console.log(JSON.stringify({
    levels: result.levels,
    scoreRange: { min: scores[0], p25: percentile(0.25), median: percentile(0.5), p75: percentile(0.75), max: scores.at(-1) },
    sample: assessments.slice(0, 5),
    hardest: [...assessments].sort((a, b) => b.score - a.score).slice(0, 5),
  }, null, 2))
}
