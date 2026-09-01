// Workers API client for the ClipSync backend.
// The Pages client is a separate origin, so it calls the Worker's absolute URL.
const API = (import.meta.env.VITE_API_BASE || "https://clipsync.spectre7.workers.dev").replace(/\/$/, "");
const WS = API.replace(/^http/, "ws");

// Resolve a server-relative file URL (/files/<key>) against the Worker origin.
export function resolveFileUrl(url) {
    if (!url) return "#";
    if (/^https?:\/\//i.test(url)) return url;
    return `${API}${url.startsWith("/") ? "" : "/"}${url}`;
}

async function handle(res) {
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
    }
    return await res.json();
}

export async function createSession() {
    const res = await fetch(`${API}/api/sessions`, { method: "POST" });
    const data = await handle(res);
    return data.code;
}

export async function verifySession(code) {
    const res = await fetch(`${API}/api/sessions/${encodeURIComponent(code)}`);
    return res.ok;
}

export async function listEntries(code) {
    const res = await fetch(`${API}/api/sessions/${encodeURIComponent(code)}/entries`);
    return handle(res);
}

export async function createEntry(code, input) {
    const res = await fetch(`${API}/api/sessions/${encodeURIComponent(code)}/entries`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            content: input.content,
            sensitive: input.sensitive,
            files: (input.files ?? []).map((f) => ({
                name: f.name,
                key: f.key,
                type: f.type,
                size: f.size,
            })),
        }),
    });
    return handle(res);
}

export async function deleteEntry(code, id) {
    const res = await fetch(`${API}/api/sessions/${encodeURIComponent(code)}/entries/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
    await handle(res);
}

export async function clearEntries(code) {
    const res = await fetch(`${API}/api/sessions/${encodeURIComponent(code)}/entries`, {
        method: "DELETE",
    });
    await handle(res);
}

export async function uploadFiles(files) {
    const form = new FormData();
    for (const file of files) {
        form.append("files", file);
    }
    const res = await fetch(`${API}/api/files`, { method: "POST", body: form });
    return handle(res);
}

export async function createPair(sessionCode) {
    const res = await fetch(`${API}/api/pairing/create`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionCode }),
    });
    return handle(res);
}

export async function claimPair(pair) {
    const res = await fetch(`${API}/api/pairing/claim`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pair }),
    });
    return handle(res);
}

export async function getStats() {
    const res = await fetch(`${API}/api/stats`);
    return handle(res);
}

export async function trackStats() {
    const res = await fetch(`${API}/api/stats/track`, { method: "POST" });
    return handle(res);
}

export function openRealtimeSocket(code, onEvent, onStatus) {
    const ws = new WebSocket(`${WS}/ws?code=${encodeURIComponent(code)}`);

    let closed = false;
    let retryTimer = null;

    ws.onopen = () => onStatus?.(true);
    ws.onmessage = (ev) => {
        try {
            const event = JSON.parse(ev.data);
            if ("type" in event) onEvent(event);
        } catch {
            // ignore non-event frames (pong/keepalive)
        }
    };
    ws.onerror = () => onStatus?.(false);
    ws.onclose = () => {
        onStatus?.(false);
        if (!closed) {
            retryTimer = setTimeout(() => {
                openRealtimeSocket(code, onEvent, onStatus);
            }, 3000);
        }
    };

    return () => {
        closed = true;
        if (retryTimer) clearTimeout(retryTimer);
        ws.close();
    };
}
