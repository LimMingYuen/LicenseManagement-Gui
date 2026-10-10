import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Customer } from '../../models/customer.models';
import { License } from '../../models/license.models';
import { AuthService } from '../../services/auth.service';
import { LicenseService } from '../../services/license.service';
import { formatIsoDateTime } from '../../shared/utils/date-format';
import { describeError } from '../../shared/utils/http-error';

export interface CustomerDetailData {
  customer: Customer;
}

/** What the customer detail dialog closes with. */
export type CustomerDetailResult = 'delete' | undefined;

/** Displays one customer with its licenses and offers to delete it. */
@Component({
  selector: 'app-customer-detail',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './customer-detail.html',
  styleUrl: './customer-detail.scss',
})
export class CustomerDetail {
  private readonly licenseService = inject(LicenseService);
  protected readonly dialogRef =
    inject<MatDialogRef<CustomerDetail, CustomerDetailResult>>(MatDialogRef);

  protected readonly customer = inject<CustomerDetailData>(MAT_DIALOG_DATA).customer;

  /** Only a SuperAdmin may delete customers. */
  protected readonly canDelete = inject(AuthService).isSuperAdmin;

  protected readonly licenses = signal<License[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);

  protected readonly formatDate = formatIsoDateTime;

  constructor() {
    void this.load();
  }

  /** Returns the pill tone for a license status. */
  protected statusTone(status: License['status']): string {
    switch (status) {
      case 'Active':
        return 'success';
      case 'Expiring':
        return 'warning';
      default:
        return 'danger';
    }
  }

  /** Loads the licenses issued to this customer. */
  private async load(): Promise<void> {
    try {
      this.licenses.set(await this.licenseService.list({ customerId: this.customer.id }));
    } catch (error) {
      this.error.set(describeError(error, 'Could not load this customer’s licenses.'));
    } finally {
      this.loading.set(false);
    }
  }
}
