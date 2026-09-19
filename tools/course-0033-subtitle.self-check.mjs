import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

function parseTime(value) {
  const [hours, minutes, secondsAndMilliseconds] = value.split(':')
  const [seconds, milliseconds] = secondsAndMilliseconds.split(',')
  return ((Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds)) * 1_000) + Number(milliseconds)
}

function parseSrt(source) {
  return source.trim().split(/\r?\n\r?\n/).map((block) => {
    const [id, timing, ...lines] = block.trim().split(/\r?\n/)
    const [start, end] = timing.split(' --> ').map(parseTime)
    return { id: Number(id), start, end, text: lines.join('\n') }
  })
}

const [englishSource, chineseSource, bilingualSource, transcript] = await Promise.all([
  readFile('resource/0033/subtitle.srt', 'utf8'),
  readFile('resource/0033/subtitle.zh.srt', 'utf8'),
  readFile('resource/0033/subtitle.bilingual.srt', 'utf8'),
  readFile('resource/0033/transcript.txt', 'utf8'),
])

const english = parseSrt(englishSource)
const chinese = parseSrt(chineseSource)
const bilingual = parseSrt(bilingualSource)

assert.equal(english.length, 224)
assert.equal(chinese.length, english.length)
assert.equal(bilingual.length, english.length)
assert.equal(english[38].start, 80_320)
assert.equal(english[58].end, 132_199)
assert.equal(english[59].start, 132_199)
assert.equal(english.at(-1)?.end, 536_529)

for (let index = 0; index < english.length; index += 1) {
  const cue = english[index]
  assert.equal(cue.id, index + 1)
  assert.equal(chinese[index].id, cue.id)
  assert.equal(bilingual[index].id, cue.id)
  assert.equal(chinese[index].start, cue.start)
  assert.equal(chinese[index].end, cue.end)
  assert.equal(bilingual[index].start, cue.start)
  assert.equal(bilingual[index].end, cue.end)
  assert.equal(bilingual[index].text, `${cue.text}\n${chinese[index].text}`)
  assert.ok(cue.start < cue.end, `cue ${cue.id} has an invalid time range`)
  if (index > 0) assert.ok(cue.start >= english[index - 1].end, `cue ${cue.id} overlaps the preceding cue`)
}

assert.match(transcript, /^Hello English learners, welcome back to EnglishPod\.$/m)
assert.match(transcript, /^All right, I'm going to make a beer run\.$/m)
assert.match(transcript, /^All right, a really common situation whenever you're watching games with friends, right\?$/m)

console.log('course 0033 subtitle timing checks passed')
