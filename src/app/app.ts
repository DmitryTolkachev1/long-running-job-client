import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { JobProcessorComponent } from './components/job-processor-component/job-processor.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, JobProcessorComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('LongRunningJobClient');
}
