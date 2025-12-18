// (SERVER) src/services/workerClient.ts
const WORKER_URL = process.env.WORKER_URL;
const WORKER_SECRET = process.env.WORKER_SECRET;
export async function sendToWorker(file, filename) {
    const form = new FormData();
    // ✅ Buffer -> Uint8Array -> Blob (TS + runtime happy)
    const bytes = new Uint8Array(file);
    const blob = new Blob([bytes], { type: "application/octet-stream" });
    form.append("file", blob, filename);
    const res = await fetch(`${WORKER_URL}/v1/split`, {
        method: "POST",
        headers: { "x-worker-secret": WORKER_SECRET },
        body: form,
    });
    if (!res.ok)
        throw new Error(await res.text());
    return res.json();
}
export async function getWorkerStatus(jobId) {
    const res = await fetch(`${WORKER_URL}/v1/status/${jobId}`, {
        headers: { "x-worker-secret": WORKER_SECRET },
    });
    if (!res.ok)
        throw new Error(await res.text());
    return res.json();
}
//# sourceMappingURL=workerClient.js.map