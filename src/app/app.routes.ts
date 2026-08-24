import { Routes } from '@angular/router';
import { superAdminGuard, authGuard } from './guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · License Management',
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'dashboard',
    title: 'Dashboard · License Management',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/dashboard/dashboard').then((m) => m.Dashboard),
  },
  // The generate pages and the catalog sit under /licenses/* but are matched exactly, so
  // the register at /licenses is unaffected by their order here.
  {
    path: 'licenses/catalog',
    title: 'License catalog · License Management',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/licenses/catalog/catalog').then((m) => m.LicenseCatalogPage),
  },
  {
    path: 'licenses/machine',
    title: 'Machine license · License Management',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/licenses/generate/machine-license').then((m) => m.MachineLicense),
  },
  {
    path: 'licenses/robot',
    title: 'Robot license · License Management',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/licenses/generate/robot-license').then((m) => m.RobotLicense),
  },
  {
    path: 'licenses/gateway',
    title: 'Gateway license · License Management',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/licenses/generate/gateway-license').then((m) => m.GatewayLicense),
  },
  {
    path: 'licenses',
    title: 'Licenses · License Management',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/licenses/licenses').then((m) => m.Licenses),
  },
  {
    path: 'customers',
    title: 'Customers · License Management',
    canActivate: [authGuard],
    loadComponent: () => import('./pages/customers/customers').then((m) => m.Customers),
  },
  {
    path: 'applications',
    title: 'Applications · License Management',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/applications/applications').then((m) => m.Applications),
  },
  {
    path: 'keys',
    title: 'RSA keys · License Management',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./pages/keys/keys').then((m) => m.Keys),
  },
  {
    path: 'backup',
    title: 'Backup & restore · License Management',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./pages/backup/backup').then((m) => m.Backup),
  },
  {
    path: 'users',
    title: 'Users · License Management',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./pages/users/users').then((m) => m.Users),
  },
  {
    path: 'account/password',
    title: 'Change password · License Management',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/change-password/change-password').then((m) => m.ChangePassword),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  { path: '**', redirectTo: 'dashboard' },
];
