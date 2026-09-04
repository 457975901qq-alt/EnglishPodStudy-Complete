export type LessonStatus = 'todo' | 'doing' | 'done'
export type LessonStatusFilter = LessonStatus | 'all'

type LessonActivity = { progress?: number; stage?: unknown; blindRating?: unknown; completedAt?: number }

export function getLessonStatus(progressOrActivity: number | LessonActivity): LessonStatus {
  const activity = typeof progressOrActivity === 'number' ? { progress: progressOrActivity } : progressOrActivity
  if (activity.completedAt) return 'done'
  return (activity.progress ?? 0) > 0 || activity.stage || activity.blindRating ? 'doing' : 'todo'
}

export function matchesLessonStatusFilter(
  filter: LessonStatusFilter,
  status: LessonStatus,
) {
  return filter === 'all' || filter === status
}


type SearchableLesson = {
  id: string
  title?: string
  displayTitle?: string
  level?: string | null
  cefrLevel?: string | null
  category?: string | null
}

export function matchesLessonSearch(lesson: SearchableLesson, query: string) {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true

  return [lesson.id, lesson.title, lesson.displayTitle, lesson.level, lesson.cefrLevel, lesson.category]
    .filter(Boolean)
    .some((value) => String(value).toLowerCase().includes(normalizedQuery))
}
