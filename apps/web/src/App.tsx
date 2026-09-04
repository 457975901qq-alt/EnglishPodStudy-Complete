import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { PAGE_TITLES } from '@/lib/pageTitles'
import { formatCourseLevel, formatTime, getLevelBadge, useCourseList, type CourseLesson, type CourseListData } from '@/data/courseList'
import { clearLessonProgress, PROGRESS_CHANGE_EVENT, readLessonProgress } from '@/data/progressStore'
import { clearReviewMemory, countDueReviewItems, readVocab, REVIEW_CHANGE_EVENT, VOCAB_CHANGE_EVENT } from '@/data/vocabStore'
import { ThemeToggle, type Theme } from '@/components/ThemeToggle'
import { getLessonStatus, matchesLessonSearch, matchesLessonStatusFilter, type LessonStatus, type LessonStatusFilter } from '@/components/lesson/courseFilter'
import { LessonPage } from '@/pages/LessonPage'
import { ReviewPage } from '@/pages/ReviewPage'
import { VocabPage } from '@/pages/VocabPage'

const THEME_KEY = 'englishpod-theme'

const navItems = [
  { to: '/dashboard', label: PAGE_TITLES.dashboard, eyebrow: 'Overview' },
  { to: '/courses', label: PAGE_TITLES.courses, eyebrow: 'Lessons' },
  { to: '/vocab', label: PAGE_TITLES.vocab, eyebrow: 'Vocabulary' },
  { to: '/review', label: PAGE_TITLES.review, eyebrow: 'SRS' },
  { to: '/settings', label: PAGE_TITLES.settings, eyebrow: 'Settings' },
]

function getInitialTheme(): Theme {
  const saved = window.localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function App() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    window.localStorage.setItem(THEME_KEY, theme)
  }, [theme])

  const cycleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'))
  }

  return (
    <Routes>
      <Route
        path="/courses/:lessonId"
        element={
          <LessonPage theme={theme} onCycleTheme={cycleTheme} />
        }
      />
      <Route
        path="/"
        element={
          <AppShell
            theme={theme}
            onCycleTheme={cycleTheme}
          />
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="courses" element={<CoursesPage />} />
        <Route path="vocab" element={<VocabPage />} />
        <Route path="review" element={<ReviewPage />} />
        <Route
          path="settings"
          element={<SettingsPage theme={theme} onCycleTheme={cycleTheme} />}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  )
}

