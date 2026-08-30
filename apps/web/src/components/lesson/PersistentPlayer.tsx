import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  formatCourseLevel,
  formatTime,
  getLevelBadge,
  getResourceUrl,
  type CourseLesson,
  type SubtitleMode,
} from '@/data/courseList'
import { shouldAutoplaySeek } from './seekBehavior'
import {
  getEndedPlaybackAction,
  getNextLessonForMode,
  getNextPlaybackMode,
  type PlaybackMode,
} from './playbackMode'

const SPEED_RATES = [0.75, 1, 1.25, 1.5, 2]
const PLAYBACK_MODE_LABELS: Record<PlaybackMode, string> = {
  sequence: '顺序播放',
  shuffle: '随机播放',
  repeat: '循环播放',
}
const SUBTITLE_MODE_LABELS: Record<SubtitleMode, string> = {
  bilingual: '中/英',
  off: '无字幕',
  zh: '中',
  en: '英',
}
const SUBTITLE_MODE_OPTIONS: Array<{ mode: SubtitleMode; label: string }> = [
  { mode: 'bilingual', label: '中英字幕' },
  { mode: 'off', label: '无字幕' },
  { mode: 'zh', label: '仅中文字幕' },
  { mode: 'en', label: '仅英文字幕' },
]
const SPEED_RATE_OPTIONS = SPEED_RATES.map((rate) => ({
  rate,
  label: rate === 1 ? '1.0x' : `${rate}x`,
}))

type PersistentPlayerProps = {
  lesson: CourseLesson
  lessons: CourseLesson[]
  currentTime: number
  seekRequest: { time: number; endTime?: number; version: number; autoplay?: boolean } | null
  autoplayRequest: { lessonId: string; version: number } | null
  resumeTime: number
  subtitleMode: SubtitleMode
  subtitleLocked?: boolean
  onSubtitleModeChange: (mode: SubtitleMode) => void
  onTimeUpdate: (time: number) => void
  onFlushProgress?: () => void
  onDurationChange: (duration: number) => void
  onAutoplayLesson: (lessonId: string) => void
}

function PlaybackModeIcon({ mode }: { mode: PlaybackMode }) {
  if (mode === 'shuffle') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M4 7h3.5c2.5 0 3.8 2.1 5.1 5s2.6 5 5.9 5H20" />
        <path d="M17 14l3 3-3 3" />
        <path d="M4 17h3.5c1.4 0 2.4-.7 3.2-1.8" />
        <path d="M16.8 4 20 7l-3.2 3" />
        <path d="M13.2 8.7C14.4 7.7 15.7 7 17.5 7H20" />
      </svg>
    )
  }

  if (mode === 'repeat') {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
        <path d="M17 2.8 20.2 6 17 9.2" />
        <path d="M4 11V9a3 3 0 0 1 3-3h13" />
        <path d="M7 21.2 3.8 18 7 14.8" />
        <path d="M20 13v2a3 3 0 0 1-3 3H4" />
      </svg>
    )
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
      <path d="M4 7h13" />
      <path d="M14 4l3 3-3 3" />
      <path d="M4 17h13" />
      <path d="M14 14l3 3-3 3" />
    </svg>
  )
}

