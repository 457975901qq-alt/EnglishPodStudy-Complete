import assert from 'node:assert/strict'
import {
  DEFAULT_PLAYBACK_MODE,
  getEndedPlaybackAction,
  getNextPlaybackMode,
  getNextLessonForMode,
  shouldReplayCurrentLesson,
} from './playbackMode.ts'

const lessons = [{ id: '1' }, { id: '2' }, { id: '3' }]

assert.equal(DEFAULT_PLAYBACK_MODE, 'repeat')

assert.equal(getNextPlaybackMode('sequence'), 'shuffle')
assert.equal(getNextPlaybackMode('shuffle'), 'repeat')
assert.equal(getNextPlaybackMode('repeat'), 'sequence')

assert.equal(getNextLessonForMode('sequence', lessons, '1')?.id, '2')
assert.equal(getNextLessonForMode('sequence', lessons, '3'), null)
assert.equal(getNextLessonForMode('repeat', lessons, '2')?.id, '3')
assert.equal(getNextLessonForMode('shuffle', lessons, '2', () => 0)?.id, '1')
assert.equal(getNextLessonForMode('shuffle', lessons, '2', () => 0.99)?.id, '3')
assert.equal(shouldReplayCurrentLesson('repeat'), true)
assert.equal(shouldReplayCurrentLesson('sequence'), false)
assert.equal(shouldReplayCurrentLesson('shuffle'), false)

assert.deepEqual(getEndedPlaybackAction('repeat', lessons, '2'), { type: 'replay' })
assert.deepEqual(getEndedPlaybackAction('sequence', lessons, '1'), {
  type: 'next',
  lesson: lessons[1],
})
assert.deepEqual(getEndedPlaybackAction('sequence', lessons, '3'), { type: 'stop' })
assert.deepEqual(getEndedPlaybackAction('shuffle', lessons, '2', () => 0.99), {
  type: 'next',
  lesson: lessons[2],
})
