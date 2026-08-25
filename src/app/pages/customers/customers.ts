import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { Customer } from '../../models/customer.models';
import { CustomerService } from '../../services/customer.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import { dialogConfig } from '../../shared/utils/dialog';
import { describeError } from '../../shared/utils/http-error';
import { CustomerForm, CustomerFormData } from './customer-form';
import { CustomerMerge, CustomerMergeData } from './customer-merge';
import { buildCustomersTableConfig } from './customers-table.config';

@Component({
  selector: 'app-customers',
  imports: [MatSnackBarModule, DataTableComponent],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Customers {
  private readonly customerService = inject(CustomerService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);

  /** Built once: which actions exist depends only on the signed-in role. */
  protected readonly tableConfig = buildCustomersTableConfig(
    this.auth.currentUser()?.role === 'SuperAdmin',
  );

  constructor() {
    void this.load();
  }

  /**
   * The whole list is fetched once and filtered in the table — the customer list is small
   * enough that a round trip per keystroke buys nothing. Inactive rows are included so they
   * can be reactivated; only the generate-form picker hides them.
   */
  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.customers.set(await this.customerService.list());
    } catch (error) {
      this.notify(describeError(error, 'Could not load customers.'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected handleAction(event: DataActionEvent<Customer>): void {
    switch (event.action) {
      case 'add':
        void this.openForm(null);
        break;
      case 'refresh':
        void this.load();
        break;
      case 'edit':
        if (event.row) void this.openForm(event.row);
        break;
      case 'merge':
        if (event.row) void this.openMerge(event.row);
        break;
      case 'licenses':
        // The register's global search matches the customer name, so this lands on exactly
        // this customer's licenses without the register needing a customer filter of its own.
        if (event.row) {
          void this.router.navigate(['/licenses'], {
            queryParams: { search: event.row.name },
          });
        }
        break;
      case 'activate':
      case 'deactivate':
        if (event.row) void this.toggleActive(event.row);
        break;
      case 'delete':
        if (event.row) void this.remove(event.row);
        break;
    }
  }

  /** null = create. Resolves when the dialog closes; a saved row comes back as the result. */
  private async openForm(customer: Customer | null): Promise<void> {
    const saved = await firstValueFrom(
      this.dialog.open(CustomerForm, dialogConfig<CustomerFormData>({ customer })).afterClosed(),
    );

    if (!saved) {
      return;
    }

    const isNew = !this.customers().some((c) => c.id === saved.id);

    if (isNew) {
      void this.load();
      this.notify(`${saved.name} was created.`, 'success');
    } else {
      this.replace(saved);
      this.notify(`${saved.name} was updated.`, 'success');
    }
  }

  private async openMerge(source: Customer): Promise<void> {
    const target = await firstValueFrom(
      this.dialog
        .open(CustomerMerge, dialogConfig<CustomerMergeData>({ source, all: this.customers() }))
        .afterClosed(),
    );

    if (!target) {
      return;
    }

    // A merge changes two rows and deletes one, so the list is refetched rather than patched.
    void this.load();
    this.notify(`Merged into ${target.name}.`, 'success');
  }

  private async toggleActive(customer: Customer): Promise<void> {
    try {
      const updated = await this.customerService.setActive(customer.id, !customer.isActive);
      this.replace(updated);
      this.notify(
        `${updated.name} was ${updated.isActive ? 'activated' : 'deactivated'}.`,
        'success',
      );
    } catch (error) {
      this.notify(describeError(error, 'Could not change the customer status.'), 'error');
    }
  }

  private async remove(customer: Customer): Promise<void> {
    if (!confirm(`Delete ${customer.name}? This cannot be undone.`)) {
      return;
    }

    try {
      await this.customerService.remove(customer.id);
      this.customers.update((list) => list.filter((c) => c.id !== customer.id));
      this.notify(`${customer.name} was deleted.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not delete this customer.'), 'error');
    }
  }

  private replace(customer: Customer): void {
    this.customers.update((list) => list.map((c) => (c.id === customer.id ? customer : c)));
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
