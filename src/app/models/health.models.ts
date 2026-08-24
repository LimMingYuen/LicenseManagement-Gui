/** The three states ASP.NET Core's health-check pipeline can report. */
export type HealthReportStatus = 'Healthy' | 'Degraded' | 'Unhealthy';

export interface HealthCheckEntry {
  name: string;
  status: HealthReportStatus;
  durationMs: number;
  description: string | null;
}

/** The body of GET /api/health. Also arrives on a 503, which is how an outage reports itself. */
export interface HealthReport {
  status: HealthReportStatus;
  checkedAt: string;
  totalDurationMs: number;
  checks: HealthCheckEntry[];
}

/**
 * What the UI branches on. The split that matters is `unreachable` (nothing answered — the
 * API is down or the network is gone) versus `unhealthy` (the API answered and told us one
 * of its dependencies is broken). They need different words in front of an operator.
 */
export type BackendStatus = 'unknown' | 'online' | 'degraded' | 'unhealthy' | 'unreachable';
