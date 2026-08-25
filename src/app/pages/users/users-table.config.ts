import { BadgeTone, DataTableConfig } from '../../shared/models/data-table.models';
import { User } from '../../models/user.models';
import { formatIsoDateTime } from '../../shared/utils/date-format';

/** SuperAdmin reads as the privileged role, Operator as an ordinary one. */
const roleTone = (display: string): BadgeTone => (display === 'SuperAdmin' ? 'info' : 'neutral');

const statusTone = (display: string): BadgeTone => (display === 'Active' ? 'success' : 'danger');

/**
 * Built per signed-in admin rather than exported flat: the deactivate action has
 * to know which row is the viewer's own account so it can disable it, and that
 * identity is only known at runtime.
 */
export function buildUsersTableConfig(selfId: number | null): DataTableConfig<User> {
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
        columnFilterOptions: [
          { value: 'SuperAdmin', label: 'Super Admin', tone: 'info' },
          { value: 'Operator', label: 'Operator', tone: 'neutral' },
        ],
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
      { action: 'edit', label: 'Edit', icon: 'edit', type: 'icon', tooltip: 'Edit user' },
      {
        action: 'reset-password',
        label: 'Reset password',
        icon: 'lock_reset',
        type: 'icon',
        tooltip: 'Reset password',
      },
      {
        action: 'deactivate',
        label: 'Deactivate',
        icon: 'person_off',
        type: 'icon',
        tooltip: 'Deactivate account',
        hidden: (row) => !row.isActive,
        disabled: (row) => row.id === selfId,
      },
      {
        action: 'activate',
        label: 'Activate',
        icon: 'how_to_reg',
        type: 'icon',
        tooltip: 'Activate account',
        hidden: (row) => row.isActive,
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
    // Deactivated accounts stay in the list but read back — they cannot sign in.
    rowMutedWhen: (row) => !row.isActive,
  };
}
