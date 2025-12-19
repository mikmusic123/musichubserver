// (SERVER) src/routes/split.routes.ts
import express from "express";
import multer from "multer";
import { loadJob, saveJob, now, type Job } from "../split/jobStore.js";

const router = express.Router();

type WorkerJob = {
  id: string;
  status: "queued" | "running" | "done" | "error" | string;
  progress?: number;
  error?: string;
  result?: any;
};

// ---------- upload ----------
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
});

// ---------- worker config ----------
const WORKER_URL_RAW = process.env.WORKER_URL;
const WORKER_SECRET = process.env.WORKER_SECRET;

if (!WORKER_URL_RAW || !WORKER_SECRET) {
  throw new Error("WORKER_URL or WORKER_SECRET not set");
}

const WORKER_URL = WORKER_URL_RAW.trim().replace(/\/+$/, "");

// ---------- helpers ----------
async function readBodySafe(res: Response) {
  const text = await res.text();
  try {
    return JSON.stringify(JSON.parse(text));
  } catch {
    return text;
  }
}

function mapWorkerStatus(status: string): Job["status"] {
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

async function createWorkerJob(file: Express.Multer.File): Promise<{ jobId: string }> {
  if (!file?.buffer) throw new Error("No file.buffer");

  const form = new FormData();

  // Node 18+ supports Blob. Buffer is accepted at runtime, TS can be fussy.
  const blob = new Blob([file.buffer as unknown as BlobPart], {
    type: file.mimetype || "application/octet-stream",
  });

  // field name MUST match worker: upload.single("file")
  form.append("file", blob, file.originalname || "upload.bin");

  const res = await fetch(`${WORKER_URL}/v1/split`, {
    method: "POST",
    headers: { "x-worker-secret": WORKER_SECRET! },
    body: form as any, // DO NOT set Content-Type; fetch sets boundary
  });

  if (!res.ok) {
    const body = await readBodySafe(res);
    throw new Error(`Worker create failed (${res.status}): ${body}`);
  }

  const data = (await res.json()) as { jobId?: string };
  if (!data.jobId) throw new Error("Worker response missing jobId");
  return { jobId: data.jobId };
}

async function fetchWorkerJob(jobId: string): Promise<WorkerJob> {
  const res = await fetch(`${WORKER_URL}/v1/status/${encodeURIComponent(jobId)}`, {
    headers: { "x-worker-secret": WORKER_SECRET! },
  });

  if (!res.ok) {
    const body = await readBodySafe(res);
    throw new Error(`Worker status failed (${res.status}): ${body}`);
  }

  return (await res.json()) as WorkerJob;
}

// ---------- routes ----------

// POST /splitter/split
router.post("/split", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

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

    return res.status(202).json({
      jobId,
      statusUrl: `/splitter/status/${jobId}`,
    });
  } catch (err: any) {
    console.error("split error:", err);
    return res.status(500).json({ error: err?.message || "Split failed" });
  }
});

// GET /splitter/status/:jobId
router.get("/status/:jobId", async (req, res) => {
  const jobId = req.params.jobId;

  try {
    const local = loadJob(jobId);
    if (!local) return res.status(404).json({ error: "Job not found" });

    const workerJob = await fetchWorkerJob(jobId);

    local.status = mapWorkerStatus(workerJob.status);
    if (typeof workerJob.progress === "number") local.progress = workerJob.progress + '';
    if (typeof workerJob.error === "string") local.error = workerJob.error;
    local.result = workerJob.result;
    local.updatedAt = now();

    saveJob(local);
    return res.json(local);
  } catch (err: any) {
    console.error("status error:", err);
    return res.status(502).json({
      error: "Worker unavailable",
      detail: err?.message,
    });
  }
});

export default router;
