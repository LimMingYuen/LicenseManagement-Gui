/** A customer in the register. */
export interface Customer {
  id: number;
  name: string;
  code: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  isActive: boolean;
  /** Number of licenses that reference this customer. */
  licenseCount: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string | null;
}

export interface CreateCustomerRequest {
  name: string;
  code: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  isActive: boolean;
}

export type UpdateCustomerRequest = CreateCustomerRequest;
