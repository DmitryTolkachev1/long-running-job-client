import { Component, OnInit, OnDestroy, NgZone, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { JobService } from '../../services/job.service';
import { SseEvent } from '../../models/sse-event.model';
import { Subscription, firstValueFrom } from 'rxjs';
import { JobType } from '../../models/job-type.model';

@Component({
  selector: 'app-job-processor',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './job-processor.component.html',
  styleUrl: './job-processor.component.css'
})
export class JobProcessorComponent implements OnInit, OnDestroy {
  inputText: string = '';
  isProcessing: boolean = false;
  currentJobId: string | null = null;
  progressText: string = '';
  jobStatus: string = '';
  error: string | null = null;
  result: string | null = null;
  isReconnecting: boolean = false;
  connectionStatus: string = '';
  stateRestored: boolean = false;

  private sseSubscription?: Subscription;
  private statusCheckInterval?: any;
  private readonly STORAGE_KEY = 'JobProcessorState';

  constructor(private jobService: JobService, private ngZone: NgZone, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.restoreState();
  }

  ngOnDestroy(): void {
    this.cleanup();
  }

  async processText(): Promise<void> {
    if (!this.inputText.trim()) {
      this.error = 'Please enter some text to process';
      return;
    }

    this.resetState();
    this.isProcessing = true;
    this.error = null;

    try {
      const response = await firstValueFrom(this.jobService.createJob(this.inputText, JobType.ENCODE));
      if (!response) {
        throw new Error('Failed to create job');
      }

      this.currentJobId = response.jobId;
      this.jobStatus = 'Created';
      this.connectionStatus = 'Connecting...';

      this.saveState();

      this.connectToProgressStream(response.jobId);

      this.startStatusPolling(response.jobId);
    } catch (error: any) {
      this.error = error.message || 'Failed to create job';
      this.isProcessing = false;
    }
  }

  cancelJob(): void {
    if (!this.currentJobId) {
      return;
    }

    this.jobService.cancelJob(this.currentJobId).subscribe({
      next: () => {
        this.jobStatus = 'Cancelling';
        this.saveState();
      },
      error: (error) => {
        console.error('Failed to cancel job:', error);
        this.error = 'Failed to cancel job';
      }
    });
  }

  private connectToProgressStream(jobId: string): void {
    // Enable reconnection with up to 10 attempts
    this.sseSubscription = this.jobService.streamJobProgress(jobId, {
      reconnect: true,
      maxReconnectAttempts: 10
    }).subscribe({
      next: (event: SseEvent) => {
        // Run inside Angular zone to trigger change detection
        this.ngZone.run(() => {
          if (event.type === 'connected') {
            console.log('SSE connection established');
            this.isReconnecting = false;
            this.connectionStatus = 'Connected';
            this.recoverProgressOnReconnect(jobId);
          } else if (event.type === 'reconnecting') {
            console.log('SSE reconnecting:', event.message);
            this.isReconnecting = true;
            this.connectionStatus = event.message || 'Reconnecting...';
          } else if (event.type === 'disconnected') {
            console.log('SSE disconnected');
            this.isReconnecting = true;
            this.connectionStatus = 'Disconnected';
          } else if (event.type === 'progress' && event.payload) {
            this.progressText += event.payload;
            this.saveState();
            this.cdr.detectChanges();
          } else if (event.type === 'status' && event.status) {
            this.jobStatus = event.status;
            this.saveState();
            this.cdr.detectChanges();
          }
        });
      },
      error: (error) => {
        this.ngZone.run(() => {
          console.error('SSE stream error:', error);
          this.isReconnecting = true;
          this.connectionStatus = 'Connection error';
        });
      },
      complete: () => {
        this.ngZone.run(() => {
          console.log('SSE stream closed');
          this.isReconnecting = false;
          this.connectionStatus = '';
        });
      }
    });
  }

  private async recoverProgressOnReconnect(jobId: string): Promise<void> {
    try {
      const status = await firstValueFrom(this.jobService.getJobStatus(jobId));
      
      if (status) {
        this.jobStatus = status.jobStatus;
        
        if (['Completed', 'Failed', 'Cancelled'].includes(status.jobStatus)) {
          this.isProcessing = false;
          this.clearState();
          this.cleanup();
        } else {
          this.saveState();
        }
        
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Error recovering progress on reconnect:', error);
    }
  }

  private startStatusPolling(jobId: string): void {
    this.statusCheckInterval = setInterval(async () => {
      try {
        this.ngZone.run(async () => {
          const status = await firstValueFrom(this.jobService.getJobStatus(jobId));
          if (status) {
          this.jobStatus = status.jobStatus;
          this.cdr.detectChanges();
          if (['Completed', 'Failed', 'Cancelled'].includes(status.jobStatus)) {
            this.isProcessing = false;
            this.clearState();
            this.cdr.detectChanges();
            this.cleanup();
          } else {
            this.saveState();
          }
        }});
      } catch (error) {
        console.error('Error checking job status:', error);
      }
    }, 10000);
  }

  private resetState(): void {
    this.progressText = '';
    this.result = null;
    this.error = null;
    this.jobStatus = '';
    this.currentJobId = null;
    this.isReconnecting = false;
    this.connectionStatus = '';
    this.stateRestored = false;
    this.clearState();
    this.cleanup();
  }

  private saveState(): void {
    try{
      const state = {
        currentJobId: this.currentJobId,
        progressText: this.progressText,
        jobStatus: this.jobStatus,
        inputText: this.inputText,
        isProcessing: this.isProcessing,
        timestamp: Date.now()
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save state', error);
    }
  }

  private async restoreState(): Promise<void> {
    try{
      const savedStateStr = localStorage.getItem(this.STORAGE_KEY);
      if (!savedStateStr) {
        return;
      }

      const savedState = JSON.parse(savedStateStr);

      const maxAge = 24 * 60 * 60 * 1000;
      if (savedState.timestamp && Date.now() - savedState.timestamp > maxAge) {
        this.clearState();
        return;
      }

      this.currentJobId = savedState.currentJobId || null;
      this.progressText = savedState.progressText || '';
      this.jobStatus = savedState.jobStatus || '';
      this.inputText = savedState.inputText || '';
      this.result = savedState.result || null;
      this.error = savedState.error || null;
      this.isProcessing = savedState.isProcessing || false;

      if (this.currentJobId && this.isProcessing) {
        this.stateRestored = true;
        await this.restoreJobConnection(this.currentJobId);
        setTimeout(() => {
          this.stateRestored = false;
          this.cdr.detectChanges();
        }, 3000);
      } else if (this.currentJobId) {
        this.stateRestored = true;
        await this.checkJobFinalStatus(this.currentJobId);
        setTimeout(() => {
          this.stateRestored = false;
          this.cdr.detectChanges();
        }, 3000);
      }

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Failed to restore state', error);
      this.clearState();
    }
  }

  private async restoreJobConnection(jobId: string): Promise<void> {
    try {
      const status = await firstValueFrom(this.jobService.getJobStatus(jobId));

      if(!status) {
        this.resetState();
        return;
      }

      this.jobStatus = status.jobStatus;

      if (['Completed', 'Failed', 'Cancelled'].includes(status.jobStatus)) {
        this.isProcessing = false;
        this.clearState();
        this.cdr.detectChanges();
        return;
      }

      this.connectionStatus = 'Reconnecting...';
      this.isReconnecting = true;
      this.connectToProgressStream(jobId);

      this.startStatusPolling(jobId);

      this.cdr.detectChanges();
    } catch (error) {
      console.error('Failed to restore job connection', error);
      this.restoreState();
    }
  }

  private async checkJobFinalStatus(jobId: string): Promise<void> {
    try {
      const status = await firstValueFrom(this.jobService.getJobStatus(jobId));
      if (status) {
        this.jobStatus = status.jobStatus;
        
        this.clearState();
        this.cdr.detectChanges();
      }
    } catch (error) {
      console.error('Failed to check job final status:', error);
      this.clearState();
    }
  }

  private clearState(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.warn('Failed to clear state', error);
    }
  }

  private cleanup(): void {
    if (this.sseSubscription) {
      this.sseSubscription.unsubscribe();
      this.sseSubscription = undefined;
    }

    if (this.statusCheckInterval) {
      clearInterval(this.statusCheckInterval);
      this.statusCheckInterval = undefined;
    }
  }
}