// (SERVER) src/routes/splitterWorker.routes.ts
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// ✅ Where your public downloads are served from:
// app.use("/files", express.static(path.resolve("outputs")));
const OUTPUT_ROOT = path.resolve("outputs");

// ✅ Optional shared secret so randoms can't upload stems
const WORKER_SECRET = process.env.WORKER_SECRET || ""; // set same value on worker + server

// Use memory storage (smallest moving parts). If you expect huge wavs, switch to diskStorage.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 250 * 1024 * 1024, // 250MB per file (adjust)
  },
});

function safeName(s: string) {
  return (s || "unknown")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 80);
}

/**
 * Worker calls this after demucs is done.
 * multipart/form-data:
 *  - jobId: string
 *  - trackName: string (optional)
 *  - vocals: file (vocals.wav)
 *  - instrumental: file (no_vocals.wav)
 *
 * Returns:
 *  { ok: true, result: { vocalsUrl, instrumentalUrl } }
 */
router.post(
  "/complete",
  upload.fields([
    { name: "vocals", maxCount: 1 },
    { name: "instrumental", maxCount: 1 },
  ]),
  (req, res) => {
    try {
      // ✅ auth
      if (WORKER_SECRET) {
        const got = String(req.header("x-worker-secret") || "");
        if (got !== WORKER_SECRET) {
          return res.status(401).json({ error: "Unauthorized worker" });
        }
      }

      const jobId = String(req.body?.jobId || "").trim();
      const trackName = safeName(String(req.body?.trackName || "track").trim());

      if (!jobId) return res.status(400).json({ error: "Missing jobId" });

      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const vocals = files?.vocals?.[0];
      const instrumental = files?.instrumental?.[0];

      if (!vocals || !instrumental) {
        return res.status(400).json({ error: "Missing vocals/instrumental files" });
      }

      // ✅ basic sanity check to avoid writing tiny/empty outputs
      if (vocals.size < 1024 || instrumental.size < 1024) {
        return res.status(400).json({ error: "Uploaded files look empty" });
      }

      // ✅ store under outputs/jobs/<jobId>/...
      const jobDir = path.join(OUTPUT_ROOT, "jobs", safeName(jobId));
      fs.mkdirSync(jobDir, { recursive: true });

      const vocalsPath = path.join(jobDir, `${trackName}-vocals.wav`);
      const instPath = path.join(jobDir, `${trackName}-instrumental.wav`);

      fs.writeFileSync(vocalsPath, vocals.buffer);
      fs.writeFileSync(instPath, instrumental.buffer);

      // ✅ URLs that your client can download via /files static:
      const vocalsUrl = `/files/jobs/${encodeURIComponent(safeName(jobId))}/${encodeURIComponent(
        path.basename(vocalsPath)
      )}`;
      const instrumentalUrl = `/files/jobs/${encodeURIComponent(safeName(jobId))}/${encodeURIComponent(
        path.basename(instPath)
      )}`;

      return res.json({
        ok: true,
        result: { vocalsUrl, instrumentalUrl },
      });
    } catch (err: any) {
      console.error("worker complete error:", err);
      return res.status(500).json({ error: err?.message || "Failed to store worker outputs" });
    }
  }
);

export default router;
