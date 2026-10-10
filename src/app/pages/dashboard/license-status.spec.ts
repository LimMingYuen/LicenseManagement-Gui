import { describe, expect, it } from 'vitest';
import { License } from '../../models/license.models';
import {
  countByType,
  countStatuses,
  expiryLabel,
  filterByStatus,
  needingAttention,
  percentOf,
} from './license-status';

/** Builds a license with only the fields these helpers read. */
function license(overrides: Partial<License>): License {
  return {
    id: 1,
    licenseId: 'guid',
    type: 'Machine',
    applicationId: 1,
    application: 'QES-KUKA-AMR',
    applicationName: 'QES KUKA AMR',
    targetId: 'M1',
    machineId: null,
    machineRefId: null,
    machineName: null,
    customerId: 1,
    customerName: 'Customer',
    licenseType: 'SUBSCRIPTION',
    status: 'Active',
    issuedAt: '2026-01-01T00:00:00Z',
    expiresAt: null,
    notes: null,
    createdAt: '2026-01-01T00:00:00Z',
    createdBy: null,
    ...overrides,
  };
}

describe('license-status', () => {
  const licenses = [
    license({ id: 1, status: 'Active', type: 'Machine' }),
    license({ id: 2, status: 'Expiring', type: 'Robot', expiresAt: '2026-02-10T00:00:00Z' }),
    license({ id: 3, status: 'Expired', type: 'Robot', expiresAt: '2026-01-05T00:00:00Z' }),
    license({ id: 4, status: 'Active', type: 'Gateway', issuedAt: '2026-03-01T00:00:00Z' }),
  ];

  it('counts licenses by status', () => {
    expect(countStatuses(licenses)).toEqual({ total: 4, active: 2, expiring: 1, expired: 1 });
  });

  it('counts every type, including types with no licenses', () => {
    const byType = countByType(licenses.filter((l) => l.type !== 'Gateway'));
    expect(byType.map((t) => t.type)).toEqual(['Machine', 'Robot', 'Gateway']);
    expect(byType[1].counts).toEqual({ total: 2, active: 0, expiring: 1, expired: 1 });
    expect(byType[2].counts.total).toBe(0);
  });

  it('lists expiring and expired licenses by soonest expiry', () => {
    expect(needingAttention(licenses).map((l) => l.id)).toEqual([3, 2]);
  });

  it('filters by status and sorts newest first', () => {
    expect(filterByStatus(licenses, 'Active').map((l) => l.id)).toEqual([4, 1]);
    expect(filterByStatus(licenses, null)).toHaveLength(4);
  });

  it('rounds percentages and handles an empty total', () => {
    expect(percentOf(1, 3)).toBe(33);
    expect(percentOf(0, 0)).toBe(0);
  });

  it('describes the time to expiry', () => {
    const now = new Date('2026-01-10T12:00:00Z').getTime();
    expect(expiryLabel(null, now)).toBe('Perpetual');
    expect(expiryLabel('2026-01-15T12:00:00Z', now)).toBe('5 days left');
    expect(expiryLabel('2026-01-11T00:00:00Z', now)).toBe('1 day left');
    expect(expiryLabel('2026-01-08T12:00:00Z', now)).toBe('Expired 2 days ago');
  });
});
