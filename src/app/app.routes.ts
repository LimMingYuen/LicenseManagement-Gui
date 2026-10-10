import { Route, Routes } from '@angular/router';
import { authGuard, guestGuard, pageGuard } from './guards/auth.guard';
import { PageHeading } from './shared/components/page-header/page-header';

/** Route title and shell header data for a page. */
function page(heading: string, icon: string): Pick<Route, 'title' | 'data'> {
  return {
    title: `${heading} · License Management`,
    data: { heading, icon } satisfies PageHeading,
  };
}

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · License Management',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'dashboard',
    ...page('Dashboard', 'dashboard'),
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  {
    path: 'licenses/catalog',
    ...page('License Catalog', 'account_tree'),
    canActivate: [pageGuard],
    loadComponent: () =>
      import('./pages/licenses/catalog/catalog').then((m) => m.LicenseCatalogPage),
  },
  {
    path: 'licenses/machine',
    ...page('Machine License', 'precision_manufacturing'),
    canActivate: [pageGuard],
    loadComponent: () =>
      import('./pages/licenses/generate/machine-license/machine-license').then(
        (m) => m.MachineLicense,
      ),
  },
  {
    path: 'licenses/robot',
    ...page('Robot License', 'smart_toy'),
    canActivate: [pageGuard],
    loadComponent: () =>
      import('./pages/licenses/generate/robot-license/robot-license').then((m) => m.RobotLicense),
  },
  {
    path: 'licenses/gateway',
    ...page('Gateway License', 'router'),
    canActivate: [pageGuard],
    loadComponent: () =>
      import('./pages/licenses/generate/gateway-license/gateway-license').then(
        (m) => m.GatewayLicense,
      ),
  },
  {
    path: 'licenses',
    ...page('Licenses', 'inventory_2'),
    canActivate: [pageGuard],
    loadComponent: () => import('./pages/licenses/list/licenses').then((m) => m.Licenses),
  },
  {
    path: 'customers',
    ...page('Customers', 'apartment'),
    canActivate: [pageGuard],
    loadComponent: () => import('./pages/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'applications',
    ...page('Applications', 'apps'),
    canActivate: [pageGuard],
    loadComponent: () => import('./pages/applications/applications').then((m) => m.Applications),
  },
  {
    path: 'keys',
    ...page('RSA Keys', 'key'),
    canActivate: [pageGuard],
    loadComponent: () => import('./pages/keys/keys').then((m) => m.Keys),
  },
  {
    path: 'users',
    ...page('Users', 'people'),
    canActivate: [pageGuard],
    loadComponent: () => import('./pages/users/users').then((m) => m.Users),
  },
  {
    path: 'roles',
    ...page('Roles', 'admin_panel_settings'),
    canActivate: [pageGuard],
    loadComponent: () => import('./pages/roles/roles').then((m) => m.Roles),
  },
  {
    path: 'account/password',
    ...page('Change password', 'lock_reset'),
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/change-password/change-password').then((m) => m.ChangePassword),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
