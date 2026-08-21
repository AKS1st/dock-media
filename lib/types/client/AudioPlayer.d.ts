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
import { type ReactNode } from 'react';
/** Props handed to the music player by MediaView. */
export interface AudioPlayerProps {
    /** The streamed source URL (already Range-aware). */
    src: string;
    /** Human-readable title (shown as the track name). */
    title: string;
    /** The file's extension label (e.g. ".MP3") shown as a subtitle. */
    extLabel: string;
}
export declare function AudioPlayer(props: AudioPlayerProps): ReactNode;
