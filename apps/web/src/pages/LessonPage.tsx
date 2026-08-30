import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ThemeToggle, type Theme } from '@/components/ThemeToggle'
import { CourseSidebar } from '@/components/lesson/CourseSidebar'
import { PersistentPlayer } from '@/components/lesson/PersistentPlayer'
import { SubtitlePanel, type SubtitleWordSelection } from '@/components/lesson/SubtitlePanel'
import { WordDefinitionPopover } from '@/components/lesson/WordDefinitionPopover'
import { useCourseList, useLessonSubtitles, type SubtitleMode } from '@/data/courseList'
import {
  calculateProgress,
  completeLesson,
  readLessonProgress,
  saveLessonProgress,
  setLessonBlindRating,
  setLessonStage,
  type BlindRating,
  type LearningStage,
  type LessonProgressMap,
} from '@/data/progressStore'
import { addReviewSentence, addVocab, isVocabSaved, removeVocabByWord } from '@/data/vocabStore'

type LessonPageProps = {
  theme: Theme
  onCycleTheme: () => void
}

const SUBTITLE_MODE_STORE = 'ep_subtitle_mode'
const SUBTITLE_MODES: SubtitleMode[] = ['bilingual', 'off', 'zh', 'en']
const FORCED_SUBTITLES: Partial<Record<LearningStage, SubtitleMode>> = {
  blind: 'off',
  intensive: 'en',
  shadowing: 'en',
  final: 'off',
}
const MASTERY_ITEMS = ['无字幕理解 ≥80%', '掌握 3–5 个表达', '跟读至少 3 句', '完成口头复述']

function readSubtitleMode(): SubtitleMode {
  try {
    const value = localStorage.getItem(SUBTITLE_MODE_STORE)
    return SUBTITLE_MODES.includes(value as SubtitleMode) ? (value as SubtitleMode) : 'bilingual'
  } catch {
    return 'bilingual'
  }
}

function saveSubtitleMode(mode: SubtitleMode) {
  try {
    localStorage.setItem(SUBTITLE_MODE_STORE, mode)
  } catch {
    // localStorage can be unavailable in private or restricted contexts.
  }
}

