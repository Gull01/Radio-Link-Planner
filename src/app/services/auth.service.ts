import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { Router } from '@angular/router';

export interface User {
  id: number;
  username: string;
  email: string;
  created_at?: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user?: User;
  token?: string;
  requires_verification?: boolean;
  user_id?: number;
  email?: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private readonly API_URL = 'http://localhost:5000/api/auth';

  currentUser = signal<User | null>(null);
  isAuthenticated = signal<boolean>(false);
  isLoading = signal<boolean>(false);

  constructor() {
    this.checkAuth();
  }

  /**
   * Check if user is authenticated on app load
   */
  private checkAuth(): void {
    const token = this.getToken();
    const userStr = localStorage.getItem('user');
    
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this.currentUser.set(user);
        this.isAuthenticated.set(true);
      } catch (error) {
        console.error('Error parsing stored user:', error);
        this.logout();
      }
    }
  }

  /**
   * Register a new user
   */
  register(data: RegisterData): Observable<AuthResponse> {
    this.isLoading.set(true);
    
    return this.http.post<AuthResponse>(`${this.API_URL}/register`, data).pipe(
      tap((response: AuthResponse) => {
        this.isLoading.set(false);
        if (response.success && response.user && response.token) {
          this.setAuthData(response.user, response.token);
        }
      }),
      catchError((error) => {
        this.isLoading.set(false);
        return of({
          success: false,
          message: error.error?.message || 'Registration failed'
        });
      })
    );
  }

  /**
   * Login user
   */
  login(credentials: LoginCredentials): Observable<AuthResponse> {
    this.isLoading.set(true);
    
    return this.http.post<AuthResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap((response: AuthResponse) => {
        this.isLoading.set(false);
        if (response.success && response.user && response.token) {
          this.setAuthData(response.user, response.token);
        }
      }),
      catchError((error) => {
        this.isLoading.set(false);
        return of({
          success: false,
          message: error.error?.message || 'Login failed'
        });
      })
    );
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    this.currentUser.set(null);
    this.isAuthenticated.set(false);
  }

  /**
   * Set authentication data
   */
  private setAuthData(user: User, token: string): void {
    localStorage.setItem('auth_token', token);
    localStorage.setItem('user', JSON.stringify(user));
    this.currentUser.set(user);
    this.isAuthenticated.set(true);
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  /**
   * Check if email is valid
   */
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate password strength
   */
  validatePassword(password: string): { valid: boolean; message: string } {
    if (password.length < 6) {
      return { valid: false, message: 'Password must be at least 6 characters' };
    }
    if (!/[A-Z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
      return { valid: false, message: 'Password must contain at least one number' };
    }
    return { valid: true, message: 'Password is strong' };
  }

  /**
   * Verify email with OTP code
   */
  verifyCode(userId: number, code: string): Observable<AuthResponse> {
    this.isLoading.set(true);
    
    return this.http.post<AuthResponse>(`${this.API_URL}/verify-code`, {
      user_id: userId,
      code: code
    }).pipe(
      tap((response: AuthResponse) => {
        this.isLoading.set(false);
        if (response.success && response.user && response.token) {
          this.setAuthData(response.user, response.token);
        }
      }),
      catchError((error) => {
        this.isLoading.set(false);
        return of({
          success: false,
          message: error.error?.message || 'Verification failed'
        });
      })
    );
  }

  /**
   * Resend verification code
   */
  resendCode(userId: number): Observable<AuthResponse> {
    this.isLoading.set(true);
    
    return this.http.post<AuthResponse>(`${this.API_URL}/resend-code`, {
      user_id: userId
    }).pipe(
      tap(() => {
        this.isLoading.set(false);
      }),
      catchError((error) => {
        this.isLoading.set(false);
        return of({
          success: false,
          message: error.error?.message || 'Failed to resend code'
        });
      })
    );
  }
}
