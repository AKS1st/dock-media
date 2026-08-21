/**
 * Video player for dock-media: a native, fullscreen-capable <video> element
 * playing the streamed source. Native controls give seeking, volume, playback
 * rate and fullscreen for free; the media file is streamed (Range-aware)
 * through /dock-media/source so seeking works without loading the whole file.
 *
 * When the browser cannot decode the container/codec, the <video> element
 * fires `error`, which is surfaced by the caller's `onError` so the user sees
 * a clear message instead of a silent black box.
 */
import { createElement, useEffect, useRef, type ReactNode } from 'react'

/** Props handed to the video player by MediaView. */
export interface VideoPlayerProps {
  /** The streamed source URL (already Range-aware). */
  src: string
  /** Human-readable title (fallback for the element's aria-label). */
  title: string
  /** Called when the browser rejects / cannot decode the media. */
  onError: (message: string) => void
}

/** Map a media element error to a friendly message. */
function errorMessage(): string {
  return '浏览器无法播放此视频（容器或编码不受支持，或文件已损坏）。'
}

export function VideoPlayer(props: VideoPlayerProps): ReactNode {
  const { src, title, onError } = props
  const videoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const video = videoRef.current
    if (video === null) return
    const onVideoError = (): void => {
      const code = video.error?.code
      if (code === undefined || code === 4) {
        onError('视频解码错误，文件可能已损坏。')
      } else {
        onError(errorMessage())
      }
    }
    video.addEventListener('error', onVideoError)
    return () => { video.removeEventListener('error', onVideoError) }
  }, [onError])

  return createElement('video', {
    ref: videoRef,
    className: 'dm-video',
    src,
    controls: true,
    preload: 'metadata',
    playsInline: true,
    'aria-label': title,
  })
}
