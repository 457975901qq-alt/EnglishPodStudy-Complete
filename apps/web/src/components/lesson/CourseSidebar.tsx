import { memo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLevelBadge, type CourseLesson } from '@/data/courseList'
import type { LessonProgressMap } from '@/data/progressStore'
import {
  getLessonStatus,
  matchesLessonStatusFilter,
  type LessonStatus,
  type LessonStatusFilter,
} from './courseFilter'

type CourseSidebarProps = {
  lessons: CourseLesson[]
  activeLesson: CourseLesson
  progressMap: LessonProgressMap
  activeProgress: number
  onSelectLesson: (lessonId: string) => void
}

const FILTERS: Array<{ value: LessonStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'todo', label: '未开始' },
  { value: 'doing', label: '学习中' },
  { value: 'done', label: '已完成' },
]

const STATUS_LABELS: Record<LessonStatus, string> = {
  todo: '未开始',
  doing: '学习中',
  done: '已完成',
}

export const CourseSidebar = memo(function CourseSidebar({
  lessons,
  activeLesson,
  progressMap,
  activeProgress,
  onSelectLesson,
}: CourseSidebarProps) {
  const [statusFilter, setStatusFilter] = useState<LessonStatusFilter>('all')
  const lessonRows = lessons
    .map((lesson) => {
      const isActive = lesson.id === activeLesson.id
      const savedProgress = progressMap[lesson.id]?.progress ?? 0
      const progress = isActive
        ? Math.max(savedProgress, Math.max(0, Math.min(100, activeProgress)))
        : savedProgress
      const status = getLessonStatus({ ...progressMap[lesson.id], progress })

      return { lesson, isActive, progress, status }
    })
    .filter(({ status }) => matchesLessonStatusFilter(statusFilter, status))

  return (
    <nav className="course-list" id="courseList" aria-label="课程列表">
      <div className="list-head">
        <span className="list-title">全部课程 · {lessons.length}</span>
      </div>

      <div className="filters" aria-label="课程状态筛选">
        {FILTERS.map((filter) => (
          <button
            key={filter.value}
            className={`chip${filter.value === statusFilter ? ' active' : ''}`}
            type="button"
            aria-pressed={filter.value === statusFilter}
            onClick={() => setStatusFilter(filter.value)}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="course-scroll">
        {lessonRows.map((row) => (
          <CourseSidebarRow key={row.lesson.id} {...row} onSelectLesson={onSelectLesson} />
        ))}
      </div>
    </nav>
  )
})

type CourseSidebarRowProps = {
  lesson: CourseLesson
  isActive: boolean
  progress: number
  status: LessonStatus
  onSelectLesson: (lessonId: string) => void
}

const CourseSidebarRow = memo(function CourseSidebarRow({
  lesson,
  isActive,
  progress,
  status,
  onSelectLesson,
}: CourseSidebarRowProps) {
  const levelBadge = getLevelBadge(lesson)

  return (
    <Link
      to={`/courses/${lesson.id}`}
      className={`course-item${isActive ? ' active' : ''}`}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => onSelectLesson(lesson.id)}
    >
      <span className={`level-badge ${levelBadge.className}`} aria-label={levelBadge.label}>
        {levelBadge.code}
      </span>
      <span className="ci-num">{lesson.id}</span>
      <span className="ci-body">
        <span className="ci-title">{lesson.displayTitle}</span>
        <span className="ci-prog">
          <span
            className="ci-bar"
            role="progressbar"
            aria-label={`${lesson.displayTitle} 播放进度`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <i style={{ width: `${progress}%` }} />
          </span>
          <span className="ci-pct">播放 {progress}%</span>
        </span>
      </span>
      <span className={`ci-dot ${status}`} aria-label={STATUS_LABELS[status]} />
    </Link>
  )
})
