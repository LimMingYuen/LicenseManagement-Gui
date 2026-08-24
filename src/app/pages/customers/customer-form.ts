import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Customer } from '../../models/customer.models';
import { CustomerService } from '../../services/customer.service';
import { describeError } from '../../shared/utils/http-error';

/**
 * Create/edit dialog. The same form serves both, and it is also mounted inline by the
 * generate pages so an operator can add a missing customer without leaving the form they
 * are part-way through.
 */
@Component({
  selector: 'app-customer-form',
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
          <label class="field">
            <span class="field-label">Customer name</span>
            <input type="text" formControlName="name" placeholder="Acme Robotics Ltd" maxlength="200" />
            <span class="field-hint">
              Written into every license signed for this customer. Must be unique.
            </span>
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <span class="field-error">A customer name is required.</span>
            }
          </label>

          <label class="field">
            <span class="field-label">Short code</span>
            <input
              type="text"
              formControlName="code"
              placeholder="ACME"
              maxlength="50"
              autocapitalize="characters"
              spellcheck="false"
            />
            <span class="field-hint">Optional. Something short to search by.</span>
          </label>

          <label class="field">
            <span class="field-label">Contact name</span>
            <input type="text" formControlName="contactName" maxlength="200" />
          </label>

          <label class="field">
            <span class="field-label">Contact email</span>
            <input
              type="email"
              formControlName="contactEmail"
              maxlength="200"
              autocapitalize="none"
              spellcheck="false"
            />
            @if (form.controls.contactEmail.touched && form.controls.contactEmail.invalid) {
              <span class="field-error">Enter a valid email address.</span>
            }
          </label>

          <label class="field">
            <span class="field-label">Notes</span>
            <textarea formControlName="notes" rows="3" maxlength="500"></textarea>
          </label>

          <label class="field-inline">
            <input type="checkbox" formControlName="isActive" />
            <span>Customer is active</span>
          </label>
          <span class="field-hint">
            Inactive customers keep their licenses and stay in the catalog, but drop out of the
            generate forms so nothing new can be issued against them.
          </span>
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
export class CustomerForm {
  private readonly customers = inject(CustomerService);

  /** null = create a new customer, otherwise edit this one. */
  readonly customer = input<Customer | null>(null);

  /** Prefills the name when opened from a generate form the operator has half-typed. */
  readonly initialName = input<string>('');

  readonly saved = output<Customer>();
  readonly cancelled = output<void>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(200)]],
    code: ['', Validators.maxLength(50)],
    contactName: ['', Validators.maxLength(200)],
    contactEmail: ['', [Validators.email, Validators.maxLength(200)]],
    notes: ['', Validators.maxLength(500)],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      const existing = this.customer();

      if (!existing) {
        // Create mode. Seeded from whatever the operator had already typed on the page that
        // opened this, so they are not made to type the name twice.
        this.form.patchValue({ name: this.initialName() });
        return;
      }

      this.form.patchValue({
        name: existing.name,
        code: existing.code ?? '',
        contactName: existing.contactName ?? '',
        contactEmail: existing.contactEmail ?? '',
        notes: existing.notes ?? '',
        isActive: existing.isActive,
      });
    });
  }

  protected editing = () => this.customer() !== null;
  protected title = () => (this.editing() ? `Edit ${this.customer()?.name}` : 'New customer');

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
      code: value.code.trim() || null,
      contactName: value.contactName.trim() || null,
      contactEmail: value.contactEmail.trim() || null,
      notes: value.notes.trim() || null,
      isActive: value.isActive,
    };

    try {
      const existing = this.customer();
      const result = existing
        ? await this.customers.update(existing.id, request)
        : await this.customers.create(request);

      this.saved.emit(result);
    } catch (error) {
      this.error.set(describeError(error, 'Could not save this customer.'));
    } finally {
      this.saving.set(false);
    }
  }
}
