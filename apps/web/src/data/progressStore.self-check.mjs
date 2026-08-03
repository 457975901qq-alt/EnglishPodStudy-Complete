import assert from 'node:assert/strict'
import { completeLesson, normalizeLessonProgress, setLessonStage } from './progressStore.ts'

const legacy = normalizeLessonProgress({ currentTime: 30, duration: 60, progress: 50, updatedAt: 1 })
assert.deepEqual(legacy, { currentTime: 30, duration: 60, progress: 50, updatedAt: 1 })
assert.equal(normalizeLessonProgress({ currentTime: 30, duration: 60 })?.progress, 50)

globalThis.window = { localStorage: { setItem() {} }, dispatchEvent() {} }
const staged = setLessonStage({ lesson: legacy }, 'lesson', 'shadowing')
assert.equal(staged.lesson.stage, 'shadowing')
assert.equal(staged.lesson.completedAt, undefined)
assert.equal(normalizeLessonProgress({ ...legacy, progress: 100 })?.completedAt, undefined)
assert.equal(completeLesson(staged, 'lesson', 123).lesson.completedAt, 123)
