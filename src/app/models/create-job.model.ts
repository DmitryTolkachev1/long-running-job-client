export interface CreateJobRequest {
    jobType: number;
    jobData?: Record<string, any>;
}

export interface CreateJobResponse {
    jobId: string;
}