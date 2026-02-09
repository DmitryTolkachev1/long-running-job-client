import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { UserService } from './user.service';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import { CreateJobRequest, CreateJobResponse } from '../models/create-job.model';
import { JobStatus } from '../models/job-status.model';
import { CancelJobResponse } from '../models/cancel-job.model';
import { SseEvent } from '../models/sse-event.model';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class JobService {
  private jobsApiUrl = environment.jobsApiUrl;

  constructor(
    private http: HttpClient,
    private userService: UserService,
    private authService: AuthService,
    private ngZone: NgZone
  ) {}

  createJob(input: string, jobType: number): Observable<CreateJobResponse> {
    const headers = new HttpHeaders({
      'Authorization': this.authService.getAuthorizationHeader(),
      'X-User-Id': this.userService.getUserId(),
      'Content-Type': 'application/json'
    });

    const data: Record<string, any> = {
      Input: input
    };

    const request: CreateJobRequest = {
      jobType: jobType,
      jobData: data,
    };

    return this.http.post<CreateJobResponse>(this.jobsApiUrl, request, { headers });
  }

  getJobStatus(jobId: string): Observable<JobStatus> {
    const headers = new HttpHeaders({
      'Authorization': this.authService.getAuthorizationHeader(),
      'X-User-Id': this.userService.getUserId(),
    });

    return this.http.get<JobStatus>(`${this.jobsApiUrl}/${jobId}/state`, { headers });
  }

  cancelJob(jobId: string): Observable<CancelJobResponse> {
    const headers = new HttpHeaders({
      'Authorization': this.authService.getAuthorizationHeader(),
      'X-User-Id': this.userService.getUserId(),
    });

    return this.http.post<CancelJobResponse>(`${this.jobsApiUrl}/${jobId}/cancel`, {}, { headers });
  }

  streamJobProgress(
    jobId: string, 
    options?: { reconnect?: boolean; maxReconnectAttempts?: number }
  ): Observable<SseEvent> {
    const subject = new Subject<SseEvent>();
    const shouldReconnect = options?.reconnect ?? true;
    const maxReconnectAttempts = options?.maxReconnectAttempts ?? 10;
    let reconnectAttempts = 0;
    let reconnectTimer: any = null;
    let isActive = true;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    const connect = async (): Promise<void> => {
      if (!isActive) {
        return;
      }

      try {
        const response = await fetch(`${this.jobsApiUrl}/${jobId}/connection`, {
          headers: {
            'Authorization': this.authService.getAuthorizationHeader(),
            'X-User-Id': this.userService.getUserId(),
            'Accept': 'text/event-stream'
          }
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        reconnectAttempts = 0;

        const bodyReader = response.body?.getReader();
        if (!bodyReader) {
          throw new Error('Response body is null');
        }
        
        reader = bodyReader;
        const decoder = new TextDecoder();
        let buffer = '';

        this.ngZone.run(() => {
          subject.next({ 
            type: 'connected', 
            jobId, 
            message: 'Connected to progress stream' 
          });
        });

        const readStream = async (): Promise<void> => {
          if (!isActive || !reader) {
            return;
          }

          try {
            const { done, value } = await reader.read();

            if (done) {
              if (shouldReconnect && isActive && reconnectAttempts < maxReconnectAttempts) {
                try {
                  const status = await firstValueFrom(this.getJobStatus(jobId));
                  const processableStatuses = ['Queued', 'Taken', 'Running', 'Retrying'];
                  
                  if (processableStatuses.includes(status.jobStatus)) {
                    await attemptReconnect();
                  } else {
                    this.ngZone.run(() => {
                      subject.complete();
                    });
                  }
                } catch (error) {
                  console.warn('Could not check job status when stream ended:', error);
                  await attemptReconnect();
                }
              } else {
                this.ngZone.run(() => {
                  subject.complete();
                });
              }
              return;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.substring(6));
                  this.ngZone.run(() => {
                    subject.next(data);
                  });
                } catch (error) {
                  console.error('Error parsing SSE event:', error);
                }
              } else if (line.includes('keep-alive')) {
              }
            }

            await readStream();
          } catch (error: any) {
            if (shouldReconnect && isActive && reconnectAttempts < maxReconnectAttempts) {
              await attemptReconnect();
            } else {
              this.ngZone.run(() => {
                subject.error(error);
              });
            }
          }
        };

        await readStream();
      } catch (error: any) {
        if (shouldReconnect && isActive && reconnectAttempts < maxReconnectAttempts) {
          await attemptReconnect();
        } else {
          this.ngZone.run(() => {
            subject.error(error);
          });
        }
      }
    };

    const attemptReconnect = async (): Promise<void> => {
      if (!isActive) {
        return;
      }

      reconnectAttempts++;
      
      this.ngZone.run(() => {
        subject.next({
          type: 'reconnecting',
          jobId,
          message: `Reconnecting... (attempt ${reconnectAttempts}/${maxReconnectAttempts})`
        });
      });

      const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);

      try {
        const status = await firstValueFrom(this.getJobStatus(jobId));
        const processableStatuses = ['Queued', 'Taken', 'Running', 'Retrying'];
        
        if (!processableStatuses.includes(status.jobStatus)) {
          this.ngZone.run(() => {
            subject.complete();
          });
          return;
        }
      } catch (error) {
        console.warn('Could not check job status before reconnect:', error);
      }

      reconnectTimer = setTimeout(() => {
        if (isActive) {
          connect();
        }
      }, delay);
    };

    connect();

    return new Observable(observer => {
      const subscription = subject.subscribe(observer);
      return () => {
        isActive = false;
        if (reconnectTimer) {
          clearTimeout(reconnectTimer);
        }
        if (reader) {
          reader.cancel().catch(() => {
          });
        }
        subscription.unsubscribe();
      };
    });
  }
}