/**
 * The cryptography the API performs. Reported by the server rather than restated here, so
 * the page cannot claim one algorithm while the server signs with another.
 */
export interface CryptoSpecs {
  keyAlgorithm: string;
  keySize: number;
  /** Digest the license signature is computed over, e.g. "SHA-256". */
  signatureDigest: string;
  /** Cipher protecting the private key at rest, e.g. "AES-256-CBC". */
  privateKeyCipher: string;
  keyDerivation: string;
  keyDerivationIterations: number;
}

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
  /** Sent even before a key exists — it describes what generating one would produce. */
  cryptoSpecs: CryptoSpecs;
}
/**
 * What importing a key did to the server's key state. Mirrors the API's KeyImportOutcome —
 * roles and enums travel as strings in both directions.
 */
export type KeyImportOutcome = 'AlreadyActive' | 'Reactivated' | 'Imported';

/** Result of adopting an existing key pair. */
export interface KeyImportResult {
  outcome: KeyImportOutcome;
  /** The refreshed status, so the page can update from this one response. */
  status: SigningKeyStatus;
}
