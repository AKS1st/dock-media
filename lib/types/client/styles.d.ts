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
/** Inject the stylesheet; returns a disposer that removes it. */
export declare function mountStyles(): () => void;
