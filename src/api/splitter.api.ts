// src/api/splitterapi.ts

export type SplitModel = "htdemucs" | "mdx_extra" | string;

export type SplitResult = {
  vocalsUrl: string;
  instrumentalUrl: string;
};

export type SplitJobStatus = "queued" | "running" | "done" | "error";

export type SplitJob = {
  id: string;
  status: SplitJobStatus;
  trackName: string;
  createdAt: string;
  updatedAt: string;
  progress?: string;
  error?: string;
  result?: SplitResult;
};

export type CreateSplitRequest = {
  model?: SplitModel;
  twoStems?: "vocals";
  outputFormat?: "wav" | "mp3";
};

export type CreateSplitResponse = {
  jobId: string;
  statusUrl: string;
};

const API_BASE = "https://musichubserver.onrender.com";
// const API_BASE = "http://localhost:4000";

function authHeaders(token?: string | null) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function handleJson<T>(res: Response): Promise<T> {
  const raw = await res.text();
  const json = raw ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : null;

  if (!res.ok) {
    const message =
      (json && ((json as any).error || (json as any).message)) ||
      raw ||
      `Request failed with ${res.status}`;
    throw new Error(message);
  }

  if (json === null) throw new Error("Expected JSON response but got empty/non-JSON body.");
  return json as T;
}

export async function createSplitJob(
  file: File,
  options: CreateSplitRequest = {},
  token?: string | null
): Promise<CreateSplitResponse> {
  const form = new FormData();
  form.append("file", file);
  if (options.model) form.append("model", options.model);
  if (options.twoStems) form.append("twoStems", options.twoStems);
  if (options.outputFormat) form.append("outputFormat", options.outputFormat);

  const res = await fetch(`${API_BASE}/splitter/split`, {
    method: "POST",
    headers: { ...authHeaders(token) },
    body: form,
  });

  return handleJson<CreateSplitResponse>(res);
}

// IMPORTANT: no Content-Type header here (avoid preflight/CORS headaches)
export async function fetchSplitJob(
  jobId: string,
  token?: string | null
): Promise<SplitJob> {
  const res = await fetch(`${API_BASE}/splitter/status/${jobId}`, {
    headers: { ...authHeaders(token) },
  });

  return handleJson<SplitJob>(res);
}

export async function waitForSplitJobDone(
  jobId: string,
  token?: string | null,
  { intervalMs = 1500, timeoutMs = 10 * 60 * 1000 }: { intervalMs?: number; timeoutMs?: number } = {}
): Promise<SplitJob> {
  const start = Date.now();
  while (true) {
    const job = await fetchSplitJob(jobId, token);
    if (job.status === "done" || job.status === "error") return job;
    if (Date.now() - start > timeoutMs) throw new Error("Split timed out");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
