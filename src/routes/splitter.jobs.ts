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

const jobs = new Map<string, SplitJob>();

function now() {
  return new Date().toISOString();
}

export function getJob(id: string) {
  return jobs.get(id);
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

  jobs.set(id, job);
  return job;
}

const demucsCmd =
  process.platform === "win32"
    ? path.resolve(".venv", "Scripts", "demucs.exe")
    : "demucs";

export function runJobInBackground(jobId: string, outputDir: string) {
  const job = jobs.get(jobId);
  if (!job) return;

  job.status = "running";
  job.updatedAt = now();
  job.progress = "Starting demucs…";

  const args = [
    // ⚠️ htdemucs is heavy; keep it if you have RAM, otherwise use mdx_extra.
    "-n",
    "htdemucs",
    "--two-stems=vocals",
    "--shifts",
    "0",
    "--segment",
    "5",
    "-o",
    outputDir,
    job.inputPath,
  ];

  const p = spawn(demucsCmd, args, {
    stdio: ["ignore", "pipe", "pipe"],
    env: { ...process.env },
  });

  const onLine = (line: string) => {
    job.progress = line.slice(0, 400);
    job.updatedAt = now();
  };

  p.stdout.on("data", (d) => onLine(String(d)));
  p.stderr.on("data", (d) => onLine(String(d)));

  p.on("error", (err) => {
    job.status = "error";
    job.error = err.message;
    job.updatedAt = now();
  });

  p.on("close", (code) => {
    if (code === 0) {
      const relBase = path.posix.join("htdemucs", job.trackName);
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
  });
}
