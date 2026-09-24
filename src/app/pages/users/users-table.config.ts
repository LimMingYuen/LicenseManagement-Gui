import { BadgeTone, DataTableConfig } from '../../shared/models/data-table.models';
import { User } from '../../models/user.models';
import { Role, SUPER_ADMIN_ROLE } from '../../models/role.models';
import { formatIsoDateTime } from '../../shared/utils/date-format';

/** Maps a role to its badge tone. */
const roleTone = (display: string): BadgeTone =>
  display === SUPER_ADMIN_ROLE ? 'info' : 'neutral';

/** Maps the status text to its badge tone. */
const statusTone = (display: string): BadgeTone => (display === 'Active' ? 'success' : 'danger');

/** Builds the users table config, disabling deletion of the signed-in account. */
export function buildUsersTableConfig(selfId: number | null, roles: Role[]): DataTableConfig<User> {
  return {
    title: 'Users',
    icon: 'people',
    columns: [
      {
        key: 'username',
        header: 'Username',
        sortable: true,
        filterable: true,
        cellType: 'mono',
        columnFilter: true,
        columnFilterType: 'text',
      },
      {
        key: 'fullName',
        header: 'Full name',
        sortable: true,
        filterable: true,
        columnFilter: true,
        columnFilterType: 'text',
        transform: (value: string) => value || '—',
      },
      {
        key: 'role',
        header: 'Role',
        sortable: true,
        filterable: true,
        cellType: 'badge',
        badgeTone: roleTone,
        width: '140px',
        columnFilter: true,
        columnFilterType: 'option',
        columnFilterOptions: roles.map((r) => ({
          value: r.name,
          label: r.name,
          tone: roleTone(r.name),
        })),
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
        key: 'lastLoginAt',
        header: 'Last sign-in',
        sortable: true,
        cellType: 'tnum',
        width: '180px',
        columnFilter: true,
        columnFilterType: 'date',
        transform: (value: string | null) => (value ? formatIsoDateTime(value) : 'Never'),
      },
    ],
    actions: [
      { action: 'view', label: 'View', icon: 'visibility', type: 'icon', tooltip: 'View user' },
      { action: 'edit', label: 'Edit', icon: 'edit', type: 'icon', tooltip: 'Edit user' },
      {
        action: 'reset-password',
        label: 'Reset password',
        icon: 'lock_reset',
        type: 'icon',
        tooltip: 'Reset password',
      },
      {
        action: 'delete',
        label: 'Delete',
        icon: 'delete',
        type: 'icon',
        tooltip: 'Delete account',
        disabled: (row) => row.id === selfId,
      },
    ],
    headerActions: [
      {
        action: 'refresh',
        label: 'Refresh',
        icon: 'refresh',
        type: 'icon',
        tooltip: 'Reload users',
      },
      {
        action: 'add',
        label: 'New user',
        icon: 'add',
        type: 'raised',
        color: 'primary',
        tooltip: 'Create a user account',
      },
    ],
    pagination: {
      pageSizeOptions: [25, 50, 100],
      pageSize: 25,
      showFirstLastButtons: true,
      enabled: true,
    },
    filter: {
      placeholder: 'Search username or name...',
      enabled: true,
    },
    defaultSort: {
      column: 'username',
      direction: 'asc',
    },
    empty: {
      message: 'No users found',
      icon: 'people_outline',
    },
    rowMutedWhen: (row) => !row.isActive,
  };
}
