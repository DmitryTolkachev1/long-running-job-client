import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private readonly username: string = environment.username;
  private readonly password: string = environment.password;

  getBasicAuthHeader(): string {
    const credentials = `${this.username}:${this.password}`;
    return btoa(credentials);
  }

  getAuthorizationHeader(): string {
    return `Basic ${this.getBasicAuthHeader()}`;
  }
}
