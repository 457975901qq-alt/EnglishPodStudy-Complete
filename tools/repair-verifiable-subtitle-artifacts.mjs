import { readFile, writeFile } from 'node:fs/promises'

// These ranges are source-verifiable non-speech outro artefacts.  Each follows the
// hosts' spoken sign-off and either contains garbled speech recognition or stretches
// "Bye" over the outro music.  Keep the subtitle explicit instead of presenting
// invented words to learners.
const repairs = [
  ['0036', 231, 231],
  ['0058', 371, 371],
  ['0099', 352, 352],
  ['0181', 243, 243],
  ['0214', 304, 304],
  ['0274', 242, 242],
  ['0289', 308, 308],
  ['0313', 199, 199],
  ['0319', 273, 277],
  ['0333', 323, 323],
  ['0344', 279, 279],
  ['0354', 293, 293],
]

// The source subtitles use a final repeated "Bye" cue for instrumental outro
// audio.  The course's prior sign-off remains intact; only the long final cue
// is normalised to music.  These are resolved dynamically because earlier
// source repairs can change cue counts.
const trailingGoodbyeMusicCourses = new Set([
  '0015', '0031', '0057', '0072', '0075', '0096', '0152', '0167', '0199',
  '0205', '0233', '0240', '0241', '0249', '0301', '0307', '0309', '0312',
  '0330', '0342', '0364',
])

// The 0004 host PDF supplies the canonical wording for this damaged vocabulary
// section.  The old subtitles had a repeated "money" loop followed by nonsense,
// including Japanese text, despite the audio being about "understaffed".
const sourceTextRepairs = [{
  course: '0004',
  start: 59,
  end: 87,
  english: [
    "Okay, I've chosen another interesting word for you, and that's understaffed.",
    'Understaffed.',
    'Understaffed.',
    'Understaffed.',
    "Now, understaffed means that they don't have enough people working there.",
    "They don't have enough workers.",
    "Right, they don't have enough employees.",
    'Perfect! Okay, um, the next one is timing is just not right.',
    'The timing is just not right.',
    'The timing is just not right.',
    'The timing is just not right.',
    "Okay, let's listen to how we can use this entire phrase in a different situation,",
  ],
  chinese: [
    '好的，我为大家选的另一个有趣的词是 understaffed（人手不足）。',
    '人手不足。',
    '人手不足。',
    '人手不足。',
    '人手不足的意思是那里没有足够的人工作。',
    '他们没有足够的工作人员。',
    '对，他们没有足够的员工。',
    '很好。下一个是“时机不对”。',
    '时机不对。',
    '时机不对。',
    '时机不对。',
    '现在我们来听听这个完整短语在另一种情境中的用法，',
  ],
}]

function parseTime(value) {
  const [hours, minutes, seconds] = value.replace(',', '.').split(':')
  return Math.round((Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds)) * 1_000)
}

function formatTime(milliseconds) {
  const total = Math.max(0, Math.round(milliseconds))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1_000)
  const millis = total % 1_000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

function parseSrt(source) {
  return source.trim().split(/\r?\n\r?\n/).map((block) => {
    const lines = block.trim().split(/\r?\n/)
    const timeIndex = lines.findIndex((line) => line.includes(' --> '))
    const [start, end] = lines[timeIndex].split(' --> ')
    return { start: parseTime(start), end: parseTime(end), text: lines.slice(timeIndex + 1).join('\n') }
  })
}

function renderSrt(entries) {
  return `${entries.map((entry, index) => `${index + 1}\n${formatTime(entry.start)} --> ${formatTime(entry.end)}\n${entry.text}`).join('\n\n')}\n`
}

function applyRepair(entries, start, end, text) {
  const first = entries[start - 1]
  const last = entries[end - 1]
  entries.splice(start - 1, end - start + 1, { start: first.start, end: last.end, text })
}

function applyTextRepair(entries, start, end, texts) {
  const first = entries[start - 1]
  const last = entries[end - 1]
  const duration = last.end - first.start
  entries.splice(start - 1, end - start + 1, ...texts.map((text, index) => ({
    start: first.start + (duration * index) / texts.length,
    end: first.start + (duration * (index + 1)) / texts.length,
    text,
  })))
}

