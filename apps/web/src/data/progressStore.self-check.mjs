import assert from 'node:assert/strict'
import { clearLessonProgressForLesson, completeLesson, normalizeLessonProgress, readLessonProgress, setLessonStage } from './progressStore.ts'

const legacy = normalizeLessonProgress({ currentTime: 30, duration: 60, progress: 50, updatedAt: 1 })
assert.deepEqual(legacy, { currentTime: 30, duration: 60, progress: 50, updatedAt: 1 })
assert.equal(normalizeLessonProgress({ currentTime: 30, duration: 60 })?.progress, 50)

globalThis.window = { localStorage: { setItem() {} }, dispatchEvent() {} }
const staged = setLessonStage({ lesson: legacy }, 'lesson', 'shadowing')
assert.equal(staged.lesson.stage, 'shadowing')
assert.equal(staged.lesson.completedAt, undefined)
assert.equal(normalizeLessonProgress({ ...legacy, progress: 100 })?.completedAt, undefined)
assert.equal(completeLesson(staged, 'lesson', 123).lesson.completedAt, 123)

const memory = new Map()
globalThis.window = {
  localStorage: {
    getItem(key) { return memory.get(key) ?? null },
    setItem(key, value) { memory.set(key, String(value)) },
    removeItem(key) { memory.delete(key) },
  },
  dispatchEvent() {},
}
memory.set('englishpod.lessonProgress.v1', JSON.stringify({ '0001': legacy, '0002': legacy }))
clearLessonProgressForLesson('0001')
assert.deepEqual(Object.keys(readLessonProgress()), ['0002'])
