import assert from 'node:assert/strict'
import { getLessonStatus, matchesLessonSearch, matchesLessonStatusFilter } from './courseFilter.ts'

assert.equal(getLessonStatus(0), 'todo')
assert.equal(getLessonStatus(1), 'doing')
assert.equal(getLessonStatus(99), 'doing')
assert.equal(getLessonStatus(100), 'doing')
assert.equal(getLessonStatus({ progress: 0, stage: 'intensive' }), 'doing')
assert.equal(getLessonStatus({ progress: 12, completedAt: 123 }), 'done')

assert.equal(matchesLessonStatusFilter('all', 'todo'), true)
assert.equal(matchesLessonStatusFilter('all', 'doing'), true)
assert.equal(matchesLessonStatusFilter('todo', 'todo'), true)
assert.equal(matchesLessonStatusFilter('todo', 'doing'), false)
assert.equal(matchesLessonStatusFilter('doing', 'doing'), true)
assert.equal(matchesLessonStatusFilter('done', 'done'), true)
assert.equal(matchesLessonStatusFilter('done', 'todo'), false)


const lesson = {
  id: '0003',
  title: 'Hotel Upgrade',
  displayTitle: 'Hotel Upgrade',
  level: 'Elementary',
  category: null,
}

assert.equal(matchesLessonSearch(lesson, ''), true)
assert.equal(matchesLessonSearch(lesson, '0003'), true)
assert.equal(matchesLessonSearch(lesson, 'hotel'), true)
assert.equal(matchesLessonSearch(lesson, 'elementary'), true)
assert.equal(matchesLessonSearch(lesson, 'office'), false)
