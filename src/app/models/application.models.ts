import { LicenseKind } from './license.models';

/**
 * A product family licenses are issued under — the top level of the catalog.
 *
 * Applications used to be two hardcoded records in C#, with the one a license belonged to
 * derived from its payload type. They are rows now, and each declares which payload types
 * it can issue: an application that does not support robots never appears on the robot
 * generate form.
 */
export interface Application {
  id: number;
  /** Stable identifier used in API filters, e.g. "QES-KUKA-AMR". Fixed at creation. */
  key: string;
  name: string;
  /** Material icon name shown against the application in the catalog. */
  icon: string;
  description: string | null;
  supportsMachine: boolean;
  supportsRobot: boolean;
  supportsGateway: boolean;
  /** Catalog display order; ties break on name. */
  sortOrder: number;
  isActive: boolean;
  /** How many licenses were issued under it. Zero is the only deletable state. */
  licenseCount: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
}

export interface CreateApplicationRequest {
  key: string;
  name: string;
  icon: string;
  description: string | null;
  supportsMachine: boolean;
  supportsRobot: boolean;
  supportsGateway: boolean;
  sortOrder: number;
  isActive: boolean;
}

/** The key is absent: it is the identifier saved links quote, so it is fixed at creation. */
export type UpdateApplicationRequest = Omit<CreateApplicationRequest, 'key'>;

/** Whether an application may issue a given payload type. */
export function supportsKind(application: Application, kind: LicenseKind): boolean {
  switch (kind) {
    case 'Machine':
      return application.supportsMachine;
    case 'Robot':
      return application.supportsRobot;
    case 'Gateway':
      return application.supportsGateway;
  }
}

/** The payload types an application issues, for display. */
export function supportedKinds(application: Application): LicenseKind[] {
  const kinds: LicenseKind[] = [];

  if (application.supportsMachine) kinds.push('Machine');
  if (application.supportsRobot) kinds.push('Robot');
  if (application.supportsGateway) kinds.push('Gateway');

  return kinds;
}
