import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { resolve } from "node:path";
// src/index.ts
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
const name = "dock-media";
/**
* Services required before mounting.
*
* The declared-authority list these routes fence with used to be injected here
* as `webRuntime`. DSH renamed that service to `webStartup` in 0.2.1, so the
* list is resolved lazily through `declaredTrustedHosts` instead: a renamed
* service can no longer park this plugin, and older hosts still mount.
*/
const inject = ["webServer"];
var WbError = class extends Error {
	code;
	status;
	constructor(code, message, status = 400) {
		super(message);
		this.code = code;
		this.status = status;
	}
};
const MAX_BODY_BYTES = 1 << 20;
async function readJsonBody(req) {
	const chunks = [];
	let total = 0;
	for await (const chunk of req) {
		const buffer = Buffer.from(chunk);
		total += buffer.length;
		if (total > MAX_BODY_BYTES) throw new WbError("bad-request", "request body too large");
		chunks.push(buffer);
	}
	const text = Buffer.concat(chunks).toString("utf8");
	if (text.trim() === "") return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new WbError("bad-request", "request body is not valid JSON");
	}
}
function writeJson(res, status, body) {
	res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
	res.end(JSON.stringify(body));
}
function writeOk(res, value) {
	writeJson(res, 200, {
		ok: true,
		value
	});
}
function writeError(res, error) {
	if (error instanceof WbError) {
		writeJson(res, error.status, {
			ok: false,
			error: {
				code: error.code,
				message: error.message
			}
		});
		return;
	}
	writeJson(res, 500, {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error)
		}
	});
}
function stringOrUndefined(payload, key) {
	const value = payload?.[key];
	return typeof value === "string" && value !== "" ? value : void 0;
}
function requireAbsolute(path) {
	if (!path.startsWith("/") && !/^[A-Za-z]:[\\/]/.test(path)) throw new WbError("fs-error", `"${path}" is not an absolute path`, 400);
	return path;
}
/**
* Resolve a caller-supplied absolute path for READING / STREAMING: no
* workspace containment — the media player opens media anywhere on the host,
* because the conversation context can mention paths outside the session
* workspace (Music folders, ~/.dsh/skills, ...).
*/
function resolveReadPath(raw) {
	requireAbsolute(raw);
	return resolve(raw);
}
function messageOf(error) {
	return error instanceof Error ? error.message : String(error);
}
/** Lowercased extension → MIME type. */
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
/** Lowercased extension → MIME type. */
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
/** File extension (lowercased, no dot), or '' when absent. */
function extOfPath(path) {
	const base = path.split(/[\\/]/).pop() ?? "";
	const at = base.lastIndexOf(".");
	return at === -1 ? "" : base.slice(at + 1).toLowerCase();
}
/** Classify a file: media kind + MIME, or undefined when not a known media file. */
function classifyFile(path) {
	const ext = extOfPath(path);
	const mime = AUDIO_MIME[ext] ?? VIDEO_MIME[ext];
	if (mime === void 0) return void 0;
	return {
		kind: AUDIO_MIME[ext] !== void 0 ? "audio" : "video",
		mime
	};
}
function header(headers, name) {
	const value = headers[name];
	return typeof value === "string" ? value : void 0;
}
function isLoopbackHostname(hostname) {
	if (hostname === "localhost" || hostname === "[::1]") return true;
	const parts = hostname.split(".");
	return parts.length === 4 && parts[0] === "127" && parts.every((part) => /^\d{1,3}$/.test(part) && Number(part) <= 255);
}
function parseAuthority(authority) {
	try {
		return new URL(`http://${authority}`);
	} catch {
		return;
	}
}
function canonicalAuthority(entry, entryUrl) {
	const port = entryUrl.port !== "" ? entryUrl.port : new URL(`https://${entry}`).port;
	return port === "" ? entryUrl.hostname : `${entryUrl.hostname}:${port}`;
}
function isTrustedAuthority(hostUrl, trustedHosts) {
	return trustedHosts.some((entry) => {
		const entryUrl = parseAuthority(entry);
		if (entryUrl === void 0) return false;
		return canonicalAuthority(entry, entryUrl) === entryUrl.hostname ? entryUrl.hostname === hostUrl.hostname : entryUrl.host === hostUrl.host;
	});
}
/**
* Authorities this deployment declared besides loopback.
*
* DSH publishes them as `trustedHosts` on `webStartup` (0.2.1+); `webRuntime`
* is the same service under its 0.1.x / 0.2.0 name, and a host that exposes
* only the connection RPC carries the list on `connection`. Probe all three
* lazily: a host with none of them keeps the loopback-only fence, and no
* rename can park this plugin on a missing service again.
*/
function declaredTrustedHosts(ctx) {
	if (typeof ctx.get !== "function") return [];
	for (const name of [
		"webStartup",
		"webRuntime",
		"connection"
	]) {
		const declared = ctx.get(name)?.trustedHosts;
		if (!Array.isArray(declared)) continue;
		return declared.filter((entry) => typeof entry === "string");
	}
	return [];
}
function isTrustedRequest(request, trustedHosts) {
	const host = header(request.headers, "host");
	if (host === void 0) return false;
	const hostUrl = parseAuthority(host);
	if (hostUrl === void 0) return false;
	if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false;
	if (header(request.headers, "sec-fetch-site") === "cross-site") return false;
	const origin = header(request.headers, "origin");
	if (origin === void 0) return true;
	try {
		return new URL(origin).host === hostUrl.host;
	} catch {
		return false;
	}
}
/** Parse an HTTP Range header into { start, end } (inclusive), or undefined. */
function parseRange(value, size) {
	const match = /^bytes=(\d*)-(\d*)$/.exec(value.trim());
	if (match === null) return void 0;
	const [, rawStart, rawEnd] = match;
	if (rawStart === "" && rawEnd !== "") {
		const n = Number(rawEnd);
		if (!Number.isFinite(n) || n <= 0) return void 0;
		return {
			start: Math.max(0, size - n),
			end: size - 1
		};
	}
	const start = Number(rawStart);
	if (!Number.isFinite(start) || start < 0 || start >= size) return void 0;
	const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
	if (end < start) return void 0;
	return {
		start,
		end
	};
}
/** Stream a file to `res`, honouring an optional Range for seeking. */
async function streamSource(res, path, rangeHeader) {
	const info = await stat(path).catch((error) => {
		throw new WbError("fs-error", `cannot read "${path}": ${messageOf(error)}`, 400);
	});
	if (info.isDirectory()) throw new WbError("fs-error", `"${path}" is a directory`, 400);
	const classified = classifyFile(path);
	if (classified === void 0) throw new WbError("bad-request", `"${path}" is not a supported media file`, 400);
	const { mime } = classified;
	const size = info.size;
	const base = {
		"content-type": mime,
		"accept-ranges": "bytes",
		"cache-control": "private, no-cache"
	};
	if (rangeHeader !== void 0) {
		const slice = parseRange(rangeHeader, size);
		if (slice === void 0) {
			res.writeHead(416, {
				"content-range": `bytes */${size}`,
				"content-type": mime,
				"accept-ranges": "bytes"
			});
			res.end();
			return;
		}
		const { start, end } = slice;
		const length = end - start + 1;
		res.writeHead(206, {
			...base,
			"content-length": String(length),
			"content-range": `bytes ${start}-${end}/${size}`
		});
		createReadStream(path, {
			start,
			end
		}).on("error", (error) => {
			res.destroy(error);
		}).pipe(res);
		return;
	}
	res.writeHead(200, {
		...base,
		"content-length": String(size)
	});
	createReadStream(path).on("error", (error) => {
		res.destroy(error);
	}).pipe(res);
}
function apply(ctx) {
	ctx.effect(() => ctx.webServer.register({
		kind: "prefix",
		path: "/dock-media",
		handler: async (req, res) => {
			if (!isTrustedRequest(req, declaredTrustedHosts(ctx))) {
				writeJson(res, 403, {
					ok: false,
					error: {
						code: "forbidden",
						message: "forbidden"
					}
				});
				return;
			}
			const url = new URL(req.url ?? "/", "http://dsh.internal");
			const pathname = url.pathname;
			const method = pathname.startsWith("/dock-media/") ? pathname.slice(12) : void 0;
			if (method === void 0 || method.includes("/")) {
				writeError(res, new WbError("not-found", `unknown /dock-media method "${method}"`, 404));
				return;
			}
			try {
				if (method === "source") {
					if (req.method !== "GET") {
						writeError(res, new WbError("bad-request", "source requires GET", 405));
						return;
					}
					const raw = url.searchParams.get("path");
					if (raw === null || raw === "") {
						writeError(res, new WbError("bad-request", "source requires a \"path\"", 400));
						return;
					}
					await streamSource(res, resolveReadPath(raw), header(req.headers, "range"));
					return;
				}
				if (method === "probe") {
					if (req.method !== "POST") {
						writeError(res, new WbError("bad-request", "probe requires POST", 405));
						return;
					}
					const raw = stringOrUndefined(await readJsonBody(req), "path");
					if (raw === void 0) {
						writeError(res, new WbError("bad-request", "probe requires a \"path\"", 400));
						return;
					}
					const path = resolveReadPath(raw);
					const info = await stat(path).catch((error) => {
						throw new WbError("fs-error", `cannot read "${path}": ${messageOf(error)}`, 400);
					});
					const classified = classifyFile(path);
					writeOk(res, {
						exists: !info.isDirectory(),
						isDir: info.isDirectory(),
						size: info.size,
						kind: classified?.kind ?? null,
						mime: classified?.mime ?? "application/octet-stream"
					});
					return;
				}
				writeError(res, new WbError("not-found", `unknown /dock-media method "${method}"`, 404));
			} catch (error) {
				writeError(res, error);
			}
		}
	}), "dock-media: /dock-media routes");
}
export { WbError, apply, inject, name };
