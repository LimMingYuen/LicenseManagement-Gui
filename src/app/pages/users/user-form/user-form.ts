import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { UserService } from '../../../services/user.service';
import { User } from '../../../models/user.models';
import { Role } from '../../../models/role.models';
import { describeError } from '../../../shared/utils/http-error';
import { formatIsoDateTime } from '../../../shared/utils/date-format';

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
  templateUrl: './user-form.html',
  styleUrl: './user-form.scss',
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
