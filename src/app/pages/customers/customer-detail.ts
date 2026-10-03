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
  template: `
    <h2 mat-dialog-title>{{ customer.name }}</h2>

    @if (error(); as message) {
      <p class="alert alert-error dialog-alert" role="alert">{{ message }}</p>
    }

    <mat-dialog-content>
      <div class="detail-tags">
        <span class="pill" [class]="customer.isActive ? 'pill--success' : 'pill--danger'">
          {{ customer.isActive ? 'Active' : 'Inactive' }}
        </span>
      </div>

      <dl class="pairs">
        @if (customer.code) {
          <dt>Code</dt>
          <dd class="mono">{{ customer.code }}</dd>
        }

        @if (customer.contactName) {
          <dt>Contact</dt>
          <dd>{{ customer.contactName }}</dd>
        }

        @if (customer.contactEmail) {
          <dt>Email</dt>
          <dd>{{ customer.contactEmail }}</dd>
        }

        @if (customer.notes) {
          <dt>Notes</dt>
          <dd>{{ customer.notes }}</dd>
        }

        <dt>Licenses</dt>
        <dd class="tnum">
          {{ customer.licenseCount }} total, {{ customer.activeLicenseCount }} active
        </dd>

        <dt>Created</dt>
        <dd class="tnum">{{ formatDate(customer.createdAt) }}</dd>

        @if (customer.createdBy) {
          <dt>Created by</dt>
          <dd>{{ customer.createdBy }}</dd>
        }

        @if (customer.updatedAt) {
          <dt>Updated</dt>
          <dd class="tnum">{{ formatDate(customer.updatedAt) }}</dd>
        }
      </dl>

      <div class="field">
        <span class="field-label">Licenses</span>
        @if (loading()) {
          <p class="muted">Loading…</p>
        } @else if (licenses().length === 0) {
          <p class="muted">No licenses have been issued to this customer.</p>
        } @else {
          <ul class="license-list">
            @for (license of licenses(); track license.id) {
              <li>
                <span class="pill" [class]="'pill--' + statusTone(license.status)">
                  {{ license.status }}
                </span>
                <span class="license-main">
                  <span>{{ license.applicationName }} · {{ license.type }}</span>
                  <span class="mono muted">{{ license.targetId }}</span>
                </span>
                <span class="tnum muted">
                  {{ license.expiresAt ? formatDate(license.expiresAt) : 'Perpetual' }}
                </span>
              </li>
            }
          </ul>
        }
      </div>

      @if (canDelete() && customer.activeLicenseCount > 0) {
        <p class="muted">This customer cannot be deleted while it has active licenses.</p>
      }
    </mat-dialog-content>

    <mat-dialog-actions>
      <button type="button" matButton="outlined" mat-dialog-close>Close</button>
      @if (canDelete()) {
        <button
          type="button"
          matButton="outlined"
          class="danger"
          [disabled]="customer.activeLicenseCount > 0"
          (click)="dialogRef.close('delete')"
        >
          Delete
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      .detail-tags {
        display: flex;
        flex-wrap: wrap;
        gap: var(--sp-2);
      }

      .pairs {
        display: grid;
        grid-template-columns: minmax(7rem, max-content) 1fr;
        gap: var(--sp-2) var(--sp-4);
        margin: 0;
        font-size: var(--fs-base);

        dt {
          color: var(--brand-text-muted);
          font-size: var(--fs-md);
        }

        dd {
          margin: 0;
          color: var(--brand-text-strong);
          overflow-wrap: anywhere;
        }
      }

      .license-list {
        display: grid;
        gap: var(--sp-2);
        max-height: 16rem;
        overflow: auto;
        margin: 0;
        padding: 0;
        list-style: none;

        li {
          display: flex;
          align-items: center;
          gap: var(--sp-3);
          padding: var(--sp-2) var(--sp-3);
          border: 1px solid var(--brand-border-soft);
          border-radius: var(--r-md);
          font-size: var(--fs-md);
        }
      }

      .license-main {
        display: flex;
        flex: 1;
        flex-direction: column;
        min-width: 0;
        overflow-wrap: anywhere;
      }
    `,
  ],
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
