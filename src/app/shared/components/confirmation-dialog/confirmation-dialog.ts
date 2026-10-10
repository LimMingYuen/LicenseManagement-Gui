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

/** Displays a confirmation or notice dialog that closes with `true` on confirm. */
@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './confirmation-dialog.html',
  styleUrl: './confirmation-dialog.scss',
})
export class ConfirmationDialogComponent {
  dialogRef = inject<MatDialogRef<ConfirmationDialogComponent>>(MatDialogRef);
  data = inject<ConfirmationDialogData>(MAT_DIALOG_DATA);

  /** Returns the CSS class that colours the dialog icon by severity. */
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
