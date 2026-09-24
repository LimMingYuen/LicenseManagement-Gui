/** Cryptographic parameters reported by the server. */
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

/** Public state of the RSA signing key. */
export interface SigningKeyStatus {
  exists: boolean;
  /** SHA-256 of the public key as colon-separated hex. */
  fingerprint: string | null;
  algorithm: string | null;
  keySize: number | null;
  createdAt: string | null;
  createdBy: string | null;
  publicKeyPem: string | null;
  /** Number of licenses signed with this key. */
  signedLicenseCount: number;
  /** Number of keys retired by earlier rotations. */
  retiredKeyCount: number;
  /** Present even before a key exists. */
  cryptoSpecs: CryptoSpecs;
}
/** Effect of a key import on the server's key state. Mirrors the API's KeyImportOutcome. */
export type KeyImportOutcome = 'AlreadyActive' | 'Reactivated' | 'Imported';

/** Result of adopting an existing key pair. */
export interface KeyImportResult {
  outcome: KeyImportOutcome;
  /** Key status after the import. */
  status: SigningKeyStatus;
}
