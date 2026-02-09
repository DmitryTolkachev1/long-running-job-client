export interface JobStatus {
    jobId: string;
    jobStatus: string;
    createdAt: string;
    startedAt?: string;
    completedAt?: string;
}