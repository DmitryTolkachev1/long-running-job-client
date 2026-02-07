export interface SseEvent {
    type: 'connected' | 'progress' | 'status' | 'reconnecting' | 'disconnected';
    jobId?: string;
    payload?: any;
    status?: string;
    message?: string;
}