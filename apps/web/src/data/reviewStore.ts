const VOCAB_STORAGE_KEY = 'englishpod.vocab.v1'
const SENTENCE_STORAGE_KEY = 'englishpod.reviewSentences.v1'
const DAY_MS = 24 * 60 * 60 * 1000

export const VOCAB_CHANGE_EVENT = 'englishpod-vocab-change'
export const REVIEW_CHANGE_EVENT = 'englishpod-review-change'

export type ReviewStatus = 'new' | 'learning' | 'reviewing' | 'mastered'
export type ReviewRating = 'again' | 'hard' | 'good' | 'easy'

export type ReviewState = {
  status: ReviewStatus
  stage: number
  dueAt: number
  lastReviewedAt?: number
  reviewCount: number
  lapseCount: number
}

export type VocabContext = {
  id: string
  lessonId: string
  audioStart: number
  audioEnd: number
  sourceText: string
  createdAt: number
}

export type VocabEntry = {
  id: string
  word: string
  phonetic?: string
  translation: string
  pos?: string
  contexts: VocabContext[]
  createdAt: number
  updatedAt: number
  review: ReviewState
}

export type VocabDraft = {
  word: string
  phonetic?: string
  translation: string
  pos?: string
  lessonId: string
  audioStart: number
  audioEnd: number
  sourceText: string
}

export type ReviewSentence = {
  id: string
  lessonId: string
  audioStart: number
  audioEnd: number
  sourceText: string
  translation?: string
  createdAt: number
  updatedAt: number
  review: ReviewState
}

export type ReviewSentenceDraft = Pick<
  ReviewSentence,
  'lessonId' | 'audioStart' | 'audioEnd' | 'sourceText' | 'translation'
>

export type WordReviewItem = {
  type: 'word'
  entry: VocabEntry
  context: VocabContext
  review: ReviewState
}

export type SentenceReviewItem = {
  type: 'sentence'
  sentence: ReviewSentence
  review: ReviewState
}

export type ReviewItem = WordReviewItem | SentenceReviewItem

type ClockOptions = {
  now?: number
}

const STAGE_INTERVALS = [DAY_MS, 3 * DAY_MS, 7 * DAY_MS, 14 * DAY_MS, 30 * DAY_MS, 60 * DAY_MS]

function normalizeWord(word: string) {
  return word.trim().toLowerCase()
}

function normalizeTime(value: unknown) {
  const time = Number(value)
  return Number.isFinite(time) ? Math.max(0, time) : 0
}

function contextId(lessonId: string, audioStart: number, sourceText: string) {
  return `${lessonId}:${Math.round(audioStart * 1000)}:${sourceText.trim().toLowerCase()}`
}

function sentenceId(draft: ReviewSentenceDraft) {
  return contextId(draft.lessonId, draft.audioStart, draft.sourceText)
}

function emitChange(eventName: string) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(eventName))
}

function createInitialReviewState(now: number): ReviewState {
  return {
    status: 'new',
    stage: 0,
    dueAt: now + DAY_MS,
    reviewCount: 0,
    lapseCount: 0,
  }
}

function normalizeReview(value: unknown, now: number): ReviewState {
  if (!value || typeof value !== 'object') return createInitialReviewState(now)

  const record = value as Partial<ReviewState>
  const stage = Number(record.stage)
  const dueAt = Number(record.dueAt)
  const lastReviewedAt = Number(record.lastReviewedAt)
  const reviewCount = Number(record.reviewCount)
  const lapseCount = Number(record.lapseCount)
  const status = record.status

  return {
    status:
      status === 'learning' || status === 'reviewing' || status === 'mastered'
        ? status
        : 'new',
    stage: Number.isFinite(stage) ? Math.max(0, Math.min(5, Math.round(stage))) : 0,
    dueAt: Number.isFinite(dueAt) ? dueAt : now + DAY_MS,
    lastReviewedAt: Number.isFinite(lastReviewedAt) ? lastReviewedAt : undefined,
    reviewCount: Number.isFinite(reviewCount) ? Math.max(0, Math.round(reviewCount)) : 0,
    lapseCount: Number.isFinite(lapseCount) ? Math.max(0, Math.round(lapseCount)) : 0,
  }
}

function normalizeContext(value: unknown, now: number): VocabContext | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Partial<VocabContext>
  const lessonId = String(record.lessonId ?? '').trim()
  const sourceText = String(record.sourceText ?? '').trim()
  const audioStart = normalizeTime(record.audioStart)
  const audioEnd = normalizeTime(record.audioEnd)

  if (!lessonId || !sourceText) return null

  return {
    id: String(record.id ?? contextId(lessonId, audioStart, sourceText)),
    lessonId,
    audioStart,
    audioEnd,
    sourceText,
    createdAt: normalizeTime(record.createdAt) || now,
  }
}

