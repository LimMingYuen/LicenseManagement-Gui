import { BadgeTone, DataTableConfig } from '../../shared/models/data-table.models';
import { License } from '../../models/license.models';
import { formatIsoDateTime } from '../../shared/utils/date-format';

/** Each license type gets its own tone so the three read apart at a glance. */
const typeTone = (display: string): BadgeTone =>
  display === 'Machine' ? 'info' : display === 'Robot' ? 'success' : 'neutral';

const statusTone = (display: string): BadgeTone => {
  switch (display) {
    case 'Active':
      return 'success';
    case 'Expiring':
      return 'warning';
    case 'Expired':
    case 'Revoked':
      return 'danger';
    default:
      return 'neutral';
  }
};

export function buildLicensesTableConfig(): DataTableConfig<License> {
  return {
    title: 'Licenses',
    icon: 'inventory_2',
    subtitle: 'Every license issued by this system',
    columns: [
      {
        key: 'applicationName',
        header: 'Application',
        sortable: true,
        filterable: true,
        width: '175px',
        columnFilter: true,
        columnFilterType: 'option',
        // Listed rather than derived, for the same reason the Type options are: a product
        // with no licenses yet still has to be selectable.
        columnFilterOptions: [
          { value: 'QES KUKA AMR', label: 'QES KUKA AMR' },
          { value: 'OMRON DI Gateway', label: 'OMRON DI Gateway' },
        ],
      },
      {
        key: 'type',
        header: 'Type',
        sortable: true,
        filterable: true,
        cellType: 'badge',
        badgeTone: typeTone,
        width: '120px',
        columnFilter: true,
        columnFilterType: 'option',
        // Listed explicitly rather than derived from the data: the Gateway option has to be
        // offered even when no gateway license exists yet. The desktop app omitted it
        // entirely, which made gateway licenses unfilterable.
        columnFilterOptions: [
          { value: 'Machine', label: 'Machine', tone: 'info' },
          { value: 'Robot', label: 'Robot', tone: 'success' },
          { value: 'Gateway', label: 'Gateway', tone: 'neutral' },
        ],
      },
      {
        key: 'customerName',
        header: 'Customer',
        sortable: true,
        filterable: true,
        columnFilter: true,
        columnFilterType: 'text',
      },
      {
        key: 'targetId',
        header: 'Target ID',
        sortable: true,
        filterable: true,
        cellType: 'mono',
        columnFilter: true,
        columnFilterType: 'text',
      },
      {
        key: 'machineId',
        header: 'Machine',
        sortable: true,
        filterable: true,
        cellType: 'mono',
        width: '150px',
        columnFilter: true,
        columnFilterType: 'text',
        // Robot licenses always name their machine; gateway licenses optionally do. A
        // machine license is its own machine, so the cell would only repeat Target ID.
        transform: (value: string | null) => value || '—',
      },
      {
        key: 'licenseType',
        header: 'Tier',
        sortable: true,
        filterable: true,
        width: '130px',
        columnFilter: true,
        columnFilterType: 'option',
        columnFilterOptions: [
          { value: 'PERPETUAL', label: 'Perpetual' },
          { value: 'SUBSCRIPTION', label: 'Subscription' },
          { value: 'TRIAL', label: 'Trial' },
        ],
      },
      {
        key: 'issuedAt',
        header: 'Issued',
        sortable: true,
        cellType: 'tnum',
        width: '175px',
        columnFilter: true,
        columnFilterType: 'date',
        transform: (value: string) => formatIsoDateTime(value),
      },
      {
        key: 'expiresAt',
        header: 'Expires',
        sortable: true,
        cellType: 'tnum',
        width: '175px',
        columnFilter: true,
        columnFilterType: 'date',
        transform: (value: string | null) => (value ? formatIsoDateTime(value) : 'Perpetual'),
      },
      {
        key: 'status',
        header: 'Status',
        sortable: true,
        cellType: 'badge',
        badgeTone: statusTone,
        width: '120px',
        columnFilter: true,
        columnFilterType: 'option',
        columnFilterOptions: [
          { value: 'Active', label: 'Active', tone: 'success' },
          { value: 'Expiring', label: 'Expiring', tone: 'warning' },
          { value: 'Expired', label: 'Expired', tone: 'danger' },
          { value: 'Revoked', label: 'Revoked', tone: 'danger' },
        ],
      },
    ],
    actions: [
      { action: 'view', label: 'View', icon: 'visibility', type: 'icon', tooltip: 'View details' },
      {
        action: 'download',
        label: 'Download',
        icon: 'download',
        type: 'icon',
        tooltip: 'Download license file',
      },
      {
        action: 'revoke',
        label: 'Revoke',
        icon: 'block',
        type: 'icon',
        tooltip: 'Revoke license',
        hidden: (row) => row.isRevoked,
      },
    ],
    headerActions: [
      { action: 'refresh', label: 'Refresh', icon: 'refresh', type: 'icon', tooltip: 'Reload licenses' },
      {
        action: 'add',
        label: 'New license',
        icon: 'add',
        type: 'raised',
        color: 'primary',
        tooltip: 'Generate a license',
      },
    ],
    pagination: { pageSizeOptions: [25, 50, 100], pageSize: 25, showFirstLastButtons: true, enabled: true },
    filter: { placeholder: 'Search customer, target or license ID...', enabled: true },
    defaultSort: { column: 'issuedAt', direction: 'desc' },
    empty: { message: 'No licenses issued yet', icon: 'inventory_2' },
    rowClickable: true,
    // Revoked licenses stay on record - they read back rather than disappearing.
    rowMutedWhen: (row) => row.isRevoked,
  };
}
