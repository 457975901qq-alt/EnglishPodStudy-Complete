import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

const tempDictDir = await mkdtemp(path.join(tmpdir(), 'englishpod-dict-'))
process.env.ENGLISHPOD_DICT_DIR = tempDictDir
await writeFile(
  path.join(tempDictDir, 'lookup.json'),
  JSON.stringify({
    hello: {
      word: 'hello',
      phonetic: 'həˈləʊ',
      pos: 'int',
      translation: 'int. 你好',
    },
    run: {
      word: 'run',
      phonetic: 'rʌn',
      pos: 'v:100',
      translation: 'vi. 跑; 运转',
    },
    go: {
      word: 'go',
      phonetic: 'ɡəʊ',
      pos: 'v',
      translation: 'vi. 去；走',
    },
    study: {
      word: 'study',
      phonetic: 'ˈstʌdi',
      pos: 'v; n',
      translation: '学习；研究',
    },
    weeks: {
      word: 'weeks',
      phonetic: 'wiːks',
      pos: 'n',
      translation: '威克斯（姓氏）',
    },
    week: {
      word: 'week',
      phonetic: 'wiːk',
      pos: 'n',
      translation: '星期；周',
    },
    buses: {
      word: 'buses',
      phonetic: '',
      pos: 'n',
      translation: '公共汽车（bus 的复数形式）',
    },
    buse: {
      word: 'buse',
      phonetic: '',
      pos: 'n',
      translation: '布斯（人名）',
    },
    bus: {
      word: 'bus',
      phonetic: 'bʌs',
      pos: 'n',
      translation: '公共汽车',
    },
    child: {
      word: 'child',
      phonetic: 'tʃaɪld',
      pos: 'n',
      translation: '孩子；儿童',
    },
    childs: {
      word: 'childs',
      phonetic: '',
      pos: 'n',
      translation: '蔡尔兹（人名）',
    },
    i: {
      word: 'I',
      phonetic: 'aɪ',
      pos: 'pron',
      translation: '我',
    },
    acoming: {
      word: 'a-coming',
      phonetic: '',
      pos: 'n',
      translation: '阿科姆（人名）',
    },
    they: {
      word: 'they',
      phonetic: 'ðeɪ',
      pos: 'pron',
      translation: '他们；它们',
    },
    have: {
      word: 'have',
      phonetic: 'hæv',
      pos: 'v',
      translation: '有；已经',
    },
    let: {
      word: 'let',
      phonetic: 'let',
      pos: 'v',
      translation: '让；允许',
    },
    us: {
      word: 'us',
      phonetic: 'ʌs',
      pos: 'pron',
      translation: '我们',
    },
    this: {
      word: 'this',
      phonetic: 'ðɪs',
      pos: 'pron',
      translation: '这；本',
    },
    thi: {
      word: 'thi',
      phonetic: '',
      pos: 'abbr',
      translation: '温度-湿度指数',
    },
    who: {
      word: 'who',
      phonetic: 'huː',
      pos: 'pron',
      translation: '谁',
    },
    is: {
      word: 'is',
      phonetic: 'ɪz',
      pos: 'v',
      translation: '是',
    },
    has: {
      word: 'has',
      phonetic: 'hæz',
      pos: 'v',
      translation: '有；已经',
    },
    would: {
      word: 'would',
      phonetic: 'wʊd',
      pos: 'v',
      translation: '将；会',
    },
    had: {
      word: 'had',
      phonetic: 'hæd',
      pos: 'v',
      translation: '有过；已经',
    },
  }),
)
await writeFile(
  path.join(tempDictDir, 'lemmas.json'),
  JSON.stringify({ ran: 'run', running: 'run', weeks: 'week', buses: 'bus', i: 'acoming' }),
)

const { createServer } = await import('./server.js')

const server = createServer()
server.listen(0, '127.0.0.1')
await once(server, 'listening')

