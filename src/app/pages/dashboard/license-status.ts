import { License, LicenseKind, LicenseStatus } from '../../models/license.models';

/** Number of licenses in each status. */
export interface StatusCounts {
  total: number;
  active: number;
  expiring: number;
  expired: number;
}

/** Status counts for one license type. */
export interface TypeStatus {
  type: LicenseKind;
  counts: StatusCounts;
}

const LICENSE_KINDS: LicenseKind[] = ['Machine', 'Robot', 'Gateway'];

const DAY_MS = 86_400_000;

/** Tallies licenses by status. */
export function countStatuses(licenses: readonly License[]): StatusCounts {
  const counts: StatusCounts = { total: licenses.length, active: 0, expiring: 0, expired: 0 };
  for (const license of licenses) {
    if (license.status === 'Active') counts.active++;
    else if (license.status === 'Expiring') counts.expiring++;
    else counts.expired++;
  }
  return counts;
}

/** Tallies licenses by status for every license type. */
export function countByType(licenses: readonly License[]): TypeStatus[] {
  return LICENSE_KINDS.map((type) => ({
    type,
    counts: countStatuses(licenses.filter((l) => l.type === type)),
  }));
}

/** Returns expiring and expired licenses, soonest expiry first. */
export function needingAttention(licenses: readonly License[]): License[] {
  return licenses
    .filter((l) => l.status !== 'Active')
    .sort((a, b) => expiryTime(a) - expiryTime(b));
}

/** Returns licenses with the given status, or all of them, newest first. */
export function filterByStatus(
  licenses: readonly License[],
  status: LicenseStatus | null,
): License[] {
  return licenses
    .filter((l) => status === null || l.status === status)
    .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime());
}

/** Returns a part of a total as a whole percentage. */
export function percentOf(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}

/** Describes how long until, or since, a license expires. */
export function expiryLabel(expiresAt: string | null, now: number = Date.now()): string {
  if (!expiresAt) return 'Perpetual';

  const days = Math.ceil((new Date(expiresAt).getTime() - now) / DAY_MS);
  if (days > 1) return `${days} days left`;
  if (days === 1) return '1 day left';
  if (days === 0) return 'Expires today';
  return days === -1 ? 'Expired 1 day ago' : `Expired ${-days} days ago`;
}

/** Returns a license's expiry as epoch milliseconds, treating perpetual as last. */
function expiryTime(license: License): number {
  return license.expiresAt ? new Date(license.expiresAt).getTime() : Number.POSITIVE_INFINITY;
}
