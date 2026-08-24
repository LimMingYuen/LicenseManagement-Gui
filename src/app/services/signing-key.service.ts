import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { SigningKeyStatus } from '../models/signing-key.models';

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
}
