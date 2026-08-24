import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { User } from '../../models/user.models';
import { UserService } from '../../services/user.service';
import { describeError } from '../../shared/utils/http-error';

/**
 * Super-admin-initiated password reset. Sets the account's real password — there is no
 * temporary password and the target is never forced to change it.
 */
@Component({
  selector: 'app-password-reset',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="cancelled.emit()"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Reset password">
      <form class="card modal-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <h2 class="modal-title">Reset password for {{ user().username }}</h2>

        @if (error(); as message) {
          <p class="alert alert-error" role="alert">{{ message }}</p>
        }

        <div class="modal-body">
          <label class="field">
            <span class="field-label">New password</span>
            <input type="password" formControlName="newPassword" autocomplete="new-password" />
            <span class="field-hint">
              Communicate it out of band — it is not emailed.
            </span>
            @if (form.controls.newPassword.touched && form.controls.newPassword.invalid) {
              <span class="field-error">A password is required.</span>
            }
          </label>
        </div>

        <footer class="modal-actions">
          <button type="button" class="btn" (click)="cancelled.emit()">Cancel</button>
          <button type="submit" class="btn btn-danger" [disabled]="saving()">
            {{ saving() ? 'Resetting…' : 'Reset password' }}
          </button>
        </footer>
      </form>
    </div>
  `,
})
export class PasswordReset {
  private readonly users = inject(UserService);

  readonly user = input.required<User>();
  readonly reset = output<void>();
  readonly cancelled = output<void>();

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
      await this.users.resetPassword(this.user().id, this.form.getRawValue().newPassword);
      this.reset.emit();
    } catch (error) {
      this.error.set(describeError(error, 'Could not reset the password.'));
    } finally {
      this.saving.set(false);
    }
  }
}
