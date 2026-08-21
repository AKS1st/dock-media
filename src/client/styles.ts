/**
 * dock-media stylesheet. Injected once via `styles.insert` semantics using a
 * plain <style> element appended to <head> and torn down on dispose (the
 * client bundle runs in the browser, where document is available — the dock
 * base mounts its own stylesheet the same way).
 *
 * All classes are prefixed `dm-` to avoid clashing with the DSH shell / dock
 * base. Colors prefer `--dsw-alias-*` theme variables with a fallback so the
 * player follows the active theme.
 */

/** The CSS text injected into the page. */
const CSS = `
.dm-root { position: relative; width: 100%; height: 100%; display: flex; flex-direction: column; padding: 12px 16px; box-sizing: border-box; }
.dm-root.dm-fullscreen {
  position: fixed !important;
  inset: 0 !important;
  z-index: 2147483000;
  padding: 0 !important;
  background: var(--dsw-alias-bg-secondary, #0b0d10);
}
.dm-root.dm-fullscreen .dm-head {
  position: absolute; top: 0; left: 0; right: 0; z-index: 2;
  padding: 10px 14px; background: rgba(0,0,0,.45); backdrop-filter: blur(6px);
  color: #fff;
}
.dm-root.dm-fullscreen .dm-title { color: #fff; }
.dm-root.dm-fullscreen .dm-stage,
.dm-root.dm-fullscreen .dm-audio-wrap { height: 100%; }

/* ── shared head strip ────────────────────────────────────────────── */
.dm-head { display: flex; align-items: center; gap: 8px; padding: 0 0 10px; }
.dm-title {
  font-weight: 600; color: var(--dsw-alias-label-primary, #1f2328);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1 1 auto;
}
.dm-badge { font-size: 11px; font-weight: 700; letter-spacing: .02em;
  color: var(--dsw-alias-interactive-fg-accent, #3b6fe0);
  background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06));
  padding: 1px 7px; border-radius: 999px; white-space: nowrap; }
.dm-meta { font-size: 11px; color: var(--dsw-alias-label-secondary, #656d76); white-space: nowrap; }
.dm-iconbtn {
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0); background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328); border-radius: 5px;
  padding: 3px 9px; cursor: pointer; font-size: 12px; line-height: 1.4;
  display: inline-flex; align-items: center; gap: 4px;
}
.dm-iconbtn:hover { background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)); }

/* ── stage (video / audio body) ───────────────────────────────────── */
.dm-stage { flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; }
.dm-video { display: block; max-width: 100%; max-height: 100%; background: #000; }

/* ── audio / music player ─────────────────────────────────────────── */
.dm-audio-wrap { flex: 1; min-height: 0; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 18px; padding: 8px 0 4px; }
.dm-art {
  width: 150px; height: 150px; border-radius: 50%; flex-shrink: 0;
  background: radial-gradient(circle at 35% 30%, #3a4a66, #12141c 70%);
  display: flex; align-items: center; justify-content: center;
  box-shadow: 0 8px 30px rgba(0,0,0,.35), inset 0 0 0 1px rgba(255,255,255,.05);
}
.dm-art-inner { width: 46px; height: 46px; border-radius: 50%;
  background: radial-gradient(circle at 40% 35%, #4a5a78, #12141c 70%);
  display: flex; align-items: center; justify-content: center;
  color: var(--dsw-alias-label-primary, #1f2328); font-size: 20px; }
.dm-art-spin { animation: dm-spin 6s linear infinite; }
@keyframes dm-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

.dm-eq { display: flex; align-items: flex-end; gap: 3px; height: 26px; }
.dm-eq span { width: 4px; border-radius: 2px; background: var(--dsw-alias-interactive-fg-accent, #3b6fe0); animation: dm-eq .9s ease-in-out infinite; }
.dm-eq span:nth-child(1) { height: 40%; animation-delay: 0s; }
.dm-eq span:nth-child(2) { height: 80%; animation-delay: .15s; }
.dm-eq span:nth-child(3) { height: 60%; animation-delay: .3s; }
.dm-eq span:nth-child(4) { height: 100%; animation-delay: .45s; }
.dm-eq span:nth-child(5) { height: 70%; animation-delay: .6s; }
.dm-eq span:nth-child(6) { height: 90%; animation-delay: .75s; }
.dm-eq span:nth-child(7) { height: 50%; animation-delay: .9s; }
@keyframes dm-eq { 0%, 100% { transform: scaleY(.55); } 50% { transform: scaleY(1); } }
.dm-eq span { transform-origin: bottom; }

.dm-name { font-size: 15px; font-weight: 600; color: var(--dsw-alias-label-primary, #1f2328);
  text-align: center; max-width: 70%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dm-sub { font-size: 12px; color: var(--dsw-alias-label-secondary, #656d76); }

/* ── transport (control bar) ──────────────────────────────────────── */
.dm-transport { width: 100%; max-width: 520px; display: flex; flex-direction: column; gap: 6px; }
.dm-seek { display: flex; align-items: center; gap: 8px; width: 100%; }
.dm-time { font-size: 11px; color: var(--dsw-alias-label-secondary, #656d76); font-variant-numeric: tabular-nums; min-width: 38px; text-align: center; }
.dm-row { display: flex; align-items: center; justify-content: center; gap: 10px; }
.dm-playbtn {
  width: 50px; height: 50px; border-radius: 50%; border: none; cursor: pointer;
  background: var(--dsw-alias-interactive-fg-accent, #3b6fe0); color: #fff;
  display: flex; align-items: center; justify-content: center; font-size: 20px;
  box-shadow: 0 4px 14px rgba(59,111,224,.35);
}
.dm-playbtn:hover { filter: brightness(1.08); }
.dm-vol { display: flex; align-items: center; gap: 6px; }
.dm-rate { font-size: 11px; color: var(--dsw-alias-label-primary, #1f2328);
  border: 1px solid var(--dsw-alias-border-l2, #d8dbe0); background: transparent;
  border-radius: 5px; padding: 2px 7px; cursor: pointer; }

/* ── range inputs (seek / volume), cross-browser ──────────────────── */
.dm-range { -webkit-appearance: none; appearance: none; flex: 1; height: 4px;
  border-radius: 3px; background: var(--dsw-alias-border-l2, #d8dbe0); outline: none; cursor: pointer; }
.dm-range::-webkit-slider-thumb { -webkit-appearance: none; appearance: none;
  width: 13px; height: 13px; border-radius: 50%; background: var(--dsw-alias-interactive-fg-accent, #3b6fe0);
  border: none; cursor: pointer; }
.dm-range::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%;
  background: var(--dsw-alias-interactive-fg-accent, #3b6fe0); border: none; cursor: pointer; }

/* ── error / empty ────────────────────────────────────────────────── */
.dm-err { color: #d1242f; font-size: 13px; line-height: 1.6; }
.dm-empty { color: var(--dsw-alias-label-secondary, #656d76); font-size: 13px; }
`

/** Inject the stylesheet; returns a disposer that removes it. */
export function mountStyles(): () => void {
  const style = document.createElement('style')
  style.setAttribute('data-dock-media', '')
  style.textContent = CSS
  document.head.appendChild(style)
  return () => { style.remove() }
}
