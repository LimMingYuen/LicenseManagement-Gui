import { ChangeDetectionStrategy, Component, effect, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Application } from '../../models/application.models';
import { ApplicationService } from '../../services/application.service';
import { describeError } from '../../shared/utils/http-error';

/**
 * Create/edit dialog for a product family.
 *
 * The three "issues" checkboxes are the point of the form: they decide which generate pages
 * offer this application. The payload formats themselves are still code — each is a signed
 * byte layout a device verifies — so what is chosen here is which of the three existing
 * formats this product is allowed to use, not a new one.
 */
@Component({
  selector: 'app-application-form',
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
            <span class="field-label">Application name</span>
            <input type="text" formControlName="name" placeholder="QES KUKA AMR" maxlength="200" />
            @if (form.controls.name.touched && form.controls.name.invalid) {
              <span class="field-error">An application name is required.</span>
            }
          </label>

          <label class="field">
            <span class="field-label">Key</span>
            <input
              type="text"
              formControlName="key"
              placeholder="QES-KUKA-AMR"
              maxlength="100"
              class="mono"
              autocapitalize="characters"
              spellcheck="false"
            />
            <span class="field-hint">
              @if (editing()) {
                Fixed after creation — API filters and saved links quote it.
              } @else {
                Letters, digits, dot, underscore and hyphen only. Cannot be changed later.
              }
            </span>
            @if (form.controls.key.touched && form.controls.key.invalid) {
              <span class="field-error">
                Letters, digits, dot, underscore or hyphen only.
              </span>
            }
          </label>

          <fieldset class="field">
            <legend class="field-label">Issues these license types</legend>

            <label class="field-inline">
              <input type="checkbox" formControlName="supportsMachine" />
              <span>Machine — bound to a customer's machine ID</span>
            </label>

            <label class="field-inline">
              <input type="checkbox" formControlName="supportsRobot" />
              <span>Robot — a robot tied to a specific machine</span>
            </label>

            <label class="field-inline">
              <input type="checkbox" formControlName="supportsGateway" />
              <span>Gateway — an Android device fingerprint</span>
            </label>

            <span class="field-hint">
              Only the ticked types offer this application on their generate page. A type cannot
              be switched off while licenses of that type already exist under it.
            </span>
            @if (!anyTypeSelected()) {
              <span class="field-error">Select at least one license type.</span>
            }
          </fieldset>

          <label class="field">
            <span class="field-label">Icon</span>
            <input
              type="text"
              formControlName="icon"
              placeholder="precision_manufacturing"
              maxlength="50"
              class="mono"
              autocapitalize="none"
              spellcheck="false"
            />
            <span class="field-hint">
              A Material Symbols name, shown against the application in the catalog.
            </span>
          </label>

          <label class="field">
            <span class="field-label">Display order</span>
            <input type="number" formControlName="sortOrder" />
            <span class="field-hint">Lowest first in the catalog. Ties break on name.</span>
          </label>

          <label class="field">
            <span class="field-label">Description</span>
            <textarea formControlName="description" rows="3" maxlength="500"></textarea>
          </label>

          <label class="field-inline">
            <input type="checkbox" formControlName="isActive" />
            <span>Application is active</span>
          </label>
          <span class="field-hint">
            Inactive applications keep their licenses and stay in the catalog, but nothing new
            can be issued under them.
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
export class ApplicationForm {
  private readonly applications = inject(ApplicationService);

  /** null = create a new application, otherwise edit this one. */
  readonly application = input<Application | null>(null);

  readonly saved = output<Application>();
  readonly cancelled = output<void>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    key: ['', [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]+$/), Validators.maxLength(100)]],
    name: ['', [Validators.required, Validators.maxLength(200)]],
    icon: ['apps', [Validators.required, Validators.maxLength(50)]],
    description: ['', Validators.maxLength(500)],
    supportsMachine: [false],
    supportsRobot: [false],
    supportsGateway: [false],
    sortOrder: [0],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      const existing = this.application();

      if (!existing) {
        return;
      }

      // Editing: the key is the identity other things quote, so it is shown but not editable.
      this.form.controls.key.disable();
      this.form.patchValue({
        key: existing.key,
        name: existing.name,
        icon: existing.icon,
        description: existing.description ?? '',
        supportsMachine: existing.supportsMachine,
        supportsRobot: existing.supportsRobot,
        supportsGateway: existing.supportsGateway,
        sortOrder: existing.sortOrder,
        isActive: existing.isActive,
      });
    });
  }

  protected editing = () => this.application() !== null;
  protected title = () =>
    this.editing() ? `Edit ${this.application()?.name}` : 'New application';

  protected anyTypeSelected(): boolean {
    const v = this.form.getRawValue();
    return v.supportsMachine || v.supportsRobot || v.supportsGateway;
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }

    // Mirrors the server rule: an application issuing nothing could never be used.
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
      icon: value.icon.trim() || 'apps',
      description: value.description.trim() || null,
      supportsMachine: value.supportsMachine,
      supportsRobot: value.supportsRobot,
      supportsGateway: value.supportsGateway,
      sortOrder: Number(value.sortOrder) || 0,
      isActive: value.isActive,
    };

    try {
      const existing = this.application();
      const result = existing
        ? await this.applications.update(existing.id, shared)
        : await this.applications.create({ ...shared, key: value.key.trim() });

      this.saved.emit(result);
    } catch (error) {
      this.error.set(describeError(error, 'Could not save this application.'));
    } finally {
      this.saving.set(false);
    }
  }
}
