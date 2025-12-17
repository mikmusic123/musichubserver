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
        // keep extension so demucs/ffmpeg can decode reliably
        const ext = path.extname(file.originalname) || ".bin";
        const safeBase = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        cb(null, safeBase + ext);
    },
});
const upload = multer({ storage });
router.post("/split", upload.single("file"), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: "No file uploaded" });
        }
        const inputPath = req.file.path;
        // folder demucs uses = basename of input file (no extension)
        const trackName = path.parse(inputPath).name;
        const stemDir = path.join(OUTPUT_DIR, "htdemucs", trackName);
        // const demucsExe = path.resolve(".venv", "Scripts", "demucs.exe");
        const demucsExe = ".venv\\Scripts\\demucs.exe";
        const args = [
            "-n", "htdemucs",
            "--two-stems=vocals",
            "-o", OUTPUT_DIR,
            inputPath,
        ];
        await new Promise((resolve, reject) => {
            const p = spawn(demucsExe, args, {
                stdio: "inherit",
                env: {
                    ...process.env,
                    TORCHAUDIO_USE_SOUNDFILE_LEGACY: "1",
                },
            });
            p.on("error", reject);
            p.on("close", (code) => code === 0 ? resolve() : reject(new Error(`demucs exited ${code}`)));
        });
        res.json({
            status: "done",
            result: {
                vocalsUrl: `/files/htdemucs/${trackName}/vocals.wav`,
                instrumentalUrl: `/files/htdemucs/${trackName}/no_vocals.wav`,
            },
        });
    }
    catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message ?? "Split failed" });
    }
});
export default router;
//# sourceMappingURL=split.js.map