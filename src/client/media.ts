/**
 * Client-side media classification for dock-media.
 *
 * Mirrors the host's extension → MIME map so the player knows, before the
 * browser finishes loading metadata, whether a file is audio (→ music player)
 * or video (→ fullscreen video player), which MIME it is, and which formats
 * the browser is very unlikely to decode natively (so the player can show a
 * clear notice instead of a silent black box / loading spinner).
 *
 * The browser still gets the final say — an unsupported codec fires the media
 * element's `error` event, which the player surfaces — so `nativePlayable`
 * is only a best-effort warning, not a hard gate.
 */

/** Lowercased extension → MIME type (audio). */
const AUDIO_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/ogg',
  flac: 'audio/flac',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  weba: 'audio/webm',
  wma: 'audio/x-ms-wma',
  mid: 'audio/midi',
  midi: 'audio/midi',
}

/** Lowercased extension → MIME type (video). */
const VIDEO_MIME: Record<string, string> = {
  mp4: 'video/mp4',
  m4v: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  ogv: 'video/ogg',
  avi: 'video/x-msvideo',
  mpg: 'video/mpeg',
  mpeg: 'video/mpeg',
  flv: 'video/x-flv',
  wmv: 'video/x-ms-wmv',
  '3gp': 'video/3gpp',
}

/**
 * Formats the browser almost never decodes natively (container/codec combos
 * not implemented by Chromium/Firefox/WebKit). These get a best-effort
 * "likely unsupported" notice while still attempting playback.
 */
const LIKELY_UNSUPPORTED = new Set(['avi', 'flv', 'wmv', 'mpg', 'mpeg', 'mid', 'midi', 'wma'])

/** File extension label ('.mp3' style) for badges. */
export function extLabel(path: string): string {
  const at = path.lastIndexOf('.')
  return at === -1 ? path.split(/[\\/]/).pop() ?? path : path.slice(at).toUpperCase()
}

/** A classified media file. */
export interface MediaInfo {
  kind: 'audio' | 'video'
  ext: string
  mime: string
  /** Best-effort warning: false → show a "likely unsupported" notice too. */
  nativePlayable: boolean
}

/** Classify a path by extension, or undefined when not a known media type. */
export function classifyMedia(path: string): MediaInfo | undefined {
  const base = path.split(/[\\/]/).pop() ?? path
  const at = base.lastIndexOf('.')
  const ext = at === -1 ? '' : base.slice(at + 1).toLowerCase()
  const mime = AUDIO_MIME[ext] ?? VIDEO_MIME[ext]
  if (mime === undefined) return undefined
  const kind = AUDIO_MIME[ext] !== undefined ? 'audio' : 'video'
  return { kind, ext, mime, nativePlayable: !LIKELY_UNSUPPORTED.has(ext) }
}

/** The media source URL (same-origin streaming endpoint, Range-aware). */
export function mediaSourceUrl(path: string): string {
  return `/dock-media/source?path=${encodeURIComponent(path)}`
}

/** Human-readable byte size. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
  const units = ['B', 'KiB', 'MiB', 'GiB']
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`
}

/** Format seconds as m:ss (h:mm:ss for long files). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}
