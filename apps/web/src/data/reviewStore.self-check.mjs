import assert from 'node:assert/strict'
import {
  addReviewSentence,
  addVocab,
  getDueReviewItems,
  rateReviewItem,
  readReviewSentences,
  readVocab,
  updateReviewSessionQueue,
  writeReviewSentences,
  writeVocab,
} from './reviewStore.ts'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 0, 1, 9)

function createMemoryStorage() {
  const map = new Map()
  return {
    getItem(key) {
      return map.get(key) ?? null
    },
    setItem(key, value) {
      map.set(key, String(value))
    },
    removeItem(key) {
      map.delete(key)
    },
    clear() {
      map.clear()
    },
  }
}

globalThis.window = {
  localStorage: createMemoryStorage(),
  dispatchEvent() {},
}

const firstEntry = addVocab(
  {
    word: 'Business',
    phonetic: 'biz',
    translation: 'n. 商业',
    pos: 'n.',
    lessonId: '0001',
    audioStart: 12,
    audioEnd: 15,
    sourceText: 'Business is changing fast.',
  },
  { now },
)
const secondEntry = addVocab(
  {
    word: 'business',
    phonetic: 'biz',
    translation: 'n. 商业',
    pos: 'n.',
    lessonId: '0002',
    audioStart: 21,
    audioEnd: 24,
    sourceText: 'This is not my business.',
  },
  { now: now + 1000 },
)

assert.equal(firstEntry.id, 'business')
assert.equal(secondEntry.id, 'business')
assert.equal(readVocab().length, 1)
assert.equal(readVocab()[0].contexts.length, 2)
assert.equal(readVocab()[0].review.dueAt, now + DAY)

addReviewSentence(
  {
    lessonId: '0001',
    audioStart: 30,
    audioEnd: 34,
    sourceText: 'What do you have in mind?',
    translation: '你有什么想法？',
  },
  { now },
)
addReviewSentence(
  {
    lessonId: '0001',
    audioStart: 30,
    audioEnd: 34,
    sourceText: 'What do you have in mind?',
    translation: '你有什么想法？',
  },
  { now: now + 1000 },
)

assert.equal(readReviewSentences().length, 1)

addVocab(
  {
    word: 'Project',
    phonetic: 'proj',
    translation: 'n. 项目',
    pos: 'n.',
    lessonId: '0003',
    audioStart: 40,
    audioEnd: 43,
    sourceText: 'The project starts today.',
  },
  { now },
)

const dueTomorrow = getDueReviewItems(now + DAY)
assert.deepEqual(
  dueTomorrow.map((item) => item.type),
  ['word', 'sentence', 'word'],
)

const reviewed = rateReviewItem(dueTomorrow[0], 'easy', now + DAY)
assert.equal(reviewed.review.stage, 2)
assert.equal(reviewed.review.dueAt, now + DAY + 7 * DAY)

const remainingItems = dueTomorrow.slice(1)
const ratedAgainItem = {
  ...dueTomorrow[0],
  entry: rateReviewItem(dueTomorrow[0], 'again', now + DAY),
}
ratedAgainItem.review = ratedAgainItem.entry.review
assert.deepEqual(updateReviewSessionQueue(dueTomorrow, ratedAgainItem, 'again'), [
  ...remainingItems,
  ratedAgainItem,
])
assert.deepEqual(updateReviewSessionQueue(dueTomorrow, ratedAgainItem, 'good'), remainingItems)

const masteredDueAt = now + 30 * DAY
writeVocab(
  readVocab().map((entry) => ({
    ...entry,
    review: { ...entry.review, status: 'mastered', stage: 5, dueAt: masteredDueAt },
  })),
)
writeReviewSentences(
  readReviewSentences().map((sentence) => ({
    ...sentence,
    review: { ...sentence.review, status: 'mastered', stage: 5, dueAt: masteredDueAt },
  })),
)
assert.equal(getDueReviewItems(masteredDueAt - 1).length, 0)
assert.equal(getDueReviewItems(masteredDueAt).length, 3)

console.log('review store checks passed')
