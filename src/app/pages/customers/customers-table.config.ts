import { BadgeTone, DataTableConfig } from '../../shared/models/data-table.models';
import { Customer } from '../../models/customer.models';
import { formatIsoDateTime } from '../../shared/utils/date-format';

const statusTone = (display: string): BadgeTone => (display === 'Active' ? 'success' : 'danger');

/**
 * A customer with no licenses reads as neutral rather than as a problem — it is the normal
 * state of one created ahead of the first order.
 */
const licenseTone = (display: string): BadgeTone => (display === 'None' ? 'neutral' : 'info');

/**
 * Built per signed-in role rather than exported flat: merge and delete rewrite or discard
 * history, so they are hidden outright from Operators instead of failing at the API.
 */
export function buildCustomersTableConfig(isSuperAdmin: boolean): DataTableConfig<Customer> {
  return {
    title: 'Customers',
    icon: 'apartment',
    columns: [
      {
        key: 'name',
        header: 'Customer',
        sortable: true,
        filterable: true,
        columnFilter: true,
        columnFilterType: 'text',
      },
      {
        key: 'licenseCount',
        header: 'Licenses',
        sortable: true,
        cellType: 'badge',
        badgeTone: licenseTone,
        width: '120px',
        transform: (value: number) => (value === 0 ? 'None' : String(value)),
      },
      {
        key: 'isActive',
        header: 'Status',
        sortable: true,
        cellType: 'badge',
        badgeTone: statusTone,
        width: '130px',
        columnFilter: true,
        columnFilterType: 'option',
        columnFilterOptions: [
          { value: 'Active', label: 'Active', tone: 'success' },
          { value: 'Inactive', label: 'Inactive', tone: 'danger' },
        ],
        transform: (value: boolean) => (value ? 'Active' : 'Inactive'),
      },
      {
        key: 'createdAt',
        header: 'Created',
        sortable: true,
        cellType: 'tnum',
        width: '180px',
        columnFilter: true,
        columnFilterType: 'date',
        transform: (value: string) => formatIsoDateTime(value),
      },
    ],
    actions: [
      { action: 'edit', label: 'Edit', icon: 'edit', type: 'icon', tooltip: 'Edit customer' },
      {
        action: 'licenses',
        label: 'View licenses',
        icon: 'inventory_2',
        type: 'icon',
        tooltip: 'Show this customer in the register',
        disabled: (row) => row.licenseCount === 0,
      },
      {
        action: 'deactivate',
        label: 'Deactivate',
        icon: 'domain_disabled',
        type: 'icon',
        tooltip: 'Hide from the generate forms',
        hidden: (row) => !row.isActive,
      },
      {
        action: 'activate',
        label: 'Activate',
        icon: 'domain_add',
        type: 'icon',
        tooltip: 'Allow new licenses again',
        hidden: (row) => row.isActive,
      },
      {
        action: 'merge',
        label: 'Merge',
        icon: 'merge',
        type: 'icon',
        tooltip: 'Fold this customer into another',
        hidden: () => !isSuperAdmin,
      },
      {
        action: 'delete',
        label: 'Delete',
        icon: 'delete',
        type: 'icon',
        tooltip: 'Delete — only possible with no licenses',
        hidden: () => !isSuperAdmin,
        // The API refuses this too; disabling it here explains why before the click.
        disabled: (row) => row.licenseCount > 0,
      },
    ],
    headerActions: [
      {
        action: 'refresh',
        label: 'Refresh',
        icon: 'refresh',
        type: 'icon',
        tooltip: 'Reload customers',
      },
      {
        action: 'add',
        label: 'New customer',
        icon: 'add',
        type: 'raised',
        color: 'primary',
        tooltip: 'Create a customer',
      },
    ],
    pagination: {
      pageSizeOptions: [25, 50, 100],
      pageSize: 25,
      showFirstLastButtons: true,
      enabled: true,
    },
    filter: {
      placeholder: 'Search customers...',
      enabled: true,
    },
    defaultSort: {
      column: 'name',
      direction: 'asc',
    },
    empty: {
      message: 'No customers yet — create one to issue licenses against',
      icon: 'apartment',
    },
    rowMutedWhen: (row) => !row.isActive,
  };
}
