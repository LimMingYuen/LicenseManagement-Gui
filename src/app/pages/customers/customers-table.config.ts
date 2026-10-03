import { BadgeTone, DataTableConfig } from '../../shared/models/data-table.models';
import { Customer } from '../../models/customer.models';
import { formatIsoDateTime } from '../../shared/utils/date-format';

/** Maps the license count text to its badge tone. */
const licenseTone = (display: string): BadgeTone => (display === 'None' ? 'neutral' : 'info');

/** Maps the active license count text to its badge tone. */
const activeTone = (display: string): BadgeTone => (display === 'None' ? 'neutral' : 'success');

/** Builds the customers table config for the signed-in role. */
export function buildCustomersTableConfig(isSuperAdmin: boolean): DataTableConfig<Customer> {
  return {
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
        key: 'activeLicenseCount',
        header: 'Active',
        sortable: true,
        cellType: 'badge',
        badgeTone: activeTone,
        width: '120px',
        transform: (value: number) => (value === 0 ? 'None' : String(value)),
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
      {
        action: 'view',
        label: 'View',
        icon: 'visibility',
        type: 'icon',
        tooltip: 'View customer details',
      },
      {
        action: 'delete',
        label: 'Delete',
        icon: 'delete',
        type: 'icon',
        tooltip: 'Delete — only possible with no active licenses',
        hidden: () => !isSuperAdmin,
        disabled: (row) => row.activeLicenseCount > 0,
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
  };
}
