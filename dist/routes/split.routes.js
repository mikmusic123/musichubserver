// (SERVER) src/routes/split.routes.ts
import express from "express";
import multer from "multer";
import { loadJob, saveJob, now } from "../split/jobStore.js";
const router = express.Router();
// ---------- upload ----------
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});
// ---------- worker config ----------
const WORKER_URL = process.env.WORKER_URL;
const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_URL || !WORKER_SECRET) {
    throw new Error("WORKER_URL or WORKER_SECRET not set");
}
// ---------- helpers ----------
async function readBodySafe(res) {
    const text = await res.text();
    try {
        return JSON.stringify(JSON.parse(text));
    }
    catch {
        return text;
    }
}
async function createWorkerJob(file) {
    if (!file?.buffer)
        throw new Error("No file.buffer");
    const bytes = new Uint8Array(file.buffer);
    const form = new FormData();
    const blob = new Blob([bytes], {
        type: file.mimetype || "application/octet-stream",
    });
    // field name MUST match worker: upload.single("file")
    form.append("file", blob, file.originalname || "upload.bin");
    const res = await fetch(`${WORKER_URL}/v1/split`, {
        method: "POST",
        headers: { "x-worker-secret": WORKER_SECRET },
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
    const res = await fetch(`${WORKER_URL}/v1/status/${encodeURIComponent(jobId)}`, { headers: { "x-worker-secret": WORKER_SECRET } });
    if (!res.ok) {
        const body = await readBodySafe(res);
        throw new Error(`Worker status failed (${res.status}): ${body}`);
    }
    return (await res.json());
}
function mapWorkerStatus(status) {
    switch (status) {
        case "queued":
        case "pending":
            return "queued";
        case "running":
        case "processing":
            return "running";
        case "done":
        case "completed":
        case "success":
            return "done";
        case "error":
        case "failed":
            return "error";
        default:
            return "error";
    }
}
// ---------- routes ----------
// POST /splitter/split
router.post("/split", upload.single("file"), async (req, res) => {
    try {
        if (!req.file)
            return res.status(400).json({ error: "No file uploaded" });
        const { jobId } = await createWorkerJob(req.file);
        const job = {
            id: jobId,
            status: "queued",
            trackName: req.file.originalname,
            inputPath: "",
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
        const local = loadJob(jobId);
        if (!local)
            return res.status(404).json({ error: "Job not found" });
        try {
            const workerJob = await fetchWorkerJob(jobId);
            local.status = mapWorkerStatus(workerJob.status);
            if (typeof workerJob.progress === "number") {
                local.progress = workerJob.progress + '';
            }
            if (typeof workerJob.error === "string") {
                local.error = workerJob.error;
            }
            local.result = workerJob.result;
            local.updatedAt = now();
            saveJob(local);
            return res.json(local);
        }
        catch (e) {
            const msg = String(e?.message || "");
            // ✅ propagate true 404 from worker (lost job / never created)
            if (msg.includes("Worker status failed (404)")) {
                local.status = "error";
                local.error = "Worker job not found (restart or wrong store path)";
                local.updatedAt = now();
                saveJob(local);
                return res.status(404).json(local);
            }
            throw e;
        }
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