const { port } = server.address()
const baseUrl = `http://127.0.0.1:${port}`

async function get(path, options) {
  return fetch(`${baseUrl}${path}`, options)
}

try {
  const coursesRes = await get('/api/courses')
  assert.equal(coursesRes.status, 200)
  const courses = await coursesRes.json()
  assert.equal(courses.count, 365)
  assert.equal(courses.lessons[0].id, '0001')

  const lessonRes = await get('/api/courses/0161')
  assert.equal(lessonRes.status, 200)
  const lesson = await lessonRes.json()
  assert.equal(lesson.id, '0161')
  assert.equal(lesson.title, 'Computer Games')

  const subtitlesRes = await get('/api/courses/0161/subtitles')
  assert.equal(subtitlesRes.status, 200)
  const subtitles = await subtitlesRes.json()
  assert.equal(subtitles[0].id, '1')
  assert.equal(subtitles[0].start, 0)
  assert.equal(subtitles[0].end, 5.16)
  assert.equal(subtitles[0].text, 'Hello everyone, welcome back to EnglishPod.')

  const bilingualRes = await get('/api/courses/0161/subtitles?mode=bilingual')
  assert.equal(bilingualRes.status, 200)
  const bilingualSubtitles = await bilingualRes.json()
  assert.equal(
    bilingualSubtitles[0].text,
    'Hello everyone, welcome back to EnglishPod.\n大家好，欢迎回到EnglishPod。',
  )

  const zhRes = await get('/api/courses/0161/subtitles?mode=zh')
  assert.equal(zhRes.status, 200)
  const zhSubtitles = await zhRes.json()
  assert.equal(zhSubtitles[0].text, '大家好，欢迎回到EnglishPod。')

  const offRes = await get('/api/courses/0161/subtitles?mode=off')
  assert.equal(offRes.status, 200)
  const offSubtitles = await offRes.json()
  assert.equal(offSubtitles[0].text, bilingualSubtitles[0].text)

  const invalidModeRes = await get('/api/courses/0161/subtitles?mode=../../course-list')
  assert.equal(invalidModeRes.status, 404)

  const dictRes = await get('/api/dict/hello')
  assert.equal(dictRes.status, 200)
  const dict = await dictRes.json()
  assert.equal(dict.found, true)
  assert.equal(dict.word, 'hello')
  assert.equal(dict.translation, 'int. 你好')

  const lemmaRes = await get('/api/dict/running')
  assert.equal(lemmaRes.status, 200)
  const lemma = await lemmaRes.json()
  assert.equal(lemma.found, true)
  assert.equal(lemma.word, 'run')
  assert.equal(lemma.matched, 'run')

  const heuristicLemmaRes = await get('/api/dict/goes')
  assert.equal(heuristicLemmaRes.status, 200)
  const heuristicLemma = await heuristicLemmaRes.json()
  assert.equal(heuristicLemma.found, true)
  assert.equal(heuristicLemma.word, 'go')
  assert.equal(heuristicLemma.matched, 'go')

  const iesLemmaRes = await get('/api/dict/studies')
  assert.equal(iesLemmaRes.status, 200)
  const iesLemma = await iesLemmaRes.json()
  assert.equal(iesLemma.found, true)
  assert.equal(iesLemma.word, 'study')
  assert.equal(iesLemma.matched, 'study')

  const ambiguousLemmaRes = await get('/api/dict/weeks')
  assert.equal(ambiguousLemmaRes.status, 200)
  const ambiguousLemma = await ambiguousLemmaRes.json()
  assert.equal(ambiguousLemma.found, true)
  assert.equal(ambiguousLemma.word, 'week')
  assert.equal(ambiguousLemma.translation, '星期；周')
  assert.equal(ambiguousLemma.matched, 'week')

  const pluralRes = await get('/api/dict/buses')
  assert.equal(pluralRes.status, 200)
  const plural = await pluralRes.json()
  assert.equal(plural.found, true)
  assert.equal(plural.word, 'bus')
  assert.equal(plural.translation, '公共汽车')

  const possessiveRes = await get("/api/dict/child's")
  assert.equal(possessiveRes.status, 200)
  const possessive = await possessiveRes.json()
  assert.equal(possessive.found, true)
  assert.equal(possessive.word, 'child')
  assert.equal(possessive.translation, '孩子；儿童')

  const exactWordRes = await get('/api/dict/i')
  assert.equal(exactWordRes.status, 200)
  const exactWord = await exactWordRes.json()
  assert.equal(exactWord.found, true)
  assert.equal(exactWord.word, 'I')
  assert.equal(exactWord.translation, '我')

  const contractionRes = await get("/api/dict/they've")
  assert.equal(contractionRes.status, 200)
  const contraction = await contractionRes.json()
  assert.equal(contraction.found, true)
  assert.equal(contraction.word, 'they have')
  assert.equal(contraction.translation, 'they have：他们；它们；有；已经')

  const letUsRes = await get("/api/dict/let's")
  assert.equal(letUsRes.status, 200)
  const letUs = await letUsRes.json()
  assert.equal(letUs.found, true)
  assert.equal(letUs.word, 'let us')

  const thisRes = await get('/api/dict/this')
  assert.equal(thisRes.status, 200)
  const thisWord = await thisRes.json()
  assert.equal(thisWord.found, true)
  assert.equal(thisWord.word, 'this')
  assert.equal(thisWord.translation, '这；本')

  const ambiguousRes = await get("/api/dict/who's")
  assert.equal(ambiguousRes.status, 200)
  const ambiguous = await ambiguousRes.json()
  assert.equal(ambiguous.found, true)
  assert.equal(ambiguous.word, 'who is / who has')
  assert.match(ambiguous.translation, /who is：谁；是/)
  assert.match(ambiguous.translation, /who has：谁；有；已经/)

  const missingWordRes = await get('/api/dict/notaword')
  assert.equal(missingWordRes.status, 200)
  const missingWord = await missingWordRes.json()
  assert.equal(missingWord.found, false)

  // Word audio must reject sentences so a dictionary click can never play a
  // full subtitle line through this endpoint.
  const sentenceAudioRes = await get('/api/dict-audio/a%20full%20sentence')
  assert.equal(sentenceAudioRes.status, 404)

  const audioRes = await get('/api/resources/0161/lesson.mp3')
  assert.equal(audioRes.status, 200)
  assert.equal(audioRes.headers.get('content-type'), 'audio/mpeg')
  assert.ok(Number(audioRes.headers.get('content-length')) > 1000)
  assert.equal(audioRes.headers.get('accept-ranges'), 'bytes')
  assert.ok(audioRes.headers.get('etag'))

  const headRes = await get('/api/resources/0161/lesson.mp3', { method: 'HEAD' })
  assert.equal(headRes.status, 200)
  assert.equal(await headRes.text(), '')

  const suffixRes = await get('/api/resources/0161/lesson.mp3', {
    headers: { range: 'bytes=-100' },
  })
  assert.equal(suffixRes.status, 206)
  assert.equal(suffixRes.headers.get('content-length'), '100')
  assert.match(suffixRes.headers.get('content-range'), /^bytes \d+-\d+\/\d+$/)
  assert.equal((await suffixRes.arrayBuffer()).byteLength, 100)

  const missingAssetRes = await get('/assets/missing.js')
  assert.equal(missingAssetRes.status, 404)

  const spaRes = await get('/courses/not-a-real-route', {
    headers: { accept: 'text/html' },
  })
  assert.equal(spaRes.status, 200)

  const traversalRes = await get('/api/resources/0161/../course-list.json')
  assert.equal(traversalRes.status, 404)
} finally {
  server.close()
  await rm(tempDictDir, { recursive: true, force: true })
}
