import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Customer } from '../../models/customer.models';
import { CustomerService } from '../../services/customer.service';
import { describeError } from '../../shared/utils/http-error';

export interface CustomerFormData {
  /** null = create a new customer, otherwise edit this one. */
  customer: Customer | null;

  /** Prefills the name when opened from a generate form the operator has half-typed. */
  initialName?: string;
}

/** Create/edit dialog for a customer. */
@Component({
  selector: 'app-customer-form',
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
        <mat-form-field>
          <mat-label>Customer name</mat-label>
          <input matInput type="text" formControlName="name" maxlength="200" />
          <mat-hint>Written into every license signed for this customer. Must be unique.</mat-hint>
          <mat-error>A customer name is required.</mat-error>
        </mat-form-field>

        <div class="field">
          <mat-checkbox formControlName="isActive">Customer is active</mat-checkbox>
          <span class="field-hint">
            Inactive customers keep their licenses and stay in the catalog, but drop out of the
            generate forms so nothing new can be issued against them.
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
})
export class CustomerForm {
  private readonly customers = inject(CustomerService);
  private readonly dialogRef = inject<MatDialogRef<CustomerForm, Customer>>(MatDialogRef);
  private readonly data = inject<CustomerFormData>(MAT_DIALOG_DATA);

  /** null = create a new customer, otherwise the one being edited. */
  private readonly customer = this.data.customer;

  protected readonly editing = this.customer !== null;
  protected readonly title = this.editing ? `Edit ${this.customer?.name}` : 'New customer';

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    isActive: [true],
  });

  constructor() {
    const existing = this.customer;

    if (!existing) {
      // Create mode. Seeded from whatever the operator had already typed on the page that
      // opened this, so they are not made to type the name twice.
      this.form.patchValue({ name: this.data.initialName ?? '' });
      return;
    }

    this.form.patchValue({
      name: existing.name,
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
    const request = {
      name: value.name.trim(),
      // These are no longer part of the dialog. On an edit the stored values are sent back
      // untouched so dropping the inputs never silently wipes data someone entered earlier.
      code: this.customer?.code ?? null,
      contactName: this.customer?.contactName ?? null,
      contactEmail: this.customer?.contactEmail ?? null,
      notes: this.customer?.notes ?? null,
      isActive: value.isActive,
    };

    try {
      const existing = this.customer;
      const result = existing
        ? await this.customers.update(existing.id, request)
        : await this.customers.create(request);

      this.dialogRef.close(result);
    } catch (error) {
      this.error.set(describeError(error, 'Could not save this customer.'));
    } finally {
      this.saving.set(false);
    }
  }
}
