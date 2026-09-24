import { LicenseKind } from './license.models';

/** A product family that licenses are issued under. */
export interface Application {
  id: number;
  /** Stable identifier, e.g. "QES-KUKA-AMR", fixed at creation. */
  key: string;
  name: string;
  supportsMachine: boolean;
  supportsRobot: boolean;
  supportsGateway: boolean;
  isActive: boolean;
  /** Number of licenses issued under this application. */
  licenseCount: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
}

export interface CreateApplicationRequest {
  key: string;
  name: string;
  supportsMachine: boolean;
  supportsRobot: boolean;
  supportsGateway: boolean;
  isActive: boolean;
}

/** Application update payload; the key cannot be changed. */
export type UpdateApplicationRequest = Omit<CreateApplicationRequest, 'key'>;

/** Returns whether an application may issue the given payload type. */
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

/** Returns the payload types an application issues. */
export function supportedKinds(application: Application): LicenseKind[] {
  const kinds: LicenseKind[] = [];

  if (application.supportsMachine) kinds.push('Machine');
  if (application.supportsRobot) kinds.push('Robot');
  if (application.supportsGateway) kinds.push('Gateway');

  return kinds;
}
