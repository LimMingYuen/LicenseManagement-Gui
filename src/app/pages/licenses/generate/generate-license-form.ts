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

/** License generation form shared by the Machine, Robot and Gateway pages. */
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
  /** Number of recently issued licenses shown under the form. */
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

  /** Active customers for the picker. */
  protected readonly customers = signal<Customer[]>([]);
  protected readonly customersLoading = signal(true);

  /** Active applications that issue this page's license type. */
  protected readonly applications = signal<Application[]>([]);
  protected readonly applicationsLoading = signal(true);

  /** Machines of the picked customer licensed for the picked application, for the robot form. */
  protected readonly machines = signal<Machine[]>([]);
  protected readonly machinesLoading = signal(false);

  /** Most recently issued licenses of this page's type. */
  protected readonly recent = signal<License[]>([]);
  protected readonly recentLoading = signal(true);
  /** Id of the recent license whose file is being fetched. */
  protected readonly downloadingId = signal<number | null>(null);

  /** Controls for every field of all three configs; ones the config does not render stay unused. */
  protected readonly form = this.fb.nonNullable.group({
    machineId: ['', [Validators.maxLength(100)]],
    robotId: ['', [Validators.maxLength(100)]],
    deviceId: ['', [Validators.maxLength(100)]],
    applicationId: [0, [Validators.required, Validators.min(1)]],
    customerId: [0, [Validators.required, Validators.min(1)]],
    licenseType: ['PERPETUAL' as LicenseTier, Validators.required],
    expiresAt: [null as Date | null],
    notes: ['', Validators.maxLength(500)],
  });

  /** Signal mirror of the raw form value, fed by a valueChanges subscription. */
  private readonly value = signal(this.rawValue());

  /** Expiry field, measured so its calendar popup matches its width. */
  private readonly expiryField = viewChild('expiryField', { read: ElementRef });

  constructor() {
    this.form.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.value.set(this.rawValue()));

    void this.loadCustomers();

    effect(() => {
      const kind = this.config().kind;
      void this.loadApplications(kind);
    });

    effect(() => {
      const kind = this.config().kind;
      const application = this.selectedApplication()?.key;
      void this.loadRecent(kind, application);
    });

    effect(() => {
      const needsMachines = this.config().fields.some((f) => f.control === 'machine');
      const customerId = Number(this.value()['customerId'] ?? 0);
      const applicationId = Number(this.value()['applicationId'] ?? 0);

      if (!needsMachines) {
        return;
      }

      void this.loadMachines(customerId, applicationId);
    });

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

  /** Picked expiry as an ISO date, or empty when none is picked. */
  protected readonly expiryPreview = computed(() => {
    const picked = this.value()['expiresAt'];
    return picked instanceof Date ? toIsoDate(picked) : '';
  });

  protected readonly selectedApplication = computed(() => {
    const id = Number(this.value()['applicationId'] ?? 0);
    return this.applications().find((a) => a.id === id) ?? null;
  });

  protected readonly selectedCustomer = computed(() => {
    const id = Number(this.value()['customerId'] ?? 0);
    return this.customers().find((c) => c.id === id) ?? null;
  });

  /** Normalized identifier the license will bind to. */
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

  /** Returns the raw form value as a plain record. */
  private rawValue(): Record<string, unknown> {
    return this.form.getRawValue() as unknown as Record<string, unknown>;
  }

  /** Loads the active customers for the picker. */
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

  /** Loads the active applications for a license type, preselecting a sole match. */
  private async loadApplications(kind: LicenseKind): Promise<void> {
    this.applicationsLoading.set(true);

    try {
      const list = await this.applicationService.list({ supports: kind, includeInactive: false });
      this.applications.set(list);

      if (list.length === 1) {
        this.form.controls.applicationId.setValue(list[0].id);
      }
    } catch (error) {
      this.error.set(describeError(error, 'Could not load the application list.'));
    } finally {
      this.applicationsLoading.set(false);
    }
  }

  /** Loads the licensed machines for the robot picker and clears a stale selection. */
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

  /** Loads the latest licenses of a type, optionally for one application. */
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

  /** Downloads the stored file of a recent license. */
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

  /** Formats a date as YYYY-MM-DD, or "Never" when there is none. */
  protected shortDate(value: string | null): string {
    if (!value) return 'Never';

    const date = new Date(value);
    if (isNaN(date.getTime())) return value;

    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  /** Validates the form and signs the license. */
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
        expiresAt: this.isPerpetual() ? null : (v['expiresAt'] as Date).toISOString(),
        notes: String(v['notes'] ?? '').trim() || null,
      });

      this.result.set(generated);
      this.notify(`${this.config().kind} license signed.`, 'success');

      void this.loadRecent(this.config().kind, this.selectedApplication()?.key);
    } catch (error) {
      this.error.set(describeError(error, 'Could not generate the license.'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Resets the form for the next license, keeping customer, application and machine. */
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

  /** Downloads the generated license file. */
  protected download(): void {
    const generated = this.result();
    if (generated) {
      saveText(generated.licenseFileContent, generated.fileName);
    }
  }

  /** Copies the generated license to the clipboard. */
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

  /** Normalizes a target identifier the same way the server does. */
  private normalizeTarget(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    return this.config().kind === 'Gateway'
      ? trimmed.replace(/\s/g, '').toUpperCase()
      : this.config().targetKey === 'robotId'
        ? trimmed
        : trimmed.replace(/-/g, '');
  }

  /** Shows a success or error snackbar. */
  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
