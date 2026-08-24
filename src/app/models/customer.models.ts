/**
 * The customer register.
 *
 * Customers used to exist only as a string typed into each generate form and re-grouped at
 * read time, which is why two spellings of one name became two customers with no way back.
 * They are rows now: created up front, renamed once, merged when they have drifted apart.
 */
export interface Customer {
  id: number;
  name: string;
  code: string | null;
  contactName: string | null;
  contactEmail: string | null;
  notes: string | null;
  isActive: boolean;
  /** How many licenses reference this customer. Zero is the only deletable state. */
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
