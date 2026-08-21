/**
 * Music player for dock-media (pure audio): a custom, polished `<audio>`
 * player driven by a hidden media element. The streamed (Range-aware) source
 * plays through native decoding; all transport UI (play/pause, seek, volume,
 * mute, playback rate, repeat one) is custom so the player reads like a
 * "music player" rather than a bare audio element.
 *
 * The visual is a spinning record disc (animated while playing) with an
 * equalizer strip and a seek/volume control block. Fullscreen (an immersive
 * now-playing screen) is handled by the container via the Fullscreen API.
 */
import { createElement, useCallback, useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { formatTime } from './media'

/** Props handed to the music player by MediaView. */
export interface AudioPlayerProps {
  /** The streamed source URL (already Range-aware). */
  src: string
  /** Human-readable title (shown as the track name). */
  title: string
  /** The file's extension label (e.g. ".MP3") shown as a subtitle. */
  extLabel: string
}

/** Playback rate choices. */
const RATES = [1, 1.25, 1.5, 2, 0.5]

export function AudioPlayer(props: AudioPlayerProps): ReactNode {
  const { src, title, extLabel } = props
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const [rate, setRate] = useState(1)
  const [loop, setLoop] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Attach media-element listeners once per source.
  useEffect(() => {
    const audio = audioRef.current
    if (audio === null) return
    const onTime = (): void => setCurrentTime(audio.currentTime)
    const onMeta = (): void => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0)
    const onPlay = (): void => setPlaying(true)
    const onPause = (): void => setPlaying(false)
    const onEnded = (): void => setPlaying(false)
    const onVolume = (): void => setVolume(audio.volume)
    const onError = (): void => setError('浏览器无法解码此音频（编码不受支持，或文件已损坏）。')
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('durationchange', onMeta)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('volumechange', onVolume)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('durationchange', onMeta)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('volumechange', onVolume)
      audio.removeEventListener('error', onError)
    }
  }, [src])

  const togglePlay = useCallback((): void => {
    const audio = audioRef.current
    if (audio === null) return
    if (audio.paused) {
      void audio.play().catch(() => setError('无法启动播放（浏览器的自动播放限制可能阻止了已加载的音轨）。'))
    } else {
      audio.pause()
    }
  }, [])

  const onSeek = useCallback((value: number): void => {
    const audio = audioRef.current
    if (audio === null) return
    audio.currentTime = value
    setCurrentTime(value)
  }, [])

  const onVolume = useCallback((value: number): void => {
    const audio = audioRef.current
    if (audio === null) return
    audio.volume = value
    if (value === 0) audio.muted = true
    else if (audio.muted) audio.muted = false
    setMuted(value === 0)
  }, [])

  const toggleMute = useCallback((): void => {
    const audio = audioRef.current
    if (audio === null) return
    audio.muted = !audio.muted
    setMuted(audio.muted)
  }, [])

  const onRate = useCallback((next: number): void => {
    const audio = audioRef.current
    if (audio === null) return
    audio.playbackRate = next
    setRate(next)
  }, [])

  const toggleLoop = useCallback((): void => {
    const audio = audioRef.current
    if (audio === null) return
    audio.loop = !audio.loop
    setLoop(audio.loop)
  }, [])

  const dur = duration > 0 ? duration : 0
  const progress = dur > 0 ? (currentTime / dur) * 100 : 0
  const discClass = playing ? 'dm-art dm-art-spin' : 'dm-art'

  return createElement('div', { className: 'dm-audio-wrap' },
    // Spinning disc / equalizer visual.
    createElement('div', { className: discClass },
      createElement('div', { className: 'dm-art-inner' }, '♫'),
    ),
    playing
      ? createElement('div', { className: 'dm-eq' },
        createElement('span'), createElement('span'), createElement('span'),
        createElement('span'), createElement('span'), createElement('span'),
        createElement('span'),
      )
      : null,

    // Track name + format.
    createElement('div', { className: 'dm-name', title }, title),
    createElement('div', { className: 'dm-sub' }, extLabel),

    // Seek bar.
    createElement('div', { className: 'dm-transport' },
      createElement('div', { className: 'dm-seek' },
        createElement('span', { className: 'dm-time' }, formatTime(currentTime)),
        createElement('input', {
          className: 'dm-range',
          type: 'range',
          min: 0,
          max: dur,
          step: 0.1,
          value: currentTime,
          disabled: dur <= 0,
          onChange: (e) => onSeek(Number(e.currentTarget.value)),
          'aria-label': '播放进度',
        }),
        createElement('span', { className: 'dm-time' }, formatTime(dur)),
      ),

      // Transport buttons.
      createElement('div', { className: 'dm-row' },
        createElement('button', {
          className: 'dm-iconbtn dm-rate',
          onClick: toggleLoop,
          title: loop ? '取消单曲循环' : '单曲循环',
          style: loop ? { color: 'var(--dsw-alias-interactive-fg-accent, #3b6fe0)' } : undefined,
        }, loop ? '🔁' : '🔁'),
        createElement('button', {
          className: 'dm-playbtn',
          onClick: togglePlay,
          title: playing ? '暂停' : '播放',
          'aria-label': playing ? '暂停' : '播放',
        }, playing ? '❚❚' : '▶'),
        createElement('div', { className: 'dm-vol' },
          createElement('button', {
            className: 'dm-iconbtn dm-rate',
            onClick: toggleMute,
            title: muted ? '取消静音' : '静音',
          }, muted ? '🔇' : '🔊'),
          createElement('input', {
            className: 'dm-range',
            type: 'range',
            min: 0,
            max: 1,
            step: 0.05,
            value: muted ? 0 : volume,
            onChange: (e) => onVolume(Number(e.currentTarget.value)),
            style: { maxWidth: 90 },
            'aria-label': '音量',
          }),
        ),
        createElement('select', {
          className: 'dm-rate',
          value: rate,
          onChange: (e: ChangeEvent<HTMLSelectElement>) => onRate(Number(e.currentTarget.value)),
          title: '播放速度',
          'aria-label': '播放速度',
        }, RATES.map((r) => createElement('option', { key: String(r), value: String(r) }, `${r}x`))),
      ),
    ),

    // Hidden media element.
    createElement('audio', {
      ref: audioRef,
      src,
      preload: 'metadata',
      volume,
      muted,
      loop,
      playbackRate: rate,
    }),

    error !== null
      ? createElement('div', { className: 'dm-err' }, error)
      : null,
  )
}
