import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../shared/components/confirmation-dialog/confirmation-dialog';
import { SigningKeyService } from '../../services/signing-key.service';
import { SigningKeyStatus } from '../../models/signing-key.models';
import { describeError } from '../../shared/utils/http-error';
import { saveBlob } from '../../shared/utils/download';
import { formatIsoDateTime } from '../../shared/utils/date-format';
import { firstValueFrom } from 'rxjs';

/**
 * The RSA signing key.
 *
 * The desktop app's equivalent page also managed the application password, because there
 * the password was what decrypted the private key. Here the two are separate concerns:
 * sign-in credentials live on the Users page and /account/password, and the key is
 * unlocked by a server-side passphrase. So this page is only about the key itself.
 */
@Component({
  selector: 'app-keys',
  imports: [RouterLink, MatSnackBarModule, PageHeaderComponent],
  templateUrl: './keys.html',
  styleUrl: './keys.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Keys {
  private readonly keys = inject(SigningKeyService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly status = signal<SigningKeyStatus | null>(null);
  protected readonly loading = signal(true);
  protected readonly working = signal(false);
  protected readonly copied = signal(false);

  /** The path consuming KUKA backend servers read the public key from. */
  protected readonly serverKeyPath = String.raw`C:\ProgramData\QES-KUKA-AMR\publickey.pem`;

  protected readonly cryptoSpecs = [
    { value: 'RSA-2048', label: 'Key length' },
    { value: 'SHA-256', label: 'Signature digest' },
    { value: 'AES-256-CBC', label: 'Private key cipher' },
    { value: 'PBKDF2 · 100k', label: 'Key derivation' },
  ];

  constructor() {
    void this.load();
  }

  protected formatDate = formatIsoDateTime;

  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.status.set(await this.keys.status());
    } catch (error) {
      this.notify(describeError(error, 'Could not load the signing key.'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected async copyPublicKey(): Promise<void> {
    const pem = this.status()?.publicKeyPem;
    if (!pem) return;

    try {
      await navigator.clipboard.writeText(pem);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.notify('Could not copy — select the key text and copy manually.', 'error');
    }
  }

  protected async exportForServer(): Promise<void> {
    try {
      saveBlob(await this.keys.downloadPublicKey(), 'publickey.pem');
      this.notify('publickey.pem downloaded.', 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not export the public key.'), 'error');
    }
  }

  /** First-run generation. No confirmation needed — there is nothing to invalidate. */
  protected async generate(): Promise<void> {
    await this.runKeyOperation('Signing key generated.');
  }

  /**
   * Rotation. Confirmed explicitly, and the message names how many licenses it strands,
   * because that number is the whole cost of the operation.
   */
  protected async regenerate(): Promise<void> {
    const stranded = this.status()?.signedLicenseCount ?? 0;

    const data: ConfirmationDialogData = {
      title: 'Regenerate signing key?',
      message:
        `This creates a new RSA-2048 key pair. ${
          stranded === 1
            ? 'The 1 license already issued'
            : `All ${stranded} licenses already issued`
        } will no longer verify against the new public key, and every customer will need a ` +
        'replacement license. This cannot be undone.',
      icon: 'warning',
      confirmText: 'Regenerate key',
      cancelText: 'Cancel',
      showCancel: true,
      confirmColor: 'warn',
    };

    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmationDialogComponent, { data, width: '440px' }).afterClosed(),
    );

    if (confirmed) {
      await this.runKeyOperation('New signing key generated. Existing licenses must be re-issued.');
    }
  }

  private async runKeyOperation(successMessage: string): Promise<void> {
    this.working.set(true);

    try {
      this.status.set(await this.keys.regenerate());
      this.notify(successMessage, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not generate the signing key.'), 'error');
    } finally {
      this.working.set(false);
    }
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
