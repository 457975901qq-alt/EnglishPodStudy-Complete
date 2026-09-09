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
}, {
  course: '0099',
  start: 304,
  end: 332,
  entries: [
    [711520, 712480, 'Come on, Dave.', '得了吧，戴夫。'],
    [712600, 713800, "It's a G-rated movie.", '这是一部 G 级电影。'],
    [714120, 715160, "It's for the kids.", '这是给孩子们看的。'],
    [715380, 716480, "It's not a thriller.", '它不是惊悚片。'],
    [716760, 717680, "Well, that's just it.", '问题就在这里。'],
    [718260, 720000, 'It did have some very dramatic and intense scenes.', '它确实有一些非常戏剧化和紧张的场景。'],
    [720000, 724560, 'For example, when Mufasa dies, or the dark, grim portrayal of Scar.', '例如，木法沙去世时，或者对刀疤黑暗阴森的刻画。'],
    [725140, 727020, 'Even so, the film is linear.', '即便如此，这部电影的情节还是线性的。'],
    [727580, 730180, "Mufasa dies, Simba runs away thinking it's his fault,", '木法沙死了，辛巴以为是自己的错而逃走，'],
    [730660, 732740, "falls in love and returns to retake what's rightfully his.", '随后坠入爱河，又回来夺回本该属于他的东西。'],
    [732920, 733900, "It's just too cliche.", '这实在太老套了。'],
    [734820, 736940, "How can it be cliche? It's a fable.", '怎么会老套呢？这是一个寓言。'],
    [737540, 739220, "It's telling a time-honored story.", '它讲述的是一个经久不衰的故事。'],
    [739680, 742740, 'The movie makes a point of how the hunger of power leads to corruption', '电影强调了对权力的渴望如何导致腐败，'],
    [742740, 746660, 'and teaches children of the value of respect, life, and love.', '并教导孩子们尊重、生命和爱的价值。'],
    [746940, 749500, 'You have always been so soft, Dick.', '你一直都这么心软，迪克。'],
    [750000, 754340, "Open your heart, Dave. Don't shut us out.", '敞开心扉吧，戴夫。不要把我们拒之门外。'],
    [754620, 756220, "Anyway, that's all for today, folks.", '总之，各位，今天就到这里。'],
    [756640, 759180, 'Join us next time as we talk about how to lose a guy in 10 days.', '下次请继续收听，我们将聊聊如何在十天内甩掉一个男人。'],
    [759440, 760840, "I'm sure you'll love that one, Dick.", '我相信你会喜欢那一部的，迪克。'],
    [764500, 765900, 'All right, so a good movie.', '好了，所以这是一部好电影。'],
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
