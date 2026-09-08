import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

function parseSrt(source) {
  return source.trim().split(/\r?\n\r?\n/).map((block) => {
    const [number, time, ...lines] = block.split(/\r?\n/)
    return { number: Number(number), time, text: lines.join('\n') }
  })
}

function timestampToMilliseconds(value) {
  const [hours, minutes, secondsAndMilliseconds] = value.split(':')
  const [seconds, milliseconds] = secondsAndMilliseconds.split(',')
  return ((Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds)) * 1000) + Number(milliseconds)
}

const [englishSource, chineseSource, bilingualSource, transcript, chineseTranscript] = await Promise.all([
  readFile('resource/0030/subtitle.srt', 'utf8'),
  readFile('resource/0030/subtitle.zh.srt', 'utf8'),
  readFile('resource/0030/subtitle.bilingual.srt', 'utf8'),
  readFile('resource/0030/transcript.txt', 'utf8'),
  readFile('resource/0030/transcript.zh.txt', 'utf8'),
])

const english = parseSrt(englishSource)
const chinese = parseSrt(chineseSource)
const bilingual = parseSrt(bilingualSource)

assert.equal(english.length, 264)
assert.equal(chinese.length, english.length)
assert.equal(bilingual.length, english.length)

for (let index = 0; index < english.length; index += 1) {
  const englishCue = english[index]
  const chineseCue = chinese[index]
  const bilingualCue = bilingual[index]
  assert.equal(englishCue.number, index + 1)
  assert.equal(chineseCue.number, index + 1)
  assert.equal(bilingualCue.number, index + 1)
  assert.equal(chineseCue.time, englishCue.time)
  assert.equal(bilingualCue.time, englishCue.time)
  assert.equal(bilingualCue.text, `${englishCue.text}\n${chineseCue.text}`)

  const [start, end] = englishCue.time.split(' --> ').map(timestampToMilliseconds)
  assert.ok(start < end, `cue ${englishCue.number} has an invalid time range`)
  if (index > 0) {
    const previousStart = timestampToMilliseconds(english[index - 1].time.split(' --> ')[0])
    assert.ok(start >= previousStart, `cue ${englishCue.number} starts before the preceding cue`)
  }
}

const dialogue = english.slice(21, 60)
  .filter((cue) => cue.text !== '[Music]')
  .map((cue) => cue.text)
  .join(' ')
  .replace(/\s+/g, ' ')

assert.equal(
  dialogue,
  "Oh, Armand, thank you for such a thoughtful invitation. It's really very nice of you to invite us over for dinner. Don't you think so, Ellen? Oh, yes, of course. We'd love to come over. Can I bring anything? No, don't worry about it. I'll take care of everything. I'll see you tonight. Come with an appetite. I know I will. I don't want to go over to his place for dinner. He gives me the creeps. Why on earth did you accept? Oh, come on, Ellen. It'll be nice to get to know him. Besides, he's new to the neighborhood, and it would be rude to decline his invitation. I guess so. You always rope me into things like this! Ladies! Thank you for coming. You look delicious. I mean beautiful. Please come in. Oh, Armand, you are too kind. How did I get myself into this? Wow, I'm really anxious to see what happens in this dinner party. Yeah, I guess we'll have to stay tuned and find out. For part three. Yeah.",
)
assert.equal(english[21].time, '00:00:45,680 --> 00:00:48,879')
assert.equal(english[48].text, 'Ladies!')
assert.equal(english[53].text, 'Oh, Armand, you are too kind.')
assert.equal(english[59].time, '00:02:27,040 --> 00:02:28,040')

for (const source of [englishSource, chineseSource, bilingualSource, transcript, chineseTranscript]) {
  assert.doesNotMatch(source, /\bArman\b/)
  assert.doesNotMatch(source, /Arlond/)
  assert.doesNotMatch(source, /wrote me into/)
  assert.doesNotMatch(source, /He'll be rude/)
}
assert.match(transcript, /You always rope me into things like this!/)
assert.match(chineseTranscript, /你总是把我拉进这种事里！/)

console.log('course 0030 subtitle checks passed')
