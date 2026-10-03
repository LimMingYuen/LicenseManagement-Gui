import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { PageHeaderActions } from '../../../shared/components/page-header/page-header-actions';
import {
  LicenseDetailComponent,
  LicenseDetailData,
} from '../../../shared/components/license-detail/license-detail';
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
import { dialogConfig } from '../../../shared/utils/dialog';
import { describeError } from '../../../shared/utils/http-error';
import { formatIsoDateTime } from '../../../shared/utils/date-format';
import { deleteMessage } from '../delete-message';

/** Stable key of a tree node, used to track expansion. */
type NodeKey = string;

/** Page that shows licenses as an Application → Customer → Machine tree. */
@Component({
  selector: 'app-license-catalog',
  imports: [
    RouterLink,
    MatIconModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    PageHeaderActions,
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

  /** Open detail dialog, closed when its license is deleted. */
  private detailRef: MatDialogRef<LicenseDetailComponent> | null = null;

  protected readonly search = signal('');
  protected readonly statusFilter = signal<LicenseStatus | 'All'>('All');

  /** Keys of collapsed nodes; every other node is open. */
  private readonly collapsed = signal<ReadonlySet<NodeKey>>(new Set());

  protected readonly statusOptions: readonly (LicenseStatus | 'All')[] = [
    'All',
    'Active',
    'Expiring',
    'Expired',
  ];

  protected readonly formatDate = formatIsoDateTime;

  constructor() {
    void this.load();
  }

  /** Loads the license catalog tree. */
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

  /** Opens the license detail dialog. */
  protected openDetail(license: License): void {
    const ref = this.dialog.open(
      LicenseDetailComponent,
      dialogConfig<LicenseDetailData>({ license }, 'min(44rem, 96vw)'),
    );

    ref.componentInstance.deleted.subscribe((row) => void this.delete(row));

    this.detailRef = ref;
    ref.afterClosed().subscribe(() => {
      if (this.detailRef === ref) this.detailRef = null;
    });
  }

  /** Deletes a license after confirmation and reloads the tree. */
  protected async delete(license: License): Promise<void> {
    const data: ConfirmationDialogData = {
      title: 'Delete license?',
      message: deleteMessage(license),
      icon: 'delete',
      confirmText: 'Delete license',
      cancelText: 'Cancel',
      showCancel: true,
      confirmColor: 'warn',
    };

    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmationDialogComponent, { data, width: '440px' }).afterClosed(),
    );

    if (!confirmed) return;

    try {
      await this.licenses.delete(license.id);
      this.detailRef?.close();
      await this.load();
      this.notify(`License for ${license.customerName} was deleted.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not delete the license.'), 'error');
    }
  }

  // ---- Filtering ------------------------------------------------------------------------

  /** Catalog tree pruned to matching licenses; applications are always kept. */
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

  /** Number of licenses that match the filters. */
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

  /** Resets the search and status filters. */
  protected clearFilters(): void {
    this.search.set('');
    this.statusFilter.set('All');
  }

  /** Updates the search term from the input. */
  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** Updates the status filter. */
  protected onStatus(value: LicenseStatus | 'All'): void {
    this.statusFilter.set(value);
  }

  // ---- Expansion ------------------------------------------------------------------------

  /** Returns the node key of an application. */
  protected appKey(app: ApplicationNode): NodeKey {
    return app.key;
  }

  /** Returns the node key of a customer within an application. */
  protected customerKey(app: ApplicationNode, customer: CustomerNode): NodeKey {
    return `${app.key}|${customer.customerName}`;
  }

  /** Whether a node is expanded; a filtered tree is always fully open. */
  protected isOpen(key: NodeKey): boolean {
    return this.filtered() || !this.collapsed().has(key);
  }

  /** Expands or collapses a node. */
  protected toggle(key: NodeKey): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }

  /** Expands every node. */
  protected expandAll(): void {
    this.collapsed.set(new Set());
  }

  /** Collapses every application and customer node. */
  protected collapseAll(): void {
    const keys = this.view().flatMap((app) => [
      app.key,
      ...app.customers.map((c) => this.customerKey(app, c)),
    ]);

    this.collapsed.set(new Set(keys));
  }

  // ---- Presentation ---------------------------------------------------------------------

  /** Returns the display label of a machine node. */
  protected machineLabel(machine: MachineNode): string {
    return machine.isUnassigned ? 'Unassigned devices' : machine.machineId;
  }

  /** Maps a license type to its pill tone. */
  protected typeTone(type: License['type']): string {
    return type === 'Machine' ? 'info' : type === 'Robot' ? 'success' : 'neutral';
  }

  /** Maps a license status to its pill tone. */
  protected statusTone(status: License['status']): string {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Expiring':
        return 'warning';
      case 'Expired':
        return 'danger';
      default:
        return 'neutral';
    }
  }

  /** Formats an expiry date, or "Perpetual" when there is none. */
  protected expiryLabel(value: string | null): string {
    return value ? this.formatDate(value) : 'Perpetual';
  }

  /** Shows a success or error snackbar. */
  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
