import { useEffect, useRef } from 'react'
import { useDictLookup, type DictLookupResult } from '@/data/dictLookup'
import { getWordAudioUrl } from '@/data/dictAudio'
import type { SubtitleWordSelection } from './SubtitlePanel'

type WordDefinitionPopoverProps = {
  selection: SubtitleWordSelection | null
  saved: boolean
  onClose: () => void
  onSave: (entry: Extract<DictLookupResult, { found: true }>, selection: SubtitleWordSelection) => void
  onRemove: (entry: Extract<DictLookupResult, { found: true }>, selection: SubtitleWordSelection) => void
}

function getPosition(selection: SubtitleWordSelection) {
  const maxLeft =
    typeof window === 'undefined'
      ? selection.anchor.left
      : Math.max(12, window.innerWidth - 360)

  return {
    left: Math.max(12, Math.min(selection.anchor.left, maxLeft)),
    top: selection.anchor.bottom + 8,
  }
}

export function WordDefinitionPopover({
  selection,
  saved,
  onClose,
  onSave,
  onRemove,
}: WordDefinitionPopoverProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const lookup = useDictLookup(selection?.word ?? null)
  const audioUrl = selection ? getWordAudioUrl(selection.word) : null

  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return

    audio.pause()
    audio.src = audioUrl
    audio.currentTime = 0
    audio.load()
    void audio.play().catch(() => {
      // Browser autoplay policies can reject an async media request. The
      // visible replay button remains available in that case.
    })

    return () => {
      audio.pause()
      audio.removeAttribute('src')
    }
  }, [audioUrl])

  useEffect(() => {
    if (!selection) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handlePointerDown)
    }
  }, [onClose, selection])

  if (!selection) return null

  const position = getPosition(selection)
  const entry = lookup.data?.found ? lookup.data : null
  const translationLines = entry?.translation
    .split(/(?:\n|\\n)+/)
    .map((line) => line.trim())
    .filter(Boolean)
    ?? []

  return (
    <div
      ref={panelRef}
      className="word-popover"
      style={{ left: position.left, top: position.top }}
      role="dialog"
      aria-label={`${selection.word} 的释义`}
    >
      <audio className="word-audio-element" ref={audioRef} preload="auto" aria-hidden="true" />
      <div className="word-popover-head">
        <div>
          <div className="word-popover-word-row">
            <p className="word-popover-word">{selection.word}</p>
            <button
              className="word-popover-audio"
              type="button"
              onClick={() => {
                const audio = audioRef.current
                if (!audio) return
                audio.currentTime = 0
                void audio.play()
              }}
              disabled={!audioUrl}
              aria-label={`播放 ${selection.word} 的单词发音`}
              title="重播单词发音"
            >
              🔊
            </button>
          </div>
          {entry?.phonetic && <p className="word-popover-phonetic">/{entry.phonetic}/</p>}
        </div>
        <button className="word-popover-close" type="button" onClick={onClose} aria-label="关闭">
          ×
        </button>
      </div>

      {lookup.loading && <p className="word-popover-muted">正在查询释义...</p>}
      {lookup.error && <p className="word-popover-error">{lookup.error}</p>}
      {lookup.data && !lookup.data.found && (
        <p className="word-popover-muted">本地词典暂未收录这个词。</p>
      )}
      {entry && (
        <>
          {entry.matched !== selection.word.toLowerCase() && (
            <p className="word-popover-muted">匹配到原形：{entry.matched}</p>
          )}
          {entry.pos && <p className="word-popover-pos">{entry.pos}</p>}
          <div className="word-popover-translation">
            {translationLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </div>
          <button
            className={`word-popover-save${saved ? ' saved' : ''}`}
            type="button"
            onClick={() => {
              if (saved) {
                onRemove(entry, selection)
              } else {
                onSave(entry, selection)
              }
            }}
          >
            {saved ? '移出生词本' : '加入生词本'}
          </button>
        </>
      )}
    </div>
  )
}
