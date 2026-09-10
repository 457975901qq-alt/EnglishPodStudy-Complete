export type PlaybackMode = 'sequence' | 'shuffle' | 'repeat'

type LessonLike = { id: string }

export const DEFAULT_PLAYBACK_MODE: PlaybackMode = 'repeat'

const PLAYBACK_MODES: PlaybackMode[] = ['sequence', 'shuffle', 'repeat']

export function getNextPlaybackMode(mode: PlaybackMode): PlaybackMode {
  const index = PLAYBACK_MODES.indexOf(mode)
  return PLAYBACK_MODES[(index + 1) % PLAYBACK_MODES.length]
}

export function shouldReplayCurrentLesson(mode: PlaybackMode) {
  return mode === 'repeat'
}

export type EndedPlaybackAction<T extends LessonLike> =
  | { type: 'replay' }
  | { type: 'next'; lesson: T }
  | { type: 'stop' }

export function getEndedPlaybackAction<T extends LessonLike>(
  mode: PlaybackMode,
  lessons: T[],
  currentLessonId: string,
  random = Math.random,
): EndedPlaybackAction<T> {
  if (shouldReplayCurrentLesson(mode)) return { type: 'replay' }

  const nextLesson = getNextLessonForMode(mode, lessons, currentLessonId, random)
  return nextLesson ? { type: 'next', lesson: nextLesson } : { type: 'stop' }
}

export function getNextLessonForMode<T extends LessonLike>(
  mode: PlaybackMode,
  lessons: T[],
  currentLessonId: string,
  random = Math.random,
): T | null {
  const currentIndex = lessons.findIndex((lesson) => lesson.id === currentLessonId)
  if (currentIndex < 0) return null

  if (mode === 'shuffle') {
    const candidates = lessons.filter((lesson) => lesson.id !== currentLessonId)
    if (candidates.length === 0) return null
    return candidates[Math.floor(random() * candidates.length)] ?? candidates[0]
  }

  return lessons[currentIndex + 1] ?? null
}
