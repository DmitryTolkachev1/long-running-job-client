export interface SseEvent {
    type: 'connected' | 'progress' | 'status';
    jobId?: string;
    payload: any;
    status?: string;
    message?: string;
}