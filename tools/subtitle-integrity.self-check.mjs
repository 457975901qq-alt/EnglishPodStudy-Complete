import { readdir, readFile } from 'node:fs/promises'

function parseSrt(source) {
  return source.trim().split(/\r?\n\r?\n/).map((block) => {
    const lines = block.trim().split(/\r?\n/)
    const timeLine = lines.find((line) => line.includes(' --> '))
    if (!timeLine) throw new Error(`Missing time range: ${block.slice(0, 80)}`)
    const [start, end] = timeLine.split(' --> ')
    return { id: Number(lines[0]), start, end, text: lines.slice(lines.indexOf(timeLine) + 1).join('\n') }
  })
}

function isMusic(text) {
  return /^\s*(\[.*music.*\]|【.*音乐.*】|♪)\s*$/iu.test(text)
}

const courseIds = (await readdir('resource')).filter((entry) => /^\d{4}$/.test(entry)).sort()
const repairedCourseIds = new Set(['0009', '0015', '0049', '0057', '0074', '0075', '0091', '0128', '0130', '0132', '0135', '0142', '0150', '0170', '0183', '0217', '0344', '0352'])
const failures = []

for (const course of courseIds) {
  const [englishSource, chineseSource, bilingualSource, transcript] = await Promise.all([
    readFile(`resource/${course}/subtitle.srt`, 'utf8'),
    readFile(`resource/${course}/subtitle.zh.srt`, 'utf8'),
    readFile(`resource/${course}/subtitle.bilingual.srt`, 'utf8'),
    readFile(`resource/${course}/transcript.txt`, 'utf8'),
  ])
  const english = parseSrt(englishSource)
  const chinese = parseSrt(chineseSource)
  const bilingual = parseSrt(bilingualSource)

  if (english.length !== chinese.length || english.length !== bilingual.length) failures.push(`${course}: subtitle mode counts differ`)
  if (repairedCourseIds.has(course) && transcript.trimEnd().split(/\r?\n/).length !== english.length) failures.push(`${course}: repaired English transcript count differs`)

  for (let index = 0; index < english.length; index += 1) {
    const entries = [english[index], chinese[index], bilingual[index]]
    if (entries.some((entry) => entry.start !== english[index].start || entry.end !== english[index].end)) failures.push(`${course}: subtitle timing mismatch at ${index + 1}`)
    const previous = english.slice(Math.max(0, index - 7), index + 1)
    if (previous.length === 8 && !isMusic(english[index].text) && previous.every((entry) => entry.text === english[index].text)) {
      failures.push(`${course}: repeated non-music subtitle at ${index - 6}-${index + 1}`)
    }
    if (repairedCourseIds.has(course) && entries.some((entry) => entry.id !== index + 1)) failures.push(`${course}: repaired subtitle id is not sequential at ${index + 1}`)
  }
}

if (failures.length) throw new Error(`Subtitle integrity check failed:\n${failures.join('\n')}`)
console.log(`Subtitle integrity check passed for ${courseIds.length} courses.`)
