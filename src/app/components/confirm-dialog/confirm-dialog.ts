import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (confirmService.showDialog()) {
      <div class="confirm-overlay" (click)="onCancel()">
        <div class="confirm-dialog" (click)="$event.stopPropagation()">
          <div class="confirm-header">
            <h3>Confirm Action</h3>
          </div>
          <div class="confirm-body">
            <p>{{ confirmService.dialogData()?.message }}</p>
          </div>
          <div class="confirm-footer">
            <button class="btn-cancel" (click)="onCancel()">
              {{ confirmService.dialogData()?.cancelText || 'Cancel' }}
            </button>
            <button class="btn-confirm" (click)="onConfirm()">
              {{ confirmService.dialogData()?.confirmText || 'OK' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .confirm-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      animation: fadeIn 0.2s ease;
    }

    .confirm-dialog {
      background: linear-gradient(145deg, #ffffff 0%, #f5f5f5 100%);
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      min-width: 420px;
      max-width: 500px;
      animation: slideUp 0.3s ease;
      overflow: hidden;
    }

    .confirm-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 20px 24px;
    }

    .confirm-header h3 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
    }

    .confirm-body {
      padding: 32px 24px;
      color: #333;
    }

    .confirm-body p {
      margin: 0;
      font-size: 16px;
      line-height: 1.6;
    }

    .confirm-footer {
      padding: 16px 24px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
      background: #f8f9fa;
      border-top: 1px solid #e0e0e0;
    }

    .btn-cancel,
    .btn-confirm {
      padding: 10px 24px;
      border: none;
      border-radius: 8px;
      font-size: 15px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .btn-cancel {
      background: #e0e0e0;
      color: #555;
    }

    .btn-cancel:hover {
      background: #d0d0d0;
      transform: translateY(-1px);
    }

    .btn-confirm {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }

    .btn-confirm:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideUp {
      from {
        transform: translateY(30px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
  `]
})
export class ConfirmDialogComponent {
  confirmService = inject(ConfirmService);

  onConfirm(): void {
    const data = this.confirmService.dialogData();
    if (data?.onConfirm) {
      data.onConfirm();
    }
  }

  onCancel(): void {
    const data = this.confirmService.dialogData();
    if (data?.onCancel) {
      data.onCancel();
    }
  }
}
