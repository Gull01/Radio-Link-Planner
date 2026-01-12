import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="notification-container">
      @for (notification of notificationService.notifications(); track notification.id) {
        <div 
          class="notification notification-{{notification.type}}"
          (click)="notificationService.remove(notification.id)">
          <div class="notification-icon">
            @switch (notification.type) {
              @case ('success') { <span class="icon">✓</span> }
              @case ('error') { <span class="icon">✕</span> }
              @case ('warning') { <span class="icon">⚠</span> }
              @case ('info') { <span class="icon">ℹ</span> }
            }
          </div>
          <div class="notification-message">{{ notification.message }}</div>
        </div>
      }
    </div>
  `,
  styles: [`
    .notification-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 12px;
      pointer-events: none;
    }

    .notification {
      min-width: 320px;
      max-width: 500px;
      padding: 20px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      gap: 16px;
      animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
      pointer-events: auto;
      cursor: pointer;
      backdrop-filter: blur(10px);
    }

    .notification-success {
      background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
      color: white;
    }

    .notification-error {
      background: linear-gradient(135deg, #f44336 0%, #d32f2f 100%);
      color: white;
    }

    .notification-warning {
      background: linear-gradient(135deg, #ff9800 0%, #f57c00 100%);
      color: white;
    }

    .notification-info {
      background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
      color: white;
    }

    .notification-icon {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .notification-icon .icon {
      font-size: 28px;
      font-weight: bold;
      line-height: 1;
    }

    .notification-message {
      font-size: 16px;
      font-weight: 500;
      line-height: 1.4;
    }

    @keyframes slideIn {
      from {
        transform: scale(0.8);
        opacity: 0;
      }
      to {
        transform: scale(1);
        opacity: 1;
      }
    }

    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
  `]
})
export class NotificationComponent {
  notificationService = inject(NotificationService);
}