function normalizeVocabEntry(value: unknown, now: number): VocabEntry | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Partial<VocabEntry> & Partial<VocabDraft>
  const word = normalizeWord(String(record.word ?? ''))
  const translation = String(record.translation ?? '').trim()
  const contexts = Array.isArray(record.contexts)
    ? record.contexts
        .map((context) => normalizeContext(context, now))
        .filter((context): context is VocabContext => context !== null)
    : [
        normalizeContext(
          {
            lessonId: record.lessonId,
            audioStart: record.audioStart,
            audioEnd: record.audioEnd,
            sourceText: record.sourceText,
            createdAt: record.createdAt,
          },
          now,
        ),
      ].filter((context): context is VocabContext => context !== null)

  if (!word || !translation || contexts.length === 0) return null

  return {
    id: word,
    word,
    phonetic: record.phonetic ? String(record.phonetic) : undefined,
    translation,
    pos: record.pos ? String(record.pos) : undefined,
    contexts,
    createdAt: normalizeTime(record.createdAt) || now,
    updatedAt: normalizeTime(record.updatedAt) || normalizeTime(record.createdAt) || now,
    review: normalizeReview(record.review, now),
  }
}

function normalizeSentence(value: unknown, now: number): ReviewSentence | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Partial<ReviewSentence>
  const lessonId = String(record.lessonId ?? '').trim()
  const sourceText = String(record.sourceText ?? '').trim()
  const audioStart = normalizeTime(record.audioStart)
  const audioEnd = normalizeTime(record.audioEnd)

  if (!lessonId || !sourceText) return null

  const draft = {
    lessonId,
    audioStart,
    audioEnd,
    sourceText,
    translation: record.translation ? String(record.translation) : undefined,
  }

  return {
    id: String(record.id ?? sentenceId(draft)),
    ...draft,
    createdAt: normalizeTime(record.createdAt) || now,
    updatedAt: normalizeTime(record.updatedAt) || normalizeTime(record.createdAt) || now,
    review: normalizeReview(record.review, now),
  }
}

