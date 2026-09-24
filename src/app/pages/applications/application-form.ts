import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Application } from '../../models/application.models';
import { ApplicationService } from '../../services/application.service';
import { describeError } from '../../shared/utils/http-error';

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
  template: `
    <form class="dialog-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 mat-dialog-title>{{ title }}</h2>

      @if (error(); as message) {
        <p class="alert alert-error dialog-alert" role="alert">{{ message }}</p>
      }

      <mat-dialog-content>
        <div class="form-row">
          <mat-form-field>
            <mat-label>Application name</mat-label>
            <input matInput type="text" formControlName="name" maxlength="200" />
            <mat-error>An application name is required.</mat-error>
          </mat-form-field>

          <mat-form-field>
            <mat-label>Key</mat-label>
            <input
              matInput
              type="text"
              formControlName="key"
              maxlength="100"
              class="mono"
              autocapitalize="characters"
              spellcheck="false"
            />
            <mat-hint>
              @if (editing) {
                Fixed after creation — API filters and saved links quote it.
              } @else {
                Letters, digits, dot, underscore and hyphen only. Cannot be changed later.
              }
            </mat-hint>
            <mat-error>Letters, digits, dot, underscore or hyphen only.</mat-error>
          </mat-form-field>
        </div>

        <fieldset class="field">
          <legend class="field-label">Issues these license types</legend>

          <div class="checkbox-row">
            <mat-checkbox formControlName="supportsMachine">
              Machine — bound to a customer's machine ID
            </mat-checkbox>

            <mat-checkbox formControlName="supportsRobot">
              Robot — a robot tied to a specific machine
            </mat-checkbox>

            <mat-checkbox formControlName="supportsGateway">
              Gateway — an Android device fingerprint
            </mat-checkbox>
          </div>

          <span class="field-hint">
            Only the ticked types offer this application on their generate page. A type cannot
            be switched off while licenses of that type already exist under it.
          </span>
          @if (!anyTypeSelected()) {
            <span class="field-invalid">Select at least one license type.</span>
          }
        </fieldset>

        <div class="field">
          <mat-checkbox formControlName="isActive">Application is active</mat-checkbox>
          <span class="field-hint">
            Inactive applications keep their licenses and stay in the catalog, but nothing new
            can be issued under them.
          </span>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button type="button" matButton="outlined" mat-dialog-close>Cancel</button>
        <button type="submit" matButton="filled" [disabled]="saving()">
          {{ saving() ? 'Saving…' : 'Save' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .form-row {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      gap: var(--sp-4);

      mat-form-field {
        flex: 1 1 16rem;
        min-width: 0;
      }
    }

    .checkbox-row {
      display: flex;
      flex-wrap: wrap;
      column-gap: var(--sp-5);
      row-gap: var(--sp-1);
    }
  `,
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
    key: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]+$/), Validators.maxLength(100)]],
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
