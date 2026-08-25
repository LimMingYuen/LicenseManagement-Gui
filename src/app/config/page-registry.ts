/**
 * Centralized page registry — the single source of truth for what the sidebar
 * shows. Adding a navigable page means adding a route in app.routes.ts and an
 * entry here; the sidebar derives its items from this list, so the two never
 * drift apart in the way a hand-maintained nav array does.
 */

export interface PageDefinition {
  /** Route path (must match app.routes.ts). */
  path: string;
  /** Display name shown in the sidebar. */
  name: string;
  /** Material icon name. */
  icon: string;
  /** Hidden from non-SuperAdmin accounts. Mirrors the guard on the route. */
  superAdminOnly?: boolean;
  /**
   * Highlight this item only on an exact URL match. Needed where one page's path is a
   * prefix of another's: /licenses would otherwise stay lit while /licenses/machine is open.
   */
  exact?: boolean;
}

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
