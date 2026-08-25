import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { Customer } from '../../models/customer.models';
import { CustomerService } from '../../services/customer.service';
import { describeError } from '../../shared/utils/http-error';

export interface CustomerMergeData {
  /** The customer being folded away. */
  source: Customer;

  /** Every customer, including the source — filtered out below. */
  all: Customer[];
}

/**
 * Folds one customer into another.
 *
 * This exists for the mess the old free-text customer field left behind: "Acme Corp" and
 * "Acme Corp." were two customers in the catalog with no way to reconcile them. Merging
 * moves the licenses and deletes the duplicate; the customer name inside each signed file
 * is left exactly as it was signed.
 */
@Component({
  selector: 'app-customer-merge',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="dialog-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 mat-dialog-title>Merge {{ source.name }}</h2>

      @if (error(); as message) {
        <p class="alert alert-error dialog-alert" role="alert">{{ message }}</p>
      }

      <mat-dialog-content>
        <p class="alert alert-warn">
          {{ source.licenseCount }}
          {{ source.licenseCount === 1 ? 'license moves' : 'licenses move' }}
          to the customer you pick, and <strong>{{ source.name }}</strong> is deleted. The
          customer name inside each signed license file is unchanged — only which customer it
          files under.
        </p>

        <mat-form-field>
          <mat-label>Merge into</mat-label>
          <mat-select formControlName="targetId">
            @for (candidate of candidates(); track candidate.id) {
              <mat-option [value]="candidate.id">
                {{ candidate.name }} ({{ candidate.licenseCount }})
              </mat-option>
            }
          </mat-select>
          @if (candidates().length === 0) {
            <mat-hint>There is no other customer to merge into.</mat-hint>
          }
        </mat-form-field>
      </mat-dialog-content>

      <mat-dialog-actions>
        <button type="button" matButton="outlined" mat-dialog-close>Cancel</button>
        <button
          type="submit"
          matButton="outlined" class="danger"
          [disabled]="saving() || !form.controls.targetId.value"
        >
          {{ saving() ? 'Merging…' : 'Merge' }}
        </button>
      </mat-dialog-actions>
    </form>
  `,
})
export class CustomerMerge {
  private readonly customers = inject(CustomerService);
  private readonly dialogRef = inject<MatDialogRef<CustomerMerge, Customer>>(MatDialogRef);
  private readonly data = inject<CustomerMergeData>(MAT_DIALOG_DATA);

  protected readonly source = this.data.source;

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly candidates = computed(() =>
    this.data.all
      .filter((c) => c.id !== this.source.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    targetId: [0, Validators.required],
  });

  protected async submit(): Promise<void> {
    const targetId = Number(this.form.controls.targetId.value);

    if (!targetId || this.saving()) {
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    try {
      this.dialogRef.close(await this.customers.merge(this.source.id, targetId));
    } catch (error) {
      this.error.set(describeError(error, 'Could not merge these customers.'));
    } finally {
      this.saving.set(false);
    }
  }
}