export function LessonPage({ theme, onCycleTheme }: LessonPageProps) {
  const { lessonId } = useParams()
  const [searchParams] = useSearchParams()
  const { data, loading, error } = useCourseList()
  const lesson = data?.lessons.find((item) => item.id === lessonId)
  const activeLesson = lesson
  const [subtitleMode, setSubtitleMode] = useState<SubtitleMode>(() => readSubtitleMode())
  const [guidedMode, setGuidedMode] = useState(true)
  const [progressMap, setProgressMap] = useState<LessonProgressMap>(() => readLessonProgress())
  const progressMapRef = useRef(progressMap)
  const savedProgress = activeLesson ? progressMap[activeLesson.id] : undefined
  const learningStage = savedProgress?.stage ?? 'blind'
  const forcedSubtitleMode = guidedMode ? FORCED_SUBTITLES[learningStage] : undefined
  const effectiveSubtitleMode = forcedSubtitleMode ?? subtitleMode
  const subtitles = useLessonSubtitles(activeLesson?.id, effectiveSubtitleMode)
  const [masteryState, setMasteryState] = useState({ lessonId: '', checks: MASTERY_ITEMS.map(() => false) })
  const masteryChecks = masteryState.lessonId === activeLesson?.id ? masteryState.checks : MASTERY_ITEMS.map(() => false)
  const [playbackState, setPlaybackState] = useState({
    lessonId: '',
    currentTime: 0,
    duration: 0,
  })
  const [seekRequest, setSeekRequest] = useState<{
    time: number
    version: number
    autoplay?: boolean
  } | null>(null)
  const [autoplayRequest, setAutoplayRequest] = useState<{
    lessonId: string
    version: number
  } | null>(null)
  const [selectedWord, setSelectedWord] = useState<SubtitleWordSelection | null>(null)
  const [, setVocabVersion] = useState(0)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const handledSeekParamRef = useRef('')
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const learningGuideTitleRef = useRef<HTMLHeadingElement>(null)
  const learningCurrentRef = useRef<HTMLDivElement>(null)
  const previousLearningStageRef = useRef(learningStage)
  const progressSaveTimerRef = useRef<number | null>(null)
  const pendingProgressRef = useRef<{
    lessonId: string
    time: number
    duration: number
  } | null>(null)

  const updateProgressMap = (updater: (current: LessonProgressMap) => LessonProgressMap) => {
    setProgressMap((current) => {
      const next = updater(current)
      progressMapRef.current = next
      return next
    })
  }

  const flushProgress = useCallback(() => {
    const pending = pendingProgressRef.current
    pendingProgressRef.current = null
    if (progressSaveTimerRef.current !== null) {
      window.clearTimeout(progressSaveTimerRef.current)
      progressSaveTimerRef.current = null
    }
    if (!pending) return

    const next = saveLessonProgress(
      progressMapRef.current,
      pending.lessonId,
      pending.time,
      pending.duration,
    )
    progressMapRef.current = next
    setProgressMap(next)
  }, [])

  const playbackMatchesLesson = playbackState.lessonId === activeLesson?.id
  const currentTime = playbackMatchesLesson
    ? playbackState.currentTime
    : (savedProgress?.currentTime ?? 0)
  const duration = playbackMatchesLesson
    ? playbackState.duration
    : (savedProgress?.duration ?? 0)

  const handleSubtitleModeChange = (mode: SubtitleMode) => {
    if (forcedSubtitleMode) return
    setSubtitleMode(mode)
    saveSubtitleMode(mode)
  }

  const handleWordSelect = (selection: SubtitleWordSelection) => {
    setSelectedWord(selection)
  }

  const updateStage = (stage: LearningStage) => {
    if (!activeLesson) return
    updateProgressMap((current) => setLessonStage(current, activeLesson.id, stage))
  }

  const rateBlindListen = (rating: BlindRating) => {
    if (!activeLesson) return
    updateProgressMap((current) => setLessonBlindRating(current, activeLesson.id, rating))
  }

  const rememberProgress = (time: number, nextDuration = duration) => {
    if (!activeLesson || nextDuration <= 0) return
    pendingProgressRef.current = {
      lessonId: activeLesson.id,
      time,
      duration: nextDuration,
    }
    if (progressSaveTimerRef.current === null) {
      progressSaveTimerRef.current = window.setTimeout(() => {
        progressSaveTimerRef.current = null
        flushProgress()
      }, 750)
    }
  }

  const handleTimeUpdate = (time: number) => {
    if (!activeLesson) return
    setPlaybackState((current) => ({
      lessonId: activeLesson.id,
      currentTime: time,
      duration: current.lessonId === activeLesson.id ? current.duration : duration,
    }))
    rememberProgress(time)
  }

  const handleDurationChange = (nextDuration: number) => {
    if (!activeLesson) return
    setPlaybackState((current) => ({
      lessonId: activeLesson.id,
      currentTime: current.lessonId === activeLesson.id ? current.currentTime : currentTime,
      duration: nextDuration,
    }))
    rememberProgress(currentTime, nextDuration)
  }

  useEffect(() => () => flushProgress(), [activeLesson?.id, flushProgress])

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(null), 1800)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    if (!navOpen) return

    const courseList = document.getElementById('courseList')
    const getFocusableElements = () => Array.from(
      courseList?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? [],
    )
    getFocusableElements()[0]?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setNavOpen(false)
        menuButtonRef.current?.focus()
        return
      }
      const focusableElements = getFocusableElements()
      if (event.key !== 'Tab' || focusableElements.length === 0) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]
      if (!courseList?.contains(document.activeElement)) {
        event.preventDefault()
        const focusTarget = event.shiftKey ? last : first
        focusTarget.focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [navOpen])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 1180px)')
    const handleChange = () => {
      setNavOpen(false)
      if (mediaQuery.matches && document.getElementById('courseList')?.contains(document.activeElement)) {
        window.requestAnimationFrame(() => menuButtonRef.current?.focus())
      }
    }

    mediaQuery.addEventListener('change', handleChange)
    return () => mediaQuery.removeEventListener('change', handleChange)
  }, [])

  useEffect(() => {
    if (previousLearningStageRef.current === learningStage) return
    previousLearningStageRef.current = learningStage
    window.requestAnimationFrame(() => {
      const focusTarget = learningCurrentRef.current ?? learningGuideTitleRef.current
      focusTarget?.focus()
    })
  }, [learningStage])

  useEffect(() => {
    if (!activeLesson) return

    const timeParam = searchParams.get('t')
    const time = Number(timeParam)
    const seekKey = `${activeLesson.id}:${timeParam ?? ''}`
    if (!timeParam || !Number.isFinite(time) || time < 0 || handledSeekParamRef.current === seekKey) {
      return
    }

    handledSeekParamRef.current = seekKey
    setSeekRequest((current) => ({
      time,
      version: (current?.version ?? 0) + 1,
      autoplay: true,
    }))
  }, [activeLesson, searchParams])

  if (loading) {
    return (
      <div className="app lesson-app" id="app">
        <header className="topbar">
          <Link className="brand" to="/dashboard" aria-label="回到仪表盘">
            <span className="logo">E</span>
            EnglishPod
          </Link>
        </header>
        <main className="main p-8 text-[var(--muted)]">正在加载课程...</main>
      </div>
    )
  }

  if (error || !data || !activeLesson) {
    return (
      <div className="app lesson-app" id="app">
        <header className="topbar">
          <Link className="brand" to="/dashboard" aria-label="回到仪表盘">
            <span className="logo">E</span>
            EnglishPod
          </Link>
        </header>
        <main className="main p-8 text-[var(--muted)]">
          课程加载失败：{error ?? (lessonId ? '课程不存在' : '没有可用课程')}
        </main>
      </div>
    )
  }

  const subtitleMessage = subtitles.loading
    ? '正在加载字幕...'
    : subtitles.error
      ? `字幕加载失败：${subtitles.error}`
      : undefined
  const activeProgress = calculateProgress(currentTime, duration)
  const selectedWordSaved =
    selectedWord && activeLesson
      ? isVocabSaved(
          selectedWord.word,
          activeLesson.id,
          selectedWord.cue.start,
          selectedWord.cue.text,
        )
      : false

  const closeCourseNav = () => {
    setNavOpen(false)
    window.requestAnimationFrame(() => menuButtonRef.current?.focus())
  }

  return (
    <div className={`app lesson-app${navOpen ? ' nav-open' : ''}`} id="app">
      <header className="topbar">
        <button
          ref={menuButtonRef}
          className="menu-toggle"
          type="button"
          aria-label="课程列表"
          aria-controls="courseList"
          aria-expanded={navOpen}
          onClick={() => setNavOpen((open) => !open)}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            aria-hidden="true"
          >
            <path d="M2 4.5h14M2 9h14M2 13.5h14" />
          </svg>
        </button>

        <Link className="brand" to="/dashboard" aria-label="回到仪表盘">
          <span className="logo">E</span>
          EnglishPod
        </Link>
        <span className="topbar-spacer" />
        <ThemeToggle theme={theme} onToggle={onCycleTheme} />
      </header>

      <div className="body-grid">
        <button className="scrim" type="button" aria-label="关闭课程列表" onClick={closeCourseNav} />
        <CourseSidebar
          lessons={data.lessons}
          activeLesson={activeLesson}
          progressMap={progressMap}
          activeProgress={activeProgress}
          onSelectLesson={(selectedLessonId) => {
            closeCourseNav()
            setAutoplayRequest((current) => ({
              lessonId: selectedLessonId,
              version: (current?.version ?? 0) + 1,
            }))
          }}
        />

        <main className="main">
          <div className="lesson-nav-row">
            <Link className="back-link" to="/courses" aria-label="返回课程库">
              <svg
                width="18"
                height="18"
                viewBox="0 0 18 18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11 4 6 9l5 5" />
              </svg>
            </Link>
            <span className="crumbs" aria-label="当前位置">
              <Link to="/courses">课程库</Link>
              <span aria-hidden="true">/</span>
              <b>{activeLesson.title}</b>
            </span>
          </div>

          <div className="lesson-workspace">
            <section className="learning-guide" aria-labelledby="learning-guide-title">
              <div className="learning-guide-head">
                <div>
                  <h2 ref={learningGuideTitleRef} id="learning-guide-title" tabIndex={-1}>{savedProgress?.completedAt ? '本课已学习' : '引导式听力学习'}</h2>
                  <p>{guidedMode ? '按步骤听懂、跟读并完成掌握自检' : '字幕和播放设置由你控制'}</p>
                </div>
                <div className="learning-mode-switch" role="group" aria-label="学习方式">
                  <button type="button" className={guidedMode ? 'active' : ''} aria-pressed={guidedMode} onClick={() => setGuidedMode(true)}>学习模式</button>
                  <button type="button" className={!guidedMode ? 'active' : ''} aria-pressed={!guidedMode} onClick={() => setGuidedMode(false)}>自由听</button>
                </div>
              </div>
              {guidedMode && !savedProgress?.completedAt && (
                <div className="learning-steps">
                  <ol className="learning-step-list" aria-label="学习步骤">
                    {['盲听', '英文精听', '跟读', '最终复听', '掌握自检'].map((label, index) => {
                      const currentIndex = ['blind', 'intensive', 'shadowing', 'final', 'complete'].indexOf(learningStage)
                      const isCurrent = index === currentIndex
                      const isDone = index < currentIndex
                      return <li key={label} className={isCurrent ? 'active' : isDone ? 'done' : ''} aria-current={isCurrent ? 'step' : undefined}>{index + 1}. {label}{isDone && <span className="sr-only">（已完成）</span>}</li>
                    })}
                  </ol>
                  <div ref={learningCurrentRef} className="learning-current" tabIndex={-1}>
                    {learningStage === 'blind' && <>
                      <h3>先盲听一遍</h3><p>关闭字幕，建议使用 1.0x。听完后选择首遍理解率。</p>
                      <div className="learning-actions">{([['under60', '低于 60%'], ['60to85', '60%–85%'], ['over85', '高于 85%']] as const).map(([value, label]) => <button key={value} type="button" onClick={() => rateBlindListen(value)}>{label}</button>)}</div>
                    </>}
                    {learningStage === 'intensive' && <>
                      <h3>英文字幕精听</h3><p>字幕已锁定为英文。逐句听清表达，可以点击句子定位和查词。</p>
                      <button className="learning-primary" type="button" onClick={() => updateStage('shadowing')}>精听完成，开始跟读</button>
                    </>}
                    {learningStage === 'shadowing' && <>
                      <h3>跟读至少 3 句</h3><p>选择三句反复播放并模仿语音语调，完成后自行确认。</p>
                      <button className="learning-primary" type="button" onClick={() => updateStage('final')}>我已跟读至少 3 句</button>
                    </>}
                    {learningStage === 'final' && <>
                      <h3>最终无字幕复听</h3><p>字幕已关闭。复听后完成四项掌握自检，全部确认才可完成本课。</p>
                      <div className="mastery-checks">{MASTERY_ITEMS.map((item, index) => <label key={item}><input type="checkbox" checked={masteryChecks[index]} onChange={(event) => setMasteryState({ lessonId: activeLesson.id, checks: masteryChecks.map((checked, itemIndex) => itemIndex === index ? event.target.checked : checked) })} />{item}</label>)}</div>
                      <button className="learning-primary" type="button" disabled={!masteryChecks.every(Boolean)} onClick={() => activeLesson && updateProgressMap((current) => completeLesson(current, activeLesson.id))}>标记本课已学习</button>
                    </>}
                  </div>
                </div>
              )}
            </section>

            <SubtitlePanel
              cues={subtitles.data ?? []}
              currentTime={currentTime}
              message={subtitleMessage}
              obscured={effectiveSubtitleMode === 'off'}
              onWordSelect={handleWordSelect}
              onSeek={(time) => {
                setSelectedWord(null)
                setSeekRequest((current) => ({
                  time,
                  version: (current?.version ?? 0) + 1,
                  autoplay: true,
                }))
              }}
              onSentenceReviewAdd={(cue) => {
                addReviewSentence({
                  lessonId: activeLesson.id,
                  audioStart: cue.start,
                  audioEnd: cue.end,
                  sourceText: cue.text,
                })
                setToastMessage('整句已加入复习，明天提醒你再听一遍')
              }}
            />
          </div>
          <WordDefinitionPopover
            selection={selectedWord}
            saved={selectedWordSaved}
            onClose={() => setSelectedWord(null)}
            onSave={(entry, selection) => {
              addVocab({
                word: entry.word,
                phonetic: entry.phonetic,
                translation: entry.translation,
                pos: entry.pos,
                lessonId: activeLesson.id,
                audioStart: selection.cue.start,
                audioEnd: selection.cue.end,
                sourceText: selection.cue.text,
              })
              setVocabVersion((version) => version + 1)
              setToastMessage(`${entry.word} 已加入生词本`)
              setSelectedWord(null)
            }}
            onRemove={(entry) => {
              if (!selectedWord) return
              removeVocabByWord(
                entry.word,
                activeLesson.id,
                selectedWord.cue.start,
                selectedWord.cue.text,
              )
              setVocabVersion((version) => version + 1)
              setToastMessage(`${entry.word} 已移出生词本`)
            }}
          />
          {toastMessage && <div className="lesson-toast">{toastMessage}</div>}
        </main>
      </div>

      <PersistentPlayer
        lesson={activeLesson}
        lessons={data.lessons}
        currentTime={currentTime}
        seekRequest={seekRequest}
        autoplayRequest={autoplayRequest}
        resumeTime={progressMap[activeLesson.id]?.currentTime ?? 0}
        onTimeUpdate={handleTimeUpdate}
        onFlushProgress={flushProgress}
        subtitleMode={effectiveSubtitleMode}
        subtitleLocked={Boolean(forcedSubtitleMode)}
        onSubtitleModeChange={handleSubtitleModeChange}
        onDurationChange={handleDurationChange}
        onAutoplayLesson={(nextLessonId) =>
          setAutoplayRequest((current) => ({
            lessonId: nextLessonId,
            version: (current?.version ?? 0) + 1,
          }))
        }
      />
    </div>
  )
}
