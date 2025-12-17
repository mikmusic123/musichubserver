// src/api/splitterapi.ts
// -------- config --------
const API_BASE = "https://musichubserver.onrender.com";
// const API_BASE = "http://localhost:4000";
function authHeaders(token) {
    const headers = {};
    if (token)
        headers.Authorization = `Bearer ${token}`;
    return headers;
}
/* ---------- JSON PARSER ---------- */
async function handleJson(res) {
    const contentType = (res.headers.get("content-type") || "").toLowerCase();
    const raw = await res.text();
    const tryJson = () => {
        try {
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    };
    const shortText = () => {
        if (!raw)
            return "";
        const pre = raw.match(/<pre>([\s\S]*?)<\/pre>/i)?.[1];
        const title = raw.match(/<title>([\s\S]*?)<\/title>/i)?.[1];
        return (pre || title || raw)
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 300);
    };
    const json = tryJson();
    if (!res.ok) {
        throw new Error((json && (json.error || json.message)) ||
            shortText() ||
            `Request failed with ${res.status}`);
    }
    if (json === null) {
        throw new Error(`Expected JSON but got ${contentType || "unknown content-type"}`);
    }
    return json;
}
/* ---------- SAFE FETCH ---------- */
async function safeFetchJson(url, init) {
    try {
        const res = await fetch(url, init);
        return await handleJson(res);
    }
    catch (e) {
        throw new Error(e?.message || "Network / CORS error");
    }
}
/* ---------- API ---------- */
// POST /splitter/split
export async function createSplitJob(file, options = {}, token) {
    const form = new FormData();
    form.append("file", file);
    if (options.model)
        form.append("model", options.model);
    if (options.twoStems)
        form.append("twoStems", options.twoStems);
    if (options.outputFormat)
        form.append("outputFormat", options.outputFormat);
    return safeFetchJson(`${API_BASE}/splitter/split`, {
        method: "POST",
        headers: { ...authHeaders(token) },
        body: form,
    });
}
// GET /splitter/status/:jobId
export async function fetchSplitJob(jobId, token) {
    return safeFetchJson(`${API_BASE}/splitter/status/${jobId}`, {
        headers: { ...authHeaders(token) },
    });
}
// Poll helper
export async function waitForSplitJobDone(jobId, token, { intervalMs = 1500, timeoutMs = 10 * 60 * 1000, } = {}) {
    const start = Date.now();
    while (true) {
        const job = await fetchSplitJob(jobId, token);
        if (job.status === "done" || job.status === "error")
            return job;
        if (Date.now() - start > timeoutMs) {
            throw new Error("Split timed out");
        }
        await new Promise((r) => setTimeout(r, intervalMs));
    }
}
//# sourceMappingURL=splitter.api.js.map