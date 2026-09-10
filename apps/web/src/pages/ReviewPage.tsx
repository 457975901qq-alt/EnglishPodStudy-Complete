import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { PAGE_TITLES } from '@/lib/pageTitles'
import {
  formatTime,
  getResourceUrl,
  useCourseList,
  type CourseLesson,
} from '@/data/courseList'
import {
  getDueReviewItems,
  rateReviewItem,
  REVIEW_CHANGE_EVENT,
  updateReviewSessionQueue,
  type ReviewItem,
  type ReviewRating,
} from '@/data/reviewStore'

const RATING_LABELS: Record<ReviewRating, string> = {
  again: '完全没懂',
  hard: '有点印象',
  good: '听懂了',
  easy: '太简单',
}

const SENTENCE_RATING_LABELS: Record<ReviewRating, string> = {
  again: '没听出来',
  hard: '听出一部分',
  good: '听懂了',
  easy: '能跟读',
}
const CJK_RE = /[\u3400-\u9fff\uf900-\ufaff]/

function itemLessonId(item: ReviewItem) {
  return item.type === 'word' ? item.context.lessonId : item.sentence.lessonId
}

function itemStart(item: ReviewItem) {
  return item.type === 'word' ? item.context.audioStart : item.sentence.audioStart
}

function itemEnd(item: ReviewItem) {
  return item.type === 'word' ? item.context.audioEnd : item.sentence.audioEnd
}

function lessonTitle(lessons: CourseLesson[], lessonId: string) {
  return lessons.find((lesson) => lesson.id === lessonId)?.displayTitle ?? `LESSON ${lessonId}`
}

