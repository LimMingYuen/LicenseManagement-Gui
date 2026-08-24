import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { describeError } from '../../shared/utils/http-error';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page narrow">
      <h1>Change password</h1>

      <form class="card form-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <p class="alert alert-error" role="alert">{{ message }}</p>
        }

        <label class="field">
          <span class="field-label">Current password</span>
          <input type="password" formControlName="currentPassword" autocomplete="current-password" />
        </label>

        <label class="field">
          <span class="field-label">New password</span>
          <input type="password" formControlName="newPassword" autocomplete="new-password" />
          @if (form.controls.newPassword.touched && form.controls.newPassword.invalid) {
            <span class="field-error">A password is required.</span>
          }
        </label>

        <label class="field">
          <span class="field-label">Confirm new password</span>
          <input type="password" formControlName="confirmPassword" autocomplete="new-password" />
          @if (form.controls.confirmPassword.touched && form.hasError('mismatch')) {
            <span class="field-error">Passwords do not match.</span>
          }
        </label>

        <footer class="modal-actions">
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Change password' }}
          </button>
        </footer>
      </form>
    </section>
  `,
})
export class ChangePassword {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', Validators.required],
      confirmPassword: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );

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

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirmation = group.get('confirmPassword')?.value;
  return next && confirmation && next !== confirmation ? { mismatch: true } : null;
}
