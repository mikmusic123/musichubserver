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
async function handleJson(res) {
    const raw = await res.text(); // read once
    const tryJson = () => {
        try {
            return raw ? JSON.parse(raw) : null;
        }
        catch {
            return null;
        }
    };
    if (!res.ok) {
        const json = tryJson();
        const message = (json && (json.error || json.message)) ||
            raw ||
            `Request failed with ${res.status}`;
        throw new Error(message);
    }
    const json = tryJson();
    if (json === null)
        throw new Error("Expected JSON response but got empty/non-JSON body.");
    return json;
}
// -------- API FUNCTIONS --------
/**
 * POST /splitter/split
 * multipart/form-data:
 *  - file: audio file
 *
 * Server returns 202:
 *  { jobId, statusUrl: "/splitter/status/<jobId>" }
 */
export async function createSplitJob(file, options = {}, token) {
    const form = new FormData();
    form.append("file", file);
    // Optional fields (only useful if your server reads them)
    if (options.model)
        form.append("model", options.model);
    if (options.twoStems)
        form.append("twoStems", options.twoStems);
    if (options.outputFormat)
        form.append("outputFormat", options.outputFormat);
    const res = await fetch(`${API_BASE}/splitter/split`, {
        method: "POST",
        headers: {
            ...authHeaders(token),
            // do NOT set Content-Type for FormData
        },
        body: form,
    });
    return handleJson(res);
}
/**
 * GET /splitter/status/:jobId
 */
export async function fetchSplitJob(jobId, token) {
    const res = await fetch(`${API_BASE}/splitter/status/${jobId}`, {
        headers: {
            ...authHeaders(token),
            "Content-Type": "application/json",
        },
    });
    return handleJson(res);
}
/**
 * Convenience: poll until done/error
 */
export async function waitForSplitJobDone(jobId, token, { intervalMs = 1500, timeoutMs = 10 * 60 * 1000, } = {}) {
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
// ...routes...
export default fetchSplitJob;
//# sourceMappingURL=split.js.map