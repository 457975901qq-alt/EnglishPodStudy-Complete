import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const data = JSON.parse(await readFile('resource/course-list.json', 'utf8').then((value) => value.replace(/^\uFEFF/, '')))
const names = {
  B: 'Elementary',
  C: 'Intermediate',
  D: 'Upper Intermediate',
  E: 'Advanced',
  F: 'Special',
}

assert.equal(data.count, 365)
assert.equal(data.lessons.length, 365)
assert.ok(data.lessons.every((lesson) => String(lesson.displayTitle ?? '').trim()), 'all courses have names')
assert.ok(data.lessons.every((lesson) => lesson.level && lesson.levelCode))
assert.ok(data.lessons.every((lesson) => names[lesson.levelCode] === lesson.level))
assert.deepEqual(
  Object.fromEntries(data.levels.map((level) => [level.code, level.count])),
  { B: 145, C: 133, D: 62, E: 19, F: 6 },
)

console.log('course level checks passed')
