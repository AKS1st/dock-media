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
import { type ReactNode } from 'react';
/** Props handed to the video player by MediaView. */
export interface VideoPlayerProps {
    /** The streamed source URL (already Range-aware). */
    src: string;
    /** Human-readable title (fallback for the element's aria-label). */
    title: string;
    /** Called when the browser rejects / cannot decode the media. */
    onError: (message: string) => void;
}
export declare function VideoPlayer(props: VideoPlayerProps): ReactNode;
