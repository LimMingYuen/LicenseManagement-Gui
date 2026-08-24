/**
 * State of the RSA signing key. The private half never leaves the server, so there is
 * nothing secret in this shape.
 */
export interface SigningKeyStatus {
  exists: boolean;
  /** SHA-256 of the public key, colon-separated hex. Null until a key is generated. */
  fingerprint: string | null;
  algorithm: string | null;
  keySize: number | null;
  createdAt: string | null;
  createdBy: string | null;
  publicKeyPem: string | null;
  /** Licenses signed with this key — what a rotation would strand. */
  signedLicenseCount: number;
  /** Keys retired by earlier rotations. Zero means the key has never been rotated. */
  retiredKeyCount: number;
}
