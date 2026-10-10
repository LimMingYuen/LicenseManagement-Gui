import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Application } from '../../../models/application.models';
import { ApplicationService } from '../../../services/application.service';
import { describeError } from '../../../shared/utils/http-error';

export interface ApplicationFormData {
  /** Null to create a new application, otherwise the one to edit. */
  application: Application | null;
}

/** Dialog that creates or edits an application. */
@Component({
  selector: 'app-application-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatCheckboxModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './application-form.html',
  styleUrl: './application-form.scss',
})
export class ApplicationForm {
  private readonly applications = inject(ApplicationService);
  private readonly dialogRef = inject<MatDialogRef<ApplicationForm, Application>>(MatDialogRef);

  /** Null when creating a new application. */
  private readonly application = inject<ApplicationFormData>(MAT_DIALOG_DATA).application;

  protected readonly editing = this.application !== null;
  protected readonly title = this.editing ? `Edit ${this.application?.name}` : 'New application';

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    key: [
      '',
      [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]+$/), Validators.maxLength(100)],
    ],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    supportsMachine: [false],
    supportsRobot: [false],
    supportsGateway: [false],
    isActive: [true],
  });

  constructor() {
    const existing = this.application;

    if (!existing) {
      return;
    }

    this.form.controls.key.disable();
    this.form.patchValue({
      key: existing.key,
      name: existing.name,
      supportsMachine: existing.supportsMachine,
      supportsRobot: existing.supportsRobot,
      supportsGateway: existing.supportsGateway,
      isActive: existing.isActive,
    });
  }

  /** Whether at least one license type is ticked. */
  protected anyTypeSelected(): boolean {
    const v = this.form.getRawValue();
    return v.supportsMachine || v.supportsRobot || v.supportsGateway;
  }

  /** Validates the form and creates or updates the application. */
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    if (!this.anyTypeSelected()) {
      this.form.markAllAsTouched();
      this.error.set('Select at least one license type this application can issue.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    const shared = {
      name: value.name.trim(),
      supportsMachine: value.supportsMachine,
      supportsRobot: value.supportsRobot,
      supportsGateway: value.supportsGateway,
      isActive: value.isActive,
    };

    try {
      const existing = this.application;
      const result = existing
        ? await this.applications.update(existing.id, shared)
        : await this.applications.create({ ...shared, key: value.key.trim() });

      this.dialogRef.close(result);
    } catch (error) {
      this.error.set(describeError(error, 'Could not save this application.'));
    } finally {
      this.saving.set(false);
    }
  }
}
