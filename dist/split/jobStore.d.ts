export type JobStatus = "queued" | "running" | "done" | "error";
export type Job = {
    id: string;
    status: JobStatus;
    trackName: string;
    inputPath: string;
    createdAt: string;
    updatedAt: string;
    progress?: string;
    error?: string;
    result?: {
        vocalsUrl: string;
        instrumentalUrl: string;
    };
};
export declare const now: () => string;
export declare function saveJob(job: Job): void;
export declare function loadJob(id: string): Job | null;
//# sourceMappingURL=jobStore.d.ts.map