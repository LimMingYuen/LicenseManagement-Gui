import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { App } from './app';
import { authGuard, guestGuard } from './guards/auth.guard';
import { AuthService } from './services/auth.service';
import { HealthService } from './services/health.service';
import { User } from './models/user.models';

@Component({ selector: 'app-login-stub', template: 'login' })
class LoginStub {}

@Component({ selector: 'app-page-stub', template: 'page' })
class PageStub {}

const admin: User = {
  id: 1,
  username: 'admin',
  fullName: 'Default Admin',
  role: 'SuperAdmin',
  isActive: true,
  createdAt: '2026-08-01T00:00:00Z',
  lastLoginAt: null,
};

/**
 * The login page inside the signed-in shell — sidebar, avatar, nav rail, and a sign-in form
 * in the middle of it. Both routes into that state are covered here: arriving at /login with
 * a session already restored, and the session coming back while the user is parked there
 * after an outage.
 */
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
    // Written before anything injects AuthService: it reads the store once, on construction.
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
    http.verify();
  });

  it('redirects to the return URL when the session was restored before the router moved', async () => {
    // The order production runs in, and the one the old redirect could not survive: the
    // session is verified by an app initializer, the shell's first change detection happens
    // next (Router.url is still '/'), and only then does the router reach /login.
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
    // The API is down, so the stored credentials cannot be checked and the guard parks the
    // browser on /login. Nothing has rejected them — the session is unverified, not gone.
    await fixture.whenStable();
    http.expectOne('/api/auth/me').flush(null, { status: 502, statusText: 'Bad Gateway' });

    await router.navigateByUrl('/login?returnUrl=%2Flicenses');
    await fixture.whenStable();

    expect(router.url).toBe('/login?returnUrl=%2Flicenses');
    expect(shell().sidebar).toBeNull();
    expect(shell().login).not.toBeNull();

    // The API answers again and the session comes back underneath a route that no guard is
    // going to re-run. The shell has to notice on its own.
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
