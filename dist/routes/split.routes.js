// (SERVER) src/routes/split.routes.ts
import express from "express";
import multer from "multer";
import { loadJob, saveJob, now } from "../split/jobStore.js";
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 200 * 1024 * 1024, // adjust (200MB example)
    },
});
// ---- worker config ----
const WORKER_URL = process.env.WORKER_URL;
const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_URL || !WORKER_SECRET) {
    throw new Error("WORKER_URL or WORKER_SECRET not set");
}
// ---- helpers ----
// ---- helpers ----
// If you're on Node < 18, fetch/FormData/Blob may not exist.
// Render typically uses Node 18+ but this keeps it explicit.
const hasBlob = typeof Blob !== "undefined";
const hasFormData = typeof FormData !== "undefined";
async function readBodySafe(res) {
    const ct = res.headers.get("content-type") || "";
    const text = await res.text();
    // try to pretty-print json
    if (ct.includes("application/json")) {
        try {
            return JSON.stringify(JSON.parse(text));
        }
        catch {
            return text;
        }
    }
    return text;
}
function toUint8Array(data) {
    // Multer in memoryStorage should give Buffer, but normalize anyway:
    if (Buffer.isBuffer(data))
        return new Uint8Array(data);
    if (data instanceof Uint8Array)
        return data;
    if (data instanceof ArrayBuffer)
        return new Uint8Array(data);
    // Some libs hand you an object like { data: [...] }
    if (data?.data && Array.isArray(data.data))
        return new Uint8Array(data.data);
    throw new Error("Unsupported file buffer type (expected Buffer/Uint8Array/ArrayBuffer).");
}
function workerHeaders() {
    return {
        // send both styles (covers most worker auth setups)
        "x-worker-secret": WORKER_SECRET,
        Authorization: `Bearer ${WORKER_SECRET}`,
    };
}
async function createWorkerJob(file) {
    if (!file?.buffer) {
        throw new Error("No file.buffer found. Ensure multer.memoryStorage() is used.");
    }
    const form = new FormData();
    // buffer -> blob (TS-safe)
    const part = file.buffer; // ✅ silence BlobPart typing mess
    const blob = new Blob([part], {
        type: file.mimetype || "application/octet-stream",
    });
    form.append("file", blob, file.originalname);
    form.append("file", blob, file.originalname || "upload.bin");
    const res = await fetch(`${WORKER_URL}/v1/split`, {
        method: "POST",
        headers: workerHeaders(),
        body: form,
    });
    if (!res.ok) {
        const body = await readBodySafe(res);
        throw new Error(`Worker create failed (${res.status}): ${body}`);
    }
    const data = (await res.json());
    if (!data.jobId)
        throw new Error("Worker response missing jobId");
    return { jobId: data.jobId };
}
async function fetchWorkerJob(jobId) {
    const res = await fetch(`${WORKER_URL}/v1/status/${encodeURIComponent(jobId)}`, {
        headers: workerHeaders(),
    });
    if (!res.ok) {
        const body = await readBodySafe(res);
        throw new Error(`Worker status failed (${res.status} ${res.statusText}): ${body}`);
    }
    return res.json();
}
// ---- routes ----
// POST /splitter/split
router.post("/split", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        // create job on worker
        const { jobId } = await createWorkerJob(req.file);
        // persist locally (server-side tracking only)
        const job = {
            id: jobId,
            status: "queued",
            trackName: req.file.originalname,
            inputPath: "", // no local file anymore
            createdAt: now(),
            updatedAt: now(),
        };
        saveJob(job);
        res.status(202).json({
            jobId,
            statusUrl: `/splitter/status/${jobId}`,
        });
    }
    catch (err) {
        console.error("split error:", err);
        res.status(500).json({ error: err?.message || "Split failed" });
    }
});
// GET /splitter/status/:jobId
router.get("/status/:jobId", async (req, res) => {
    try {
        const jobId = req.params.jobId;
        // ensure we know this job
        const local = loadJob(jobId);
        if (!local) {
            return res.status(404).json({ error: "Job not found" });
        }
        // fetch worker state
        const workerJob = await fetchWorkerJob(jobId);
        // sync minimal fields
        local.status = workerJob.status;
        local.progress = workerJob.progress;
        local.error = workerJob.error;
        local.result = workerJob.result;
        local.updatedAt = now();
        saveJob(local);
        res.json(local);
    }
    catch (err) {
        console.error("status error:", err);
        res.status(502).json({
            error: "Worker unavailable",
            detail: err?.message,
        });
    }
});
export default router;
//# sourceMappingURL=split.routes.js.map