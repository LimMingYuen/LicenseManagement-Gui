import { BadgeTone, DataTableConfig } from '../../shared/models/data-table.models';
import { Role, SUPER_ADMIN_ROLE } from '../../models/role.models';

/** Maps the role kind text to its badge tone. */
const kindTone = (display: string): BadgeTone => (display === 'System' ? 'info' : 'neutral');

/** Builds the roles table config. */
export function buildRolesTableConfig(): DataTableConfig<Role> {
  return {
    title: 'Roles',
    icon: 'admin_panel_settings',
    columns: [
      {
        key: 'name',
        header: 'Role',
        sortable: true,
        filterable: true,
        cellType: 'mono',
        columnFilter: true,
        columnFilterType: 'text',
      },
      {
        key: 'description',
        header: 'Description',
        sortable: true,
        filterable: true,
        columnFilter: true,
        columnFilterType: 'text',
        transform: (value: string) => value || '—',
      },
      {
        key: 'isSystem',
        header: 'Kind',
        sortable: true,
        cellType: 'badge',
        badgeTone: kindTone,
        width: '130px',
        columnFilter: true,
        columnFilterType: 'option',
        columnFilterOptions: [
          { value: 'System', label: 'System', tone: 'info' },
          { value: 'Custom', label: 'Custom', tone: 'neutral' },
        ],
        transform: (value: boolean) => (value ? 'System' : 'Custom'),
      },
      {
        key: 'pageCount',
        header: 'Pages',
        sortable: true,
        cellType: 'tnum',
        width: '110px',
        transform: (value: number, row: Role) =>
          row.name === SUPER_ADMIN_ROLE ? 'All' : String(value),
      },
      {
        key: 'userCount',
        header: 'Users',
        sortable: true,
        cellType: 'tnum',
        width: '110px',
      },
    ],
    actions: [
      { action: 'view', label: 'View', icon: 'visibility', type: 'icon', tooltip: 'View role' },
      { action: 'edit', label: 'Edit', icon: 'edit', type: 'icon', tooltip: 'Edit role' },
      {
        action: 'users',
        label: 'Users',
        icon: 'people',
        type: 'icon',
        tooltip: 'Show users with this role',
        disabled: (row) => row.userCount === 0,
      },
      {
        action: 'delete',
        label: 'Delete',
        icon: 'delete',
        type: 'icon',
        tooltip: 'Delete — only custom roles no user holds',
        disabled: (row) => row.isSystem || row.userCount > 0,
      },
    ],
    headerActions: [
      {
        action: 'refresh',
        label: 'Refresh',
        icon: 'refresh',
        type: 'icon',
        tooltip: 'Reload roles',
      },
      {
        action: 'add',
        label: 'New role',
        icon: 'add',
        type: 'raised',
        color: 'primary',
        tooltip: 'Create a role',
      },
    ],
    pagination: {
      pageSizeOptions: [25, 50, 100],
      pageSize: 25,
      showFirstLastButtons: true,
      enabled: true,
    },
    filter: {
      placeholder: 'Search role or description...',
      enabled: true,
    },
    defaultSort: {
      column: 'name',
      direction: 'asc',
    },
    empty: {
      message: 'No roles found',
      icon: 'admin_panel_settings',
    },
  };
}