function AppShell({
  theme,
  onCycleTheme,
}: {
  theme: Theme
  onCycleTheme: () => void
}) {
  const location = useLocation()
  const isCourseLibrary = location.pathname === '/courses'

  return (
    <div className="min-h-dvh bg-[var(--bg)] text-[var(--fg)]">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg)_82%,transparent)] px-4 backdrop-blur-xl md:px-7">
        <div className="flex items-center gap-2 font-semibold">
          <span className="grid size-7 place-items-center rounded-[var(--radius-sm)] bg-[var(--accent)] font-[var(--font-display)] text-sm font-bold text-[var(--accent-on)]">
            E
          </span>
          EnglishPod
        </div>
        <ThemeToggle theme={theme} onToggle={onCycleTheme} className="ml-auto theme-toggle" />
      </header>

      <div
        className={cn(
          'grid min-h-[calc(100dvh-var(--topbar-h))] grid-cols-1 md:grid-cols-[280px_1fr]',
          isCourseLibrary && 'app-shell-body-courses',
        )}
      >
        <aside className="border-b border-[var(--border-soft)] bg-[var(--surface-warm)] p-3 md:border-b-0 md:border-r">
          <nav className="grid gap-1">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-[var(--radius-md)] px-4 py-3 text-left transition hover:bg-[var(--surface)]',
                    isActive &&
                      'bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]',
                  )
                }
              >
                <span className="block font-semibold">{item.label}</span>
                <span className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--meta)]">
                  {item.eyebrow}
                </span>
              </NavLink>
            ))}
          </nav>
        </aside>

        <main
          className={cn(
            'min-w-0 px-5 py-8 md:px-10 lg:px-16',
            isCourseLibrary && 'app-shell-main-courses',
          )}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function DashboardPage() {
  const { data, loading, error } = useCourseList()
  const [vocabCount, setVocabCount] = useState(() => readVocab().length)
  const [dueReviewCount, setDueReviewCount] = useState(() => countDueReviewItems())
  const [weeklyLearningDays, setWeeklyLearningDays] = useState(() => countWeeklyLearningDays())

  useEffect(() => {
    const refresh = () => {
      setVocabCount(readVocab().length)
      setDueReviewCount(countDueReviewItems())
      setWeeklyLearningDays(countWeeklyLearningDays())
    }
    window.addEventListener(VOCAB_CHANGE_EVENT, refresh)
    window.addEventListener(REVIEW_CHANGE_EVENT, refresh)
    window.addEventListener(PROGRESS_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(VOCAB_CHANGE_EVENT, refresh)
      window.removeEventListener(REVIEW_CHANGE_EVENT, refresh)
      window.removeEventListener(PROGRESS_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const stats = [
    { label: '课程总数', value: loading ? '加载中' : error ? '--' : String(data?.count ?? 0) },
    { label: '本周学习', value: `${weeklyLearningDays} 天` },
    { label: '待复习', value: `${dueReviewCount} 个`, to: '/review' },
    { label: '生词量', value: `${vocabCount} 个`, to: '/vocab' },
  ]

  return (
    <section className="mx-auto grid max-w-5xl gap-8">
      <div>
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--accent)]">
          Overview
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold tracking-[var(--tracking-display)] md:text-5xl">
          {PAGE_TITLES.dashboard}
        </h1>
      </div>

      <TodayLearningCard data={data} dueReviewCount={dueReviewCount} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => {
          const content = (
            <>
              <p className="text-sm text-[var(--muted)]">{stat.label}</p>
              <p className="mt-3 font-[var(--font-display)] text-3xl font-semibold">
                {stat.value}
              </p>
            </>
          )

          return stat.to ? (
            <Link
              key={stat.label}
              className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-5 transition hover:bg-[var(--surface)]"
              to={stat.to}
            >
              {content}
            </Link>
          ) : (
            <article
              key={stat.label}
              className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-5"
            >
              {content}
            </article>
          )
        })}
      </div>

      {data && <CourseDistribution data={data} />}

    </section>
  )
}

function TodayLearningCard({
  data,
  dueReviewCount,
}: {
  data: CourseListData | null
  dueReviewCount: number
}) {
  if (dueReviewCount > 0) {
    return (
      <Link
        className="group flex items-center justify-between gap-5 rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--accent)_38%,var(--border-soft))] bg-[color-mix(in_srgb,var(--accent)_8%,var(--surface-warm))] p-5 transition hover:bg-[color-mix(in_srgb,var(--accent)_12%,var(--surface-warm))]"
        to="/review"
      >
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-[var(--radius-pill)] bg-[var(--accent)] text-[var(--accent-on)]">
            <HeadphonesIcon />
          </span>
          <div>
            <p className="font-semibold">先完成今日复习</p>
            <p className="text-sm text-[var(--muted)]">{dueReviewCount} 项内容已经到期，完成后再学习新课。</p>
          </div>
        </div>
        <span className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--accent)]">
          Review
        </span>
      </Link>
    )
  }

  const target = getContinueLearningTarget(data)
  const title = target.lesson ? '继续学习' : '开始学习'
  const subtitle = target.lesson
    ? `${target.lesson.displayTitle} · ${formatDashboardTime(target.time)}`
    : '从课程库选择一节，开始用原声练听力。'

  return (
    <Link
      className="group flex items-center justify-between gap-5 rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-5 transition hover:bg-[var(--surface)]"
      to={target.to}
    >
      <div className="flex items-center gap-4">
        <span className="grid size-12 place-items-center rounded-[var(--radius-pill)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-[var(--accent)]">
          <HeadphonesIcon />
        </span>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-[var(--muted)]">{subtitle}</p>
        </div>
      </div>
      <span className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--meta)] transition group-hover:text-[var(--accent)]">
        Listen
      </span>
    </Link>
  )
}

function getContinueLearningTarget(data: CourseListData | null) {
  const progressEntries = Object.entries(readLessonProgress())
    .filter(([, progress]) => progress.updatedAt > 0)
    .sort(([, a], [, b]) => b.updatedAt - a.updatedAt)
  const [lessonId, progress] = progressEntries[0] ?? []
  const lesson = lessonId ? data?.lessons.find((item) => item.id === lessonId) ?? null : null

  if (!lessonId || !progress) return { to: '/courses', lesson: null, time: 0 }

  return {
    to: `/courses/${lessonId}?t=${Math.floor(progress.currentTime)}`,
    lesson,
    time: progress.currentTime,
  }
}

