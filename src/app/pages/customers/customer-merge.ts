import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Customer } from '../../models/customer.models';
import { CustomerService } from '../../services/customer.service';
import { describeError } from '../../shared/utils/http-error';

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
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="modal-backdrop" (click)="cancelled.emit()"></div>
    <div class="modal" role="dialog" aria-modal="true" aria-label="Merge customer">
      <form class="card modal-card" [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <h2 class="modal-title">Merge {{ source().name }}</h2>

        @if (error(); as message) {
          <p class="alert alert-error" role="alert">{{ message }}</p>
        }

        <div class="modal-body">
          <p class="alert alert-warn">
            {{ source().licenseCount }}
            {{ source().licenseCount === 1 ? 'license moves' : 'licenses move' }}
            to the customer you pick, and <strong>{{ source().name }}</strong> is deleted. The
            customer name inside each signed license file is unchanged — only which customer it
            files under.
          </p>

          <label class="field">
            <span class="field-label">Merge into</span>
            <select formControlName="targetId">
              <option [value]="0" disabled>Choose a customer…</option>
              @for (candidate of candidates(); track candidate.id) {
                <option [value]="candidate.id">
                  {{ candidate.name }} ({{ candidate.licenseCount }})
                </option>
              }
            </select>
            @if (candidates().length === 0) {
              <span class="field-hint">There is no other customer to merge into.</span>
            }
          </label>
        </div>

        <footer class="modal-actions">
          <button type="button" class="btn" (click)="cancelled.emit()">Cancel</button>
          <button
            type="submit"
            class="btn btn-danger"
            [disabled]="saving() || !form.controls.targetId.value"
          >
            {{ saving() ? 'Merging…' : 'Merge' }}
          </button>
        </footer>
      </form>
    </div>
  `,
})
export class CustomerMerge {
  private readonly customers = inject(CustomerService);

  /** The customer being folded away. */
  readonly source = input.required<Customer>();

  /** Every customer, including the source — filtered out below. */
  readonly all = input.required<Customer[]>();

  readonly merged = output<Customer>();
  readonly cancelled = output<void>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly candidates = computed(() =>
    this.all()
      .filter((c) => c.id !== this.source().id)
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
      this.merged.emit(await this.customers.merge(this.source().id, targetId));
    } catch (error) {
      this.error.set(describeError(error, 'Could not merge these customers.'));
    } finally {
      this.saving.set(false);
    }
  }
}
