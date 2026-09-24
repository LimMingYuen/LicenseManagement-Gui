import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { KeyImportResult, SigningKeyStatus } from '../models/signing-key.models';

/** Calls the signing keys API. */
@Injectable({ providedIn: 'root' })
export class SigningKeyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/keys';

  /** Gets the state of the signing key. */
  status(): Promise<SigningKeyStatus> {
    return firstValueFrom(this.http.get<SigningKeyStatus>(this.baseUrl));
  }

  /** Downloads the public key as a PEM file. */
  downloadPublicKey(): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/public`, { responseType: 'blob' }));
  }

  /** Creates the key pair, or rotates it if one already exists. */
  regenerate(): Promise<SigningKeyStatus> {
    return firstValueFrom(this.http.post<SigningKeyStatus>(`${this.baseUrl}/regenerate`, null));
  }

  /** Imports an existing key pair from an encrypted or plain PEM file. */
  importKey(file: File, passphrase: string): Promise<KeyImportResult> {
    const body = new FormData();
    body.append('file', file);
    body.append('passphrase', passphrase);

    return firstValueFrom(this.http.post<KeyImportResult>(`${this.baseUrl}/import`, body));
  }
}
