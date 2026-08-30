import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatTime } from '@/data/courseList'
import { PAGE_TITLES } from '@/lib/pageTitles'
import { WordAudioButton } from '@/components/lesson/WordAudioButton'
import {
  readVocab,
  removeVocab,
  removeVocabContext,
  VOCAB_CHANGE_EVENT,
  type VocabEntry,
} from '@/data/vocabStore'

type VocabFilter = 'all' | 'due' | 'mastered'

function formatDate(value: number) {
  if (!value) return '未知时间'
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}

function formatDueDate(value: number, now: number) {
  if (value <= now) return '今天到期'
  return new Intl.RelativeTimeFormat('zh-CN', { numeric: 'auto' }).format(
    Math.ceil((value - now) / (24 * 60 * 60 * 1000)),
    'day',
  )
}

function reviewLabel(entry: VocabEntry, now: number) {
  if (entry.review.status === 'mastered') return '已掌握'
  if (entry.review.dueAt <= now) return '待复习'
  if (entry.review.status === 'new') return '新词'
  return '学习中'
}

export function VocabPage() {
  const [entries, setEntries] = useState<VocabEntry[]>(() => readVocab())
  const [filter, setFilter] = useState<VocabFilter>('all')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const refresh = () => {
      setNow(Date.now())
      setEntries(readVocab())
    }
    window.addEventListener(VOCAB_CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(VOCAB_CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const handleRemove = (id: string) => {
    removeVocab(id)
    setEntries(readVocab())
  }

  const handleRemoveContext = (word: string, contextId: string) => {
    removeVocabContext(word, contextId)
    setEntries(readVocab())
  }

  const dueCount = entries.filter(
    (entry) => entry.review.status !== 'mastered' && entry.review.dueAt <= now,
  ).length
  const masteredCount = entries.filter((entry) => entry.review.status === 'mastered').length
  const filteredEntries = entries.filter((entry) => {
    if (filter === 'due') return entry.review.status !== 'mastered' && entry.review.dueAt <= now
    if (filter === 'mastered') return entry.review.status === 'mastered'
    return true
  })

  return (
    <section className="mx-auto grid max-w-5xl gap-6">
      <div>
        <p className="font-[var(--font-mono)] text-xs uppercase tracking-[0.08em] text-[var(--accent)]">
          Vocabulary
        </p>
        <h1 className="mt-2 font-[var(--font-display)] text-4xl font-semibold tracking-[var(--tracking-display)]">
          {PAGE_TITLES.vocab}
        </h1>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['生词总数', `${entries.length} 个`],
          ['今天到期', `${dueCount} 个`],
          ['已掌握', `${masteredCount} 个`],
        ].map(([label, value]) => (
          <article
            key={label}
            className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-4"
          >
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="mt-2 font-[var(--font-display)] text-3xl font-semibold">{value}</p>
          </article>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-6">
          <p className="font-semibold">还没有收藏生词。</p>
          <p className="mt-2 text-sm text-[var(--muted)]">
            进入课程页，点击英文字幕里的单词即可查看释义并加入生词本。
          </p>
          <Link
            className="mt-4 inline-flex rounded-[var(--radius-md)] bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-on)]"
            to="/courses"
          >
            去课程库
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="flex flex-wrap gap-2">
            {[
              ['all', '全部'],
              ['due', '今天到期'],
              ['mastered', '已掌握'],
            ].map(([value, label]) => (
              <button
                key={value}
                className={`rounded-[var(--radius-pill)] border px-4 py-2 text-sm transition ${
                  filter === value
                    ? 'border-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-[var(--accent)]'
                    : 'border-[var(--border-soft)] bg-[var(--surface-warm)] text-[var(--muted)] hover:bg-[var(--surface)]'
                }`}
                type="button"
                onClick={() => setFilter(value as VocabFilter)}
              >
                {label}
              </button>
            ))}
          </div>

          {filteredEntries.length === 0 && (
            <div className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-6 text-sm text-[var(--muted)]">
              当前筛选下没有生词。
            </div>
          )}

          {filteredEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-[var(--radius-lg)] border border-[var(--border-soft)] bg-[var(--surface-warm)] p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-baseline gap-3">
                    <h2 className="text-2xl font-semibold">{entry.word}</h2>
                    <WordAudioButton
                      word={entry.audioWord ?? entry.word}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--border-soft)] bg-[var(--surface)] text-sm transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-40"
                    />
                    {entry.phonetic && (
                      <span className="text-sm text-[var(--muted)]">/{entry.phonetic}/</span>
                    )}
                    {entry.pos && (
                      <span className="font-[var(--font-mono)] text-xs text-[var(--meta)]">
                        {entry.pos}
                      </span>
                    )}
                    <span className="rounded-[var(--radius-pill)] bg-[var(--surface)] px-3 py-1 text-xs font-semibold text-[var(--fg-2)]">
                      {reviewLabel(entry, now)}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--fg-2)]">
                    {entry.translation}
                  </p>
                  <p className="mt-2 text-xs text-[var(--meta)]">
                    {formatDueDate(entry.review.dueAt, now)} · 复习 {entry.review.reviewCount} 次 ·
                    来源 {entry.contexts.length} 句
                  </p>
                </div>
                <button
                  className="rounded-[var(--radius-md)] border border-[var(--border-soft)] px-3 py-2 text-sm text-[var(--muted)] transition hover:bg-[var(--surface)]"
                  type="button"
                  onClick={() => handleRemove(entry.id)}
                >
                  删除
                </button>
              </div>
              <div className="mt-4 grid gap-2">
                {entry.contexts.map((context) => (
                  <div
                    key={context.id}
                    className="rounded-[var(--radius-md)] border border-[var(--border-soft)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--meta)]">
                      <div className="flex flex-wrap gap-3">
                        <Link
                          className="font-semibold text-[var(--accent)] underline-offset-4 hover:underline"
                          to={`/courses/${context.lessonId}?t=${Math.floor(context.audioStart)}`}
                        >
                          LESSON {context.lessonId}
                        </Link>
                        <span>{formatTime(context.audioStart)}</span>
                        <span>{formatDate(context.createdAt)}</span>
                      </div>
                      <button
                        className="text-[var(--muted)] underline-offset-4 hover:underline"
                        type="button"
                        onClick={() => handleRemoveContext(entry.word, context.id)}
                      >
                        移除此句
                      </button>
                    </div>
                    <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[var(--fg-2)]">
                      {context.sourceText}
                    </p>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
