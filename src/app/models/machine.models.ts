/** A machine in the register, owned by exactly one customer. */
export interface Machine {
  id: number;
  /** Machine ID with dashes stripped, so MACHINE-001 and MACHINE001 are one machine. */
  machineId: string;
  customerId: number;
  customerName: string;
  /** Optional human label, e.g. "Line 3 palletiser". */
  name: string | null;
  notes: string | null;
  isActive: boolean;
  /** True when the machine holds an unrevoked machine license. */
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

/** Machine update payload; the machine ID and owning customer cannot be changed. */
export interface UpdateMachineRequest {
  name: string | null;
  notes: string | null;
  isActive: boolean;
}

export interface MachineListQuery {
  customerId?: number;
  /** Keeps only machines with an active machine license under this application. */
  licensedForApplicationId?: number;
  search?: string;
  includeInactive?: boolean;
}
