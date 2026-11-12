window.__ModuleLoader__.load({
	id: "dock-media",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		// src/client/media.ts
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
		/** Lowercased extension → MIME type (audio). */
		const AUDIO_MIME = {
			mp3: "audio/mpeg",
			wav: "audio/wav",
			ogg: "audio/ogg",
			oga: "audio/ogg",
			opus: "audio/ogg",
			flac: "audio/flac",
			aac: "audio/aac",
			m4a: "audio/mp4",
			weba: "audio/webm",
			wma: "audio/x-ms-wma",
			mid: "audio/midi",
			midi: "audio/midi"
		};
		/** Lowercased extension → MIME type (video). */
		const VIDEO_MIME = {
			mp4: "video/mp4",
			m4v: "video/mp4",
			webm: "video/webm",
			mov: "video/quicktime",
			mkv: "video/x-matroska",
			ogv: "video/ogg",
			avi: "video/x-msvideo",
			mpg: "video/mpeg",
			mpeg: "video/mpeg",
			flv: "video/x-flv",
			wmv: "video/x-ms-wmv",
			"3gp": "video/3gpp"
		};
		/**
		* Formats the browser almost never decodes natively (container/codec combos
		* not implemented by Chromium/Firefox/WebKit). These get a best-effort
		* "likely unsupported" notice while still attempting playback.
		*/
		const LIKELY_UNSUPPORTED = /* @__PURE__ */ new Set([
			"avi",
			"flv",
			"wmv",
			"mpg",
			"mpeg",
			"mid",
			"midi",
			"wma"
		]);
		/** File extension label ('.mp3' style) for badges. */
		function extLabel(path) {
			const at = path.lastIndexOf(".");
			return at === -1 ? path.split(/[\\/]/).pop() ?? path : path.slice(at).toUpperCase();
		}
		/** Classify a path by extension, or undefined when not a known media type. */
		function classifyMedia(path) {
			const base = path.split(/[\\/]/).pop() ?? path;
			const at = base.lastIndexOf(".");
			const ext = at === -1 ? "" : base.slice(at + 1).toLowerCase();
			const mime = AUDIO_MIME[ext] ?? VIDEO_MIME[ext];
			if (mime === void 0) return void 0;
			return {
				kind: AUDIO_MIME[ext] !== void 0 ? "audio" : "video",
				ext,
				mime,
				nativePlayable: !LIKELY_UNSUPPORTED.has(ext)
			};
		}
		/** The media source URL (same-origin streaming endpoint, Range-aware). */
		function mediaSourceUrl(path) {
			return `/dock-media/source?path=${encodeURIComponent(path)}`;
		}
		/** Human-readable byte size. */
		function formatBytes(bytes) {
			if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
			const units = [
				"B",
				"KiB",
				"MiB",
				"GiB"
			];
			let value = bytes;
			let unit = 0;
			while (value >= 1024 && unit < units.length - 1) {
				value /= 1024;
				unit += 1;
			}
			return `${value.toFixed(value >= 100 || unit === 0 ? 0 : 1)} ${units[unit]}`;
		}
		/** Format seconds as m:ss (h:mm:ss for long files). */
		function formatTime(seconds) {
			if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
			const total = Math.floor(seconds);
			const h = Math.floor(total / 3600);
			const m = Math.floor(total % 3600 / 60);
			const s = total % 60;
			if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
			return `${m}:${String(s).padStart(2, "0")}`;
		}
		// src/client/VideoPlayer.tsx
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
		/** Map a media element error to a friendly message. */
		function errorMessage() {
			return "浏览器无法播放此视频（容器或编码不受支持，或文件已损坏）。";
		}
		function VideoPlayer(props) {
			const { src, title, onError } = props;
			const videoRef = (0, react.useRef)(null);
			(0, react.useEffect)(() => {
				const video = videoRef.current;
				if (video === null) return;
				const onVideoError = () => {
					const code = video.error?.code;
					if (code === void 0 || code === 4) onError("视频解码错误，文件可能已损坏。");
					else onError(errorMessage());
				};
				video.addEventListener("error", onVideoError);
				return () => {
					video.removeEventListener("error", onVideoError);
				};
			}, [onError]);
			return (0, react.createElement)("video", {
				ref: videoRef,
				className: "dm-video",
				src,
				controls: true,
				preload: "metadata",
				playsInline: true,
				"aria-label": title
			});
		}
		// src/client/AudioPlayer.tsx
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
		/** Playback rate choices. */
		const RATES = [
			1,
			1.25,
			1.5,
			2,
			.5
		];
		function AudioPlayer(props) {
			const { src, title, extLabel } = props;
			const audioRef = (0, react.useRef)(null);
			const [playing, setPlaying] = (0, react.useState)(false);
			const [currentTime, setCurrentTime] = (0, react.useState)(0);
			const [duration, setDuration] = (0, react.useState)(0);
			const [volume, setVolume] = (0, react.useState)(1);
			const [muted, setMuted] = (0, react.useState)(false);
			const [rate, setRate] = (0, react.useState)(1);
			const [loop, setLoop] = (0, react.useState)(false);
			const [error, setError] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				const audio = audioRef.current;
				if (audio === null) return;
				const onTime = () => setCurrentTime(audio.currentTime);
				const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
				const onPlay = () => setPlaying(true);
				const onPause = () => setPlaying(false);
				const onEnded = () => setPlaying(false);
				const onVolume = () => setVolume(audio.volume);
				const onError = () => setError("浏览器无法解码此音频（编码不受支持，或文件已损坏）。");
				audio.addEventListener("timeupdate", onTime);
				audio.addEventListener("loadedmetadata", onMeta);
				audio.addEventListener("durationchange", onMeta);
				audio.addEventListener("play", onPlay);
				audio.addEventListener("pause", onPause);
				audio.addEventListener("ended", onEnded);
				audio.addEventListener("volumechange", onVolume);
				audio.addEventListener("error", onError);
				return () => {
					audio.removeEventListener("timeupdate", onTime);
					audio.removeEventListener("loadedmetadata", onMeta);
					audio.removeEventListener("durationchange", onMeta);
					audio.removeEventListener("play", onPlay);
					audio.removeEventListener("pause", onPause);
					audio.removeEventListener("ended", onEnded);
					audio.removeEventListener("volumechange", onVolume);
					audio.removeEventListener("error", onError);
				};
			}, [src]);
			const togglePlay = (0, react.useCallback)(() => {
				const audio = audioRef.current;
				if (audio === null) return;
				if (audio.paused) audio.play().catch(() => setError("无法启动播放（浏览器的自动播放限制可能阻止了已加载的音轨）。"));
				else audio.pause();
			}, []);
			const onSeek = (0, react.useCallback)((value) => {
				const audio = audioRef.current;
				if (audio === null) return;
				audio.currentTime = value;
				setCurrentTime(value);
			}, []);
			const onVolume = (0, react.useCallback)((value) => {
				const audio = audioRef.current;
				if (audio === null) return;
				audio.volume = value;
				if (value === 0) audio.muted = true;
				else if (audio.muted) audio.muted = false;
				setMuted(value === 0);
			}, []);
			const toggleMute = (0, react.useCallback)(() => {
				const audio = audioRef.current;
				if (audio === null) return;
				audio.muted = !audio.muted;
				setMuted(audio.muted);
			}, []);
			const onRate = (0, react.useCallback)((next) => {
				const audio = audioRef.current;
				if (audio === null) return;
				audio.playbackRate = next;
				setRate(next);
			}, []);
			const toggleLoop = (0, react.useCallback)(() => {
				const audio = audioRef.current;
				if (audio === null) return;
				audio.loop = !audio.loop;
				setLoop(audio.loop);
			}, []);
			const dur = duration > 0 ? duration : 0;
			dur > 0 && currentTime / dur * 100;
			return (0, react.createElement)("div", { className: "dm-audio-wrap" }, (0, react.createElement)("div", { className: playing ? "dm-art dm-art-spin" : "dm-art" }, (0, react.createElement)("div", { className: "dm-art-inner" }, "♫")), playing ? (0, react.createElement)("div", { className: "dm-eq" }, (0, react.createElement)("span"), (0, react.createElement)("span"), (0, react.createElement)("span"), (0, react.createElement)("span"), (0, react.createElement)("span"), (0, react.createElement)("span"), (0, react.createElement)("span")) : null, (0, react.createElement)("div", {
				className: "dm-name",
				title
			}, title), (0, react.createElement)("div", { className: "dm-sub" }, extLabel), (0, react.createElement)("div", { className: "dm-transport" }, (0, react.createElement)("div", { className: "dm-seek" }, (0, react.createElement)("span", { className: "dm-time" }, formatTime(currentTime)), (0, react.createElement)("input", {
				className: "dm-range",
				type: "range",
				min: 0,
				max: dur,
				step: .1,
				value: currentTime,
				disabled: dur <= 0,
				onChange: (e) => onSeek(Number(e.currentTarget.value)),
				"aria-label": "播放进度"
			}), (0, react.createElement)("span", { className: "dm-time" }, formatTime(dur))), (0, react.createElement)("div", { className: "dm-row" }, (0, react.createElement)("button", {
				className: "dm-iconbtn dm-rate",
				onClick: toggleLoop,
				title: loop ? "取消单曲循环" : "单曲循环",
				style: loop ? { color: "var(--dsw-alias-interactive-fg-accent, #3b6fe0)" } : void 0
			}, loop ? "🔁" : "🔁"), (0, react.createElement)("button", {
				className: "dm-playbtn",
				onClick: togglePlay,
				title: playing ? "暂停" : "播放",
				"aria-label": playing ? "暂停" : "播放"
			}, playing ? "❚❚" : "▶"), (0, react.createElement)("div", { className: "dm-vol" }, (0, react.createElement)("button", {
				className: "dm-iconbtn dm-rate",
				onClick: toggleMute,
				title: muted ? "取消静音" : "静音"
			}, muted ? "🔇" : "🔊"), (0, react.createElement)("input", {
				className: "dm-range",
				type: "range",
				min: 0,
				max: 1,
				step: .05,
				value: muted ? 0 : volume,
				onChange: (e) => onVolume(Number(e.currentTarget.value)),
				style: { maxWidth: 90 },
				"aria-label": "音量"
			})), (0, react.createElement)("select", {
				className: "dm-rate",
				value: rate,
				onChange: (e) => onRate(Number(e.currentTarget.value)),
				title: "播放速度",
				"aria-label": "播放速度"
			}, RATES.map((r) => (0, react.createElement)("option", {
				key: String(r),
				value: String(r)
			}, `${r}x`))))), (0, react.createElement)("audio", {
				ref: audioRef,
				src,
				preload: "metadata",
				volume,
				muted,
				loop,
				playbackRate: rate
			}), error !== null ? (0, react.createElement)("div", { className: "dm-err" }, error) : null);
		}
		// src/client/MediaView.tsx
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
		/** True when the browser's Fullscreen API is usable. */
		function hasFullscreenApi() {
			return typeof document !== "undefined" && typeof document.fullscreenEnabled !== "undefined" && document.fullscreenEnabled === true && typeof Element !== "undefined" && typeof Element.prototype.requestFullscreen === "function";
		}
		function MediaView(props) {
			const { seed } = props;
			const openSeed = seed ?? {};
			const path = openSeed.path;
			const title = openSeed.title ?? path?.split(/[\\/]/).pop() ?? "Media";
			const containerRef = (0, react.useRef)(null);
			const [size, setSize] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [fullscreen, setFullscreen] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (path === void 0) return;
				let cancelled = false;
				(async () => {
					try {
						const json = await (await fetch("/dock-media/probe", {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({ path })
						})).json();
						if (json.ok !== true || json.value === void 0) return;
						if (cancelled) return;
						setSize(json.value.size);
					} catch {}
				})();
				return () => {
					cancelled = true;
				};
			}, [path]);
			(0, react.useEffect)(() => {
				const root = containerRef.current;
				if (root === null) return;
				const el = root;
				const onChange = () => {
					setFullscreen(document.fullscreenElement === el);
				};
				document.addEventListener("fullscreenchange", onChange);
				return () => {
					document.removeEventListener("fullscreenchange", onChange);
				};
			}, []);
			const toggleFullscreen = () => {
				const root = containerRef.current;
				if (root === null) return;
				if (hasFullscreenApi()) {
					if (document.fullscreenElement === root) document.exitFullscreen();
					else root.requestFullscreen().catch(() => {});
				} else setFullscreen((current) => !current);
			};
			if (path === void 0) return (0, react.createElement)("div", { className: "dm-root" }, (0, react.createElement)("div", { className: "dm-empty" }, "没有可播放的媒体路径。"));
			const info = classifyMedia(path);
			if (info === void 0) return (0, react.createElement)("div", { className: "dm-root" }, (0, react.createElement)("div", { className: "dm-empty" }, `不支持的媒体类型：${path}`));
			const src = mediaSourceUrl(path);
			const sizeText = size !== null ? formatBytes(size) : "";
			const notice = !info.nativePlayable ? "⚠ 该封装/编码通常无法在浏览器直接解码（可能需要系统播放器）。" : null;
			return (0, react.createElement)("div", {
				ref: containerRef,
				className: fullscreen ? "dm-root dm-fullscreen" : "dm-root"
			}, (0, react.createElement)("div", { className: "dm-head" }, (0, react.createElement)("span", {
				className: "dm-title",
				title: path
			}, title), (0, react.createElement)("span", { className: "dm-badge" }, extLabel(path)), sizeText !== "" ? (0, react.createElement)("span", { className: "dm-meta" }, sizeText) : null, (0, react.createElement)("button", {
				className: "dm-iconbtn",
				onClick: toggleFullscreen,
				title: fullscreen ? "退出全屏" : "全屏"
			}, fullscreen ? "⛶ 退出全屏" : "⛶ 全屏")), info.kind === "video" ? (0, react.createElement)("div", { className: "dm-stage" }, (0, react.createElement)(VideoPlayer, {
				src,
				title,
				onError: setError
			})) : (0, react.createElement)(AudioPlayer, {
				src,
				title,
				extLabel: extLabel(path)
			}), notice !== null || error !== null ? (0, react.createElement)("div", { style: { paddingTop: 6 } }, notice !== null ? (0, react.createElement)("div", { className: "dm-sub" }, notice) : null, error !== null ? (0, react.createElement)("div", { className: "dm-err" }, error) : null) : null);
		}
		// src/client/styles.ts
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
`;
		/** Inject the stylesheet; returns a disposer that removes it. */
		function mountStyles() {
			const style = document.createElement("style");
			style.setAttribute("data-dock-media", "");
			style.textContent = CSS;
			document.head.appendChild(style);
			return () => {
				style.remove();
			};
		}
		// src/client/index.ts
		/** Requires the workbench base (carrier) and the dock-files file domain. */
		const inject = ["workbench", "files"];
		/** The extensions this viewer claims (audio + video containers/codecs). */
		const MEDIA_EXTS = [
			"mp3",
			"wav",
			"ogg",
			"oga",
			"opus",
			"flac",
			"aac",
			"m4a",
			"weba",
			"wma",
			"mid",
			"midi",
			"mp4",
			"m4v",
			"webm",
			"mov",
			"mkv",
			"ogv",
			"avi",
			"mpg",
			"mpeg",
			"flv",
			"wmv",
			"3gp"
		];
		/** Client plugin body. */
		function apply(ctx) {
			const workbench = ctx.get("workbench");
			const files = ctx.get("files");
			if (workbench === void 0 || files === void 0) return;
			ctx.effect(() => workbench.registerPlugin({
				id: "dock-media",
				title: "Media",
				description: "Media player for the dock file explorer: plays audio and video files with music and fullscreen playback modes.",
				hasEntry: false
			}), "dock-media: plugin metadata");
			ctx.effect(() => mountStyles(), "dock-media: styles");
			ctx.effect(() => files.registerFileViewer({
				id: "media",
				exts: MEDIA_EXTS,
				icon: {
					color: "#e0894d",
					viewBox: "0 0 16 16",
					path: "M5.20 2.40h5.60a2.8 2.8 0 0 1 2.8 2.8v5.60a2.8 2.8 0 0 1 -2.8 2.8h-5.60a2.8 2.8 0 0 1 -2.8 -2.8v-5.60a2.8 2.8 0 0 1 2.8 -2.8zM5.80 4.00h4.40a1.8 1.8 0 0 1 1.8 1.8v4.40a1.8 1.8 0 0 1 -1.8 1.8h-4.40a1.8 1.8 0 0 1 -1.8 -1.8v-4.40a1.8 1.8 0 0 1 1.8 -1.8zM6.6 5.4L10.4 8L6.6 10.6z"
				}
			}), "dock-media: file viewer");
			ctx.effect(() => workbench.registerEditorView({
				id: "media",
				title: "Media",
				order: 130,
				component: MediaView
			}), "dock-media: view");
		}
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map