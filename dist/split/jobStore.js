// (SERVER) src/split/jobStore.ts
import fs from "fs";
import path from "path";
export const now = () => new Date().toISOString();
// ✅ Render-safe writable dir
const JOBS_DIR = process.env.JOBS_DIR || "/tmp/musichub_jobs";
fs.mkdirSync(JOBS_DIR, { recursive: true });
function jobPath(id) {
    return path.join(JOBS_DIR, `${id}.json`);
}
export function saveJob(job) {
    fs.writeFileSync(jobPath(job.id), JSON.stringify(job, null, 2), "utf-8");
}
export function loadJob(id) {
    const p = jobPath(id);
    if (!fs.existsSync(p))
        return null;
    try {
        return JSON.parse(fs.readFileSync(p, "utf-8"));
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=jobStore.js.map