const WORD_TOKEN_PATTERN = /^[a-z0-9]+(?:['-][a-z0-9]+)*$/i

/**
 * Returns the app's same-origin proxy for EasyDict's English word audio.
 * Keeping the original clicked token matters: "weeks" should sound like
 * "weeks", and "they've" should not be replaced with a whole sentence.
 */
export function getWordAudioUrl(word: string): string | null {
  const normalized = word.trim().replaceAll('’', "'")
  if (!WORD_TOKEN_PATTERN.test(normalized) || normalized.length > 80) return null
  return `/api/dict-audio/${encodeURIComponent(normalized)}`
}