export function PersistentPlayer({
  lesson,
  lessons,
  currentTime,
  seekRequest,
  autoplayRequest,
  resumeTime,
  subtitleMode,
  subtitleLocked = false,
  onSubtitleModeChange,
  onTimeUpdate,
  onFlushProgress,
  onDurationChange,
  onAutoplayLesson,
}: PersistentPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const clipEndRef = useRef<number | null>(null)
  const subtitleSwitcherRef = useRef<HTMLDivElement>(null)
  const subtitleButtonRef = useRef<HTMLButtonElement>(null)
  const speedSwitcherRef = useRef<HTMLDivElement>(null)
  const speedButtonRef = useRef<HTMLButtonElement>(null)
  const [duration, setDuration] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackRate, setPlaybackRate] = useState(1)
  const [playbackMode, setPlaybackMode] = useState<PlaybackMode>('sequence')
  const [subtitleMenuOpen, setSubtitleMenuOpen] = useState(false)
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false)
  const navigate = useNavigate()
  const lessonIndex = lessons.findIndex((item) => item.id === lesson.id)
  const previousLesson = lessonIndex > 0 ? lessons[lessonIndex - 1] : null
  const nextLesson = getNextLessonForMode(playbackMode, lessons, lesson.id)
  const seekValue = duration > 0 ? Math.min(currentTime, duration) : 0
  const progress = duration > 0 ? (seekValue / duration) * 100 : 0
  const speedLabel = playbackRate === 1 ? '1.0x' : `${playbackRate}x`
  const levelBadge = getLevelBadge(lesson)
  const levelLabel = formatCourseLevel(lesson.level)
  const playbackModeLabel = PLAYBACK_MODE_LABELS[playbackMode]
  const nextPlaybackModeLabel = PLAYBACK_MODE_LABELS[getNextPlaybackMode(playbackMode)]
  const subtitleModeLabel = SUBTITLE_MODE_LABELS[subtitleMode]

  useEffect(() => {
    if (!subtitleMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (subtitleSwitcherRef.current?.contains(event.target as Node)) return
      setSubtitleMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSubtitleMenuOpen(false)
        subtitleButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [subtitleMenuOpen])

  useEffect(() => {
    if (!speedMenuOpen) return

    const handlePointerDown = (event: PointerEvent) => {
      if (speedSwitcherRef.current?.contains(event.target as Node)) return
      setSpeedMenuOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSpeedMenuOpen(false)
        speedButtonRef.current?.focus()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [speedMenuOpen])

  useEffect(() => {
    if (!audioRef.current) return
    audioRef.current.playbackRate = playbackRate
  }, [lesson.id, playbackRate])

  const handleSeek = (time: number) => {
    if (!audioRef.current || duration <= 0) return
    audioRef.current.currentTime = time
    onTimeUpdate(time)
  }

  const selectSpeed = (rate: number) => {
    setPlaybackRate(rate)
    setSpeedMenuOpen(false)
    speedButtonRef.current?.focus()
  }

  const cyclePlaybackMode = () => {
    setPlaybackMode((currentMode) => getNextPlaybackMode(currentMode))
  }

  const selectSubtitleMode = (mode: SubtitleMode) => {
    onSubtitleModeChange(mode)
    setSubtitleMenuOpen(false)
    subtitleButtonRef.current?.focus()
  }

  const handleSubtitleButtonKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (subtitleLocked) return
    const currentIndex = SUBTITLE_MODE_OPTIONS.findIndex((option) => option.mode === subtitleMode)
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
      event.preventDefault()
      selectSubtitleMode(SUBTITLE_MODE_OPTIONS[(currentIndex + 1) % SUBTITLE_MODE_OPTIONS.length].mode)
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
      event.preventDefault()
      selectSubtitleMode(
        SUBTITLE_MODE_OPTIONS[(currentIndex - 1 + SUBTITLE_MODE_OPTIONS.length) % SUBTITLE_MODE_OPTIONS.length].mode,
      )
    }
  }

  const playAudio = async (audio: HTMLAudioElement) => {
    try {
      await audio.play()
      setIsPlaying(true)
    } catch {
      setIsPlaying(false)
    }
  }

  useEffect(() => {
    if (!seekRequest || !audioRef.current) return
    const audio = audioRef.current
    clipEndRef.current = seekRequest.endTime ?? null
    audio.currentTime = seekRequest.time
    if (shouldAutoplaySeek(audio.paused, Boolean(seekRequest.autoplay))) {
      void playAudio(audio)
    }
  }, [seekRequest])
  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (audio.paused) {
      await playAudio(audio)
    } else {
      audio.pause()
      setIsPlaying(false)
    }
  }

  const handleEnded = () => {
    const audio = audioRef.current
    if (clipEndRef.current !== null) {
      clipEndRef.current = null
      setIsPlaying(false)
      return
    }
    onFlushProgress?.()
    const action = getEndedPlaybackAction(playbackMode, lessons, lesson.id)

    if (audio && action.type === 'replay') {
      audio.currentTime = 0
      onTimeUpdate(0)
      void playAudio(audio)
      return
    }

    if (action.type === 'next') {
      setIsPlaying(false)
      onAutoplayLesson(action.lesson.id)
      navigate(`/courses/${action.lesson.id}`)
      return
    }

    setIsPlaying(false)
  }

  return (
    <footer className="player">
      <audio
        key={lesson.id}
        ref={audioRef}
        src={getResourceUrl(lesson.id, 'lesson.mp3')}
        onLoadStart={() => {
          clipEndRef.current = null
          setIsPlaying(false)
          setDuration(0)
          onDurationChange(0)
        }}
        onLoadedMetadata={(event) => {
          const audio = event.currentTarget
          const nextDuration = audio.duration
          const startTime = Math.min(resumeTime, nextDuration)

          audio.playbackRate = playbackRate
          audio.currentTime = startTime
          setDuration(nextDuration)
          onDurationChange(nextDuration)
          onTimeUpdate(startTime)

          if (autoplayRequest?.lessonId === lesson.id) {
            void playAudio(audio)
          }
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget
          const clipEnd = clipEndRef.current
          if (clipEnd !== null && audio.currentTime >= clipEnd) {
            clipEndRef.current = null
            audio.pause()
            audio.currentTime = clipEnd
            setIsPlaying(false)
            onTimeUpdate(clipEnd)
            return
          }
          onTimeUpdate(audio.currentTime)
        }}
        onPause={onFlushProgress}
        onEnded={handleEnded}
      />
      <div className="now">
        <div
          className={`cover level-badge ${levelBadge.className}`}
          aria-label={`等级 ${levelBadge.label}`}
        >
          {levelBadge.code}
        </div>
        <div className="now-text">
          <div className="now-title">{lesson.displayTitle}</div>
          <div className="now-sub">
            LESSON {lesson.id}{levelLabel ? ' · ' + levelLabel : ''}
          </div>
        </div>
      </div>

      <div className="controls" aria-label="播放器控制">
        <div className="btn-row">
          <button
            className="ctrl"
            type="button"
            aria-label="上一课"
            disabled={!previousLesson}
            onClick={() => previousLesson && navigate(`/courses/${previousLesson.id}`)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M7 5h2v14H7zM20 5v14L9 12z" />
            </svg>
          </button>
          <button
            className={`ctrl play${isPlaying ? ' playing' : ''}`}
            type="button"
            aria-label={isPlaying ? '暂停' : '播放'}
            onClick={togglePlay}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              {isPlaying ? (
                <path d="M7 5h4v14H7zM13 5h4v14h-4z" />
              ) : (
                <path d="M8 5v14l11-7z" />
              )}
            </svg>
          </button>
          <button
            className="ctrl"
            type="button"
            aria-label={playbackMode === 'shuffle' ? '随机下一课' : '下一课'}
            disabled={!nextLesson}
            onClick={() => nextLesson && navigate(`/courses/${nextLesson.id}`)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M15 5h2v14h-2zM4 5l11 7L4 19z" />
            </svg>
          </button>
        </div>

        <div className="scrub">
          <span className="time">{formatTime(currentTime)}</span>
          <input
            className="track"
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={seekValue}
            disabled={duration <= 0}
            aria-label="播放进度"
            style={{
              background: `linear-gradient(to right, var(--fg) 0%, var(--fg) ${progress}%, var(--border) ${progress}%, var(--border) 100%)`,
            }}
            onChange={(event) => handleSeek(Number(event.currentTarget.value))}
          />
          <span className="time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="extras">
        <div ref={subtitleSwitcherRef} className={`subtitle-switcher${subtitleMenuOpen ? ' open' : ''}`}>
          <button
            ref={subtitleButtonRef}
            className="subtitle-btn"
            type="button"
            aria-label={`字幕模式：${subtitleModeLabel}`}
            aria-haspopup="menu"
            aria-expanded={subtitleMenuOpen}
            disabled={subtitleLocked}
            title={subtitleLocked ? '学习模式当前阶段已锁定字幕' : undefined}
            onClick={() => { if (!subtitleLocked) setSubtitleMenuOpen((open) => !open); setSpeedMenuOpen(false) }}
            onKeyDown={handleSubtitleButtonKeyDown}
          >
            {subtitleModeLabel}
          </button>
          <div className="subtitle-menu" role="menu" aria-label="字幕选项">
            {SUBTITLE_MODE_OPTIONS.map((option) => {
              const active = option.mode === subtitleMode
              return (
                <button
                  key={option.mode}
                  className={`subtitle-option${active ? ' active' : ''}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => selectSubtitleMode(option.mode)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
        <span className="extras-sep" aria-hidden="true" />
        <button
          className={`mode-toggle${playbackMode === 'sequence' ? '' : ' active'}`}
          type="button"
          aria-label={`播放模式：${playbackModeLabel}，点击切换为${nextPlaybackModeLabel}`}
          title={playbackModeLabel}
          onClick={cyclePlaybackMode}
        >
          <PlaybackModeIcon mode={playbackMode} />
        </button>
        <div ref={speedSwitcherRef} className={`speed-switcher${speedMenuOpen ? ' open' : ''}`}>
          <button
            ref={speedButtonRef}
            className="speed"
            type="button"
            aria-label={`播放速度 ${speedLabel}`}
            aria-haspopup="menu"
            aria-expanded={speedMenuOpen}
            onClick={() => { setSpeedMenuOpen((open) => !open); setSubtitleMenuOpen(false) }}
          >
            {speedLabel}
          </button>
          <div className="speed-menu" role="menu" aria-label="播放速度">
            {SPEED_RATE_OPTIONS.map((option) => {
              const active = option.rate === playbackRate
              return (
                <button
                  key={option.rate}
                  className={`speed-option${active ? ' active' : ''}`}
                  type="button"
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => selectSpeed(option.rate)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </footer>
  )
}
