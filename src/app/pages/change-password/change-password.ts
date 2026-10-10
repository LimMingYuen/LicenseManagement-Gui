import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../services/auth.service';
import { FormErrorStateMatcher } from '../../shared/utils/error-state';
import { describeError } from '../../shared/utils/http-error';

/** Page where the signed-in user changes their password. */
@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './change-password.html',
})
export class ChangePassword {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Shows the group-level mismatch error on the confirm field. */
  protected readonly confirmMatcher = new FormErrorStateMatcher('mismatch');

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', Validators.required],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

  /** Changes the password and returns to the dashboard. */
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const { currentPassword, newPassword } = this.form.getRawValue();

    try {
      await this.auth.changePassword(currentPassword, newPassword);
      await this.router.navigateByUrl('/dashboard');
    } catch (error) {
      this.error.set(describeError(error, 'Could not change your password.'));
    } finally {
      this.saving.set(false);
    }
  }
}

/** Reports a mismatch between the new password and its confirmation. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  return next && confirmation && next !== confirmation ? { mismatch: true } : null;
}
