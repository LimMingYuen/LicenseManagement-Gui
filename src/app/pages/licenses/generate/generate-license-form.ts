import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { LicenseService } from '../../../services/license.service';
import { CustomerService } from '../../../services/customer.service';
import { ApplicationService } from '../../../services/application.service';
import { MachineService } from '../../../services/machine.service';
import { Application } from '../../../models/application.models';
import { Customer } from '../../../models/customer.models';
import { Machine } from '../../../models/machine.models';
import { License, LicenseKind, LicenseTier, LicenseWithFile } from '../../../models/license.models';
import { describeError } from '../../../shared/utils/http-error';
import { saveText } from '../../../shared/utils/download';
import { provideIsoDates, toIsoDate } from '../../../shared/utils/iso-date';
import { GenerateConfig } from './generate-license.config';

/**
 * The generate form shared by the Machine, Robot and Gateway pages.
 *
 * The three differ only in which identifiers they collect and which tiers they allow, so
 * the shape lives in a GenerateConfig and this component renders it — the same split the
 * Users page uses between users.ts and users-table.config.ts.
 *
 * The customer is not part of that config. It is a picker over the customer register that
 * every license type needs; the register itself is managed on the Customers page.
 */
@Component({
  selector: 'app-generate-license-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatButtonModule,
  ],
  providers: [provideIsoDates()],
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
  private readonly machineService = inject(MachineService);
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

  /** Active applications that issue this page's license type, and nothing else. */
  protected readonly applications = signal<Application[]>([]);
  protected readonly applicationsLoading = signal(true);

  /**
   * The machines a robot can be licensed onto: this customer's, active, and already holding
   * a machine license for the picked application. Empty until both pickers above are set,
   * because a machine belongs to one customer and is licensed under one application.
   *
   * Only the robot form reads these — see the 'machine' control kind in GenerateFieldConfig.
   */
  protected readonly machines = signal<Machine[]>([]);
  protected readonly machinesLoading = signal(false);

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
    // 0 is "nothing picked" for both pickers. mat-option carries the id through as a
    // number, so nothing has to undo the string a native <option value> would produce.
    applicationId: [0, [Validators.required, Validators.min(1)]],
    customerId: [0, [Validators.required, Validators.min(1)]],
    licenseType: ['PERPETUAL' as LicenseTier, Validators.required],
    // MatDatepicker works in Date, not the YYYY-MM-DD string the old native date input
    // held. It is turned back into a string at the two places that need one: the preview
    // rail below, and the request built in submit().
    expiresAt: [null as Date | null],
    notes: ['', Validators.maxLength(500)],
  });

  /**
   * Mirror of the form value, so the preview rail and the expiry rule can be computed().
   * Fed by an explicit subscription rather than toSignal(), which needs an injection
   * context that a field initializer does not reliably provide here.
   */
  private readonly value = signal(this.rawValue());

  /**
   * The expiry field, when the tier has one. Measured so its calendar can open at the same
   * width — see the effect in the constructor.
   */
  private readonly expiryField = viewChild('expiryField', { read: ElementRef });

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

    // The machine list is a function of the customer and the application, both of which the
    // operator can change after the form has loaded - so it is reloaded on every change
    // rather than fetched once. Only forms that render a machine picker ask for it.
    effect(() => {
      const needsMachines = this.config().fields.some((f) => f.control === 'machine');
      const customerId = Number(this.value()['customerId'] ?? 0);
      const applicationId = Number(this.value()['applicationId'] ?? 0);

      if (!needsMachines) {
        return;
      }

      void this.loadMachines(customerId, applicationId);
    });

    // Material sizes the calendar to a fixed 296px, which leaves it visibly narrower than
    // the field it drops out of. The overlay renders on <body>, so no stylesheet in this
    // component can reach it and no CSS anywhere can read the field's width: the width has
    // to be measured here and published as a custom property the global rule for
    // .field-width-calendar picks up. Observed rather than read once, because the field
    // belongs to a container-query grid and changes width as the window does.
    effect((onCleanup) => {
      const field: HTMLElement | undefined = this.expiryField()?.nativeElement;
      if (!field) {
        return;
      }

      const publish = () =>
        document.documentElement.style.setProperty(
          '--field-calendar-width',
          `${field.offsetWidth}px`,
        );

      publish();
      const observer = new ResizeObserver(publish);
      observer.observe(field);

      onCleanup(() => {
        observer.disconnect();
        document.documentElement.style.removeProperty('--field-calendar-width');
      });
    });
  }

  protected readonly isPerpetual = computed(() => this.value()['licenseType'] === 'PERPETUAL');

  /** The picked expiry in ISO order, for the preview rail. Empty until one is picked. */
  protected readonly expiryPreview = computed(() => {
    const picked = this.value()['expiresAt'];
    return picked instanceof Date ? toIsoDate(picked) : '';
  });

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
   * block the page — the picker simply stays empty.
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
   * The machines this robot could be licensed onto.
   *
   * Filtered server-side to the ones holding an active machine license for this application,
   * so the picker cannot offer something the API would then refuse. A picked machine that
   * falls out of the new list - the operator switched customer - is cleared rather than left
   * showing a machine that no longer belongs to the form.
   */
  private async loadMachines(customerId: number, applicationId: number): Promise<void> {
    if (customerId <= 0 || applicationId <= 0) {
      this.machines.set([]);
      return;
    }

    this.machinesLoading.set(true);

    try {
      const list = await this.machineService.list({
        customerId,
        licensedForApplicationId: applicationId,
        includeInactive: false,
      });

      this.machines.set(list);

      const picked = String(this.form.controls.machineId.value ?? '');
      if (picked && !list.some((m) => m.machineId === picked)) {
        this.form.controls.machineId.setValue('');
      }
    } catch (error) {
      this.machines.set([]);
      this.error.set(describeError(error, 'Could not load the machine list.'));
    } finally {
      this.machinesLoading.set(false);
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
        expiresAt: this.isPerpetual() ? null : (v['expiresAt'] as Date).toISOString(),
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

  /**
   * Clears the form for the next license, keeping the customer — they usually come in batches.
   * The machine is kept for the same reason: a machine is normally licensed once and then
   * fitted with several robots, so it outlasts a single trip through this form.
   */
  protected issueAnother(): void {
    const { customerId, applicationId, machineId } = this.form.getRawValue();
    const keepMachine = this.config().fields.some((f) => f.control === 'machine');

    this.form.reset({
      licenseType: 'PERPETUAL',
      customerId,
      applicationId,
      machineId: keepMachine ? machineId : '',
    });
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
