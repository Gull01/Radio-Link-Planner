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
  email = signal<string>('');
  password = signal<string>('');
  confirmPassword = signal<string>('');
  username = signal<string>('');
  
  // Validation messages
  emailError = signal<string>('');
  passwordError = signal<string>('');
  usernameError = signal<string>('');

  toggleMode(): void {
    this.isLoginMode.set(!this.isLoginMode());
    this.clearErrors();
  }

  validateEmail(): boolean {
    const emailValue = this.email().trim();
    if (!emailValue) {
      this.emailError.set('Email is required');
      return false;
    }
    if (!this.authService.isValidEmail(emailValue)) {
      this.emailError.set('Please enter a valid email address (any provider accepted)');
      return false;
    }
    this.emailError.set('');
    return true;
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
    if (this.isLoginMode()) return true;
    
    const usernameValue = this.username().trim();
    if (!usernameValue) {
      this.usernameError.set('Username is required');
      return false;
    }
    if (usernameValue.length < 3) {
      this.usernameError.set('Username must be at least 3 characters');
      return false;
    }
    this.usernameError.set('');
    return true;
  }

  clearErrors(): void {
    this.emailError.set('');
    this.passwordError.set('');
    this.usernameError.set('');
  }

  async onSubmit(): Promise<void> {
    this.clearErrors();
    
    const isEmailValid = this.validateEmail();
    const isPasswordValid = this.validatePassword();
    const isUsernameValid = this.validateUsername();
    
    if (!isEmailValid || !isPasswordValid || !isUsernameValid) {
      return;
    }

    this.isLoading.set(true);

    if (this.isLoginMode()) {
      // Login
      const credentials: LoginCredentials = {
        email: this.email().trim(),
        password: this.password()
      };

      this.authService.login(credentials).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          
          if (response.success) {
            this.notificationService.success(`Welcome back, ${response.user?.username}!`);
            this.onLoginSuccess.emit();
          } else if (response.requires_verification && response.user_id) {
            // Redirect to verification page
            this.notificationService.show(response.message, 'info');
            sessionStorage.setItem('pending_verification_user_id', response.user_id.toString());
            sessionStorage.setItem('pending_verification_email', this.email().trim());
            this.router.navigate(['/verify-email'], {
              state: { 
                userId: response.user_id,
                email: this.email().trim()
              }
            });
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
        email: this.email().trim(),
        password: this.password()
      };

      this.authService.register(registerData).subscribe({
        next: (response) => {
          this.isLoading.set(false);
          
          if (response.success && response.requires_verification && response.user_id) {
            // Redirect to verification page
            this.notificationService.success('Registration successful! Please check your email for verification code.');
            sessionStorage.setItem('pending_verification_user_id', response.user_id.toString());
            sessionStorage.setItem('pending_verification_email', response.email || this.email().trim());
            this.router.navigate(['/verify-email'], {
              state: { 
                userId: response.user_id,
                email: response.email || this.email().trim()
              }
            });
          } else if (response.success) {
            // Old flow fallback (shouldn't happen now)
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
