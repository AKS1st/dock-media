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
import { type ReactNode } from 'react';
import type { ViewProps } from './contract.ts';
export declare function MediaView(props: ViewProps): ReactNode;
