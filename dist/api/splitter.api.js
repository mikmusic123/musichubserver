// src/api/splitterapi.ts
const API_BASE = "https://musichubserver.onrender.com";
// const API_BASE = "http://localhost:4000";
function authHeaders(token) {
    const headers = {};
    if (token)
        headers.Authorization = `Bearer ${token}`;
    return headers;
}
async function handleJson(res) {
    const raw = await res.text();
    const json = raw ? (() => { try {
        return JSON.parse(raw);
    }
    catch {
        return null;
    } })() : null;
    if (!res.ok) {
        const message = (json && (json.error || json.message)) ||
            raw ||
            `Request failed with ${res.status}`;
        throw new Error(message);
    }
    if (json === null)
        throw new Error("Expected JSON response but got empty/non-JSON body.");
    return json;
}
export async function createSplitJob(file, options = {}, token) {
    const form = new FormData();
    form.append("file", file);
    if (options.model)
        form.append("model", options.model);
    if (options.twoStems)
        form.append("twoStems", options.twoStems);
    if (options.outputFormat)
        form.append("outputFormat", options.outputFormat);
    const res = await fetch(`${API_BASE}/splitter/split`, {
        method: "POST",
        headers: { ...authHeaders(token) },
        body: form,
    });
    return handleJson(res);
}
// IMPORTANT: no Content-Type header here (avoid preflight/CORS headaches)
export async function fetchSplitJob(jobId, token) {
    const res = await fetch(`${API_BASE}/splitter/status/${jobId}`, {
        headers: { ...authHeaders(token) },
    });
    return handleJson(res);
}
export async function waitForSplitJobDone(jobId, token, { intervalMs = 1500, timeoutMs = 10 * 60 * 1000 } = {}) {
    const start = Date.now();
    while (true) {
        const job = await fetchSplitJob(jobId, token);
        if (job.status === "done" || job.status === "error")
            return job;
        if (Date.now() - start > timeoutMs)
            throw new Error("Split timed out");
        await new Promise((r) => setTimeout(r, intervalMs));
    }
}
//# sourceMappingURL=splitter.api.js.map