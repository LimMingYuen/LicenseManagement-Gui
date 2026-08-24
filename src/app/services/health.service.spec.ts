import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { HealthReport } from '../models/health.models';
import { HEALTH_URL, HealthService } from './health.service';

const healthy: HealthReport = {
  status: 'Healthy',
  checkedAt: '2026-08-24T10:00:00Z',
  totalDurationMs: 4,
  checks: [{ name: 'database', status: 'Healthy', durationMs: 4, description: 'ok' }],
};

describe('HealthService', () => {
  let service: HealthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(HealthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.stop();
    http.verify();
  });

  it('starts out unknown, so the banner stays quiet until there is something to report', () => {
    expect(service.status()).toBe('unknown');
  });

  it('reports online once the API answers healthy', async () => {
    const probe = service.check();
    http.expectOne(HEALTH_URL).flush(healthy);
    await probe;

    expect(service.status()).toBe('online');
    expect(service.lastReport()?.checks[0].name).toBe('database');
  });

  it('reads the report out of a 503 rather than calling the API unreachable', async () => {
    const unhealthy: HealthReport = {
      ...healthy,
      status: 'Unhealthy',
      checks: [
        { name: 'database', status: 'Unhealthy', durationMs: 5001, description: 'The license database refused the connection.' },
      ],
    };

    const probe = service.check();
    http.expectOne(HEALTH_URL).flush(unhealthy, { status: 503, statusText: 'Service Unavailable' });
    await probe;

    // The API answered — it is up, its database is not. Those need different words.
    expect(service.status()).toBe('unhealthy');
    expect(service.failingChecks()).toHaveLength(1);
  });

  it('goes unreachable on the first failure, when there is no known-good state to protect', async () => {
    const probe = service.check();
    http.expectOne(HEALTH_URL).error(new ProgressEvent('error'), { status: 0 });
    await probe;

    expect(service.status()).toBe('unreachable');
    expect(service.lastReport()).toBeNull();
  });

  it('does not drop a healthy session on a single failed probe', async () => {
    const first = service.check();
    http.expectOne(HEALTH_URL).flush(healthy);
    await first;

    const second = service.check();
    http.expectOne(HEALTH_URL).error(new ProgressEvent('error'), { status: 0 });
    await second;

    expect(service.status()).toBe('online');

    const third = service.check();
    http.expectOne(HEALTH_URL).error(new ProgressEvent('error'), { status: 0 });
    await third;

    expect(service.status()).toBe('unreachable');
  });

  it('clears an outage as soon as a real API call gets through', async () => {
    const probe = service.check();
    http.expectOne(HEALTH_URL).error(new ProgressEvent('error'), { status: 0 });
    await probe;
    expect(service.status()).toBe('unreachable');

    service.reportReachable();

    expect(service.status()).toBe('online');
  });

  it('needs two transport failures from real calls before it declares an outage', async () => {
    const probe = service.check();
    http.expectOne(HEALTH_URL).flush(healthy);
    await probe;

    service.reportUnreachable();
    expect(service.status()).toBe('online');

    service.reportUnreachable();
    expect(service.status()).toBe('unreachable');
  });
});
