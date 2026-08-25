import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import {
  MAT_FORM_FIELD_DEFAULT_OPTIONS,
  MatFormFieldDefaultOptions,
} from '@angular/material/form-field';
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';
import { HealthService } from './services/health.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),

    // Revalidate stored Basic credentials before the first route activates,
    // so guards never see a half-restored session after a page reload.
    provideAppInitializer(() => inject(AuthService).restoreSession()),

    // Start watching the API. Not awaited: a dead backend must not hold the app at a blank
    // screen — the whole point is to render the login page and say the server is down.
    // Started here rather than in the service constructor because the auth interceptor
    // injects it, and a probe fired during construction would re-enter a half-built service.
    provideAppInitializer(() => void inject(HealthService).start()),

    // Every form field in the app is outlined, and reserves subscript space only when it
    // actually carries a hint or an error. Set once here rather than repeated as an
    // attribute on each of the fields across the dialogs and pages.
    {
      provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
      useValue: {
        appearance: 'outline',
        subscriptSizing: 'dynamic',
      } satisfies MatFormFieldDefaultOptions,
    },

    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: { verticalPosition: 'top', horizontalPosition: 'center' },
    },
  ],
};
