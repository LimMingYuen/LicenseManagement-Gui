import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { LicenseDetailComponent } from '../../../shared/components/license-detail/license-detail';
import { LicenseService } from '../../../services/license.service';
import {
  ApplicationNode,
  CustomerNode,
  License,
  LicenseCatalog,
  LicenseStatus,
  MachineNode,
} from '../../../models/license.models';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../../shared/components/confirmation-dialog/confirmation-dialog';
import { describeError } from '../../../shared/utils/http-error';
import { formatIsoDateTime } from '../../../shared/utils/date-format';

/** A node key, so expansion survives a reload and a search. */
type NodeKey = string;

/**
 * The license catalog: Application → Customer → Machine → licenses.
 *
 * The register at /licenses answers "show me every license"; this page answers "what has
 * this customer got deployed, and on which machine". The server folds the tree (see
 * LicenseCatalogService) so the roll-up counts cannot disagree with the dashboard.
 *
 * Filtering happens here rather than server-side: the tree is fetched whole for the counts
 * anyway, and narrowing it in the browser keeps every keystroke instant.
 */
@Component({
  selector: 'app-license-catalog',
  imports: [
    RouterLink,
    MatIconModule,
    MatSnackBarModule,
    PageHeaderComponent,
    LicenseDetailComponent,
  ],
  templateUrl: './catalog.html',
  styleUrl: './catalog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LicenseCatalogPage {
  private readonly licenses = inject(LicenseService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly catalog = signal<LicenseCatalog | null>(null);
  protected readonly loading = signal(true);
  protected readonly detail = signal<License | null>(null);

  protected readonly search = signal('');
  protected readonly statusFilter = signal<LicenseStatus | 'All'>('All');

  /**
   * Collapsed rather than expanded nodes are tracked, so a newly issued license appears
   * without the operator having to re-open the branch it landed in.
   */
  private readonly collapsed = signal<ReadonlySet<NodeKey>>(new Set());

  protected readonly statusOptions: readonly (LicenseStatus | 'All')[] = [
    'All',
    'Active',
    'Expiring',
    'Expired',
    'Revoked',
  ];

  protected readonly formatDate = formatIsoDateTime;

  constructor() {
    void this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.catalog.set(await this.licenses.catalog());
    } catch (error) {
      this.notify(describeError(error, 'Could not load the license catalog.'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Revoking from the detail modal. Confirmed for the same reason the register confirms it:
   * the customer already holds the signed file, and this registry is the only thing that
   * says it is no longer valid.
   *
   * The tree is reloaded rather than patched in place — every roll-up count above the
   * license changes, and recomputing them here would be a second implementation of
   * LicenseCatalogService that could disagree with it.
   */
  protected async revoke(license: License): Promise<void> {
    const data: ConfirmationDialogData = {
      title: 'Revoke license?',
      message:
        `This marks the ${license.type.toLowerCase()} license for ${license.customerName} ` +
        `(${license.targetId}) as revoked. Verification will fail for this target.`,
      icon: 'block',
      confirmText: 'Revoke license',
      cancelText: 'Cancel',
      showCancel: true,
      confirmColor: 'warn',
    };

    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmationDialogComponent, { data, width: '440px' }).afterClosed(),
    );

    if (!confirmed) return;

    try {
      const updated = await this.licenses.revoke(license.id, null);
      this.detail.set(updated);
      await this.load();
      this.notify(`License for ${updated.customerName} was revoked.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not revoke the license.'), 'error');
    }
  }

  // ---- Filtering ------------------------------------------------------------------------

  /**
   * The tree with non-matching licenses pruned, and any branch left empty removed with
   * them — except applications, which always show so an unlicensed product is visible
   * rather than merely absent.
   */
  protected readonly view = computed<ApplicationNode[]>(() => {
    const source = this.catalog()?.applications ?? [];
    const term = this.search().trim().toLowerCase();
    const status = this.statusFilter();

    if (!term && status === 'All') {
      return source;
    }

    const keep = (l: License): boolean => {
      if (status !== 'All' && l.status !== status) return false;
      if (!term) return true;

      return (
        l.customerName.toLowerCase().includes(term) ||
        l.targetId.toLowerCase().includes(term) ||
        l.licenseId.toLowerCase().includes(term) ||
        (l.machineId?.toLowerCase().includes(term) ?? false)
      );
    };

    return source.map((app) => ({
      ...app,
      customers: app.customers
        .map((customer) => ({
          ...customer,
          machines: customer.machines
            .map((machine) => ({ ...machine, licenses: machine.licenses.filter(keep) }))
            .filter((machine) => machine.licenses.length > 0),
        }))
        .filter((customer) => customer.machines.length > 0),
    }));
  });

  protected readonly filtered = computed(
    () => this.search().trim().length > 0 || this.statusFilter() !== 'All',
  );

  /** Licenses surviving the filter. Shown so a narrowed tree still states its size. */
  protected readonly matchCount = computed(() =>
    this.view().reduce(
      (total, app) =>
        total +
        app.customers.reduce(
          (sub, c) => sub + c.machines.reduce((m, machine) => m + machine.licenses.length, 0),
          0,
        ),
      0,
    ),
  );

  protected clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('All');
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onStatus(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as LicenseStatus | 'All');
  }

  // ---- Expansion ------------------------------------------------------------------------

  protected appKey(app: ApplicationNode): NodeKey {
    return app.key;
  }

  protected customerKey(app: ApplicationNode, customer: CustomerNode): NodeKey {
    return `${app.key}|${customer.customerName}`;
  }

  /** A filtered tree is shown fully open — the operator asked to see the matches. */
  protected isOpen(key: NodeKey): boolean {
    return this.filtered() || !this.collapsed().has(key);
  }

  protected toggle(key: NodeKey): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  protected expandAll(): void {
    this.collapsed.set(new Set());
  }

  protected collapseAll(): void {
    const keys = this.view().flatMap((app) => [
      app.key,
      ...app.customers.map((c) => this.customerKey(app, c)),
    ]);

    this.collapsed.set(new Set(keys));
  }

  // ---- Presentation ---------------------------------------------------------------------

  protected machineLabel(machine: MachineNode): string {
    return machine.isUnassigned ? 'Unassigned devices' : machine.machineId;
  }

  protected typeTone(type: License['type']): string {
    return type === 'Machine' ? 'info' : type === 'Robot' ? 'success' : 'neutral';
  }

  protected statusTone(status: License['status']): string {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Expiring':
        return 'warning';
      case 'Expired':
      case 'Revoked':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  protected expiryLabel(value: string | null): string {
    return value ? this.formatDate(value) : 'Perpetual';
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
