import { readFile, writeFile } from 'node:fs/promises'

// Each entry was checked against the bundled host script and a local
// Whisper large-v3-turbo transcription of resource/<course>/lesson.mp3.
// Keep the audio-derived timestamps rather than distributing text across the
// corrupt range: these are learner-facing, time-synchronised subtitles.
const repairs = [{
  course: '0046',
  start: 80,
  end: 108,
  entries: [
    [186700, 187720, "Okay, what's happening?", '好了，发生什么事了？'],
    [188220, 190100, 'The patient is in acute respiratory failure.', '病人处于急性呼吸衰竭状态。'],
    [190200, 191520, "I think we're going to have to intubate.", '我想我们得给他插管了。'],
    [192180, 192760, 'All right.', '好的。'],
    [193040, 193580, "Tube's in.", '管子插好了。'],
    [193820, 194140, 'Bag him.', '给他捏气囊。'],
    [194440, 196340, "Somebody give him 10 cc's shot of adrenaline.", '谁给他注射 10 毫升肾上腺素。'],
    [196780, 198700, 'Let\'s go, people, move, move!', '快，大家动起来，快，快！'],
    [205580, 207460, 'Doctor, oh thank God!', '医生，哦，谢天谢地！'],
    [207660, 208840, 'How is he?', '他怎么样了？'],
    [209400, 213220, "We've managed to stabilize Frankie, but he's not out of the woods yet.", '我们设法稳定了弗兰基的情况，但他还没有脱离危险。'],
    [213820, 215340, "He's still in critical condition.", '他仍然处于危急状态。'],
    [215860, 218240, "We're moving him to intensive care, but...", '我们正要把他转到重症监护室，但是……'],
    [219140, 221140, 'Doctor, just do whatever it takes.', '医生，请不惜一切代价。'],
    [221440, 223260, 'I just want my little Frankie to be okay.', '我只想让我的小弗兰基没事。'],
    [223900, 226960, "I couldn't imagine life without my little hamster.", '我无法想象没有我的小仓鼠的生活。'],
  ],
}]

function parseTime(value) {
  const [hours, minutes, seconds] = value.replace(',', '.').split(':')
  return Math.round((Number(hours) * 3_600 + Number(minutes) * 60 + Number(seconds)) * 1_000)
}

function formatTime(milliseconds) {
  const total = Math.round(milliseconds)
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

for (const { course, start, end, entries: sourceEntries } of repairs) {
  const folder = `resource/${course}`
  const [englishSource, chineseSource, transcriptSource] = await Promise.all([
    readFile(`${folder}/subtitle.srt`, 'utf8'),
    readFile(`${folder}/subtitle.zh.srt`, 'utf8'),
    readFile(`${folder}/transcript.txt`, 'utf8'),
  ])
  const english = parseSrt(englishSource)
  const chinese = parseSrt(chineseSource)
  const transcript = transcriptSource.trimEnd().split(/\r?\n/)
  const replacement = sourceEntries.map(([entryStart, entryEnd, englishText, chineseText]) => ({ entryStart, entryEnd, englishText, chineseText }))

  const alreadyRepaired = english.slice(start - 1, start - 1 + replacement.length).every((entry, index) => (
    entry.start === replacement[index].entryStart && entry.end === replacement[index].entryEnd && entry.text === replacement[index].englishText
  ))
  if (alreadyRepaired) {
    console.log(`${course} ${start}-${end} already repaired; skipped.`)
    continue
  }

  english.splice(start - 1, end - start + 1, ...replacement.map(({ entryStart, entryEnd, englishText }) => ({ start: entryStart, end: entryEnd, text: englishText })))
  chinese.splice(start - 1, end - start + 1, ...replacement.map(({ entryStart, entryEnd, chineseText }) => ({ start: entryStart, end: entryEnd, text: chineseText })))
  transcript.splice(start - 1, end - start + 1, ...replacement.map(({ englishText }) => englishText))
  const bilingual = english.map((entry, index) => ({ ...entry, text: `${entry.text}\n${chinese[index].text}` }))

  await Promise.all([
    writeFile(`${folder}/subtitle.srt`, renderSrt(english)),
    writeFile(`${folder}/subtitle.zh.srt`, renderSrt(chinese)),
    writeFile(`${folder}/subtitle.bilingual.srt`, renderSrt(bilingual)),
    writeFile(`${folder}/transcript.txt`, `${transcript.join('\n')}\n`),
  ])
}

console.log(`Repaired ${repairs.length} local-Whisper-confirmed subtitle range.`)
