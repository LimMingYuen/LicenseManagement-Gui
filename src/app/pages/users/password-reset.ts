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
  /** Account whose password is reset. */
  user: User;
}

/** Dialog in which a SuperAdmin sets a new password for an account. */
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
  templateUrl: './password-reset.html',
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

  /** Sets the new password and closes the dialog. */
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
