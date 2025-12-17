import path from "path";
import { spawn } from "child_process";
const jobs = new Map();
function now() {
    return new Date().toISOString();
}
export function getJob(id) {
    return jobs.get(id);
}
export function createJob(params) {
    const trackName = path.parse(params.inputPath).name;
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const job = {
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
const demucsCmd = process.platform === "win32"
    ? path.resolve(".venv", "Scripts", "demucs.exe")
    : "demucs";
export function runJobInBackground(jobId, outputDir) {
    const job = jobs.get(jobId);
    if (!job)
        return;
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
    const onLine = (line) => {
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
        }
        else {
            job.status = "error";
            job.error = `demucs exited ${code}`;
        }
        job.updatedAt = now();
    });
}
//# sourceMappingURL=splitter.jobs.js.map