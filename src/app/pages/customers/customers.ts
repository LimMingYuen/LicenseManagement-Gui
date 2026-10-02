import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Customer } from '../../models/customer.models';
import { CustomerService } from '../../services/customer.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import { dialogConfig } from '../../shared/utils/dialog';
import { describeError } from '../../shared/utils/http-error';
import { CustomerForm, CustomerFormData } from './customer-form';
import { buildCustomersTableConfig } from './customers-table.config';

/** Page that lists customers and creates new ones. */
@Component({
  selector: 'app-customers',
  imports: [MatSnackBarModule, DataTableComponent],
  templateUrl: './customers.html',
  styleUrl: './customers.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Customers {
  private readonly customerService = inject(CustomerService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly loading = signal(true);

  protected readonly tableConfig = buildCustomersTableConfig();

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
      case 'licenses':
        if (event.row) {
          void this.router.navigate(['/licenses'], {
            queryParams: { search: event.row.name },
          });
        }
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

  /** Shows a success or error snackbar. */
  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