for (const [course, start, end] of repairs) {
  const folder = `resource/${course}`
  const [englishSource, chineseSource, transcriptSource] = await Promise.all([
    readFile(`${folder}/subtitle.srt`, 'utf8'),
    readFile(`${folder}/subtitle.zh.srt`, 'utf8'),
    readFile(`${folder}/transcript.txt`, 'utf8'),
  ])
  const english = parseSrt(englishSource)
  const chinese = parseSrt(chineseSource)
  const transcript = transcriptSource.trimEnd().split(/\r?\n/)
  const originalEnglish = english.slice(start - 1, end).map((entry) => entry.text).join(' ')

  if (/^\[Music\]$/u.test(originalEnglish)) {
    console.log(`${course} ${start}-${end} already repaired; skipped.`)
    continue
  }

  applyRepair(english, start, end, '[Music]')
  applyRepair(chinese, start, end, '【音乐】')
  transcript.splice(start - 1, end - start + 1, '[Music]')
  const bilingual = english.map((entry, index) => ({ ...entry, text: `${entry.text}\n${chinese[index].text}` }))

  await Promise.all([
    writeFile(`${folder}/subtitle.srt`, renderSrt(english)),
    writeFile(`${folder}/subtitle.zh.srt`, renderSrt(chinese)),
    writeFile(`${folder}/subtitle.bilingual.srt`, renderSrt(bilingual)),
    writeFile(`${folder}/transcript.txt`, `${transcript.join('\n')}\n`),
  ])
}

for (const course of trailingGoodbyeMusicCourses) {
  const folder = `resource/${course}`
  const [englishSource, chineseSource, transcriptSource] = await Promise.all([
    readFile(`${folder}/subtitle.srt`, 'utf8'),
    readFile(`${folder}/subtitle.zh.srt`, 'utf8'),
    readFile(`${folder}/transcript.txt`, 'utf8'),
  ])
  const english = parseSrt(englishSource)
  const chinese = parseSrt(chineseSource)
  const transcript = transcriptSource.trimEnd().split(/\r?\n/)
  const lastIndex = english.length - 1

  if (english[lastIndex].text === '[Music]') {
    console.log(`${course} outro already repaired; skipped.`)
    continue
  }
  if (!/^bye[.!]?$/iu.test(english[lastIndex].text) || !/^bye[.!]?$/iu.test(english[lastIndex - 1]?.text ?? '')) {
    throw new Error(`${course}: expected a repeated goodbye before the music outro`)
  }

  english[lastIndex].text = '[Music]'
  chinese[lastIndex].text = '【音乐】'
  transcript[lastIndex] = '[Music]'
  const bilingual = english.map((entry, index) => ({ ...entry, text: `${entry.text}\n${chinese[index].text}` }))
  await Promise.all([
    writeFile(`${folder}/subtitle.srt`, renderSrt(english)),
    writeFile(`${folder}/subtitle.zh.srt`, renderSrt(chinese)),
    writeFile(`${folder}/subtitle.bilingual.srt`, renderSrt(bilingual)),
    writeFile(`${folder}/transcript.txt`, `${transcript.join('\n')}\n`),
  ])
}

for (const { course, start, end, english: englishTexts, chinese: chineseTexts } of sourceTextRepairs) {
  const folder = `resource/${course}`
  const [englishSource, chineseSource, transcriptSource] = await Promise.all([
    readFile(`${folder}/subtitle.srt`, 'utf8'),
    readFile(`${folder}/subtitle.zh.srt`, 'utf8'),
    readFile(`${folder}/transcript.txt`, 'utf8'),
  ])
  const english = parseSrt(englishSource)
  const chinese = parseSrt(chineseSource)
  const transcript = transcriptSource.trimEnd().split(/\r?\n/)

  if (english[start - 1]?.text === englishTexts[0]) {
    console.log(`${course} ${start}-${end} already repaired; skipped.`)
    continue
  }

  applyTextRepair(english, start, end, englishTexts)
  applyTextRepair(chinese, start, end, chineseTexts)
  transcript.splice(start - 1, end - start + 1, ...englishTexts)
  const bilingual = english.map((entry, index) => ({ ...entry, text: `${entry.text}\n${chinese[index].text}` }))

  await Promise.all([
    writeFile(`${folder}/subtitle.srt`, renderSrt(english)),
    writeFile(`${folder}/subtitle.zh.srt`, renderSrt(chinese)),
    writeFile(`${folder}/subtitle.bilingual.srt`, renderSrt(bilingual)),
    writeFile(`${folder}/transcript.txt`, `${transcript.join('\n')}\n`),
  ])
}

console.log(`Repaired ${repairs.length} source-verifiable outro subtitle artefacts and ${sourceTextRepairs.length} host-script section.`)
