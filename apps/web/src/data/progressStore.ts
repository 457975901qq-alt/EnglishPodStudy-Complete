const STORAGE_KEY = 'englishpod.lessonProgress.v1'

export const PROGRESS_CHANGE_EVENT = 'englishpod-progress-change'

function emitProgressChange() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new Event(PROGRESS_CHANGE_EVENT))
}

export type LessonProgress = {
  currentTime: number
  duration: number
  progress: number
  updatedAt: number
  stage?: LearningStage
  blindRating?: BlindRating
  completedAt?: number
}

export type LearningStage = 'blind' | 'intensive' | 'shadowing' | 'final' | 'complete'
export type BlindRating = 'under60' | '60to85' | 'over85'

export type LessonProgressMap = Record<string, LessonProgress>

function clampProgress(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)))
}

const LEARNING_STAGES: LearningStage[] = ['blind', 'intensive', 'shadowing', 'final', 'complete']
const BLIND_RATINGS: BlindRating[] = ['under60', '60to85', 'over85']

export function normalizeLessonProgress(value: unknown): LessonProgress | null {
  if (!value || typeof value !== 'object') return null

  const record = value as Partial<LessonProgress>
  const currentTime = Number(record.currentTime)
  const duration = Number(record.duration)
  const updatedAt = Number(record.updatedAt)
  const completedAt = Number(record.completedAt)
  const storedProgress = Number(record.progress)

  if (!Number.isFinite(currentTime) || !Number.isFinite(duration)) return null

  return {
    currentTime: Math.max(0, currentTime),
    duration: Math.max(0, duration),
    progress: Number.isFinite(storedProgress) ? clampProgress(storedProgress) : calculateProgress(currentTime, duration),
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : 0,
    ...(LEARNING_STAGES.includes(record.stage as LearningStage) ? { stage: record.stage as LearningStage } : {}),
    ...(BLIND_RATINGS.includes(record.blindRating as BlindRating) ? { blindRating: record.blindRating as BlindRating } : {}),
    ...(Number.isFinite(completedAt) && completedAt > 0 ? { completedAt } : {}),
  }
}

export function calculateProgress(currentTime: number, duration: number) {
  if (!Number.isFinite(currentTime) || !Number.isFinite(duration) || duration <= 0) {
    return 0
  }

  return clampProgress((currentTime / duration) * 100)
}

export function readLessonProgress(): LessonProgressMap {
  if (typeof window === 'undefined') return {}

  try {
    const rawValue = window.localStorage.getItem(STORAGE_KEY)
    if (!rawValue) return {}

    const parsed = JSON.parse(rawValue) as Record<string, unknown>
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([lessonId, value]) => [lessonId, normalizeLessonProgress(value)] as const)
        .filter((entry): entry is [string, LessonProgress] => entry[1] !== null),
    )
  } catch {
    return {}
  }
}

export function writeLessonProgress(progressMap: LessonProgressMap) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progressMap))
}

export function clearLessonProgress() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
  emitProgressChange()
}

export function saveLessonProgress(
  progressMap: LessonProgressMap,
  lessonId: string,
  currentTime: number,
  duration: number,
): LessonProgressMap {
  const progress = calculateProgress(currentTime, duration)
  const nextMap = {
    ...progressMap,
    [lessonId]: {
      ...progressMap[lessonId],
      currentTime: Math.max(0, currentTime),
      duration: Math.max(0, duration),
      progress,
      updatedAt: Date.now(),
    },
  }

  writeLessonProgress(nextMap)
  return nextMap
}

function updateLearningProgress(
  progressMap: LessonProgressMap,
  lessonId: string,
  changes: Partial<LessonProgress>,
) {
  const previous = progressMap[lessonId] ?? { currentTime: 0, duration: 0, progress: 0, updatedAt: 0 }
  const nextMap = { ...progressMap, [lessonId]: { ...previous, ...changes, updatedAt: Date.now() } }
  writeLessonProgress(nextMap)
  emitProgressChange()
  return nextMap
}

export function setLessonStage(progressMap: LessonProgressMap, lessonId: string, stage: LearningStage) {
  return updateLearningProgress(progressMap, lessonId, { stage })
}

export function setLessonBlindRating(progressMap: LessonProgressMap, lessonId: string, blindRating: BlindRating) {
  return updateLearningProgress(progressMap, lessonId, { blindRating, stage: 'intensive' })
}

export function completeLesson(progressMap: LessonProgressMap, lessonId: string, completedAt = Date.now()) {
  return updateLearningProgress(progressMap, lessonId, { stage: 'complete', completedAt })
}
