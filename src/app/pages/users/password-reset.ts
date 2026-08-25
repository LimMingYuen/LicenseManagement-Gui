import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { User } from '../../models/user.models';
import { UserService } from '../../services/user.service';
import { describeError } from '../../shared/utils/http-error';

export interface PasswordResetData {
  /** The account whose password is being set. */
  user: User;
}

/**
 * Super-admin-initiated password reset. Sets the account's real password — there is no
 * temporary password and the target is never forced to change it.
 */
@Component({
  selector: 'app-password-reset',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 mat-dialog-title>Reset password for {{ user.username }}</h2>

      @if (error(); as message) {
        <p class="alert alert-error dialog-alert" role="alert">{{ message }}</p>
      }

      <mat-dialog-content>
        <mat-form-field>
          <mat-label>New password</mat-label>
          <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
          <mat-hint>Communicate it out of band — it is not emailed.</mat-hint>
          <mat-error>A password is required.</mat-error>
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button type="button" matButton="outlined" mat-dialog-close>Cancel</button>
        <button type="submit" matButton="outlined" class="danger" [disabled]="saving()">
          {{ saving() ? 'Resetting…' : 'Reset password' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class PasswordReset {
  private readonly users = inject(UserService);
  private readonly dialogRef = inject<MatDialogRef<PasswordReset, boolean>>(MatDialogRef);

  protected readonly user = inject<PasswordResetData>(MAT_DIALOG_DATA).user;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    newPassword: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      await this.users.resetPassword(this.user.id, this.form.getRawValue().newPassword);
      this.dialogRef.close(true);
    } catch (error) {
      this.error.set(describeError(error, 'Could not reset the password.'));
    } finally {
      this.saving.set(false);
    }
  }
}
