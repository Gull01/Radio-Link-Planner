import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-verify-email',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-email.html',
  styleUrls: ['./verify-email.css']
})
export class VerifyEmailComponent {
  private authService = inject(AuthService);
  private notificationService = inject(NotificationService);
  private router = inject(Router);

  verificationCode = signal('');
  isLoading = signal(false);
  userId = signal<number | null>(null);
  userEmail = signal<string>('');
  resendCooldown = signal(0);
  private cooldownInterval: any;

  constructor() {
    // Get user data from navigation state
    const navigation = this.router.getCurrentNavigation();
    const state = navigation?.extras?.state;
    
    if (state && state['userId']) {
      this.userId.set(state['userId']);
      this.userEmail.set(state['email'] || '');
    } else {
      // Try to get from session storage as fallback
      const storedUserId = sessionStorage.getItem('pending_verification_user_id');
      const storedEmail = sessionStorage.getItem('pending_verification_email');
      
      if (storedUserId) {
        this.userId.set(parseInt(storedUserId));
        this.userEmail.set(storedEmail || '');
      } else {
        // No user data, redirect to login
        this.router.navigate(['/login']);
      }
    }
  }

  verifyCode() {
    const code = this.verificationCode().trim();
    
    if (!code) {
      this.notificationService.show('Please enter the verification code', 'error');
      return;
    }

    if (code.length !== 6) {
      this.notificationService.show('Verification code must be 6 digits', 'error');
      return;
    }

    const userId = this.userId();
    if (!userId) {
      this.notificationService.show('Invalid session. Please try again.', 'error');
      this.router.navigate(['/login']);
      return;
    }

    this.isLoading.set(true);

    this.authService.verifyCode(userId, code).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        
        if (response.success) {
          this.notificationService.show('Email verified successfully!', 'success');
          
          // Clear session storage
          sessionStorage.removeItem('pending_verification_user_id');
          sessionStorage.removeItem('pending_verification_email');
          
          // Redirect to home
          setTimeout(() => {
            this.router.navigate(['/']);
          }, 1000);
        } else {
          this.notificationService.show(response.message, 'error');
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        this.notificationService.show('Verification failed. Please try again.', 'error');
      }
    });
  }

  resendCode() {
    if (this.resendCooldown() > 0) {
      return;
    }

    const userId = this.userId();
    if (!userId) {
      this.notificationService.show('Invalid session. Please try again.', 'error');
      this.router.navigate(['/login']);
      return;
    }

    this.isLoading.set(true);

    this.authService.resendCode(userId).subscribe({
      next: (response) => {
        this.isLoading.set(false);
        
        if (response.success) {
          this.notificationService.show('Verification code resent successfully!', 'success');
          this.startCooldown();
        } else {
          this.notificationService.show(response.message, 'error');
        }
      },
      error: (error) => {
        this.isLoading.set(false);
        this.notificationService.show('Failed to resend code. Please try again.', 'error');
      }
    });
  }

  private startCooldown() {
    this.resendCooldown.set(60);
    
    this.cooldownInterval = setInterval(() => {
      const currentCooldown = this.resendCooldown();
      if (currentCooldown > 0) {
        this.resendCooldown.set(currentCooldown - 1);
      } else {
        clearInterval(this.cooldownInterval);
      }
    }, 1000);
  }

  backToLogin() {
    // Clear session storage
    sessionStorage.removeItem('pending_verification_user_id');
    sessionStorage.removeItem('pending_verification_email');
    
    this.router.navigate(['/login']);
  }

  ngOnDestroy() {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }

  // Format code input - only allow digits
  onCodeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 6);
    this.verificationCode.set(value);
  }
}
