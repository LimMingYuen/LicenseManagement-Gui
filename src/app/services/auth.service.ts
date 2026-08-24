import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { User } from '../models/user.models';

const CREDENTIALS_KEY = 'lm.credentials';

/** Statuses that mean the request never reached anything able to judge the credentials. */
const UNVERIFIED_STATUSES = new Set([502, 503, 504]);

/**
 * Holds the HTTP Basic credentials for the session.
 *
 * Basic auth has no server-side session and no token: the browser must keep the
 * username:password pair for as long as the user is signed in. We keep it in
 * sessionStorage so it dies with the tab, but be aware this is weaker than a
 * short-lived token — any XSS on this origin can read it.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  private readonly credentials = signal<string | null>(sessionStorage.getItem(CREDENTIALS_KEY));
  private readonly user = signal<User | null>(null);

  private restoring = false;

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isSuperAdmin = computed(() => this.user()?.role === 'SuperAdmin');

  /**
   * Credentials are held but have not been confirmed against the API — the state a reload
   * lands in when the server is down. Distinct from signed out: nothing has rejected these.
   */
  readonly isSessionUnverified = computed(() => this.credentials() !== null && this.user() === null);

  /** The value the interceptor puts on the Authorization header, or null when signed out. */
  authorizationHeader(): string | null {
    const encoded = this.credentials();
    return encoded ? `Basic ${encoded}` : null;
  }

  async login(username: string, password: string): Promise<User> {
    const encoded = encodeCredentials(username, password);

    // Sent explicitly rather than via the interceptor: nothing is stored until it succeeds.
    const user = await firstValueFrom(
      this.http.post<User>('/api/auth/login', null, {
        headers: new HttpHeaders({ Authorization: `Basic ${encoded}` }),
      }),
    );

    sessionStorage.setItem(CREDENTIALS_KEY, encoded);
    this.credentials.set(encoded);
    this.user.set(user);
    return user;
  }

  logout(): void {
    sessionStorage.removeItem(CREDENTIALS_KEY);
    this.credentials.set(null);
    this.user.set(null);
  }

  /**
   * Re-validates stored credentials on a page reload. Runs before the first route
   * activates, so guards see a settled auth state.
   *
   * Also re-run once the API comes back, which is why an unreachable server must not clear
   * the credentials: a reload during an outage would otherwise sign the user out and make
   * them retype a password that was never wrong. Only the server rejecting them counts.
   */
  async restoreSession(): Promise<void> {
    if (!this.credentials() || this.restoring) {
      return;
    }

    this.restoring = true;

    try {
      this.user.set(await firstValueFrom(this.http.get<User>('/api/auth/me')));
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;

      // Status 0 and the proxy's gateway codes mean nothing looked at these credentials.
      // Anything else is the API's verdict on them: password changed, account deactivated.
      if (status !== 0 && !UNVERIFIED_STATUSES.has(status)) {
        this.logout();
      }
    } finally {
      this.restoring = false;
    }
  }

  /** Self-service change. Re-encodes the stored credentials so the session survives. */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await firstValueFrom(
      this.http.post<void>('/api/auth/change-password', { currentPassword, newPassword }),
    );

    const username = this.user()?.username;
    if (username) {
      const encoded = encodeCredentials(username, newPassword);
      sessionStorage.setItem(CREDENTIALS_KEY, encoded);
      this.credentials.set(encoded);
    }
  }
}

/**
 * base64(username:password) over UTF-8. Plain btoa() throws on any character
 * outside Latin-1, which would break perfectly valid passwords.
 */
function encodeCredentials(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
