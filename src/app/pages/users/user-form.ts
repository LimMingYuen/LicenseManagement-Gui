import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UserService } from '../../services/user.service';
import { User, UserRole } from '../../models/user.models';
import { describeError } from '../../shared/utils/http-error';

export interface UserFormData {
  /** null = create a new account, otherwise edit this one. */
  user: User | null;
}

/**
 * Create/edit dialog. The same form serves both; on edit the username and password
 * fields drop out — username is the identity key and passwords go through reset.
 *
 * The password typed here is the account's real password: nothing marks it temporary
 * and the user is never forced to change it. Hand it over out of band.
 */
@Component({
  selector: 'app-user-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 mat-dialog-title>{{ title }}</h2>

      @if (error(); as message) {
        <p class="alert alert-error dialog-alert" role="alert">{{ message }}</p>
      }

      <mat-dialog-content>
        @if (!editing) {
          <mat-form-field>
            <mat-label>Username</mat-label>
            <input
              matInput
              type="text"
              formControlName="username"
              autocapitalize="none"
              spellcheck="false"
            />
            <mat-error>Letters, digits, dot, underscore or hyphen only.</mat-error>
          </mat-form-field>

          <mat-form-field>
            <mat-label>Password</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
            <mat-hint>Communicate it out of band — it is not emailed.</mat-hint>
            <mat-error>A password is required.</mat-error>
          </mat-form-field>
        }

        <mat-form-field>
          <mat-label>Full name</mat-label>
          <input matInput type="text" formControlName="fullName" />
        </mat-form-field>

        <mat-form-field>
          <mat-label>Role</mat-label>
          <mat-select formControlName="role">
            <mat-option value="Operator">Operator — generate and view licenses</mat-option>
            <mat-option value="SuperAdmin">Super Admin — full access, including users</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-checkbox formControlName="isActive">Account is active</mat-checkbox>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button type="button" matButton="outlined" mat-dialog-close>Cancel</button>
        <button type="submit" matButton="filled" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class UserForm {
  private readonly users = inject(UserService);
  private readonly dialogRef = inject<MatDialogRef<UserForm, User>>(MatDialogRef);

  /** null = create a new account, otherwise the one being edited. */
  private readonly user = inject<UserFormData>(MAT_DIALOG_DATA).user;

  protected readonly editing = this.user !== null;
  protected readonly title = this.editing ? `Edit ${this.user?.username}` : 'New user';

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
    const existing = this.user;

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
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();

    try {
      const existing = this.user;
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

      this.dialogRef.close(result);
    } catch (error) {
      this.error.set(describeError(error, 'Could not save this user.'));
    } finally {
      this.saving.set(false);
    }
  }
}
