/**
 * Host half of dock-media: the /dock-media streaming endpoint that serves a
 * media file as bytes so the browser's `<audio>` / `<video>` element can
 * play and seek it without loading the whole file into memory.
 *
 * Contrast with dock-images (which reads a whole file as base64): media
 * files are large and playable <video>/<audio> elements need random access
 * to seek. So instead of a JSON read route, dock-media serves the file bytes
 * directly via a GET route that:
 *   - resolves a caller-supplied absolute path (no workspace confinement,
 *     exactly like dock-images — the conversation context can open media
 *     anywhere on the host, e.g. ~/Music/..., ~/.dsh/...);
 *   - infers the MIME type from the file extension;
 *   - answers `Range: bytes=...` with `206 Partial Content` +
 *     `Content-Range` and always advertises `Accept-Ranges: bytes`, so the
 *     media element can seek and stream progressively;
 *   - streams the bytes with `createReadStream` (never buffers the whole
 *     file in memory).
 *
 * A small POST `/dock-media/probe` sibling returns the file's size, MIME and
 * media kind (audio | video) without streaming it, so the player header can
 * show the format badge and size immediately.
 *
 * Wire / trust-fence helpers follow the same stripped pattern as dock-files /
 * dock-editor / dock-images (each plugin keeps its own copies).
 */
import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'

export const name = 'dock-media'

/** Services required before mounting. */
export const inject = ['webServer', 'webRuntime']

// ── Wire helpers (same envelope as the /dock-images API) ─────────────────

type WbErrorCode = 'bad-request' | 'forbidden' | 'fs-error' | 'not-found' | 'internal'

export class WbError extends Error {
  constructor(
    readonly code: WbErrorCode,
    message: string,
    readonly status = 400,
  ) {
    super(message)
  }
}

const MAX_BODY_BYTES = 1 << 20

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  let total = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    total += buffer.length
    if (total > MAX_BODY_BYTES) throw new WbError('bad-request', 'request body too large')
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return {}
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new WbError('bad-request', 'request body is not valid JSON')
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function writeOk(res: ServerResponse, value: unknown): void {
  writeJson(res, 200, { ok: true, value })
}

function writeError(res: ServerResponse, error: unknown): void {
  if (error instanceof WbError) {
    writeJson(res, error.status, { ok: false, error: { code: error.code, message: error.message } })
    return
  }
  const message = error instanceof Error ? error.message : String(error)
  writeJson(res, 500, { ok: false, error: { code: 'internal', message } })
}

function stringOrUndefined(payload: unknown, key: string): string | undefined {
  const value = (payload as Record<string, unknown> | null)?.[key]
  return typeof value === 'string' && value !== '' ? value : undefined
}

function requireAbsolute(path: string): string {
  if (!path.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(path)) {
    throw new WbError('fs-error', `"${path}" is not an absolute path`, 400)
  }
  return path
}

/**
 * Resolve a caller-supplied absolute path for READING / STREAMING: no
 * workspace containment — the media player opens media anywhere on the host,
 * because the conversation context can mention paths outside the session
 * workspace (Music folders, ~/.dsh/skills, ...).
 */
function resolveReadPath(raw: string): string {
  requireAbsolute(raw)
  return resolve(raw)
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

// ── Media classification (extension → MIME + kind) ──────────────────────

/** Lowercased extension → MIME type. */
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

/** Lowercased extension → MIME type. */
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
  ts: 'video/mp2t',
  '3gp': 'video/3gpp',
}

/** File extension (lowercased, no dot), or '' when absent. */
function extOfPath(path: string): string {
  const base = path.split(/[\\/]/).pop() ?? ''
  const at = base.lastIndexOf('.')
  return at === -1 ? '' : base.slice(at + 1).toLowerCase()
}

/** Classify a file: media kind + MIME, or undefined when not a known media file. */
function classifyFile(path: string): { kind: 'audio' | 'video'; mime: string } | undefined {
  const ext = extOfPath(path)
  const mime = AUDIO_MIME[ext] ?? VIDEO_MIME[ext]
  if (mime === undefined) return undefined
  const kind = AUDIO_MIME[ext] !== undefined ? 'audio' : 'video'
  return { kind, mime }
}

// ── Trust fence (same as dock-files / dock-editor / dock-images) ─────────

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

