import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Customer } from '../../models/customer.models';
import { AuthService } from '../../services/auth.service';
import { CustomerService } from '../../services/customer.service';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../shared/components/confirmation-dialog/confirmation-dialog';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import { dialogConfig } from '../../shared/utils/dialog';
import { describeError } from '../../shared/utils/http-error';
import {
  CustomerDetail,
  CustomerDetailData,
  CustomerDetailResult,
} from './customer-detail/customer-detail';
import { CustomerForm, CustomerFormData } from './customer-form/customer-form';
import { buildCustomersTableConfig } from './customers-table.config';

/** Page that lists, creates, views and deletes customers. */
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
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);

  /** Built once, since the available actions depend only on the signed-in role. */
  protected readonly tableConfig = buildCustomersTableConfig(this.auth.isSuperAdmin());

  constructor() {
    void this.load();
  }

  /** Loads all customers, including inactive ones. */
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

  /** Dispatches a table action. */
  protected handleAction(event: DataActionEvent<Customer>): void {
    switch (event.action) {
      case 'add':
        void this.openForm();
        break;
      case 'refresh':
        void this.load();
        break;
      case 'view':
        if (event.row) void this.view(event.row);
        break;
      case 'delete':
        if (event.row) void this.remove(event.row);
        break;
    }
  }

  /** Opens the new customer dialog and reloads the list after a save. */
  private async openForm(): Promise<void> {
    const saved = await firstValueFrom(
      this.dialog.open(CustomerForm, dialogConfig<CustomerFormData>({})).afterClosed(),
    );

    if (!saved) {
      return;
    }

    void this.load();
    this.notify(`${saved.name} was created.`, 'success');
  }

  /** Opens the customer detail dialog, deleting the customer if asked to from there. */
  private async view(customer: Customer): Promise<void> {
    const result = await firstValueFrom(
      this.dialog
        .open<CustomerDetail, CustomerDetailData, CustomerDetailResult>(
          CustomerDetail,
          dialogConfig<CustomerDetailData>({ customer }, '40rem'),
        )
        .afterClosed(),
    );

    if (result === 'delete') {
      await this.remove(customer);
    }
  }

  /** Deletes a customer with no active licenses after confirmation. */
  private async remove(customer: Customer): Promise<void> {
    if (customer.activeLicenseCount > 0) {
      this.notify(
        `${customer.name} has ${customer.activeLicenseCount} active license(s) and cannot be deleted.`,
        'error',
      );
      return;
    }

    const expired = customer.licenseCount;
    const data: ConfirmationDialogData = {
      title: 'Delete customer?',
      message:
        `This permanently removes ${customer.name}, its machines` +
        (expired > 0 ? ` and its ${expired} expired license(s)` : '') +
        '. This cannot be undone.',
      icon: 'delete',
      confirmText: 'Delete customer',
      cancelText: 'Cancel',
      showCancel: true,
      confirmColor: 'warn',
    };

    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmationDialogComponent, { data, width: '440px' }).afterClosed(),
    );

    if (!confirmed) return;

    try {
      await this.customerService.remove(customer.id);
      this.customers.update((list) => list.filter((c) => c.id !== customer.id));
      this.notify(`${customer.name} was deleted.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not delete this customer.'), 'error');
      void this.load();
    }
  }

  /** Shows a success or error snackbar. */
  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
