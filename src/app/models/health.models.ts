/** The three states ASP.NET Core's health-check pipeline can report. */
export type HealthReportStatus = 'Healthy' | 'Degraded' | 'Unhealthy';

export interface HealthCheckEntry {
  name: string;
  status: HealthReportStatus;
  durationMs: number;
  description: string | null;
}

/** Response body of GET /api/health. */
export interface HealthReport {
  status: HealthReportStatus;
  checkedAt: string;
  totalDurationMs: number;
  checks: HealthCheckEntry[];
}

/** Backend connection state the UI branches on. */
export type BackendStatus = 'unknown' | 'online' | 'degraded' | 'unhealthy' | 'unreachable';
