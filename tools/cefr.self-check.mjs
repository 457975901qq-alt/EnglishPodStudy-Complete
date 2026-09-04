import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const data = JSON.parse(await readFile('resource/cefr-assessment.json', 'utf8').then((value) => value.replace(/^\uFEFF/, '')))
const catalog = JSON.parse(await readFile('resource/course-list.json', 'utf8').then((value) => value.replace(/^\uFEFF/, '')))
const allowedLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1'])
const allowedConfidence = new Set(['high', 'medium', 'low'])

assert.equal(data.count, 365)
assert.equal(data.assessments.length, 365)
assert.deepEqual(
  data.assessments.map((item) => item.id),
  catalog.lessons.map((lesson) => lesson.id),
)
assert.deepEqual(Object.keys(data.levels), ['A1', 'A2', 'B1', 'B2', 'C1'])
assert.equal(
  data.assessments.filter((item) => allowedLevels.has(item.cefrLevel)).length,
  365,
)
assert.ok(data.assessments.every((item) => allowedConfidence.has(item.confidence)))
assert.ok(data.assessments.every((item) => Number.isFinite(item.score) && item.score >= 0 && item.score <= 100))
assert.ok(data.assessments.every((item) => item.metrics.words > 0 && item.metrics.subtitleCues > 0))
assert.equal(
  Object.values(data.levels).reduce((total, count) => total + count, 0),
  365,
)
assert.match(data.methodology.version, /^\d{4}-\d{2}-\d{2}\.\d+$/)

console.log('CEFR assessment checks passed')
