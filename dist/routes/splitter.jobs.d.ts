export type JobStatus = "queued" | "running" | "done" | "error";
export type SplitJob = {
    id: string;
    status: string;
    trackName: string;
    inputPath: string;
    createdAt: string;
    updatedAt: string;
    progress?: string;
    error?: string;
    result?: any;
};
export declare function getJob(id: string): SplitJob | null;
export declare function createJob(params: {
    inputPath: string;
}): SplitJob;
export declare function runJobInBackground(jobId: string, outputDir: string): void;
//# sourceMappingURL=splitter.jobs.d.ts.map