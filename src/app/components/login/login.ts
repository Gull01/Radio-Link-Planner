import { Component, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, RegisterData, LoginCredentials } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.css'
})
export class LoginComponent {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  onLoginSuccess = output<void>();

  isLoginMode = signal<boolean>(true);
  isLoading = signal<boolean>(false);
  
  // Form fields
  password = signal<string>('');
  confirmPassword = signal<string>('');
  username = signal<string>('');
  
  // Validation messages
  passwordError = signal<string>('');
  usernameError = signal<string>('');

  toggleMode(): void {
    this.isLoginMode.set(!this.isLoginMode());
    this.clearErrors();
  }



  validatePassword(): boolean {
    const passwordValue = this.password();
    if (!passwordValue) {
      this.passwordError.set('Password is required');
      return false;
    }
    
    if (!this.isLoginMode()) {
      const validation = this.authService.validatePassword(passwordValue);
      if (!validation.valid) {
        this.passwordError.set(validation.message);
        return false;
      }
      
      if (passwordValue !== this.confirmPassword()) {
        this.passwordError.set('Passwords do not match');
        return false;
      }
    }
    
    this.passwordError.set('');
    return true;
  }

  validateUsername(): boolean {
    const usernameValue = this.username().trim();
    if (!usernameValue) {
      this.usernameError.set('Username is required');
      return false;
    }
    if (!this.isLoginMode() && usernameValue.length < 3) {
      this.usernameError.set('Username must be at least 3 characters');
      return false;
    }
    this.usernameError.set('');
    return true;
  }

  clearErrors(): void {
    this.passwordError.set('');
    this.usernameError.set('');
  }

  async onSubmit(): Promise<void> {
    this.clearErrors();
    
    const isPasswordValid = this.validatePassword();
    const isUsernameValid = this.validateUsername();
    
    if (!isUsernameValid || !isPasswordValid) {
      return;
    }

    this.isLoading.set(true);

    if (this.isLoginMode()) {
      // Login
      const credentials: LoginCredentials = {
        email: this.username().trim(), // Using username as email field
        password: this.password()
      };

      this.authService.login(credentials).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          
          if (response.success) {
            this.notificationService.success(`Welcome back, ${response.user?.username}!`);
            this.onLoginSuccess.emit();
          } else {
            this.notificationService.error(response.message);
          }
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
    } else {
      // Register
      const registerData: RegisterData = {
        username: this.username().trim(),
        email: this.username().trim() + '@localuser.com', // Auto-generate email from username
        password: this.password()
      };

      this.authService.register(registerData).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          
          if (response.success) {
            // Instant registration - no email verification needed
            this.notificationService.success(`Welcome, ${response.user?.username}! Your account has been created.`);
            this.onLoginSuccess.emit();
          } else {
            this.notificationService.error(response.message);
          }
        },
        error: () => {
          this.isLoading.set(false);
        }
      });
    }
  }
}
