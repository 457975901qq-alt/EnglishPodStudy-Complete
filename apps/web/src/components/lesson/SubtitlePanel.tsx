import { useEffect, useMemo, useRef, type KeyboardEvent } from 'react'
import { formatTime, type SubtitleCue } from '@/data/courseList'
import { getCenteredScrollTop } from './subtitleScroll'
import { isTranslationLine } from './subtitleLine'
import { tokenizeEnglish } from './tokenizeEnglish'

export type SubtitleWordSelection = {
  word: string
  cue: SubtitleCue
  lineIndex: number
  anchor: {
    left: number
    top: number
    bottom: number
  }
}

type SubtitlePanelProps = {
  cues: SubtitleCue[]
  currentTime: number
  savedWords?: string[]
  message?: string
  obscured?: boolean
  onSeek: (time: number) => void
  onWordSelect?: (selection: SubtitleWordSelection) => void
  onSentenceReviewAdd?: (cue: SubtitleCue) => void
}

export function SubtitlePanel({
  cues,
  currentTime,
  savedWords = [],
  message,
  obscured = false,
  onSeek,
  onWordSelect,
  onSentenceReviewAdd,
}: SubtitlePanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const activeCueRef = useRef<HTMLDivElement>(null)
  const savedWordSet = useMemo(
    () => new Set(savedWords.map((word) => normalizeWord(word)).filter(Boolean)),
    [savedWords],
  )
  const activeIndex = findActiveCueIndex(cues, currentTime)
  const renderedCues = useMemo(
    () => cues.map((cue) => ({
      cue,
      lines: cue.text.split('\n').map((text) => ({
        text,
        translated: isTranslationLine(text),
        tokens: tokenizeEnglish(text),
      })),
    })),
    [cues],
  )

  useEffect(() => {
    const scrollEl = scrollRef.current
    const cueEl = activeCueRef.current
    if (activeIndex < 0 || !scrollEl || !cueEl) return

    scrollEl.scrollTo({
      top: getCenteredScrollTop(scrollEl, cueEl),
      behavior: 'smooth',
    })
  }, [activeIndex])

  const handleCueKeyDown = (event: KeyboardEvent<HTMLDivElement>, start: number) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    onSeek(start)
  }

  return (
    <div className={`subs-scroll${obscured ? ' obscured' : ''}`} id="subsScroll" ref={scrollRef}>
      <div className="subs" id="subs">
        {message && <p className="text-sm text-[var(--muted)]">{message}</p>}
        {renderedCues.map(({ cue, lines }, index) => (
          <div
            key={cue.id}
            ref={index === activeIndex ? activeCueRef : null}
            className={[
              'cue',
              index === activeIndex ? 'active' : '',
              index < activeIndex ? 'passed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            role="button"
            tabIndex={0}
            onClick={() => onSeek(cue.start)}
            onKeyDown={(event) => handleCueKeyDown(event, cue.start)}
          >
            <button
              className="t"
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                onSeek(cue.start)
              }}
            >
              {formatTime(cue.start)}
            </button>
            <span className="line">
              {lines.map(({ text: line, translated, tokens }, lineIndex) => (
                <span
                  key={`${cue.id}-${lineIndex}`}
                  className={translated ? 'line-translation' : undefined}
                >
                  {translated || obscured
                    ? line
                    : tokens.map((token, tokenIndex) =>
                        token.isWord ? (
                          <button
                            key={`${cue.id}-${lineIndex}-${tokenIndex}`}
                            className={`word-token${savedWordSet.has(normalizeWord(token.text)) ? ' saved' : ''}`}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              const rect = event.currentTarget.getBoundingClientRect()
                              onWordSelect?.({
                                word: token.text,
                                cue,
                                lineIndex,
                                anchor: {
                                  left: rect.left,
                                  top: rect.top,
                                  bottom: rect.bottom,
                                },
                              })
                            }}
                          >
                            {token.text}
                          </button>
                        ) : (
                          <span key={`${cue.id}-${lineIndex}-${tokenIndex}`}>
                            {token.text}
                          </span>
                        ),
                      )}
                </span>
              ))}
            </span>
            {onSentenceReviewAdd && (
              <button
                className="cue-review"
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  onSentenceReviewAdd(cue)
                }}
              >
                加入复习
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function normalizeWord(word: string) {
  return word.trim().toLowerCase().replaceAll('’', "'")
}

function findActiveCueIndex(cues: SubtitleCue[], currentTime: number) {
  let low = 0
  let high = cues.length - 1

  while (low <= high) {
    const middle = Math.floor((low + high) / 2)
    const cue = cues[middle]
    if (currentTime < cue.start) {
      high = middle - 1
    } else if (currentTime >= cue.end) {
      low = middle + 1
    } else {
      return middle
    }
  }

  return -1
}
