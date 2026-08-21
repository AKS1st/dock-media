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
/** File extension label ('.mp3' style) for badges. */
export declare function extLabel(path: string): string;
/** A classified media file. */
export interface MediaInfo {
    kind: 'audio' | 'video';
    ext: string;
    mime: string;
    /** Best-effort warning: false → show a "likely unsupported" notice too. */
    nativePlayable: boolean;
}
/** Classify a path by extension, or undefined when not a known media type. */
export declare function classifyMedia(path: string): MediaInfo | undefined;
/** The media source URL (same-origin streaming endpoint, Range-aware). */
export declare function mediaSourceUrl(path: string): string;
/** Human-readable byte size. */
export declare function formatBytes(bytes: number): string;
/** Format seconds as m:ss (h:mm:ss for long files). */
export declare function formatTime(seconds: number): string;
