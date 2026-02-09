import { v4 as uuidv4 } from 'uuid';
import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class UserService {
  private readonly STORAGE_KEY = 'long-running-job-user-id';

  getUserId(): string {
    let userId = localStorage.getItem(this.STORAGE_KEY);

    if(!userId){
      userId = this.generateRandomUserId();
      localStorage.setItem(this.STORAGE_KEY, userId);
    }

    return userId;
  }

  private generateRandomUserId(): string {
    const id = uuidv4();

    return `user-${id}`;
  }
}
