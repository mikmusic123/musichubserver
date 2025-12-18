// (SERVER) src/routes/split.routes.ts
import express from "express";
import multer from "multer";
import { loadJob, saveJob, now } from "../split/jobStore.js";
const router = express.Router();
const upload = multer(); // ⬅️ memory storage (buffer)
// ---- worker config ----
const WORKER_URL = process.env.WORKER_URL;
const WORKER_SECRET = process.env.WORKER_SECRET;
if (!WORKER_URL || !WORKER_SECRET) {
    throw new Error("WORKER_URL or WORKER_SECRET not set");
}
// ---- helpers ----
async function createWorkerJob(file) {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype || "application/octet-stream",
    });
    form.append("file", blob, file.originalname);
    const res = await fetch(`${WORKER_URL}/v1/split`, {
        method: "POST",
        headers: {
            "x-worker-secret": WORKER_SECRET,
        },
        body: form,
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Worker create failed: ${t}`);
    }
    return res.json();
}
async function fetchWorkerJob(jobId) {
    const res = await fetch(`${WORKER_URL}/v1/status/${jobId}`, {
        headers: {
            "x-worker-secret": WORKER_SECRET,
        },
    });
    if (!res.ok) {
        const t = await res.text();
        throw new Error(`Worker status failed: ${t}`);
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