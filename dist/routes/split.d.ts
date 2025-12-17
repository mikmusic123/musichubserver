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
    inputPath?: string;
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
/**
 * POST /splitter/split
 * multipart/form-data:
 *  - file: audio file
 *
 * Server returns 202:
 *  { jobId, statusUrl: "/splitter/status/<jobId>" }
 */
export declare function createSplitJob(file: File, options?: CreateSplitRequest, token?: string | null): Promise<CreateSplitResponse>;
/**
 * GET /splitter/status/:jobId
 */
export declare function fetchSplitJob(jobId: string, token?: string | null): Promise<SplitJob>;
/**
 * Convenience: poll until done/error
 */
export declare function waitForSplitJobDone(jobId: string, token?: string | null, { intervalMs, timeoutMs, }?: {
    intervalMs?: number;
    timeoutMs?: number;
}): Promise<SplitJob>;
export default fetchSplitJob;
//# sourceMappingURL=split.d.ts.map