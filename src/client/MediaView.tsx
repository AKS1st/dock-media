/**
 * Media view: the container dock-media hands to the workbench. It reads the
 * open seed's path, classifies it (audio → music player, video → fullscreen
 * player), streams it through /dock-media/source, and wraps the player in a
 * shared header (title, format badge, size) plus a fullscreen toggle.
 *
 * The floating window hosts the view; fullscreen escapes that window by
 * using the browser Fullscreen API on the container (falling back to a
 * fixed inset:0 overlay when the API is unavailable).
 */
import { createElement, useEffect, useRef, useState, type ReactNode } from 'react'
import type { ViewProps } from './contract.ts'
import { classifyMedia, extLabel, formatBytes, mediaSourceUrl } from './media'
import { VideoPlayer } from './VideoPlayer'
import { AudioPlayer } from './AudioPlayer'

/** The seed shape the file domain dispatches (EditorOpenSeed). */
interface OpenSeed {
  path?: string
  title?: string
  meta?: unknown
}

/** The /dock-media/probe response envelope. */
interface ProbeResponse {
  ok: boolean
  value?: { exists: boolean; isDir: boolean; size: number; kind: 'audio' | 'video' | null; mime: string }
  error?: { code: string; message: string }
}

/** True when the browser's Fullscreen API is usable. */
function hasFullscreenApi(): boolean {
  return typeof document !== 'undefined'
    && typeof document.fullscreenEnabled !== 'undefined'
    && document.fullscreenEnabled === true
    && typeof Element !== 'undefined'
    && typeof Element.prototype.requestFullscreen === 'function'
}

export function MediaView(props: ViewProps): ReactNode {
  const { seed } = props
  const openSeed = (seed ?? {}) as OpenSeed
  const path = openSeed.path
  const title = openSeed.title ?? path?.split(/[\\/]/).pop() ?? 'Media'

  const containerRef = useRef<HTMLDivElement | null>(null)
  const [size, setSize] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [fullscreen, setFullscreen] = useState(false)

  // Probe the file metadata (size) for the header; optional (player works
  // without it). The classification comes from the extension, so a probe
  // failure never blocks playback.
  useEffect(() => {
    if (path === undefined) return
    let cancelled = false
    void (async () => {
      try {
        const response = await fetch('/dock-media/probe', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ path }),
        })
        const json = (await response.json()) as ProbeResponse
        if (json.ok !== true || json.value === undefined) return
        if (cancelled) return
        setSize(json.value.size)
      } catch {
        // ignore: probe is best-effort
      }
    })()
    return () => { cancelled = true }
  }, [path])

  // Track fullscreen state (API or manual fallback).
  useEffect(() => {
    const root = containerRef.current
    if (root === null) return
    const el = root
    const onChange = (): void => {
      setFullscreen(document.fullscreenElement === el)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => { document.removeEventListener('fullscreenchange', onChange) }
  }, [])

  const toggleFullscreen = (): void => {
    const root = containerRef.current
    if (root === null) return
    if (hasFullscreenApi()) {
      if (document.fullscreenElement === root) {
        void document.exitFullscreen()
      } else {
        void root.requestFullscreen().catch(() => { /* ignore */ })
      }
    } else {
      // Fallback: toggle a fixed overlay (best-effort without the API).
      setFullscreen((current) => !current)
    }
  }

  if (path === undefined) {
    return createElement('div', { className: 'dm-root' },
      createElement('div', { className: 'dm-empty' }, '没有可播放的媒体路径。'),
    )
  }
  const info = classifyMedia(path)
  if (info === undefined) {
    return createElement('div', { className: 'dm-root' },
      createElement('div', { className: 'dm-empty' }, `不支持的媒体类型：${path}`),
    )
  }

  const src = mediaSourceUrl(path)
  const sizeText = size !== null ? formatBytes(size) : ''
  const notice = !info.nativePlayable
    ? '⚠ 该封装/编码通常无法在浏览器直接解码（可能需要系统播放器）。'
    : null

  return createElement(
    'div',
    {
      ref: containerRef,
      className: fullscreen ? 'dm-root dm-fullscreen' : 'dm-root',
    },
    // Header.
    createElement('div', { className: 'dm-head' },
      createElement('span', { className: 'dm-title', title: path }, title),
      createElement('span', { className: 'dm-badge' }, extLabel(path)),
      sizeText !== '' ? createElement('span', { className: 'dm-meta' }, sizeText) : null,
      createElement('button', {
        className: 'dm-iconbtn',
        onClick: toggleFullscreen,
        title: fullscreen ? '退出全屏' : '全屏',
      }, fullscreen ? '⛶ 退出全屏' : '⛶ 全屏'),
    ),
    // Player stage.
    info.kind === 'video'
      ? createElement('div', { className: 'dm-stage' },
          createElement(VideoPlayer, { src, title, onError: setError }),
        )
      : createElement(AudioPlayer, { src, title, extLabel: extLabel(path) }),
    // Notice (likely-unsupported) + error.
    notice !== null || error !== null
      ? createElement('div', { style: { paddingTop: 6 } },
          notice !== null ? createElement('div', { className: 'dm-sub' }, notice) : null,
          error !== null ? createElement('div', { className: 'dm-err' }, error) : null,
        )
      : null,
  )
}
