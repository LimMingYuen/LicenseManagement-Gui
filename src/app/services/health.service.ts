import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { BackendStatus, HealthReport } from '../models/health.models';

export const HEALTH_URL = '/api/health';

/** Quiet cadence while everything is fine — enough to notice an outage, cheap enough to ignore. */
const POLL_WHEN_HEALTHY_MS = 30_000;

/** Once something is wrong, poll hard: the point is to clear the banner the moment it recovers. */
const POLL_WHEN_UNHEALTHY_MS = 5_000;

/**
 * One dropped probe is a hiccup — a laptop waking up, a proxy recycling. Two in a row is an
 * outage. The exception is the very first probe: at startup there is no "last known good"
 * to protect, so a failure there is reported immediately rather than after another 5s.
 */
const FAILURES_BEFORE_UNREACHABLE = 2;

/**
 * Tracks whether the API is actually there.
 *
 * Before this existed the client only found out the backend was down by having a user action
 * fail, one action at a time. This polls {@link HEALTH_URL} instead, so the answer is already
 * known when the screen renders — including on the login page, where nothing else has ever
 * called the API yet.
 *
 * The probe is not the only input: {@link reportReachable} and {@link reportUnreachable} let
 * the auth interceptor fold the outcome of every real API call into the same state, so a
 * connection refused on a save is reflected instantly rather than up to 30 seconds later.
 */
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

  /** The browser itself says there is no network. A different message than a dead API. */
  readonly isBrowserOffline = this.offline.asReadonly();

  /** The API answered the last time we asked, whatever its dependencies are doing. */
  readonly isReachable = computed(() => {
    const status = this.state();
    return status === 'online' || status === 'degraded' || status === 'unhealthy';
  });

  /**
   * The API is not usable, so the shell steps aside for the server-unavailable screen.
   * `degraded` is deliberately not included — the app still works, and the connection row
   * in the profile menu is enough to say so without taking the whole screen away.
   */
  readonly isDown = computed(() => this.state() === 'unreachable' || this.state() === 'unhealthy');

  /** The checks that are not Healthy, for the banner detail line. */
  readonly failingChecks = computed(() =>
    (this.report()?.checks ?? []).filter((check) => check.status !== 'Healthy'),
  );

  constructor() {
    // Root service, so this only fires in tests — but a timer that outlives its TestBed
    // keeps firing HTTP calls into a torn-down injector.
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  /**
   * Begins polling. Called from an app initializer rather than the constructor: the auth
   * interceptor injects this service, so a probe fired from inside the constructor would
   * re-enter a half-built instance.
   */
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

  stop(): void {
    this.started = false;
    this.clearTimer();
    window.removeEventListener('online', this.onBrowserOnline);
    window.removeEventListener('offline', this.onBrowserOffline);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
  }

  /** Probe now. Safe to call from a retry button — overlapping calls collapse into one. */
  async check(): Promise<void> {
    if (this.probing()) {
      return;
    }

    this.clearTimer();
    this.probing.set(true);

    try {
      this.applyReport(await firstValueFrom(this.http.get<HealthReport>(HEALTH_URL)));
    } catch (error) {
      // An Unhealthy report comes back as 503 with the report still in the body: the API is
      // up and telling us what is broken, which is not the same as no answer at all.
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

  /**
   * A real API call succeeded. Whatever we thought, the API is clearly there — clear the
   * banner without making the user wait for the next scheduled probe.
   */
  reportReachable(): void {
    this.failures.set(0);

    if (this.state() === 'unreachable' || this.state() === 'unknown') {
      this.state.set('online');
      this.checkedAt.set(new Date());
      this.scheduleNext();
    }
  }

  /**
   * A real API call failed at the transport layer (status 0 — refused, DNS, CORS preflight).
   * Counted like a failed probe so a single blip does not flash the banner.
   */
  reportUnreachable(): void {
    this.registerFailure();
    this.scheduleNext();
  }

  private applyReport(report: HealthReport): void {
    this.report.set(report);
    this.failures.set(0);
    this.state.set(
      report.status === 'Healthy' ? 'online' : report.status === 'Degraded' ? 'degraded' : 'unhealthy',
    );
  }

  private registerFailure(): void {
    const failures = this.failures() + 1;
    this.failures.set(failures);

    // Nothing answered, so the last report describes a world that no longer exists.
    this.report.set(null);

    if (failures >= FAILURES_BEFORE_UNREACHABLE || this.state() === 'unknown') {
      this.state.set('unreachable');
    }
  }

  private scheduleNext(): void {
    this.clearTimer();

    // Polling a backend nobody is looking at, from a tab nobody is looking at, is pure noise.
    // The visibilitychange handler probes again the moment the tab comes back.
    if (!this.started || document.hidden) {
      return;
    }

    const delay = this.state() === 'online' ? POLL_WHEN_HEALTHY_MS : POLL_WHEN_UNHEALTHY_MS;
    this.timer = setTimeout(() => void this.check(), delay);
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private readonly onBrowserOnline = (): void => {
    this.offline.set(false);
    void this.check();
  };

  private readonly onBrowserOffline = (): void => {
    this.offline.set(true);
    // No point probing through a network the browser knows is gone; say so directly.
    this.clearTimer();
    this.failures.set(FAILURES_BEFORE_UNREACHABLE);
    this.report.set(null);
    this.state.set('unreachable');
  };

  private readonly onVisibilityChange = (): void => {
    if (!document.hidden) {
      void this.check();
    }
  };
}
