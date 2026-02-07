import { Injectable, NgZone } from '@angular/core';
import { environment } from '../../environments/environment';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { UserService } from './user.service';
import { Observable, Subject } from 'rxjs';
import { CreateJobRequest, CreateJobResponse } from '../models/create-job.model';
import { JobStatus } from '../models/job-status.model';
import { CancelJobResponse } from '../models/cancel-job.model';
import { SseEvent } from '../models/sse-event.model';

@Injectable({
  providedIn: 'root',
})
export class JobService {
  private jobsApiUrl = environment.jobsApiUrl;

  constructor(
    private http: HttpClient,
    private userService: UserService
  ) {}

  createJob(input: string, jobType: number): Observable<CreateJobResponse> {
    const headers = new HttpHeaders({
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
      'X-User-Id': this.userService.getUserId(),
    });

    return this.http.get<JobStatus>(`${this.jobsApiUrl}/${jobId}/state`, { headers });
  }

  cancelJob(jobId: string): Observable<CancelJobResponse> {
    const headers = new HttpHeaders({
      'X-User-Id': this.userService.getUserId(),
    });

    return this.http.post<CancelJobResponse>(`${this.jobsApiUrl}/${jobId}/cancel`, {}, { headers });
  }

  streamJobProgress(jobId: string): Observable<SseEvent> {
    const subject = new Subject<SseEvent>();

    fetch(`${this.jobsApiUrl}/${jobId}/connection`, {
      headers: {
        'X-User-Id': this.userService.getUserId(),
        'Accept': 'text/event-stream'
      }
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        subject.error(new Error('Response body is null'));
        return;
      }

      const readStream = () => {
        reader.read().then(({ done, value }) => {
          if (done) {
            subject.complete();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.substring(6));
                subject.next(data);
              } catch (error) {
                console.error('Error parsing SSE event:', error);
              }
            } else if (line.includes('keep-alive')) {
                console.info('Connection keep-alive message received');
            }
          }

          readStream();
        }).catch(error => {
          subject.error(error);
        });
      };

      readStream();
    }).catch(error => {
      subject.error(error);
    });

    return new Observable(observer => {
      const subscription = subject.subscribe(observer);
      return () => {
        subscription.unsubscribe();
      };
    });
  }
}
