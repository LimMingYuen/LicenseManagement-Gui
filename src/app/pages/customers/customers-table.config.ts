import { BadgeTone, DataTableConfig } from '../../shared/models/data-table.models';
import { Customer } from '../../models/customer.models';
import { formatIsoDateTime } from '../../shared/utils/date-format';

/** Maps the license count text to its badge tone. */
const licenseTone = (display: string): BadgeTone => (display === 'None' ? 'neutral' : 'info');

/** Builds the customers table config. */
export function buildCustomersTableConfig(): DataTableConfig<Customer> {
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
        action: 'licenses',
        label: 'View licenses',
        icon: 'inventory_2',
        type: 'icon',
        tooltip: 'Show this customer in the register',
        disabled: (row) => row.licenseCount === 0,
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
