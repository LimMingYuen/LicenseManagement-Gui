import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { CurrentUser } from '../models/user.models';
import { PAGE_REGISTRY } from '../config/page-registry';
import { SUPER_ADMIN_ROLE } from '../models/role.models';
import { PageService } from './page.service';

const CREDENTIALS_KEY = 'lm.credentials';

/** Gateway statuses that leave stored credentials unverified rather than rejected. */
const UNVERIFIED_STATUSES = new Set([502, 503, 504]);

/** Holds the HTTP Basic credentials and the signed-in user for the session. */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly pages = inject(PageService);

  private readonly credentials = signal<string | null>(sessionStorage.getItem(CREDENTIALS_KEY));
  private readonly user = signal<CurrentUser | null>(null);

  private restoring = false;

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isSuperAdmin = computed(() => this.user()?.role === SUPER_ADMIN_ROLE);

  /** Credentials are stored but not yet confirmed by the API. */
  readonly isSessionUnverified = computed(
    () => this.credentials() !== null && this.user() === null,
  );

  /** Whether the signed-in account may open the page registered at the given path. */
  canAccessPage(path: string): boolean {
    const user = this.user();
    if (!user) {
      return false;
    }

    const page = PAGE_REGISTRY.find((p) => p.path === path);
    if (page?.superAdminOnly) {
      return this.isSuperAdmin();
    }

    return this.isSuperAdmin() || !!page?.alwaysAllowed || user.allowedPages.includes(path);
  }

  /** Returns the Authorization header value, or null when signed out. */
  authorizationHeader(): string | null {
    const encoded = this.credentials();
    return encoded ? `Basic ${encoded}` : null;
  }

  /** Signs in with the given credentials and stores them on success. */
  async login(username: string, password: string): Promise<CurrentUser> {
    const encoded = encodeCredentials(username, password);

    const user = await firstValueFrom(
      this.http.post<CurrentUser>('/api/auth/login', null, {
        headers: new HttpHeaders({ Authorization: `Basic ${encoded}` }),
      }),
    );

    sessionStorage.setItem(CREDENTIALS_KEY, encoded);
    this.credentials.set(encoded);
    this.user.set(user);
    this.syncPages();
    return user;
  }

  /** Clears the stored credentials and the current user. */
  logout(): void {
    sessionStorage.removeItem(CREDENTIALS_KEY);
    this.credentials.set(null);
    this.user.set(null);
  }

  /** Re-validates the stored credentials against the API. */
  async restoreSession(): Promise<void> {
    if (!this.credentials() || this.restoring) {
      return;
    }

    this.restoring = true;

    try {
      this.user.set(await firstValueFrom(this.http.get<CurrentUser>('/api/auth/me')));
      this.syncPages();
    } catch (error) {
      const status = error instanceof HttpErrorResponse ? error.status : 0;

      if (status !== 0 && !UNVERIFIED_STATUSES.has(status)) {
        this.logout();
      }
    } finally {
      this.restoring = false;
    }
  }

  /** Pushes the page registry to the server when a SuperAdmin is signed in. */
  private syncPages(): void {
    if (this.isSuperAdmin()) {
      this.pages.sync().catch(() => {
        // Non-critical: the next SuperAdmin sign-in retries the sync.
      });
    }
  }

  /** Changes the current user's password and updates the stored credentials. */
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

/** Encodes username:password as UTF-8 base64 for a Basic header. */
function encodeCredentials(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}
