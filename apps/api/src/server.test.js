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
  }),
)
await writeFile(path.join(tempDictDir, 'lemmas.json'), JSON.stringify({ ran: 'run', running: 'run' }))

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

  const missingWordRes = await get('/api/dict/notaword')
  assert.equal(missingWordRes.status, 200)
  const missingWord = await missingWordRes.json()
  assert.equal(missingWord.found, false)

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
