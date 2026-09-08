import { readFile, writeFile } from 'node:fs/promises'

// Verified against public EnglishPod dialogue sheets and time-matched lesson audio.
// A replacement may cover music or incidental sound when the original source has no speech.
const repairs = [
  ['0009', 216, 246, ['[Music]'], ['【音乐】']],
  ['0015', 223, 237, ["Oh, I don't know."], ['哦，我不知道。']],
  ['0049', 58, 69, [
    'Smelly Toes is playing, and Eric asked if I would go with him.',
    "Who's this Eric guy?",
    "Duh. He's like the hottest and most popular guy at school.",
    'Come on, Dad, please!',
    'No can do. Sorry.',
    'Fine then.',
    'Would you mind giving me 100 bucks?',
    'No way.',
    "Ugh, that's so unfair.",
    '[Music]',
  ], [
    'Smelly Toes 乐队正在演出，Eric 邀请我和他一起去。',
    '这个 Eric 是谁？',
    '拜托，他是学校里最帅、最受欢迎的男生。',
    '求你了，爸爸！',
    '办不到，抱歉。',
    '好吧。',
    '那你介意给我一百美元吗？',
    '不行。',
    '唉，这太不公平了。',
    '【音乐】',
  ]],
  ['0057', 297, 310, ['[Office machine noises]'], ['【办公室设备声】']],
  ['0074', 91, 99, [
    'Be cool.',
    'Be cool.',
    'Just take a fork and eat your salad.',
  ], [
    '冷静。',
    '冷静。',
    '拿起叉子，吃你的沙拉就好。',
  ]],
  ['0075', 205, 216, ['[Dental treatment sounds]'], ['【牙科治疗器械声】']],
  ['0091', 59, 74, [
    'To play God with our fate?',
    'Silence, human.',
    'You wield a belligerent attitude that has caused years of pain and anguish among yourselves.',
    'Now you will pay the price.',
  ], [
    '来主宰我们的命运？',
    '住口，人类。',
    '你们的好战态度，给自己带来了多年的痛苦与折磨。',
    '现在你们要付出代价。',
  ]],
  ['0128', 412, 425, ['[Music]'], ['【音乐】']],
  ['0128', 462, 483, ['[Music]'], ['【音乐】']],
  ['0130', 314, 323, [
    'Are you looking to develop strength or muscle tone and definition?',
    "Well, I don't want to be ripped like you.",
    'I just want a good physique with weights and cardio.',
    'In that case, you want to work with less weight.',
    'You can start off by working 10 to 15 reps and four sets.',
    'Five-kilo weight should be enough.',
    'Now, it is very important that you stretch before pumping iron.',
    'You might pull a muscle.',
    'Got it.',
    "Wow, is that the weight you're lifting?",
  ], [
    '你是想增强力量，还是想练出紧实、有线条的肌肉？',
    '嗯，我不想像你一样练得那么壮。',
    '我只想通过力量和有氧训练保持好身材。',
    '那样的话，你应该用较轻的重量。',
    '可以从每组 10 到 15 次、共四组开始。',
    '五公斤的重量应该够了。',
    '现在很重要的是：举铁前要先拉伸。',
    '不然你可能会拉伤肌肉。',
    '明白了。',
    '哇，你举的是这个重量吗？',
  ]],
  ['0132', 68, 80, ["I don't know."], ['我不知道。']],
  ['0135', 331, 352, [
    "Maybe it's just that he's stressed out from working or something.",
    'He does have a pretty nerve-wracking job, you know.',
    "Yeah, but he's always in a really foul mood.",
    "I tried to find out what's bothering him or get him to talk about his day, but he always shuts down and brushes me off.",
    'Men are like that, you know.',
    'They can feel nervous, anxious, or on edge, and the only way they can express it is by trying to hide it through aggressiveness.',
  ], [
    '也许只是工作压力太大，或是别的什么原因。',
    '你知道，他的工作确实很让人紧张。',
    '是，但他的心情总是很糟。',
    '我试着问他烦什么，或让他聊聊一天的情况，但他总是沉默，还把我打发走。',
    '男人就是这样，你知道。',
    '他们会紧张、焦虑、坐立不安，却往往用攻击性来掩饰。',
  ]],
  ['0142', 199, 209, [
    'I need your help.',
    'What is it?',
    'Why are all these clothes on the bed?',
    "I don't know what to wear.",
    'Okay. Give me your opinion.',
    'Do you like the way this looks?',
  ], [
    '我需要你帮忙。',
    '怎么了？',
    '为什么床上堆了这么多衣服？',
    '我不知道该穿什么。',
    '好，告诉我你的看法。',
    '你觉得这样穿怎么样？',
  ]],
  ['0150', 23, 34, [
    'Do you have any bug spray?',
    'No, I forgot to buy some.',
    "Then we'll have to put up with it.",
    'We can cover ourselves with beer.',
    "That way, if they bite us, they'll get drunk and fall asleep.",
    "That's, without doubt, the best idea you've ever had.",
    "Let's do it.",
    'Run!',
    "They're thirsty for more.",
  ], [
    '你有驱虫喷雾吗？',
    '没有，我忘了买。',
    '那我们只能忍着了。',
    '我们可以把啤酒涂在身上。',
    '这样它们咬我们后会喝醉，然后睡着。',
    '毫无疑问，这是你想过的最好的主意。',
    '就这么干。',
    '快跑！',
    '它们还想再来一口。',
  ]],
  ['0170', 286, 316, [
    '[Music]',
    "Man, I'm freaking out. You've got to help me.",
    'Whoa, whoa, take it easy. Relax.',
    "Jeez, you're sweating like a pig. What's going on?",
    "I can't go through with this. I just can't.",
    "I'm not ready for marriage. What was I thinking?",
    "I'm only 35 years old.",
    "I've got my entire life ahead of me.",
    'Adventures waiting.',
    "I can't settle down yet.",
    'What are you talking about?',
    "It wasn't more than a month ago that you were rambling on about how you are tired of living the life of a bachelor and how you envy your friends that have a family.",
  ], [
    '【音乐】',
    '天啊，我快崩溃了。你得帮帮我。',
    '喂，喂，别急，放松。',
    '天哪，你汗流浃背的。怎么了？',
    '我不能把这事办下去，真的不行。',
    '我还没准备好结婚。我当时在想什么？',
    '我才三十五岁。',
    '我的整个人生还在前面。',
    '还有冒险在等着我。',
    '我还不能安定下来。',
    '你在说什么？',
    '一个多月前，你还一直说厌倦了单身生活，羡慕那些有家庭的朋友。',
  ]],
  ['0183', 216, 224, ['I can’t breathe.'], ['我喘不过气来了。']],
  ['0217', 168, 175, ['Don’t be like that, Judy.', 'I really miss your home cooking.'], ['别这样，Judy。', '我真的很想念你做的家常菜。']],
  ['0344', 11, 18, ['[Music]'], ['【音乐】']],
  ['0352', 213, 227, [
    'The entire complex is made of white marble.',
    'And in the interior of the tomb, the walls are covered with gems and emeralds.',
    'Cool.',
    'Also amongst the winners is Petra in Jordan, Machu Picchu in Peru,',
    'and the pyramid in Chichen Itza in Mexico.',
    'Wait a minute.',
    'It also says that the Christ the Redeemer statue in Brazil',
    'and the Colosseum in Rome are wonders.',
    'I would love to go to Italy and see the Colosseum.',
    'Stand in the middle like a gladiator.',
    "Well, let's see if we can find some cheap airfare,",
    'and we can go towards the end of the year.',
    'Good idea.',
  ], [
    '整座建筑群都由白色大理石建成。',
    '在陵墓内部，墙壁上镶满了宝石和祖母绿。',
    '真酷。',
    '获选的还有约旦的佩特拉、秘鲁的马丘比丘，',
    '以及墨西哥奇琴伊察的金字塔。',
    '等等。',
    '上面还说，巴西的基督救世主像',
    '和罗马斗兽场也是奇迹。',
    '我很想去意大利看看斗兽场。',
    '像角斗士一样站在中央。',
    '我们看看能不能找到便宜机票，',
    '年底时一起去。',
    '好主意。',
  ]],
]

