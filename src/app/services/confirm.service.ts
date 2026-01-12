import { Injectable, signal } from '@angular/core';

export interface ConfirmDialogData {
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel?: () => void;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  showDialog = signal<boolean>(false);
  dialogData = signal<ConfirmDialogData | null>(null);

  confirm(
    message: string,
    confirmText: string = 'OK',
    cancelText: string = 'Cancel'
  ): Promise<boolean> {
    return new Promise((resolve) => {
      this.dialogData.set({
        message,
        confirmText,
        cancelText,
        onConfirm: () => {
          this.showDialog.set(false);
          resolve(true);
        },
        onCancel: () => {
          this.showDialog.set(false);
          resolve(false);
        }
      });
      this.showDialog.set(true);
    });
  }

  hide(): void {
    this.showDialog.set(false);
    this.dialogData.set(null);
  }
}
