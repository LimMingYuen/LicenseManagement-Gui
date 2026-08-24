import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LicenseService } from '../../../services/license.service';
import { CustomerService } from '../../../services/customer.service';
import { ApplicationService } from '../../../services/application.service';
import { Application } from '../../../models/application.models';
import { Customer } from '../../../models/customer.models';
import { License, LicenseKind, LicenseTier, LicenseWithFile } from '../../../models/license.models';
import { describeError } from '../../../shared/utils/http-error';
import { saveText } from '../../../shared/utils/download';
import { CustomerForm } from '../../customers/customer-form';
import { GenerateConfig } from './generate-license.config';

/**
 * The generate form shared by the Machine, Robot and Gateway pages.
 *
 * The three differ only in which identifiers they collect and which tiers they allow, so
 * the shape lives in a GenerateConfig and this component renders it — the same split the
 * Users page uses between users.ts and users-table.config.ts.
 *
 * The customer is not part of that config. It is a picker over the customer register that
 * every license type needs, and it can create a customer inline so an operator who reaches
 * this page and finds the customer missing is not sent away mid-form.
 */
@Component({
  selector: 'app-generate-license-form',
  imports: [ReactiveFormsModule, RouterLink, MatSnackBarModule, CustomerForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './generate-license-form.html',
  styleUrl: './generate-license-form.scss',
})
export class GenerateLicenseForm {
  /** Enough to answer "did the last few land" without turning the panel into the register. */
  private static readonly RECENT_LIMIT = 5;

  private readonly licenses = inject(LicenseService);
  private readonly customerService = inject(CustomerService);
  private readonly applicationService = inject(ApplicationService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  readonly config = input.required<GenerateConfig>();

  protected readonly saving = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly result = signal<LicenseWithFile | null>(null);
  protected readonly copied = signal(false);

  /** Active customers only — a deactivated one cannot be issued against. */
  protected readonly customers = signal<Customer[]>([]);
  protected readonly customersLoading = signal(true);
  protected readonly creatingCustomer = signal(false);

  /** Active applications that issue this page's license type, and nothing else. */
  protected readonly applications = signal<Application[]>([]);
  protected readonly applicationsLoading = signal(true);

  /**
   * The licenses this page's type issued most recently. Shown under the form because it is
   * the question an operator asks straight after signing one - did it land, and what did
   * the last few look like - and it saves a trip to the register to answer it.
   */
  protected readonly recent = signal<License[]>([]);
  protected readonly recentLoading = signal(true);
  /** The row whose file is being fetched, so only that row shows its pending label. */
  protected readonly downloadingId = signal<number | null>(null);

  /**
   * Controls are created for every possible field name across the three configs. Ones the
   * active config does not render simply stay untouched, which keeps the form static and
   * avoids rebuilding it when the config input arrives.
   */
  protected readonly form = this.fb.nonNullable.group({
    machineId: ['', [Validators.maxLength(100)]],
    robotId: ['', [Validators.maxLength(100)]],
    deviceId: ['', [Validators.maxLength(100)]],
    // 0 is "nothing picked" for both pickers. Bound with [ngValue] so the value stays a
    // number rather than becoming the string a plain <option value> would produce.
    applicationId: [0, [Validators.required, Validators.min(1)]],
    customerId: [0, [Validators.required, Validators.min(1)]],
    licenseType: ['PERPETUAL' as LicenseTier, Validators.required],
    expiresAt: [''],
    notes: ['', Validators.maxLength(500)],
  });

  /**
   * Mirror of the form value, so the preview rail and the expiry rule can be computed().
   * Fed by an explicit subscription rather than toSignal(), which needs an injection
   * context that a field initializer does not reliably provide here.
   */
  private readonly value = signal(this.rawValue());

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.value.set(this.rawValue()));

    void this.loadCustomers();

    // The application list depends on which license type this page issues, and the config
    // input is not available until after construction - hence an effect rather than a call.
    effect(() => {
      const kind = this.config().kind;
      void this.loadApplications(kind);
    });

    // Narrowed to the picked application once there is one, so the panel lists the licenses
    // that share this form's product rather than every license of this type.
    effect(() => {
      const kind = this.config().kind;
      const application = this.selectedApplication()?.key;
      void this.loadRecent(kind, application);
    });
  }

  protected readonly isPerpetual = computed(() => this.value()['licenseType'] === 'PERPETUAL');

  /** The picked application, for the preview rail. */
  protected readonly selectedApplication = computed(() => {
    const id = Number(this.value()['applicationId'] ?? 0);
    return this.applications().find((a) => a.id === id) ?? null;
  });

  /** The picked customer, for the preview rail and the result panel. */
  protected readonly selectedCustomer = computed(() => {
    const id = Number(this.value()['customerId'] ?? 0);
    return this.customers().find((c) => c.id === id) ?? null;
  });

  /** Preview of the identifier this license will bind to. */
  protected readonly targetPreview = computed(() =>
    this.normalizeTarget(String(this.value()[this.config().targetKey] ?? '')),
  );

  protected readonly ready = computed(() => {
    const v = this.value();
    const fieldsFilled = this.config()
      .fields.filter((f) => !f.optional)
      .every((f) => String(v[f.key] ?? '').trim().length > 0);

    return (
      fieldsFilled &&
      Number(v['applicationId'] ?? 0) > 0 &&
      Number(v['customerId'] ?? 0) > 0 &&
      (this.isPerpetual() || !!v['expiresAt'])
    );
  });

  private rawValue(): Record<string, unknown> {
    return this.form.getRawValue() as unknown as Record<string, unknown>;
  }

  /**
   * Inactive customers are excluded server-side. Failing to load is reported but does not
   * block the page — the picker simply stays empty and the create-inline button still works.
   */
  private async loadCustomers(): Promise<void> {
    this.customersLoading.set(true);

    try {
      this.customers.set(await this.customerService.list({ includeInactive: false }));
    } catch (error) {
      this.error.set(describeError(error, 'Could not load the customer list.'));
    } finally {
      this.customersLoading.set(false);
    }
  }

  /**
   * Only applications that issue this license type, and only active ones - so the picker
   * cannot offer something the API would then reject.
   */
  private async loadApplications(kind: LicenseKind): Promise<void> {
    this.applicationsLoading.set(true);

    try {
      const list = await this.applicationService.list({ supports: kind, includeInactive: false });
      this.applications.set(list);

      // With one candidate there is no choice to make, so making the operator make it is
      // just friction. This is the common case until a second product exists.
      if (list.length === 1) {
        this.form.controls.applicationId.setValue(list[0].id);
      }
    } catch (error) {
      this.error.set(describeError(error, 'Could not load the application list.'));
    } finally {
      this.applicationsLoading.set(false);
    }
  }

  /**
   * The recent panel is a convenience, not part of issuing: a failure empties it and says
   * nothing, rather than raising an error over a form that is still perfectly usable.
   */
  private async loadRecent(kind: LicenseKind, application?: string): Promise<void> {
    this.recentLoading.set(true);

    try {
      const list = await this.licenses.list({ type: kind, application });

      this.recent.set(
        [...list]
          .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt))
          .slice(0, GenerateLicenseForm.RECENT_LIMIT),
      );
    } catch {
      this.recent.set([]);
    } finally {
      this.recentLoading.set(false);
    }
  }

  /**
   * Re-downloads a listed license. The detail fetch rather than the file endpoint, because
   * it carries the stored file name alongside the content - nothing is re-signed either way.
   */
  protected async downloadRecent(license: License): Promise<void> {
    if (this.downloadingId() !== null) return;

    this.downloadingId.set(license.id);

    try {
      const stored = await this.licenses.get(license.id);
      saveText(stored.licenseFileContent, stored.fileName);
    } catch (error) {
      this.notify(describeError(error, 'Could not fetch that license file.'), 'error');
    } finally {
      this.downloadingId.set(null);
    }
  }

  /** Date only, ISO order, for the register table. Null expiry means perpetual. */
  protected shortDate(value: string | null): string {
    if (!value) return 'Never';

    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** A customer created from the inline dialog is selected straight away. */
  protected onCustomerCreated(customer: Customer): void {
    this.creatingCustomer.set(false);
    this.customers.update((list) =>
      [...list, customer].sort((a, b) => a.name.localeCompare(b.name)),
    );
    this.form.controls.customerId.setValue(customer.id);
    this.notify(`${customer.name} was created.`, 'success');
  }

  protected async submit(): Promise<void> {
    if (this.saving()) return;

    const v = this.rawValue();

    if (Number(v['applicationId'] ?? 0) <= 0) {
      this.form.markAllAsTouched();
      this.error.set('Select an application.');
      return;
    }

    if (Number(v['customerId'] ?? 0) <= 0) {
      this.form.markAllAsTouched();
      this.error.set('Select a customer.');
      return;
    }

    // Only the required fields this config actually renders can block submission.
    const missing = this.config().fields.find(
      (f) => !f.optional && !String(v[f.key] ?? '').trim(),
    );

    if (missing) {
      this.form.markAllAsTouched();
      this.error.set(`${missing.label} is required.`);
      return;
    }

    if (!this.isPerpetual() && !v['expiresAt']) {
      this.form.markAllAsTouched();
      this.error.set('An expiration date is required for non-perpetual licenses.');
      return;
    }

    this.saving.set(true);
    this.error.set(null);
    this.result.set(null);

    try {
      const generated = await this.config().submit(this.licenses, {
        ...v,
        // The API treats a perpetual license as one with no expiry, whatever the date box holds.
        expiresAt: this.isPerpetual() ? null : new Date(String(v['expiresAt'])).toISOString(),
        notes: String(v['notes'] ?? '').trim() || null,
      });

      this.result.set(generated);
      this.notify(`${this.config().kind} license signed.`, 'success');

      // So the panel is already current behind the result card when "Issue another" clears it.
      void this.loadRecent(this.config().kind, this.selectedApplication()?.key);
    } catch (error) {
      this.error.set(describeError(error, 'Could not generate the license.'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Clears the form for the next license, keeping the customer — they usually come in batches. */
  protected issueAnother(): void {
    const { customerId, applicationId } = this.form.getRawValue();
    this.form.reset({ licenseType: 'PERPETUAL', customerId, applicationId });
    this.result.set(null);
    this.error.set(null);
  }

  protected download(): void {
    const generated = this.result();
    if (generated) {
      saveText(generated.licenseFileContent, generated.fileName);
    }
  }

  protected async copy(): Promise<void> {
    const generated = this.result();
    if (!generated) return;

    try {
      await navigator.clipboard.writeText(generated.licenseFileContent);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.error.set('Could not copy — select the license text and copy manually.');
    }
  }

  /**
   * Mirrors the server's normalisation so the preview shows what will actually be signed
   * rather than what was typed.
   */
  private normalizeTarget(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    return this.config().kind === 'Gateway'
      ? trimmed.replace(/\s/g, '').toUpperCase()
      : this.config().targetKey === 'robotId'
        ? trimmed
        : trimmed.replace(/-/g, '');
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