function englishLines(text: string) {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !CJK_RE.test(line))

  return lines
    .filter((line, index) => index === 0 || line.toLocaleLowerCase() !== lines[index - 1].toLocaleLowerCase())
    .join('\n')
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function HighlightedText({ text, word }: { text: string; word: string }) {
  const pattern = new RegExp(`\\b(${escapeRegex(word)})\\b`, 'ig')
  const parts = text.split(pattern)

  return (
    <>
      {parts.map((part, index) =>
        part.toLowerCase() === word.toLowerCase() ? (
          <mark
            key={`${part}-${index}`}
            className="rounded bg-[color-mix(in_srgb,var(--accent)_18%,transparent)] px-1 text-[var(--fg)]"
          >
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </>
  )
}

function ReviewAudio({ lessonId, start, end }: { lessonId: string; start: number; end: number }) {
  const audioRef = useRef<HTMLAudioElement>(null)

  const resetToStart = () => {
    const audio = audioRef.current
    if (!audio) return
    audio.currentTime = start
  }

  return (
    <div className="grid gap-2">
      <audio
        ref={audioRef}
        className="w-full"
        controls
        preload="metadata"
        src={getResourceUrl(lessonId, 'lesson.mp3')}
        onLoadedMetadata={resetToStart}
        onPlay={(event) => {
          const audio = event.currentTarget
          if (audio.currentTime < start || audio.currentTime > end) audio.currentTime = start
        }}
        onTimeUpdate={(event) => {
          const audio = event.currentTarget
          if (end > start && audio.currentTime >= end) audio.pause()
        }}
      />
      <p className="text-xs text-[var(--meta)]">
        片段 {formatTime(start)} - {formatTime(end)}
      </p>
    </div>
  )
}

export function ReviewPage() {
  const { data } = useCourseList()
  const lessons = useMemo(() => data?.lessons ?? [], [data])
  const [items, setItems] = useState<ReviewItem[]>(() => getDueReviewItems())
  const [started, setStarted] = useState(false)
  const [answerVisible, setAnswerVisible] = useState(false)
  const [completed, setCompleted] = useState(0)

  useEffect(() => {
    const refresh = () => setItems(getDueReviewItems())
    window.addEventListener(REVIEW_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(REVIEW_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const wordCount = items.filter((item) => item.type === 'word').length
  const sentenceCount = items.filter((item) => item.type === 'sentence').length
  const activeItem = items[0]
  const hasFinishedSession = started && !activeItem

  const handleRate = (rating: ReviewRating) => {
    if (!activeItem) return
    const ratedItem: ReviewItem =
      activeItem.type === 'word'
        ? (() => {
            const entry = rateReviewItem(activeItem, rating)
            return { ...activeItem, entry, review: entry.review }
          })()
        : (() => {
            const sentence = rateReviewItem(activeItem, rating)
            return { ...activeItem, sentence, review: sentence.review }
          })()
    setCompleted((value) => value + 1)
    setAnswerVisible(false)
    setItems((current) => updateReviewSessionQueue(current, ratedItem, rating))
  }

  if (items.length === 0 && !hasFinishedSession) {
    return (
      <section className="mx-auto grid max-w-4xl gap-6">
        <ReviewHeading />
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-6">
          <p className="font-semibold">今天没有到期复习。</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            听课时点击单词加入生词本，或把整句加入复习，明天就会出现在这里。
          </p>
          <Link
            className="mt-4 inline-flex rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-on)]"
            to="/courses"
          >
            去课程库
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="mx-auto grid max-w-4xl gap-6">
      <ReviewHeading />

      {!started && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-6">
          <p className="text-sm text-[var(--muted)]">今日任务</p>
          <h2 className="mt-2 font-[var(--font-display)] text-3xl font-semibold">
            今天 {items.length} 个复习
          </h2>
          <p className="mt-3 text-[var(--muted)]">
            {wordCount} 个单词，{sentenceCount} 个句子，预计 {Math.max(1, items.length)} 分钟。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="rounded-[var(--radius-md)] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-on)]"
              type="button"
              onClick={() => setStarted(true)}
            >
              开始复习
            </button>
            <Link
              className="rounded-[var(--radius-md)] border border-[var(--border-soft)] px-5 py-3 text-sm font-semibold text-[var(--muted)]"
              to="/dashboard"
            >
              稍后
            </Link>
          </div>
        </div>
      )}

      {started && activeItem && (
        <article className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--accent)]">
              {activeItem.type === 'word' ? 'Word Review' : 'Sentence Review'}
            </p>
            <p className="text-sm text-[var(--muted)]">
              已完成 {completed} 个，剩余 {items.length} 个
            </p>
          </div>

          <div className="mt-5 grid gap-5">
            <ReviewAudio
              lessonId={itemLessonId(activeItem)}
              start={itemStart(activeItem)}
              end={itemEnd(activeItem)}
            />

            {activeItem.type === 'word' ? (
              <div>
                <p className="text-sm text-[var(--muted)]">听原句，回忆高亮单词在这里的意思。</p>
                <p className="mt-3 whitespace-pre-line text-2xl font-semibold leading-9">
                  <HighlightedText
                    text={englishLines(activeItem.context.sourceText)}
                    word={activeItem.entry.word}
                  />
                </p>
                <p className="mt-3 text-sm text-[var(--meta)]">
                  目标词：<span className="font-semibold text-[var(--fg)]">{activeItem.entry.word}</span>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-[var(--muted)]">
                  先只听音频，尝试在心里复述这整句话的意思。
                </p>
                {!answerVisible && (
                  <p className="mt-3 rounded-[var(--radius-md)] bg-[var(--surface)] p-4 text-sm text-[var(--muted)]">
                    字幕已隐藏。准备好后再显示答案。
                  </p>
                )}
              </div>
            )}

            {!answerVisible ? (
              <button
                className="rounded-[var(--radius-md)] bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-[var(--accent-on)]"
                type="button"
                onClick={() => setAnswerVisible(true)}
              >
                显示答案
              </button>
            ) : (
              <div className="grid gap-4">
                <div className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  {activeItem.type === 'word' ? (
                    <>
                      <p className="text-2xl font-semibold">{activeItem.entry.word}</p>
                      {activeItem.entry.phonetic && (
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          /{activeItem.entry.phonetic}/
                        </p>
                      )}
                      <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--fg-2)]">
                        {activeItem.entry.translation}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="whitespace-pre-line text-xl font-semibold leading-8">
                        {activeItem.sentence.sourceText}
                      </p>
                      {activeItem.sentence.translation && (
                        <p className="mt-3 text-sm text-[var(--muted)]">
                          {activeItem.sentence.translation}
                        </p>
                      )}
                    </>
                  )}
                  <p className="mt-4 text-xs text-[var(--meta)]">
                    {lessonTitle(lessons, itemLessonId(activeItem))}
                  </p>
                  <Link
                    className="mt-3 inline-flex text-sm font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                    to={`/courses/${itemLessonId(activeItem)}?t=${Math.floor(itemStart(activeItem))}`}
                  >
                    回到原课
                  </Link>
                </div>

                <div className="grid gap-2 sm:grid-cols-4">
                  {(['again', 'hard', 'good', 'easy'] as ReviewRating[]).map((rating) => (
                    <button
                      key={rating}
                      className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface-warm)] px-3 py-3 text-sm font-semibold transition hover:bg-[var(--surface)]"
                      type="button"
                      onClick={() => handleRate(rating)}
                    >
                      {activeItem.type === 'word'
                        ? RATING_LABELS[rating]
                        : SENTENCE_RATING_LABELS[rating]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>
      )}

      {hasFinishedSession && (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-6">
          <p className="font-semibold">今天这组复习完成了。</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            已完成 {completed} 个项目。系统会根据你的反馈安排下一次出现时间。
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-on)]"
              to="/courses"
            >
              回到课程继续听
            </Link>
            <button
              className="rounded-[var(--radius-md)] border border-[var(--border-soft)] px-4 py-2 text-sm font-semibold text-[var(--muted)]"
              type="button"
              onClick={() => {
                setItems(getDueReviewItems())
                setStarted(false)
                setCompleted(0)
              }}
            >
              再看待复习
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function ReviewHeading() {
  return (
    <div>
      <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--accent)]">
        SRS
      </p>
      <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold tracking-[var(--tracking-display)]">
        {PAGE_TITLES.review}
      </h1>
    </div>
  )
}
