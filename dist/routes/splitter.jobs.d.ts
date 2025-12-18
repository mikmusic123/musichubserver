export type JobStatus = "queued" | "running" | "done" | "error";
export type SplitJob = {
    id: string;
    status: JobStatus;
    createdAt: string;
    updatedAt: string;
    inputPath: string;
    trackName: string;
    error?: string;
    progress?: string;
    result?: {
        vocalsUrl: string;
        instrumentalUrl: string;
    };
};
export declare function getJob(id: string): SplitJob | null;
export declare function createJob(params: {
    inputPath: string;
}): SplitJob;
export declare function runJobInBackground(jobId: string, outputDir: string): void;
//# sourceMappingURL=splitter.jobs.d.ts.map