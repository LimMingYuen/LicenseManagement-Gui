/**
 * The machine register - the middle level of customer -> machine -> robot.
 *
 * A machine used to exist only as a string repeated on every license that named it, so the
 * link between a robot license and its machine was a coincidence of spelling: a typo produced
 * a robot bound to a machine that did not exist, and nothing stopped a robot being issued
 * against another customer's machine. It is a row now, owned by exactly one customer.
 *
 * The identifier inside a signed license file is untouched by this. `machineId` here is the
 * same normalised string, and the row is only how the registry groups what was signed.
 */
export interface Machine {
  id: number;
  /** Stored with dashes stripped, so MACHINE-001 and MACHINE001 are one machine. */
  machineId: string;
  customerId: number;
  customerName: string;
  /** Optional human label, e.g. "Line 3 palletiser". Null until someone sets one. */
  name: string | null;
  notes: string | null;
  isActive: boolean;
  /**
   * True once a machine license has been issued for it and not revoked. A robot can only be
   * licensed onto a machine that has one, so the robot form filters on it.
   */
  hasMachineLicense: boolean;
  licenseCount: number;
  robotCount: number;
  gatewayCount: number;
  createdAt: string;
  createdBy: string | null;
}

export interface CreateMachineRequest {
  machineId: string;
  customerId: number;
  name: string | null;
  notes: string | null;
  isActive: boolean;
}

/**
 * Neither the machine ID nor the owning customer is editable: both appear in payloads already
 * signed against this machine, so re-pointing the row would relabel history.
 */
export interface UpdateMachineRequest {
  name: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface MachineListQuery {
  /** A machine belongs to one customer; the pickers always narrow by it. */
  customerId?: number;
  /**
   * Keeps only machines that hold an active machine license under this application - the
   * machines a robot can actually be licensed onto.
   */
  licensedForApplicationId?: number;
  search?: string;
  includeInactive?: boolean;
}
