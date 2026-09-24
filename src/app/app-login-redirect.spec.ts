import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { authGuard, guestGuard } from './guards/auth.guard';
import { AuthService } from './services/auth.service';
import { HealthService } from './services/health.service';
import { CurrentUser } from './models/user.models';

/** Stands in for the login page. */
@Component({ selector: 'app-login-stub', template: 'login' })
class LoginStub {}

/** Stands in for a guarded page. */
@Component({ selector: 'app-page-stub', template: 'page' })
class PageStub {}

const admin: CurrentUser = {
  id: 1,
  username: 'admin',
  fullName: 'Default Admin',
  roleId: 1,
  role: 'SuperAdmin',
  isActive: true,
  createdAt: '2026-08-01T00:00:00Z',
  lastLoginAt: null,
  allowedPages: [],
};

/** Covers a signed-in user arriving at, or stranded on, the login route. */
describe('App · a signed-in user on the login route', () => {
  let fixture: ComponentFixture<App>;
  let router: Router;
  let auth: AuthService;
  let http: HttpTestingController;

  function shell() {
    const element = fixture.nativeElement as HTMLElement;
    return {
      sidebar: element.querySelector('app-sidebar'),
      login: element.querySelector('app-login-stub'),
    };
  }

  beforeEach(async () => {
    sessionStorage.setItem('lm.credentials', btoa('admin:secret'));

    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter([
          { path: 'login', canActivate: [guestGuard], component: LoginStub },
          { path: 'dashboard', canActivate: [authGuard], component: PageStub },
          { path: 'licenses', canActivate: [authGuard], component: PageStub },
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.inject(HealthService).stop();
    sessionStorage.clear();
    http.match('/api/pages/sync').forEach((request) => request.flush(null));
    http.verify();
  });

  it('redirects to the return URL when the session was restored before the router moved', async () => {
    const restored = auth.restoreSession();
    http.expectOne('/api/auth/me').flush(admin);
    await restored;

    await fixture.whenStable();
    await router.navigateByUrl('/login?returnUrl=%2Flicenses');
    await fixture.whenStable();

    expect(router.url).toBe('/licenses');
    expect(shell().login).toBeNull();
    expect(shell().sidebar).not.toBeNull();
  });

  it('leaves /login once the credentials are verified again after an outage', async () => {
    await fixture.whenStable();
    http.expectOne('/api/auth/me').flush(null, { status: 502, statusText: 'Bad Gateway' });

    await router.navigateByUrl('/login?returnUrl=%2Flicenses');
    await fixture.whenStable();

    expect(router.url).toBe('/login?returnUrl=%2Flicenses');
    expect(shell().sidebar).toBeNull();
    expect(shell().login).not.toBeNull();

    const restored = auth.restoreSession();
    http.expectOne('/api/auth/me').flush(admin);
    await restored;
    await fixture.whenStable();

    expect(router.url).toBe('/licenses');
    expect(shell().login).toBeNull();
    expect(shell().sidebar).not.toBeNull();
  });

  it('sends a signed-in user to the dashboard when the return URL points off-origin', async () => {
    const restored = auth.restoreSession();
    http.expectOne('/api/auth/me').flush(admin);
    await restored;

    await fixture.whenStable();
    await router.navigateByUrl('/login?returnUrl=%2F%2Fevil.example');
    await fixture.whenStable();

    expect(router.url).toBe('/dashboard');
  });
});