function parseTime(value) {
  const [hours, minutes, seconds] = value.replace(',', '.').split(':')
  return Math.round((Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds)) * 1000)
}

function formatTime(milliseconds) {
  const total = Math.max(0, Math.round(milliseconds))
  const hours = Math.floor(total / 3_600_000)
  const minutes = Math.floor((total % 3_600_000) / 60_000)
  const seconds = Math.floor((total % 60_000) / 1000)
  const millis = total % 1000
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(millis).padStart(3, '0')}`
}

function parseSrt(source) {
  return source.trim().split(/\r?\n\r?\n/).map((block) => {
    const lines = block.trim().split(/\r?\n/)
    const timeLine = lines.find((line) => line.includes(' --> '))
    if (!timeLine) throw new Error(`Subtitle block is missing a time range: ${block.slice(0, 80)}`)
    const [start, end] = timeLine.split(' --> ')
    return { start: parseTime(start), end: parseTime(end), text: lines.slice(2).join('\n') }
  })
}

function renderSrt(entries) {
  return `${entries.map((entry, index) => `${index + 1}\n${formatTime(entry.start)} --> ${formatTime(entry.end)}\n${entry.text}`).join('\n\n')}\n`
}

function entriesForRange(first, last, texts) {
  const start = first.start
  const end = last.end
  return texts.map((text, index) => ({
    start: start + ((end - start) * index) / texts.length,
    end: start + ((end - start) * (index + 1)) / texts.length,
    text,
  }))
}

function applySrtRepair(entries, start, end, texts) {
  const replacement = entriesForRange(entries[start - 1], entries[end - 1], texts)
  entries.splice(start - 1, end - start + 1, ...replacement)
}

function applyTranscriptRepair(lines, start, end, texts) {
  lines.splice(start - 1, end - start + 1, ...texts)
}

const grouped = new Map()
for (const repair of repairs) {
  const [course] = repair
  grouped.set(course, [...(grouped.get(course) ?? []), repair])
}

for (const [course, courseRepairs] of grouped) {
  if (process.env.REPAIR_COURSE_AFTER && course < process.env.REPAIR_COURSE_AFTER) continue
  const folder = `resource/${course}`
  const [englishSource, chineseSource, transcriptSource] = await Promise.all([
    readFile(`${folder}/subtitle.srt`, 'utf8'),
    readFile(`${folder}/subtitle.zh.srt`, 'utf8'),
    readFile(`${folder}/transcript.txt`, 'utf8'),
  ])
  const english = parseSrt(englishSource)
  const chinese = parseSrt(chineseSource)
  const transcript = transcriptSource.trimEnd().split(/\r?\n/)

  for (const [, start, end, englishTexts, chineseTexts] of [...courseRepairs].sort((a, b) => b[1] - a[1])) {
    if (englishTexts.length !== chineseTexts.length) throw new Error(`${course} replacement length mismatch`)
    const originalRange = english.slice(start - 1, end)
    let longestRepeat = 0
    let currentRepeat = 0
    let previousText = null
    for (const entry of originalRange) {
      currentRepeat = entry.text === previousText ? currentRepeat + 1 : 1
      longestRepeat = Math.max(longestRepeat, currentRepeat)
      previousText = entry.text
    }
    const isUnrepairedDuplicate = longestRepeat >= 8
    if (!isUnrepairedDuplicate) {
      console.log(`${course} ${start}-${end} already repaired; skipped.`)
      continue
    }
    applySrtRepair(english, start, end, englishTexts)
    applySrtRepair(chinese, start, end, chineseTexts)
    applyTranscriptRepair(transcript, start, end, englishTexts)
  }

  const bilingual = english.map((entry, index) => ({ ...entry, text: `${entry.text}\n${chinese[index].text}` }))
  await Promise.all([
    writeFile(`${folder}/subtitle.srt`, renderSrt(english)),
    writeFile(`${folder}/subtitle.zh.srt`, renderSrt(chinese)),
    writeFile(`${folder}/subtitle.bilingual.srt`, renderSrt(bilingual)),
    writeFile(`${folder}/transcript.txt`, `${transcript.join('\n')}\n`),
  ])
}

console.log(`Repaired ${repairs.length} confirmed subtitle-corruption ranges across ${grouped.size} lessons.`)
