// src/routes/split.ts
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { spawn } from "child_process";
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
const demucsCmd = process.platform === "win32"
    ? path.resolve(".venv", "Scripts", "demucs.exe")
    : "demucs";
const JOBS_PATH = path.resolve("jobs.json");
function loadJobs() {
    try {
        if (!fs.existsSync(JOBS_PATH))
            return {};
        return JSON.parse(fs.readFileSync(JOBS_PATH, "utf-8") || "{}");
    }
    catch {
        return {};
    }
}
function saveJobs(all) {
    fs.writeFileSync(JOBS_PATH, JSON.stringify(all, null, 2), "utf-8");
}
function getJob(id) {
    const all = loadJobs();
    return all[id];
}
function setJob(job) {
    const all = loadJobs();
    all[job.id] = job;
    saveJobs(all);
}
const MODEL = "mdx_extra"; // ✅ change to "htdemucs" if you have RAM
const now = () => new Date().toISOString();
function runJob(job) {
    job.status = "running";
    job.updatedAt = now();
    job.progress = "Starting demucs…";
    setJob(job);
    const args = [
        "-n", MODEL,
        "--two-stems=vocals",
        "--shifts", "0",
        "--segment", "5",
        "-o", OUTPUT_DIR,
        job.inputPath,
    ];
    const p = spawn(demucsCmd, args, {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, TORCHAUDIO_USE_SOUNDFILE_LEGACY: "1" },
    });
    const onLine = (d) => {
        job.progress = d.toString().slice(0, 400);
        job.updatedAt = now();
        setJob(job);
    };
    p.stdout.on("data", onLine);
    p.stderr.on("data", onLine);
    p.on("error", (err) => {
        job.status = "error";
        job.error = err.message;
        job.updatedAt = now();
        setJob(job);
    });
    p.on("close", (code) => {
        if (code === 0) {
            const relBase = path.posix.join(MODEL, job.trackName);
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
        setJob(job);
    });
}
// POST /splitter/split
router.post("/split", upload.single("file"), (req, res) => {
    if (!req.file)
        return res.status(400).json({ error: "No file uploaded" });
    const jobId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const trackName = path.parse(req.file.path).name;
    const job = {
        id: jobId,
        status: "queued",
        trackName,
        inputPath: req.file.path,
        createdAt: now(),
        updatedAt: now(),
    };
    setJob(job);
    runJob(job);
    res.status(202).json({
        jobId,
        statusUrl: `/splitter/status/${jobId}`,
    });
});
// GET /splitter/status/:jobId
router.get("/status/:jobId", (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job)
        return res.status(404).json({ error: "Job not found" });
    res.json(job);
    setJob(job);
});
export default router;
//# sourceMappingURL=split.routes.js.map