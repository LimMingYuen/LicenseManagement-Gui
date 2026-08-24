import { Component, inject } from '@angular/core';

import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

export interface ConfirmationDialogData {
  title: string;
  message: string;
  icon?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
  confirmColor?: 'primary' | 'accent' | 'warn';
}

@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [
    MatDialogModule,
    MatButtonModule,
    MatIconModule
],
  template: `
    <div class="confirmation-dialog">
      <div class="dialog-icon">
        <mat-icon [class]="getIconClass()">{{ data.icon || 'check_circle' }}</mat-icon>
      </div>
      <h2 mat-dialog-title>{{ data.title }}</h2>
      <mat-dialog-content>
        <p>{{ data.message }}</p>
      </mat-dialog-content>
      <mat-dialog-actions align="center">
        @if (data.showCancel) {
          <button mat-stroked-button [mat-dialog-close]="false">
            {{ data.cancelText || 'Cancel' }}
          </button>
        }
        <button mat-flat-button class="confirm-btn" [mat-dialog-close]="true" cdkFocusInitial>
          {{ data.confirmText || 'OK' }}
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .confirmation-dialog {
      text-align: center;
      padding: 16px;
    }

    .dialog-icon {
      margin-bottom: 16px;

      .success-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #4caf50;
      }

      .warning-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #ff9800;
      }

      .error-icon {
        font-size: 64px;
        width: 64px;
        height: 64px;
        color: #f44336;
      }
    }

    h2[mat-dialog-title] {
      margin: 0 0 16px 0;
      font-size: 20px;
      font-weight: 500;
    }

    mat-dialog-content {
      margin-bottom: 24px;

      p {
        margin: 0;
        color: #666;
        font-size: 14px;
        line-height: 1.5;
      }
    }

    mat-dialog-actions {
      padding: 0;
      margin: 0;
      min-height: auto;

      button {
        min-width: 120px;
        box-shadow: none !important;
      }

      .confirm-btn {
        background-color: var(--mat-sys-primary);
        color: #fff;
      }
    }
  `]
})
export class ConfirmationDialogComponent {
  dialogRef = inject<MatDialogRef<ConfirmationDialogComponent>>(MatDialogRef);
  data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);


  getIconClass(): string {
    const icon = this.data.icon || 'check_circle';
    if (icon === 'warning' || icon === 'warning_amber') {
      return 'warning-icon';
    } else if (icon === 'error' || icon === 'error_outline' || icon === 'delete') {
      return 'error-icon';
    }
    return 'success-icon';
  }
}
