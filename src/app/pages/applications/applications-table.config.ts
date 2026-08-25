import { BadgeTone, DataTableConfig } from '../../shared/models/data-table.models';
import { Application, supportedKinds } from '../../models/application.models';
import { formatIsoDateTime } from '../../shared/utils/date-format';

const statusTone = (display: string): BadgeTone => (display === 'Active' ? 'success' : 'danger');

/** An application with no licenses is the normal state of a newly created one, not a fault. */
const licenseTone = (display: string): BadgeTone => (display === 'None' ? 'neutral' : 'info');

/**
 * Built per signed-in role rather than exported flat: everything that writes is SuperAdmin-only,
 * so an Operator gets a read-only list rather than buttons that fail at the API.
 */
export function buildApplicationsTableConfig(isSuperAdmin: boolean): DataTableConfig<Application> {
  return {
    title: 'Applications',
    icon: 'apps',
    columns: [
      {
        key: 'name',
        header: 'Application',
        sortable: true,
        filterable: true,
        columnFilter: true,
        columnFilterType: 'text',
      },
      {
        key: 'key',
        header: 'Key',
        sortable: true,
        filterable: true,
        cellType: 'mono',
        width: '200px',
        columnFilter: true,
        columnFilterType: 'text',
      },
      {
        key: 'supportsMachine',
        header: 'Issues',
        sortable: false,
        width: '220px',
        // Reads off the whole row rather than the one flag the key names — the three
        // supports* columns are one fact as far as an operator is concerned.
        transform: (_value: boolean, row: Application) => supportedKinds(row).join(', ') || '—',
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
      {
        action: 'edit',
        label: 'Edit',
        icon: 'edit',
        type: 'icon',
        tooltip: 'Edit application',
        hidden: () => !isSuperAdmin,
      },
      {
        action: 'licenses',
        label: 'View licenses',
        icon: 'inventory_2',
        type: 'icon',
        tooltip: 'Show this application in the register',
        disabled: (row) => row.licenseCount === 0,
      },
      {
        action: 'deactivate',
        label: 'Deactivate',
        icon: 'block',
        type: 'icon',
        tooltip: 'Stop new licenses being issued under it',
        hidden: (row) => !isSuperAdmin || !row.isActive,
      },
      {
        action: 'activate',
        label: 'Activate',
        icon: 'check_circle',
        type: 'icon',
        tooltip: 'Allow new licenses again',
        hidden: (row) => !isSuperAdmin || row.isActive,
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
        tooltip: 'Reload applications',
      },
      ...(isSuperAdmin
        ? [
            {
              action: 'add',
              label: 'New application',
              icon: 'add',
              type: 'raised' as const,
              color: 'primary' as const,
              tooltip: 'Create an application',
            },
          ]
        : []),
    ],
    pagination: {
      pageSizeOptions: [25, 50, 100],
      pageSize: 25,
      showFirstLastButtons: true,
      enabled: true,
    },
    filter: {
      placeholder: 'Search name or key...',
      enabled: true,
    },
    defaultSort: {
      column: 'name',
      direction: 'asc',
    },
    empty: {
      message: 'No applications yet — create one to issue licenses under',
      icon: 'apps',
    },
    rowMutedWhen: (row) => !row.isActive,
  };
}
