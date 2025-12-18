import fs from "fs";
import path from "path";
import { spawn } from "child_process";

export type JobStatus = "queued" | "running" | "done" | "error";

export type SplitJob = {
  id: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  inputPath: string;
  trackName: string;
  error?: string;
  progress?: string;
  result?: {
    vocalsUrl: string;
    instrumentalUrl: string;
  };
};

function now() {
  return new Date().toISOString();
}

// ✅ Render-safe writable folder (Linux)
const JOBS_DIR = process.env.JOBS_DIR || "/tmp/musichub_jobs";
fs.mkdirSync(JOBS_DIR, { recursive: true });

function jobFile(id: string) {
  return path.join(JOBS_DIR, `${id}.json`);
}

function saveJob(job: SplitJob) {
  fs.writeFileSync(jobFile(job.id), JSON.stringify(job, null, 2), "utf-8");
}

export function getJob(id: string): SplitJob | null {
  const p = jobFile(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8")) as SplitJob;
  } catch {
    return null;
  }
}

export function createJob(params: { inputPath: string }) {
  const trackName = path.parse(params.inputPath).name;
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const job: SplitJob = {
    id,
    status: "queued",
    createdAt: now(),
    updatedAt: now(),
    inputPath: params.inputPath,
    trackName,
  };

  saveJob(job);
  return job;
}

const demucsCmd =
  process.platform === "win32"
    ? path.resolve(".venv", "Scripts", "demucs.exe")
    : "demucs";

export function runJobInBackground(jobId: string, outputDir: string) {
  const job = getJob(jobId);
  if (!job) return;

  job.status = "running";
  job.updatedAt = now();
  job.progress = "Starting demucs…";
  saveJob(job);

  // ✅ mdx_extra is much safer on Render memory than htdemucs
  const MODEL = "mdx_extra";

  const args = [
    "-n", MODEL,
    "--two-stems=vocals",
    "--shifts", "0",
    "--segment", "5",
    "-o", outputDir,
    job.inputPath,
  ];

  const p = spawn(demucsCmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  const onLine = (buf: Buffer) => {
    const txt = buf.toString();
    job.progress = txt.slice(-250); // last 250 chars (more useful)
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