function readArray(key: string): unknown[] {
  if (typeof window === 'undefined') return []

  try {
    const rawValue = window.localStorage.getItem(key)
    if (!rawValue) return []

    const parsed = JSON.parse(rawValue) as unknown
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeArray<T>(key: string, values: T[], eventName: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(key, JSON.stringify(values))
  emitChange(eventName)
  emitChange(REVIEW_CHANGE_EVENT)
}

function mergeVocabEntries(entries: VocabEntry[]) {
  const merged = new Map<string, VocabEntry>()

  for (const entry of entries) {
    const existing = merged.get(entry.id)
    if (!existing) {
      merged.set(entry.id, entry)
      continue
    }

    const contextMap = new Map(existing.contexts.map((context) => [context.id, context]))
    for (const context of entry.contexts) {
      if (!contextMap.has(context.id)) contextMap.set(context.id, context)
    }

    merged.set(entry.id, {
      ...existing,
      phonetic: existing.phonetic ?? entry.phonetic,
      translation: existing.translation || entry.translation,
      pos: existing.pos ?? entry.pos,
      contexts: [...contextMap.values()].sort((a, b) => b.createdAt - a.createdAt),
      createdAt: Math.min(existing.createdAt, entry.createdAt),
      updatedAt: Math.max(existing.updatedAt, entry.updatedAt),
    })
  }

  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function readVocab(options: ClockOptions = {}): VocabEntry[] {
  const now = options.now ?? Date.now()
  return mergeVocabEntries(
    readArray(VOCAB_STORAGE_KEY)
      .map((entry) => normalizeVocabEntry(entry, now))
      .filter((entry): entry is VocabEntry => entry !== null),
  )
}

export function writeVocab(entries: VocabEntry[]) {
  writeArray(VOCAB_STORAGE_KEY, entries, VOCAB_CHANGE_EVENT)
}

export function clearReviewMemory() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(VOCAB_STORAGE_KEY)
  window.localStorage.removeItem(SENTENCE_STORAGE_KEY)
  emitChange(VOCAB_CHANGE_EVENT)
  emitChange(REVIEW_CHANGE_EVENT)
}

export function addVocab(draft: VocabDraft, options: ClockOptions = {}): VocabEntry {
  const now = options.now ?? Date.now()
  const entries = readVocab({ now })
  const id = normalizeWord(draft.word)
  const existing = entries.find((entry) => entry.id === id)
  const context = normalizeContext({ ...draft, createdAt: now }, now)

  if (!context) {
    throw new Error('Cannot save vocab without lesson context')
  }

  const contexts = existing?.contexts ?? []
  const nextContexts = contexts.some((item) => item.id === context.id)
    ? contexts
    : [context, ...contexts]

  const entry: VocabEntry = {
    id,
    word: id,
    phonetic: draft.phonetic ?? existing?.phonetic,
    translation: draft.translation || existing?.translation || '',
    pos: draft.pos ?? existing?.pos,
    contexts: nextContexts,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    review: existing?.review ?? createInitialReviewState(now),
  }

  writeVocab([entry, ...entries.filter((item) => item.id !== id)])
  return entry
}

export function removeVocab(id: string) {
  writeVocab(readVocab().filter((entry) => entry.id !== id))
}

export function removeVocabByWord(
  word: string,
  lessonId?: string,
  audioStart?: number,
  sourceText?: string,
) {
  const normalizedWord = normalizeWord(word)

  if (!lessonId) {
    removeVocab(normalizedWord)
    return
  }

  const entries = readVocab()
  const entry = entries.find((item) => item.id === normalizedWord)
  if (!entry) return

  const contextToRemove =
    typeof audioStart === 'number' && sourceText
      ? contextId(lessonId, audioStart, sourceText)
      : null
  const contexts = entry.contexts.filter((context) =>
    contextToRemove ? context.id !== contextToRemove : context.lessonId !== lessonId,
  )
  if (contexts.length === 0) {
    removeVocab(normalizedWord)
    return
  }

  writeVocab(
    entries.map((item) =>
      item.id === normalizedWord ? { ...item, contexts, updatedAt: Date.now() } : item,
    ),
  )
}

export function removeVocabContext(word: string, contextIdToRemove: string) {
  const normalizedWord = normalizeWord(word)
  const entries = readVocab()
  const entry = entries.find((item) => item.id === normalizedWord)
  if (!entry) return

  const contexts = entry.contexts.filter((context) => context.id !== contextIdToRemove)
  if (contexts.length === 0) {
    removeVocab(normalizedWord)
    return
  }

  writeVocab(
    entries.map((item) =>
      item.id === normalizedWord ? { ...item, contexts, updatedAt: Date.now() } : item,
    ),
  )
}

export function isVocabSaved(
  word: string,
  lessonId?: string,
  audioStart?: number,
  sourceText?: string,
) {
  const normalizedWord = normalizeWord(word)
  const entry = readVocab().find((item) => item.id === normalizedWord)
  if (!entry) return false
  if (!lessonId) return true

  if (typeof audioStart === 'number' && sourceText) {
    const id = contextId(lessonId, audioStart, sourceText)
    return entry.contexts.some((context) => context.id === id)
  }

  return entry.contexts.some((context) => context.lessonId === lessonId)
}

export function readReviewSentences(options: ClockOptions = {}): ReviewSentence[] {
  const now = options.now ?? Date.now()
  return readArray(SENTENCE_STORAGE_KEY)
    .map((entry) => normalizeSentence(entry, now))
    .filter((entry): entry is ReviewSentence => entry !== null)
    .sort((a, b) => b.updatedAt - a.updatedAt)
}

export function writeReviewSentences(entries: ReviewSentence[]) {
  writeArray(SENTENCE_STORAGE_KEY, entries, REVIEW_CHANGE_EVENT)
}

export function addReviewSentence(
  draft: ReviewSentenceDraft,
  options: ClockOptions = {},
): ReviewSentence {
  const now = options.now ?? Date.now()
  const entries = readReviewSentences({ now })
  const id = sentenceId(draft)
  const existing = entries.find((entry) => entry.id === id)
  const entry: ReviewSentence = {
    id,
    lessonId: draft.lessonId,
    audioStart: normalizeTime(draft.audioStart),
    audioEnd: normalizeTime(draft.audioEnd),
    sourceText: draft.sourceText.trim(),
    translation: draft.translation?.trim() || existing?.translation,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    review: existing?.review ?? createInitialReviewState(now),
  }

  writeReviewSentences([entry, ...entries.filter((item) => item.id !== id)])
  return entry
}

export function removeReviewSentence(id: string) {
  writeReviewSentences(readReviewSentences().filter((entry) => entry.id !== id))
}

function chooseReviewContext(entry: VocabEntry) {
  return [...entry.contexts].sort((a, b) => b.createdAt - a.createdAt)[0]
}

export function getDueReviewItems(now = Date.now(), limit = 10): ReviewItem[] {
  const wordItems: ReviewItem[] = readVocab({ now })
    .filter((entry) => entry.review.dueAt <= now)
    .map((entry) => ({
      type: 'word' as const,
      entry,
      context: chooseReviewContext(entry),
      review: entry.review,
    }))
    .filter((item) => item.context)

  const sentenceItems: ReviewItem[] = readReviewSentences({ now })
    .filter((sentence) => sentence.review.dueAt <= now)
    .map((sentence) => ({ type: 'sentence', sentence, review: sentence.review }))

  const sortedItems = [...wordItems, ...sentenceItems]
    .sort((a, b) => {
      const overdue = a.review.dueAt - b.review.dueAt
      if (overdue !== 0) return overdue

      const stage = a.review.stage - b.review.stage
      if (stage !== 0) return stage

      return b.review.lapseCount - a.review.lapseCount
    })

  return interleaveReviewItems(sortedItems).slice(0, limit)
}

function interleaveReviewItems(items: ReviewItem[]) {
  const words = items.filter((item) => item.type === 'word')
  const sentences = items.filter((item) => item.type === 'sentence')
  const result: ReviewItem[] = []
  let wordIndex = 0
  let sentenceIndex = 0
  let nextType: ReviewItem['type'] = words.length >= sentences.length ? 'word' : 'sentence'

  while (wordIndex < words.length || sentenceIndex < sentences.length) {
    if (nextType === 'word' && wordIndex < words.length) {
      result.push(words[wordIndex])
      wordIndex += 1
      nextType = 'sentence'
      continue
    }

    if (nextType === 'sentence' && sentenceIndex < sentences.length) {
      result.push(sentences[sentenceIndex])
      sentenceIndex += 1
      nextType = 'word'
      continue
    }

    nextType = nextType === 'word' ? 'sentence' : 'word'
  }

  return result
}

export function countDueReviewItems(now = Date.now()) {
  const dueWords = readVocab({ now }).filter((entry) => entry.review.dueAt <= now).length
  const dueSentences = readReviewSentences({ now }).filter(
    (sentence) => sentence.review.dueAt <= now,
  ).length
  return dueWords + dueSentences
}

function reviewItemKey(item: ReviewItem) {
  return item.type === 'word' ? `word:${item.entry.id}` : `sentence:${item.sentence.id}`
}

export function updateReviewSessionQueue(
  items: ReviewItem[],
  ratedItem: ReviewItem,
  rating: ReviewRating,
) {
  const remaining = items.filter((item) => reviewItemKey(item) !== reviewItemKey(ratedItem))
  return rating === 'again' ? [...remaining, ratedItem] : remaining
}

function nextReviewState(review: ReviewState, rating: ReviewRating, now: number): ReviewState {
  const previousStage = review.stage
  const nextStage =
    rating === 'again'
      ? 0
      : rating === 'hard'
        ? Math.max(0, previousStage - 1)
        : rating === 'good'
          ? Math.min(5, previousStage + 1)
          : Math.min(5, previousStage + 2)

  return {
    status: nextStage >= 5 ? 'mastered' : nextStage === 0 ? 'learning' : 'reviewing',
    stage: nextStage,
    dueAt: now + STAGE_INTERVALS[nextStage],
    lastReviewedAt: now,
    reviewCount: review.reviewCount + 1,
    lapseCount: rating === 'again' ? review.lapseCount + 1 : review.lapseCount,
  }
}

export function rateReviewItem(
  item: WordReviewItem,
  rating: ReviewRating,
  now?: number,
): VocabEntry
export function rateReviewItem(
  item: SentenceReviewItem,
  rating: ReviewRating,
  now?: number,
): ReviewSentence
export function rateReviewItem(item: ReviewItem, rating: ReviewRating, now = Date.now()) {
  const review = nextReviewState(item.review, rating, now)

  if (item.type === 'word') {
    const nextEntry = { ...item.entry, review, updatedAt: now }
    writeVocab(readVocab({ now }).map((entry) => (entry.id === nextEntry.id ? nextEntry : entry)))
    return nextEntry
  }

  const nextSentence = { ...item.sentence, review, updatedAt: now }
  writeReviewSentences(
    readReviewSentences({ now }).map((entry) =>
      entry.id === nextSentence.id ? nextSentence : entry,
    ),
  )
  return nextSentence
}
