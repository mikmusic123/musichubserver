// (SERVER) src/routes/split.routes.ts
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
import { loadJob, saveJob, now, type Job } from "../split/jobStore.js";

const router = express.Router();

const UPLOAD_DIR = path.resolve("uploads");
const OUTPUT_DIR = path.resolve("outputs");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    const safeBase = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    cb(null, safeBase + ext);
  },
});
const upload = multer({ storage });

const demucsCmd =
  process.platform === "win32"
    ? path.resolve(".venv", "Scripts", "demucs.exe")
    : "demucs";

const MODEL = "mdx_extra";

function runJob(job: Job) {
  job.status = "running";
  job.updatedAt = now();
  job.progress = "Starting demucs…";
  saveJob(job);

  const args = [
    "-n", MODEL,
    "--two-stems=vocals",
    "--shifts", "0",
    "--segment", "2",
    "--overlap", "0.1",
    "-o", OUTPUT_DIR,
    job.inputPath,
  ];

  const p = spawn(demucsCmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env, OMP_NUM_THREADS: "1", MKL_NUM_THREADS: "1", TORCH_NUM_THREADS: "1" },
  });

  const onLine = (d: Buffer) => {
    const txt = d.toString();
    job.progress = txt.slice(Math.max(0, txt.length - 200));
    job.updatedAt = now();
    saveJob(job);
  };

  p.stdout.on("data", onLine);
  p.stderr.on("data", onLine);

  p.on("error", (err) => {
    job.status = "error";
    job.error = err.message;
    job.updatedAt = now();
    saveJob(job);
  });

  p.on("close", (code) => {
    if (code === 0) {
      const relBase = path.posix.join(MODEL, job.trackName);
      job.status = "done";
      job.result = {
        vocalsUrl: `/files/${relBase}/vocals.wav`,
        instrumentalUrl: `/files/${relBase}/no_vocals.wav`,
      };
    } else {
      job.status = "error";
      job.error = `demucs exited ${code}`;
    }
    job.updatedAt = now();
    saveJob(job);
  });
}

// POST /splitter/split
router.post("/split", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const trackName = path.parse(req.file.path).name;

  const job: Job = {
    id: jobId,
    status: "queued",
    trackName,
    inputPath: req.file.path,
    createdAt: now(),
    updatedAt: now(),
  };

  saveJob(job);   // ✅ persist immediately
  runJob(job);    // ✅ background

  res.status(202).json({ jobId, statusUrl: `/splitter/status/${jobId}` });
});

// GET /splitter/status/:jobId
router.get("/status/:jobId", (req, res) => {
  const job = loadJob(req.params.jobId);
  if (!job) return res.status(404).json({ error: "Job not found" });
  return res.json(job);
});

export default router;
