import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AuthService } from '../../services/auth.service';
import { FormErrorStateMatcher } from '../../shared/utils/error-state';
import { describeError } from '../../shared/utils/http-error';

@Component({
  selector: 'app-change-password',
  imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page narrow">
      <h1>Change password</h1>

      <form class="card form-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        @if (error(); as message) {
          <p class="alert alert-error" role="alert">{{ message }}</p>
        }

        <mat-form-field>
          <mat-label>Current password</mat-label>
          <input
            matInput
            type="password"
            formControlName="currentPassword"
            autocomplete="current-password"
          />
        </mat-form-field>

        <mat-form-field>
          <mat-label>New password</mat-label>
          <input matInput type="password" formControlName="newPassword" autocomplete="new-password" />
          <mat-error>A password is required.</mat-error>
        </mat-form-field>

        <mat-form-field>
          <mat-label>Confirm new password</mat-label>
          <input
            matInput
            type="password"
            formControlName="confirmPassword"
            autocomplete="new-password"
            [errorStateMatcher]="confirmMatcher"
          />
          <mat-error>
            @if (form.hasError('mismatch')) {
              Passwords do not match.
            } @else {
              A password is required.
            }
          </mat-error>
        </mat-form-field>

        <footer class="form-actions">
          <button type="submit" matButton="filled" [disabled]="saving()">
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

  /**
   * The mismatch rule lives on the group, not on the confirm box, so Material would never
   * paint that field as failing on its own. This hands it the group's verdict.
   */
  protected readonly confirmMatcher = new FormErrorStateMatcher('mismatch');

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
