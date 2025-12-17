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

// Cross-platform demucs command
const demucsCmd =
  process.platform === "win32"
    ? path.resolve(".venv", "Scripts", "demucs.exe")
    : "demucs"; // Render/Linux: uses venv PATH

function runDemucs(args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(demucsCmd, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        TORCHAUDIO_USE_SOUNDFILE_LEGACY: "1",
      },
    });

    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`demucs exited ${code}`))
    );
  });
}

router.post("/split", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const inputPath = req.file.path;
    const trackName = path.parse(inputPath).name;

    const args = [
      "-n",
      "htdemucs",
      "--two-stems=vocals",
      "-o",
      OUTPUT_DIR,
      inputPath,
    ];

    await runDemucs(args);

    // Demucs output structure:
    // outputs/htdemucs/<trackName>/vocals.wav and no_vocals.wav
    const relBase = path.posix.join("htdemucs", trackName);

    return res.json({
      status: "done",
      result: {
        vocalsUrl: `/files/${relBase}/vocals.wav`,
        instrumentalUrl: `/files/${relBase}/no_vocals.wav`,
      },
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err?.message ?? "Split failed" });
  }
});

export default router;
