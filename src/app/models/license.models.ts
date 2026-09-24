/** What a license binds to. Mirrors the API's LicenseRecordType. */
export type LicenseKind = 'Machine' | 'Robot' | 'Gateway';

/** Stable key of a product family, e.g. "QES-KUKA-AMR". */
export type LicenseApplicationKey = string;

/** Commercial tier. Robot licenses have no trial. */
export type LicenseTier = 'PERPETUAL' | 'SUBSCRIPTION' | 'TRIAL';

/** Lifecycle state, computed by the server. */
export type LicenseStatus = 'Active' | 'Expiring' | 'Expired' | 'Revoked';

export interface License {
  id: number;
  /** GUID inside the signed payload. */
  licenseId: string;
  type: LicenseKind;
  /** Product family the license was issued under. */
  applicationId: number;
  application: LicenseApplicationKey;
  applicationName: string;
  /** Machine ID, robot ID or device ID depending on `type`. */
  targetId: string;
  /** Machine the license belongs to in the catalog; null for Machine licenses. */
  machineId: string | null;
  /** Machine register row the license is linked to; null for unattached desktop imports. */
  machineRefId: number | null;
  /** Human-readable machine label, if set. */
  machineName: string | null;
  /** Owning customer row; null for legacy or desktop-imported records. */
  customerId: number | null;
  /** Linked customer's current name, or the stored name when unlinked. */
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

/** A license together with its signed file. */
export interface LicenseWithFile {
  license: License;
  licenseFileContent: string;
  fileName: string;
}

/** Dashboard counts and recent licenses. */
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
  /** Application to issue under; must support this license type. */
  applicationId: number;
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
  /** Optional machine for catalog grouping; not part of the signed payload. */
  machineId: string | null;
}

export interface LicenseListQuery {
  search?: string;
  type?: LicenseKind;
  status?: LicenseStatus;
  application?: LicenseApplicationKey;
}

// ---- Catalog: Application -> Customer -> Machine -> licenses ---------------------------

/** Status tally for one catalog node, rolled up from its licenses. */
export interface CatalogCounts {
  total: number;
  active: number;
  expiring: number;
  expired: number;
  revoked: number;
}

/** Catalog level 3: every license bound to one machine. */
export interface MachineNode {
  /** Machine ID, or a placeholder label when `isUnassigned`. */
  machineId: string;
  /** Machine register row; null for the unassigned bucket and desktop imports. */
  machineRefId: number | null;
  /** Human-readable machine label, if set. */
  name: string | null;
  /** True for the bucket holding licenses that name no machine. */
  isUnassigned: boolean;
  /** True when robots or gateways reference this machine but it has no machine license. */
  isOrphaned: boolean;
  /** Machine license first, then robots, then gateways. */
  licenses: License[];
  counts: CatalogCounts;
}

/** Catalog level 2: one customer's machines within one application. */
export interface CustomerNode {
  /** Null for licenses that predate the customer register. */
  customerId: number | null;
  customerName: string;
  machines: MachineNode[];
  counts: CatalogCounts;
}

/** Catalog level 1: one product family, present even without licenses. */
export interface ApplicationNode {
  id: number;
  key: LicenseApplicationKey;
  name: string;
  customers: CustomerNode[];
  counts: CatalogCounts;
}

export interface LicenseCatalog {
  applications: ApplicationNode[];
  totals: CatalogCounts;
}
