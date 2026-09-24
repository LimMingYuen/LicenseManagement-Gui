import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UserService } from '../../services/user.service';
import { User } from '../../models/user.models';
import { Role } from '../../models/role.models';
import { describeError } from '../../shared/utils/http-error';
import { formatIsoDateTime } from '../../shared/utils/date-format';

export interface UserFormData {
  /** Null to create a new account, otherwise the one to edit. */
  user: User | null;
  /** Roles offered in the role picker. */
  roles: Role[];
  /** Shows the account without allowing changes. */
  readonly?: boolean;
}

/** Dialog that creates or edits a user account. */
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
        @if (readonly) {
          <mat-form-field>
            <mat-label>Username</mat-label>
            <input matInput type="text" formControlName="username" class="mono" />
          </mat-form-field>
        }

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
            <input
              matInput
              type="password"
              formControlName="password"
              autocomplete="new-password"
            />
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
            @for (role of roles; track role.id) {
              <mat-option [value]="role.name">
                {{ role.name }}{{ role.description ? ' — ' + role.description : '' }}
              </mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-checkbox formControlName="isActive">Account is active</mat-checkbox>

        @if (readonly && user) {
          <dl class="meta">
            <dt>Created</dt>
            <dd>{{ formatDate(user.createdAt) }}</dd>
            <dt>Last sign-in</dt>
            <dd>{{ user.lastLoginAt ? formatDate(user.lastLoginAt) : 'Never' }}</dd>
          </dl>
        }
      </mat-dialog-content>

      <mat-dialog-actions>
        @if (readonly) {
          <button type="button" matButton="filled" mat-dialog-close>Close</button>
        } @else {
          <button type="button" matButton="outlined" mat-dialog-close>Cancel</button>
          <button type="submit" matButton="filled" [disabled]="saving()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        }
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .meta {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: var(--sp-1) var(--sp-4);
      margin: var(--sp-2) 0 0;
      font-size: var(--fs-md);

      dt {
        color: var(--brand-text-muted);
      }

      dd {
        margin: 0;
        font-variant-numeric: tabular-nums;
      }
    }
  `,
})
export class UserForm {
  private readonly users = inject(UserService);
  private readonly dialogRef = inject<MatDialogRef<UserForm, User>>(MatDialogRef);

  private readonly data = inject<UserFormData>(MAT_DIALOG_DATA);

  /** Null when creating a new account. */
  protected readonly user = this.data.user;

  protected readonly readonly = this.data.readonly ?? false;
  protected readonly formatDate = formatIsoDateTime;

  protected readonly roles = this.data.roles;

  protected readonly editing = this.user !== null;
  protected readonly title = this.readonly
    ? this.user?.username
    : this.editing
      ? `Edit ${this.user?.username}`
      : 'New user';

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    username: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]+$/)]],
    password: ['', Validators.required],
    fullName: [''],
    role: ['Operator', Validators.required],
    isActive: [true],
  });

  constructor() {
    const existing = this.user;

    if (!existing) {
      return;
    }

    this.form.controls.username.disable();
    this.form.controls.password.disable();
    this.form.patchValue({
      username: existing.username,
      fullName: existing.fullName,
      role: existing.role,
      isActive: existing.isActive,
    });

    if (this.readonly) {
      this.form.disable();
    }
  }

  /** Validates the form and creates or updates the account. */
  protected async submit(): Promise<void> {
    if (this.readonly || this.form.invalid || this.saving()) {
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