function parseAuthority(authority: string): URL | undefined {
  try {
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

function canonicalAuthority(entry: string, entryUrl: URL): string {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

function isTrustedRequest(request: IncomingMessage, trustedHosts: readonly string[]): boolean {
  const host = header(request.headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(request.headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(request.headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}

// ── Streaming helpers ─────────────────────────────────────────────────────

/** Parse an HTTP Range header into { start, end } (inclusive), or undefined. */
function parseRange(value: string, size: number): { start: number; end: number } | undefined {
  const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim())
  if (match === null) return undefined
  const [, rawStart, rawEnd] = match
  // Suffix range "bytes=-N": last N bytes.
  if (rawStart === '' && rawEnd !== '') {
    const n = Number(rawEnd)
    if (!Number.isFinite(n) || n <= 0) return undefined
    const start = Math.max(0, size - n)
    return { start, end: size - 1 }
  }
  const start = Number(rawStart)
  if (!Number.isFinite(start) || start < 0 || start >= size) return undefined
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1)
  if (end < start) return undefined
  return { start, end }
}

// ── Plugin body ───────────────────────────────────────────────────────────

interface WbContext {
  webServer: {
    register(options: {
      kind: 'prefix'
      path: string
      handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>
    }): () => void
  }
  webRuntime: {
    trustedHosts: readonly string[]
  }
  effect(fn: () => void | (() => void), label?: string): void
}

/** Stream a file to `res`, honouring an optional Range for seeking. */
async function streamSource(res: ServerResponse, path: string, rangeHeader: string | undefined): Promise<void> {
  const info = await stat(path).catch((error) => {
    throw new WbError('fs-error', `cannot read "${path}": ${messageOf(error)}`, 400)
  })
  if (info.isDirectory()) {
    throw new WbError('fs-error', `"${path}" is a directory`, 400)
  }
  const classified = classifyFile(path)
  if (classified === undefined) {
    throw new WbError('bad-request', `"${path}" is not a supported media file`, 400)
  }
  const { mime } = classified
  const size = info.size
  const base = {
    'content-type': mime,
    'accept-ranges': 'bytes',
    'cache-control': 'private, no-cache',
  }

  // Range request → 206 Partial Content so <video>/<audio> can seek.
  if (rangeHeader !== undefined) {
    const slice = parseRange(rangeHeader, size)
    if (slice === undefined) {
      res.writeHead(416, {
        'content-range': `bytes */${size}`,
        'content-type': mime,
        'accept-ranges': 'bytes',
      })
      res.end()
      return
    }
    const { start, end } = slice
    const length = end - start + 1
    res.writeHead(206, {
      ...base,
      'content-length': String(length),
      'content-range': `bytes ${start}-${end}/${size}`,
    })
    createReadStream(path, { start, end }).on('error', (error) => {
      res.destroy(error)
    }).pipe(res)
    return
  }

  // Full-body request → 200 with the whole file streamed.
  res.writeHead(200, { ...base, 'content-length': String(size) })
  createReadStream(path).on('error', (error) => {
    res.destroy(error)
  }).pipe(res)
}

export function apply(ctx: WbContext): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'prefix',
    path: '/dock-media',
    handler: async (req, res) => {
      if (!isTrustedRequest(req, ctx.webRuntime.trustedHosts)) {
        writeJson(res, 403, { ok: false, error: { code: 'forbidden', message: 'forbidden' } })
        return
      }
      const url = new URL(req.url ?? '/', 'http://dsh.internal')
      const pathname = url.pathname
      const method = pathname.startsWith('/dock-media/') ? pathname.slice('/dock-media/'.length) : undefined
      if (method === undefined || method.includes('/')) {
        writeError(res, new WbError('not-found', `unknown /dock-media method "${method}"`, 404))
        return
      }

      try {
        // GET /dock-media/source?path=... → stream the file (Range-aware).
        if (method === 'source') {
          if (req.method !== 'GET') {
            writeError(res, new WbError('bad-request', 'source requires GET', 405))
            return
          }
          const raw = url.searchParams.get('path')
          if (raw === null || raw === '') {
            writeError(res, new WbError('bad-request', 'source requires a "path"', 400))
            return
          }
          const path = resolveReadPath(raw)
          await streamSource(res, path, header(req.headers, 'range'))
          return
        }

        // POST /dock-media/probe → metadata (size, mime, kind) without streaming.
        if (method === 'probe') {
          if (req.method !== 'POST') {
            writeError(res, new WbError('bad-request', 'probe requires POST', 405))
            return
          }
          const payload = await readJsonBody(req)
          const raw = stringOrUndefined(payload, 'path')
          if (raw === undefined) {
            writeError(res, new WbError('bad-request', 'probe requires a "path"', 400))
            return
          }
          const path = resolveReadPath(raw)
          const info = await stat(path).catch((error) => {
            throw new WbError('fs-error', `cannot read "${path}": ${messageOf(error)}`, 400)
          })
          const classified = classifyFile(path)
          writeOk(res, {
            exists: !info.isDirectory(),
            isDir: info.isDirectory(),
            size: info.size,
            kind: classified?.kind ?? null,
            mime: classified?.mime ?? 'application/octet-stream',
          })
          return
        }

        writeError(res, new WbError('not-found', `unknown /dock-media method "${method}"`, 404))
      } catch (error) {
        writeError(res, error)
      }
    },
  }), 'dock-media: /dock-media routes')
}
