import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { KeyImportResult, SigningKeyStatus } from '../models/signing-key.models';

@Injectable({ providedIn: 'root' })
export class SigningKeyService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/keys';

  status(): Promise<SigningKeyStatus> {
    return firstValueFrom(this.http.get<SigningKeyStatus>(this.baseUrl));
  }

  /** The public key as a .pem file, for deployment to consuming servers. */
  downloadPublicKey(): Promise<Blob> {
    return firstValueFrom(this.http.get(`${this.baseUrl}/public`, { responseType: 'blob' }));
  }

  /** Creates the key pair, or rotates it if one already exists. */
  regenerate(): Promise<SigningKeyStatus> {
    return firstValueFrom(this.http.post<SigningKeyStatus>(`${this.baseUrl}/regenerate`, null));
  }

  /**
   * Adopts an existing key pair instead of generating one — the desktop app's
   * private.pem.enc, or any PEM holding an RSA private key.
   *
   * Sent as multipart because private.pem.enc is raw bytes; base64 through a JSON field
   * would only add a step that can go wrong.
   *
   * @param passphrase What `file` was encrypted with. Ignored by the server for a plain PEM.
   */
  importKey(file: File, passphrase: string): Promise<KeyImportResult> {
    const body = new FormData();
    body.append('file', file);
    body.append('passphrase', passphrase);

    return firstValueFrom(this.http.post<KeyImportResult>(`${this.baseUrl}/import`, body));
  }
}