function formatDashboardTime(seconds: number) {
  const whole = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`
}

function countWeeklyLearningDays(now = Date.now()) {
  const weekStart = now - 6 * 24 * 60 * 60 * 1000
  const days = new Set<string>()

  for (const progress of Object.values(readLessonProgress())) {
    if (progress.updatedAt < weekStart || progress.updatedAt > now) continue
    days.add(new Date(progress.updatedAt).toDateString())
  }

  return days.size
}

function CourseDistribution({ data }: { data: CourseListData }) {
  const rows = getCourseDistributionRows(data)
  const total = rows.reduce((sum, row) => sum + row.value, 0) || 1

  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="font-semibold">课程结构</p>
          <p className="text-sm text-[var(--muted)]">按 CEFR 听力对齐等级分布</p>
        </div>
        <span className="font-[var(--font-mono)] text-xs text-[var(--meta)]">{data.count} lessons</span>
      </div>
      <div className="mt-5 grid gap-3">
        {rows.map((row) => {
          const percent = Math.round((row.value / total) * 100)
          return (
            <div key={row.label} className="grid gap-2">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{row.label}</span>
                <span className="text-[var(--muted)]">{row.value} · {percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface)]">
                <div
                  className="h-full rounded-[var(--radius-pill)] bg-[var(--accent)]"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function getCourseDistributionRows(data: CourseListData) {
  const counts = new Map<string, number>()

  for (const lesson of data.lessons) {
    const label = lesson.cefrLevel ?? '未评估'
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }

  return Array.from(counts, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
}

function HeadphonesIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 13a8 8 0 0 1 16 0" />
      <path d="M4 13v4a2 2 0 0 0 2 2h1v-7H6a2 2 0 0 0-2 2Z" />
      <path d="M20 13v4a2 2 0 0 1-2 2h-1v-7h1a2 2 0 0 1 2 2Z" />
      <path d="M9 18c1.8 1.1 4.2 1.1 6 0" />
    </svg>
  )
}

function CoursesPage() {
  const { data, loading, error } = useCourseList()
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<LessonStatusFilter>('all')
  const [progressMap, setProgressMap] = useState(() => readLessonProgress())
  const [isListScrolled, setIsListScrolled] = useState(false)
  const courseListRef = useRef<HTMLDivElement>(null)
  const lessons = data?.lessons ?? []
  const rows = lessons
    .map((lesson) => {
      const progress = progressMap[lesson.id]
      const status = getLessonStatus(progress ?? { progress: 0 })
      return { lesson, progress, status }
    })
    .filter(({ lesson, status }) =>
      matchesLessonStatusFilter(statusFilter, status) && matchesLessonSearch(lesson, query),
    )

  useEffect(() => {
    const refresh = () => setProgressMap(readLessonProgress())
    window.addEventListener(PROGRESS_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(PROGRESS_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  useEffect(() => {
    const courseList = courseListRef.current
    if (!courseList) return

    const updateScrollState = () => setIsListScrolled(courseList.scrollTop > 8)
    updateScrollState()
    courseList.addEventListener('scroll', updateScrollState, { passive: true })
    return () => courseList.removeEventListener('scroll', updateScrollState)
  }, [rows.length])

  const statusCounts = lessons.reduce<Record<LessonStatus | 'all', number>>(
    (counts, lesson) => {
      const status = getLessonStatus(progressMap[lesson.id] ?? { progress: 0 })
      counts.all += 1
      counts[status] += 1
      return counts
    },
    { all: 0, todo: 0, doing: 0, done: 0 },
  )

  return (
    <section className={cn('courses-page mx-auto grid max-w-6xl gap-3', isListScrolled && 'is-list-scrolled')}>
      <div className="course-page-top">
        <PageHeading eyebrow="Lessons" title={PAGE_TITLES.courses} />
        {loading && <StateText>正在加载课程列表...</StateText>}
        {error && <StateText>课程列表加载失败：{error}</StateText>}

        <div className="sticky top-14 z-10 flex flex-wrap items-center gap-3 border-b border-[var(--border-soft)] bg-[color-mix(in_srgb,var(--bg)_88%,transparent)] py-3 backdrop-blur-xl">
          <label className="sr-only" htmlFor="course-search">搜索课程</label>
          <input
            id="course-search"
            className="min-w-[220px] flex-1 rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-4 py-2.5 text-sm text-[var(--fg)] outline-none transition placeholder:text-[var(--meta)] focus:border-[var(--accent)]"
            placeholder="搜索课程、课号、等级或分类"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {COURSE_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.value}
                className={cn(
                  'rounded-[var(--radius-pill)] border px-3 py-1.5 transition',
                  statusFilter === filter.value
                    ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
                    : 'border-[var(--border-soft)] bg-[var(--surface-warm)] text-[var(--muted)] hover:bg-[var(--surface)]',
                )}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
              >
                {filter.label} {statusCounts[filter.value]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="course-library overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-soft)]">
        <div className="grid grid-cols-[76px_minmax(0,1fr)_150px_190px] gap-4 border-b border-[var(--border-soft)] bg-[var(--surface)] px-4 py-2 font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--meta)] max-lg:hidden">
          <span>Lesson</span>
          <span>Title</span>
          <span>级别</span>
          <span>Progress</span>
        </div>
        <div className="course-library-scroll divide-y divide-[var(--border-soft)]" ref={courseListRef}>
          {rows.map(({ lesson, progress, status }) => (
            <Link
              key={lesson.id}
              className="course-library-row grid gap-3 bg-[var(--surface-warm)] px-4 py-2 transition hover:bg-[var(--surface)] lg:grid-cols-[76px_minmax(0,1fr)_150px_190px] lg:items-center lg:gap-4"
              to={courseHref(lesson.id, progress)}
            >
              <span className="font-[var(--font-mono)] text-xs text-[var(--meta)]">{lesson.id}</span>
              <span className="min-w-0">
                <span className="block truncate font-semibold">{lesson.displayTitle}</span>
                <span className="mt-1 block text-xs text-[var(--meta)] lg:hidden">
                  {lessonListMeta(lesson, status)}
                </span>
              </span>
              <span className="hidden lg:block">{lessonLevelBadge(lesson)}</span>
              <span className="course-row-progress grid gap-1">
                <span className="flex items-center justify-between gap-2 text-xs text-[var(--meta)]">
                  <span>{lessonStatusLabel(status)}</span>
                  <span>{formatCourseProgress(progress)}</span>
                </span>
                <span className="h-1.5 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--surface)]">
                  <span
                    className="block h-full rounded-[var(--radius-pill)] bg-[var(--accent)]"
                    style={{ width: progressBarWidth(progress) }}
                  />
                </span>
              </span>
            </Link>
          ))}
          {rows.length === 0 && (
            <p className="bg-[var(--surface-warm)] px-4 py-8 text-sm text-[var(--muted)]">
              没有匹配的课程。
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

const COURSE_STATUS_FILTERS: Array<{ value: LessonStatusFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'doing', label: '学习中' },
  { value: 'done', label: '已完成' },
  { value: 'todo', label: '未开始' },
]

function lessonStatusLabel(status: LessonStatus) {
  if (status === 'done') return '已完成'
  if (status === 'doing') return '学习中'
  return '未开始'
}

function courseHref(lessonId: string, progress?: { currentTime: number }) {
  return progress ? '/courses/' + lessonId + '?t=' + Math.floor(progress.currentTime) : '/courses/' + lessonId
}

function formatCourseProgress(progress?: { progress: number; currentTime: number }) {
  return progress ? '播放 ' + progress.progress + '% · ' + formatTime(progress.currentTime) : '未开始'
}

function progressBarWidth(progress?: { progress: number }) {
  return (progress?.progress ?? 0) + '%'
}

function lessonLevelBadge(lesson: Pick<CourseLesson, 'level' | 'levelCode' | 'cefrLevel'>) {
  const levelBadge = getLevelBadge(lesson)
  const levelLabel = lesson.cefrLevel ? `CEFR ${lesson.cefrLevel}` : formatCourseLevel(lesson.level)
  if (!levelLabel) return null

  return (
    <span className="course-level-pill">
      <span className={`level-badge ${levelBadge.className}`} aria-hidden="true">
        {levelBadge.code}
      </span>
      <span>{levelLabel}</span>
    </span>
  )
}

function lessonListMeta(lesson: Pick<CourseLesson, 'level' | 'levelCode' | 'cefrLevel'>, status: LessonStatus) {
  const levelLabel = lesson.cefrLevel ? `CEFR ${lesson.cefrLevel}` : formatCourseLevel(lesson.level)
  return levelLabel ? levelLabel + ' · ' + lessonStatusLabel(status) : lessonStatusLabel(status)
}

function StateText({ children }: { children: ReactNode }) {
  return <p className="text-sm text-[var(--muted)]">{children}</p>
}

const CLEAR_MEMORY_CONFIRM_TEXT = '清空记忆'

function SettingsPage({
  theme,
  onCycleTheme,
}: {
  theme: Theme
  onCycleTheme: () => void
}) {
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)
  const [clearConfirmText, setClearConfirmText] = useState('')
  const [clearMessage, setClearMessage] = useState<string | null>(null)
  const canClearMemory = clearConfirmText === CLEAR_MEMORY_CONFIRM_TEXT

  const handleClearMemory = () => {
    if (!canClearMemory) return

    clearLessonProgress()
    clearReviewMemory()
    setClearConfirmText('')
    setClearConfirmOpen(false)
    setClearMessage('学习记忆已清空。主题和字幕设置已保留。')
  }

  return (
    <section className="mx-auto grid max-w-5xl gap-6">
      <PageHeading eyebrow="Settings" title={PAGE_TITLES.settings} />
      <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-5">
        <p className="text-sm text-[var(--muted)]">外观</p>
        <div className="mt-3 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold">主题</p>
            <p className="text-sm text-[var(--muted)]">在亮色与暗色主题之间切换。</p>
          </div>
          <ThemeToggle theme={theme} onToggle={onCycleTheme} />
        </div>
      </div>

      <section className="rounded-[var(--radius-lg)] border border-[color-mix(in_srgb,var(--danger)_42%,var(--border-soft))] bg-[color-mix(in_srgb,var(--danger)_6%,var(--surface-warm))] p-5">
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--danger)]">
          危险操作
        </p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <h2 className="font-semibold">清空学习记忆</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              这会删除课程学习进度、生词本和每日复习内容。这个操作无法撤销，但不会影响主题和字幕模式设置。
            </p>
          </div>
          <button
            className="rounded-[var(--radius-md)] border border-[var(--danger)] px-4 py-2 text-sm font-semibold text-[var(--danger)] transition hover:bg-[color-mix(in_srgb,var(--danger)_10%,transparent)]"
            type="button"
            onClick={() => {
              setClearConfirmOpen(true)
              setClearMessage(null)
            }}
          >
            清空学习记忆
          </button>
        </div>

        {clearConfirmOpen && (
          <div className="mt-4 rounded-[var(--radius-md)] border border-[color-mix(in_srgb,var(--danger)_48%,var(--border-soft))] bg-[var(--surface-warm)] p-4">
            <p className="font-semibold text-[var(--danger)]">请确认你要永久清空学习记忆</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              输入 <span className="font-semibold text-[var(--fg)]">{CLEAR_MEMORY_CONFIRM_TEXT}</span> 后才能继续。
            </p>
            <label className="mt-4 block text-sm font-semibold" htmlFor="clear-memory-confirm">
              确认文字
            </label>
            <input
              id="clear-memory-confirm"
              className="mt-2 w-full rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--fg)] outline-none transition placeholder:text-[var(--meta)] focus:border-[var(--danger)]"
              placeholder={CLEAR_MEMORY_CONFIRM_TEXT}
              value={clearConfirmText}
              onChange={(event) => setClearConfirmText(event.target.value)}
            />
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                className="rounded-[var(--radius-md)] bg-[var(--danger)] px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-45"
                type="button"
                disabled={!canClearMemory}
                onClick={handleClearMemory}
              >
                确认清空
              </button>
              <button
                className="rounded-[var(--radius-md)] border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold text-[var(--muted)] transition hover:bg-[var(--surface)]"
                type="button"
                onClick={() => {
                  setClearConfirmOpen(false)
                  setClearConfirmText('')
                }}
              >
                取消
              </button>
            </div>
          </div>
        )}

        {clearMessage && (
          <p className="mt-4 rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--success)_10%,transparent)] px-4 py-3 text-sm text-[var(--success)]">
            {clearMessage}
          </p>
        )}
      </section>
    </section>
  )
}

function PageHeading({
  eyebrow,
  title,
}: {
  eyebrow: string
  title: string
}) {
  return (
    <div>
      <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--accent)]">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold tracking-[var(--tracking-display)]">
        {title}
      </h1>
    </div>
  )
}

export default App
