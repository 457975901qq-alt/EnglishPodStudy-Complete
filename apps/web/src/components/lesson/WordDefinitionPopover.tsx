import { useEffect, useRef, useState } from 'react'
import { useDictLookup, type DictLookupResult } from '@/data/dictLookup'
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
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [speechError, setSpeechError] = useState<{ word: string; message: string } | null>(null)
  const lookup = useDictLookup(selection?.word ?? null)
  const speechSupported =
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    'SpeechSynthesisUtterance' in window

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel()
      }
    }
  }, [selection?.word])

  const handleSpeak = () => {
    if (!selection || !speechSupported) return

    const speech = window.speechSynthesis
    if (isSpeaking) {
      speech.cancel()
      setIsSpeaking(false)
      return
    }

    speech.cancel()
    setSpeechError(null)
    const utterance = new SpeechSynthesisUtterance(selection.word)
    utterance.lang = 'en-US'
    utterance.rate = 0.82
    const voices = speech.getVoices()
    utterance.voice =
      voices.find((voice) => voice.lang.toLowerCase() === 'en-us') ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith('en')) ??
      null
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = (event) => {
      setIsSpeaking(false)
      if (event.error !== 'canceled') {
        setSpeechError({ word: selection.word, message: '无法播放发音，请检查浏览器语音设置。' })
      }
    }
    speech.speak(utterance)
  }

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
      <div className="word-popover-head">
        <div>
          <div className="word-popover-word-row">
            <p className="word-popover-word">{entry?.word ?? selection.word}</p>
            <button
              className="word-popover-audio"
              type="button"
              onClick={handleSpeak}
              disabled={!speechSupported}
              aria-label={isSpeaking ? '停止发音' : '播放发音'}
              aria-pressed={isSpeaking}
              title={speechSupported ? '播放英文发音' : '当前浏览器不支持语音播放'}
            >
              <span aria-hidden="true">{isSpeaking ? '■' : '🔊'}</span>
              {isSpeaking ? '停止' : '发音'}
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
      {speechError?.word === selection.word && (
        <p className="word-popover-error">{speechError.message}</p>
      )}
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
