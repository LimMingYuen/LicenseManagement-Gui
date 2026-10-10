import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Customer } from '../../../models/customer.models';
import { CustomerService } from '../../../services/customer.service';
import { describeError } from '../../../shared/utils/http-error';

export interface CustomerFormData {
  /** Name to prefill. */
  initialName?: string;
}

/** Dialog that creates a customer. */
@Component({
  selector: 'app-customer-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-form.html',
})
export class CustomerForm {
  private readonly customers = inject(CustomerService);
  private readonly dialogRef = inject<MatDialogRef<CustomerForm, Customer>>(MatDialogRef);
  private readonly data = inject<CustomerFormData>(MAT_DIALOG_DATA);

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [this.data.initialName ?? '', [Validators.required, Validators.maxLength(200)]],
  });

  /** Validates the form and creates the customer. */
  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      const result = await this.customers.create({
        name: this.form.getRawValue().name.trim(),
        code: null,
        contactName: null,
        contactEmail: null,
        notes: null,
        isActive: true,
      });

      this.dialogRef.close(result);
    } catch (error) {
      this.error.set(describeError(error, 'Could not save this customer.'));
    } finally {
      this.saving.set(false);
    }
  }
}
