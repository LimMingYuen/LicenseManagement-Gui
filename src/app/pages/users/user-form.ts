import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { User, UserRole } from '../../models/user.models';
import { describeError } from '../../shared/utils/http-error';

/**
 * Create/edit dialog. The same form serves both; on edit the username and password
 * fields drop out — username is the identity key and passwords go through reset.
 *
 * The password typed here is the account's real password: nothing marks it temporary
 * and the user is never forced to change it. Hand it over out of band.
 */
@Component({
  selector: 'app-user-form',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="cancelled.emit()"></div>
    <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="title()">
      <form class="card modal-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <h2 class="modal-title">{{ title() }}</h2>

        @if (error(); as message) {
          <p class="alert alert-error" role="alert">{{ message }}</p>
        }

        <div class="modal-body">
          @if (!editing()) {
            <label class="field">
              <span class="field-label">Username</span>
              <input type="text" formControlName="username" autocapitalize="none" spellcheck="false" />
              @if (form.controls.username.touched && form.controls.username.invalid) {
                <span class="field-error">Letters, digits, dot, underscore or hyphen only.</span>
              }
            </label>

            <label class="field">
              <span class="field-label">Password</span>
              <input type="password" formControlName="password" autocomplete="new-password" />
              <span class="field-hint">
                Communicate it out of band — it is not emailed.
              </span>
              @if (form.controls.password.touched && form.controls.password.invalid) {
                <span class="field-error">A password is required.</span>
              }
            </label>
          }

          <label class="field">
            <span class="field-label">Full name</span>
            <input type="text" formControlName="fullName" />
          </label>

          <label class="field">
            <span class="field-label">Role</span>
            <select formControlName="role">
              <option value="Operator">Operator — generate and view licenses</option>
              <option value="SuperAdmin">Super Admin — full access, including users</option>
            </select>
          </label>

          <label class="field-inline">
            <input type="checkbox" formControlName="isActive" />
            <span>Account is active</span>
          </label>
        </div>

        <footer class="modal-actions">
          <button type="button" class="btn" (click)="cancelled.emit()">Cancel</button>
          <button type="submit" class="btn btn-primary" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        </footer>
      </form>
    </div>
  `,
})
export class UserForm {
  private readonly users = inject(UserService);

  /** null = create a new account, otherwise edit this one. */
  readonly user = input<User | null>(null);

  readonly saved = output<User>();
  readonly cancelled = output<void>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    password: ['', Validators.required],
    fullName: [''],
    role: ['Operator' as UserRole, Validators.required],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      const existing = this.user();
      if (!existing) {
        return;
      }

      // Editing: identity and credential fields are out of scope for this form.
      this.form.controls.username.disable();
      this.form.controls.password.disable();
      this.form.patchValue({
        fullName: existing.fullName,
        role: existing.role,
        isActive: existing.isActive,
      });
    });
  }

  protected editing = () => this.user() !== null;
  protected title = () => (this.editing() ? `Edit ${this.user()?.username}` : 'New user');

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();

    try {
      const existing = this.user();
      const result = existing
        ? await this.users.update(existing.id, {
            fullName: value.fullName.trim(),
            role: value.role,
            isActive: value.isActive,
          })
        : await this.users.create({
            username: value.username.trim(),
            password: value.password,
            fullName: value.fullName.trim(),
            role: value.role,
            isActive: value.isActive,
          });

      this.saved.emit(result);
    } catch (error) {
      this.error.set(describeError(error, 'Could not save this user.'));
    } finally {
      this.saving.set(false);
    }
  }
}
