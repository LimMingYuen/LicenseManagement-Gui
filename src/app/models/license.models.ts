/** What a license binds to. Mirrors the API's LicenseRecordType. */
export type LicenseKind = 'Machine' | 'Robot' | 'Gateway';

/**
 * The stable key of a product family, e.g. "QES-KUKA-AMR".
 *
 * A plain string rather than a union: applications are rows in the database now, created
 * and named from the Applications page, so the set is not knowable at compile time.
 */
export type LicenseApplicationKey = string;

/** Commercial tier. Robot licenses have no trial. */
export type LicenseTier = 'PERPETUAL' | 'SUBSCRIPTION' | 'TRIAL';

/**
 * Lifecycle state, computed server-side so the register and the dashboard cannot
 * disagree about what "expiring" means.
 */
export type LicenseStatus = 'Active' | 'Expiring' | 'Expired' | 'Revoked';

export interface License {
  id: number;
  /** The GUID inside the signed payload; stable across export/import. */
  licenseId: string;
  type: LicenseKind;
  /** The product family this license was issued under. Stored, not derived from . */
  applicationId: number;
  application: LicenseApplicationKey;
  applicationName: string;
  /** Machine ID, robot ID or device ID depending on `type`. */
  targetId: string;
  /**
   * The machine this license hangs off in the catalog. Required for Robot licenses and
   * part of their signed payload; optional and registry-only for Gateway licenses; always
   * null for Machine licenses, which are their own machine (see `targetId`).
   */
  machineId: string | null;
  /**
   * The customer row this license belongs to. Null for rows that predate the customer
   * register or arrived through a desktop backup import.
   */
  customerId: number | null;
  /** The linked customer's current name, or the name frozen into the record when unlinked. */
  customerName: string;
  licenseType: LicenseTier;
  status: LicenseStatus;
  issuedAt: string;
  /** Null means perpetual. */
  expiresAt: string | null;
  notes: string | null;
  isRevoked: boolean;
  revokedAt: string | null;
  revokedReason: string | null;
  createdAt: string;
  createdBy: string | null;
}

/** A license plus its signed file — returned by generate, and by the detail fetch. */
export interface LicenseWithFile {
  license: License;
  licenseFileContent: string;
  fileName: string;
}

export interface LicenseSummary {
  total: number;
  machineCount: number;
  robotCount: number;
  gatewayCount: number;
  activeCount: number;
  expiringCount: number;
  expiredCount: number;
  revokedCount: number;
  recent: License[];
  expiringSoon: License[];
}

/** Fields every generate form collects. */
interface GenerateBase {
  /** The application to issue under. Must be one that supports this license type. */
  applicationId: number;
  /** The customer to issue against. The portal always sends this rather than a name. */
  customerId: number;
  licenseType: LicenseTier;
  /** Required unless the tier is PERPETUAL. */
  expiresAt: string | null;
  notes: string | null;
}

export interface GenerateMachineRequest extends GenerateBase {
  machineId: string;
}

export interface GenerateRobotRequest extends GenerateBase {
  robotId: string;
  machineId: string;
}

export interface GenerateGatewayRequest extends GenerateBase {
  deviceId: string;
  /**
   * Optional machine the device is sited against. Groups the license in the catalog and
   * is deliberately not written into the signed payload.
   */
  machineId: string | null;
}

export interface LicenseListQuery {
  search?: string;
  type?: LicenseKind;
  status?: LicenseStatus;
  application?: LicenseApplicationKey;
}

// ---- Catalog: Application -> Customer -> Machine -> licenses ---------------------------

/** Status tally for one node of the catalog. Rolls up from the leaves. */
export interface CatalogCounts {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  revoked: number;
}

/** Level 3. Every license bound to one machine. */
export interface MachineNode {
  /** The machine ID, or a placeholder label when `isUnassigned`. */
  machineId: string;
  /** True for the bucket holding licenses that name no machine. */
  isUnassigned: boolean;
  /**
   * True when robots or gateways point at this machine but no machine license was ever
   * issued for it — a binding that is only a typed-in string.
   */
  isOrphaned: boolean;
  /** Machine license first, then robots, then gateways. */
  licenses: License[];
  counts: CatalogCounts;
}

/** Level 2. One customer's machines within one application. */
export interface CustomerNode {
  /** Null for licenses that predate the customer register; those get no manage link. */
  customerId: number | null;
  customerName: string;
  machines: MachineNode[];
  counts: CatalogCounts;
}

/** Level 1. One product family. Present even when it holds no licenses. */
export interface ApplicationNode {
  id: number;
  key: LicenseApplicationKey;
  name: string;
  icon: string;
  customers: CustomerNode[];
  counts: CatalogCounts;
}

export interface LicenseCatalog {
  applications: ApplicationNode[];
  totals: CatalogCounts;
}
