/** A navigable page shown in the sidebar. */
export interface PageDefinition {
  /** Route path matching app.routes.ts. */
  path: string;
  /** Display name shown in the sidebar. */
  name: string;
  /** Material icon name. */
  icon: string;
  /** Hidden from non-SuperAdmin accounts. */
  superAdminOnly?: boolean;
  /** Highlights the item only on an exact URL match. */
  exact?: boolean;
}

/** Pages listed in the sidebar, in display order. */
export const PAGE_REGISTRY: PageDefinition[] = [
  { path: '/dashboard', name: 'Dashboard', icon: 'dashboard' },
  { path: '/licenses/machine', name: 'Machine License', icon: 'precision_manufacturing' },
  { path: '/licenses/robot', name: 'Robot License', icon: 'smart_toy' },
  { path: '/licenses/gateway', name: 'Gateway License', icon: 'router' },
  { path: '/licenses/catalog', name: 'License Catalog', icon: 'account_tree' },
  { path: '/licenses', name: 'All Licenses', icon: 'inventory_2', exact: true },
  { path: '/customers', name: 'Customers', icon: 'apartment' },
  { path: '/applications', name: 'Applications', icon: 'apps' },
  { path: '/keys', name: 'RSA Keys', icon: 'key', superAdminOnly: true },
  { path: '/users', name: 'Users', icon: 'people', superAdminOnly: true },
];
