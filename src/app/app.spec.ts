import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { HealthReport } from './models/health.models';
import { HEALTH_URL, HealthService } from './services/health.service';

const healthy: HealthReport = {
  status: 'Healthy',
  checkedAt: '2026-08-24T10:00:00Z',
  totalDurationMs: 4,
  checks: [{ name: 'database', status: 'Healthy', durationMs: 4, description: 'ok' }],
};

describe('App', () => {
  let fixture: ComponentFixture<App>;
  let health: HealthService;
  let http: HttpTestingController;

  /** Drives one probe to completion and lets the shell re-render off the result. */
  async function settleProbe(respond: (request: ReturnType<HttpTestingController['expectOne']>) => void) {
    const probe = health.check();
    respond(http.expectOne(HEALTH_URL));
    await probe;
    await fixture.whenStable();
  }

  function shell() {
    const element = fixture.nativeElement as HTMLElement;
    return {
      serverUnavailable: element.querySelector('app-server-unavailable'),
      sidebar: element.querySelector('app-sidebar'),
      outlet: element.querySelector('router-outlet'),
    };
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(App);
    health = TestBed.inject(HealthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    health.stop();
    http.verify();
  });

  it('should create the app', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should not show the sidebar shell while signed out', async () => {
    await fixture.whenStable();
    expect(shell().sidebar).toBeNull();
  });

  it('renders the signed-out shell while the API is healthy', async () => {
    await settleProbe((request) => request.flush(healthy));

    expect(shell().serverUnavailable).toBeNull();
    expect(shell().outlet).not.toBeNull();
  });

  it('replaces the whole shell when the API cannot be reached', async () => {
    await settleProbe((request) => request.error(new ProgressEvent('error'), { status: 0 }));

    expect(shell().serverUnavailable).not.toBeNull();
    expect(shell().sidebar).toBeNull();
    expect(shell().outlet).toBeNull();
  });

  it('blocks the shell when the API is up but a dependency it needs is down', async () => {
    await settleProbe((request) =>
      request.flush(
        { ...healthy, status: 'Unhealthy' },
        { status: 503, statusText: 'Service Unavailable' },
      ),
    );

    expect(shell().serverUnavailable).not.toBeNull();
  });

  it('gives the shell back on its own once the API recovers', async () => {
    await settleProbe((request) => request.error(new ProgressEvent('error'), { status: 0 }));
    expect(shell().serverUnavailable).not.toBeNull();

    await settleProbe((request) => request.flush(healthy));

    expect(shell().serverUnavailable).toBeNull();
    expect(shell().outlet).not.toBeNull();
  });
});
