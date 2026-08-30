import { useRef } from 'react'
import { getWordAudioUrl } from '@/data/dictAudio'

type WordAudioButtonProps = {
  word: string
  className?: string
}

export function WordAudioButton({ word, className = '' }: WordAudioButtonProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const audioUrl = getWordAudioUrl(word)

  const playAudio = () => {
    const audio = audioRef.current
    if (!audio || !audioUrl) return
    audio.currentTime = 0
    void audio.play()
  }

  return (
    <>
      <button
        className={className}
        type="button"
        onClick={playAudio}
        disabled={!audioUrl}
        aria-label={`播放 ${word} 的单词发音`}
        title={audioUrl ? '播放单词发音' : '该词暂不支持单词发音'}
      >
        🔊
      </button>
      <audio
        ref={audioRef}
        className="word-audio-element"
        src={audioUrl ?? undefined}
        preload="auto"
        aria-hidden="true"
      />
    </>
  )
}
