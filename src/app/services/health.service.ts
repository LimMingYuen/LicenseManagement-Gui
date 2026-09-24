import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BackendStatus, HealthReport } from '../models/health.models';

export const HEALTH_URL = '/api/health';

/** Poll interval while the API is online. */
const POLL_WHEN_HEALTHY_MS = 30_000;

/** Poll interval while the API is down or degraded. */
const POLL_WHEN_UNHEALTHY_MS = 5_000;

/** Consecutive failures after startup before the API is reported unreachable. */
const FAILURES_BEFORE_UNREACHABLE = 2;

/** Tracks API reachability by polling the health endpoint and observing real API calls. */
@Injectable({ providedIn: 'root' })
export class HealthService {
  private readonly http = inject(HttpClient);

  private readonly state = signal<BackendStatus>('unknown');
  private readonly report = signal<HealthReport | null>(null);
  private readonly checkedAt = signal<Date | null>(null);
  private readonly probing = signal(false);
  private readonly offline = signal(!navigator.onLine);

  private readonly failures = signal(0);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private started = false;

  readonly status = this.state.asReadonly();
  readonly lastReport = this.report.asReadonly();
  readonly lastCheckedAt = this.checkedAt.asReadonly();
  readonly isChecking = this.probing.asReadonly();

  readonly isBrowserOffline = this.offline.asReadonly();

  /** The API answered the last request, regardless of its dependencies. */
  readonly isReachable = computed(() => {
    const status = this.state();
    return status === 'online' || status === 'degraded' || status === 'unhealthy';
  });

  /** The API is unusable and the server-unavailable screen replaces the shell. */
  readonly isDown = computed(() => this.state() === 'unreachable' || this.state() === 'unhealthy');

  /** Health checks in the last report that are not Healthy. */
  readonly failingChecks = computed(() =>
    (this.report()?.checks ?? []).filter((check) => check.status !== 'Healthy'),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /** Starts polling and listening for network and visibility changes. */
  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;

    window.addEventListener('online', this.onBrowserOnline);
    window.addEventListener('offline', this.onBrowserOffline);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    void this.check();
  }

  /** Stops polling and removes the event listeners. */
  stop(): void {
    this.started = false;
    this.clearTimer();
    window.removeEventListener('online', this.onBrowserOnline);
    window.removeEventListener('offline', this.onBrowserOffline);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Probes the health endpoint now unless a probe is already running. */
  async check(): Promise<void> {
    if (this.probing()) {
      return;
    }

    this.clearTimer();
    this.probing.set(true);

    try {
      this.applyReport(await firstValueFrom(this.http.get<HealthReport>(HEALTH_URL)));
    } catch (error) {
      const body = error instanceof HttpErrorResponse ? (error.error as HealthReport | null) : null;

      if (body && typeof body === 'object' && typeof body.status === 'string') {
        this.applyReport(body);
      } else {
        this.registerFailure();
      }
    } finally {
      this.probing.set(false);
      this.checkedAt.set(new Date());
      this.scheduleNext();
    }
  }

  /** Records that a real API call reached the server. */
  reportReachable(): void {
    this.failures.set(0);

    if (this.state() === 'unreachable' || this.state() === 'unknown') {
      this.state.set('online');
      this.checkedAt.set(new Date());
      this.scheduleNext();
    }
  }

  /** Records that a real API call failed at the transport layer. */
  reportUnreachable(): void {
    this.registerFailure();
    this.scheduleNext();
  }

  /** Stores a health report and derives the backend status from it. */
  private applyReport(report: HealthReport): void {
    this.report.set(report);
    this.failures.set(0);
    this.state.set(
      report.status === 'Healthy' ? 'online' : report.status === 'Degraded' ? 'degraded' : 'unhealthy',
    );
  }

  /** Counts a failed probe or call and marks the API unreachable at the threshold. */
  private registerFailure(): void {
    const failures = this.failures() + 1;
    this.failures.set(failures);

    this.report.set(null);

    if (failures >= FAILURES_BEFORE_UNREACHABLE || this.state() === 'unknown') {
      this.state.set('unreachable');
    }
  }

  /** Schedules the next probe based on the current status. */
  private scheduleNext(): void {
    this.clearTimer();

    if (!this.started || document.hidden) {
      return;
    }

    const delay = this.state() === 'online' ? POLL_WHEN_HEALTHY_MS : POLL_WHEN_UNHEALTHY_MS;
    this.timer = setTimeout(() => void this.check(), delay);
  }

  /** Cancels the pending probe timer. */
  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  /** Probes as soon as the browser regains network access. */
  private readonly onBrowserOnline = (): void => {
    this.offline.set(false);
    void this.check();
  };

  /** Marks the API unreachable as soon as the browser loses network access. */
  private readonly onBrowserOffline = (): void => {
    this.offline.set(true);
    this.clearTimer();
    this.failures.set(FAILURES_BEFORE_UNREACHABLE);
    this.report.set(null);
    this.state.set('unreachable');
  };

  /** Probes when the tab becomes visible again. */
  private readonly onVisibilityChange = (): void => {
    if (!document.hidden) {
      void this.check();
    }
  };
}
