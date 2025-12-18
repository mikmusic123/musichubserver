// (SERVER) src/routes/split.routes.ts
import express from "express";
import multer from "multer";
import { loadJob, saveJob, now, type Job } from "../split/jobStore.js";

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
async function readBodySafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

function workerHeaders() {
  return {
    "x-worker-secret": WORKER_SECRET!,
    Authorization: `Bearer ${WORKER_SECRET!}`,
  };
}

async function createWorkerJob(file: Express.Multer.File) {
  if (!file?.buffer) {
    throw new Error("No file.buffer found");
  }

  // ✅ convert Buffer → Uint8Array (TS-safe BlobPart)
  const bytes = new Uint8Array(file.buffer);

  // ✅ global FormData / Blob (Node 18+)
  const form = new FormData();
  const blob = new Blob([bytes], {
    type: file.mimetype || "application/octet-stream",
  });

  // ✅ field name MUST match worker: upload.single("file")
  form.append("file", blob as any, file.originalname || "upload.bin");

  const res = await fetch(`${WORKER_URL}/v1/split`, {
    method: "POST",
    headers: workerHeaders(),
    // ❌ DO NOT set Content-Type
    body: form as any,
  });

  if (!res.ok) {
    const body = await readBodySafe(res);
    throw new Error(`Worker create failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { jobId?: string };
  if (!data.jobId) throw new Error("Worker response missing jobId");

  return { jobId: data.jobId };
}

async function fetchWorkerJob(jobId: string) {
  const res = await fetch(`${WORKER_URL}/v1/status/${encodeURIComponent(jobId)}`, {
    headers: workerHeaders(),
  });

  if (!res.ok) {
    const body = await readBodySafe(res);
    throw new Error(`Worker status failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ---------- routes ----------

// POST /splitter/split
router.post("/split", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const { jobId } = await createWorkerJob(req.file);

    const job: Job = {
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
  } catch (err: any) {
    console.error("split error:", err);
    res.status(500).json({ error: err?.message || "Split failed" });
  }
});

// GET /splitter/status/:jobId
router.get("/status/:jobId", async (req, res) => {
  try {
    const jobId = req.params.jobId;

    const local = loadJob(jobId);
    if (!local) return res.status(404).json({ error: "Job not found" });

    const workerJob = await fetchWorkerJob(jobId);

    local.status = workerJob.status;
    local.progress = workerJob.progress;
    local.error = workerJob.error;
    local.result = workerJob.result;
    local.updatedAt = now();

    saveJob(local);

    res.json(local);
  } catch (err: any) {
    console.error("status error:", err);
    res.status(502).json({
      error: "Worker unavailable",
      detail: err?.message,
    });
  }
});

export default router;
