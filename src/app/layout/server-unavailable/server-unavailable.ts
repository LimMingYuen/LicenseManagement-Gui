import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { HealthService } from '../../services/health.service';
import { AppLogoComponent } from '../../shared/components/app-logo/app-logo';

/** Full-screen fallback shown while the API is unreachable or unhealthy. */
@Component({
  selector: 'app-server-unavailable',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule, AppLogoComponent],
  templateUrl: './server-unavailable.html',
  styleUrl: './server-unavailable.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerUnavailable {
  private readonly health = inject(HealthService);

  protected readonly isRetrying = this.health.isChecking;

  protected readonly icon = computed(() => {
    if (this.health.isBrowserOffline()) {
      return 'wifi_off';
    }
    return this.health.status() === 'unhealthy' ? 'error_outline' : 'cloud_off';
  });

  protected readonly title = computed(() => {
    if (this.health.isBrowserOffline()) {
      return 'You are offline';
    }
    return this.health.status() === 'unhealthy'
      ? 'The server is running with a fault'
      : 'Cannot reach the server';
  });

  protected readonly detail = computed(() => {
    if (this.health.isBrowserOffline()) {
      return 'This device has lost its network connection. The app will return on its own once the connection is back.';
    }

    if (this.health.status() === 'unhealthy') {
      return 'The License Management API answered, but a service it depends on is unavailable. Licenses cannot be issued or saved until it recovers.';
    }

    return 'The License Management API is not responding. It may be starting up, stopped, or blocked by the network.';
  });

  /** Failing health checks reported by the server. */
  protected readonly failures = computed(() =>
    this.health
      .failingChecks()
      .map((check) => check.description?.trim() || `${check.name}: ${check.status}`),
  );

  protected readonly lastCheckedLabel = computed(() => {
    const checkedAt = this.health.lastCheckedAt();
    return checkedAt ? `Last checked at ${checkedAt.toLocaleTimeString()}` : '';
  });

  /** Runs a health check immediately. */
  protected retry(): void {
    void this.health.check();
  }
}
