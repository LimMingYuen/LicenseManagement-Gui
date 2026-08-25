import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { PageHeaderComponent } from '../../shared/components/page-header/page-header';
import {
  ConfirmationDialogComponent,
  ConfirmationDialogData,
} from '../../shared/components/confirmation-dialog/confirmation-dialog';
import { SigningKeyService } from '../../services/signing-key.service';
import { KeyImportOutcome, SigningKeyStatus } from '../../models/signing-key.models';
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
  imports: [
    MatSnackBarModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    FormsModule,
    PageHeaderComponent,
  ],
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

  /** The chosen key file and the passphrase it was encrypted with, for import. */
  protected readonly importFile = signal<File | null>(null);
  protected readonly importPassphrase = signal('');
  protected readonly importing = signal(false);

  /**
   * Whether the rotation control is revealed. Rotation is behind a deliberate second step
   * because a stray click there ends every license in the field, and adopting an existing key
   * — the neighbouring card — is almost always what was actually wanted.
   */
  protected readonly showRotation = signal(false);

  /** e.g. "RSA-2048" - what generating a pair produces, per the server. */
  protected readonly keyLabel = computed(() => {
    const specs = this.status()?.cryptoSpecs;
    return specs ? `${specs.keyAlgorithm}-${specs.keySize}` : '';
  });

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
        `This creates a new ${this.keyLabel()} key pair. ${
          stranded === 1
            ? 'The 1 license already issued'
            : `All ${stranded} licenses already issued`
        } will no longer verify, and every application carrying the current public key as a ` +
        'compiled-in constant must be rebuilt and redeployed before it accepts anything signed ' +
        'by the new key. If you meant to adopt a key the field already trusts, import it ' +
        'instead. This cannot be undone.',
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

  /** Remembers the chosen file. The input is cleared so re-picking the same file still fires. */
  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
    input.value = '';
  }

  /**
   * Adopts an existing key pair. Continuity is the whole point: applications in the field
   * carry a public key compiled into them, so a server that has generated its own pair signs
   * licenses none of them will accept. Importing the original private key is the repair.
   */
  protected async importKey(): Promise<void> {
    const file = this.importFile();

    if (!file) {
      this.notify('Choose a key file first.', 'error');
      return;
    }

    // Replacing a key that already exists cuts both ways - it can repair the installation or
    // strand it - so the operator confirms with the stakes named.
    if (this.status()?.exists && !(await this.confirmReplace(file.name))) {
      return;
    }

    this.importing.set(true);

    try {
      const result = await this.keys.importKey(file, this.importPassphrase());

      this.status.set(result.status);
      this.importFile.set(null);
      this.importPassphrase.set('');
      this.notify(this.describeOutcome(result.outcome), 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not import the key.'), 'error');
    } finally {
      this.importing.set(false);
    }
  }

  /**
   * The file's fingerprint is not known until the server has read it, so the warning has to
   * cover both outcomes honestly rather than predict one.
   */
  private async confirmReplace(fileName: string): Promise<boolean> {
    const stranded = this.status()?.signedLicenseCount ?? 0;

    const data: ConfirmationDialogData = {
      title: 'Replace the signing key?',
      message:
        `The key in ${fileName} becomes the key this server signs with. If it is the key your ` +
        'installed applications already trust, this repairs them. If it is a different key, ' +
        `${
          stranded === 1
            ? 'the 1 license signed with the current key'
            : `all ${stranded} licenses signed with the current key`
        } will stop verifying. This cannot be undone.`,
      icon: 'warning',
      confirmText: 'Import key',
      cancelText: 'Cancel',
      showCancel: true,
      confirmColor: 'warn',
    };

    const confirmed = await firstValueFrom(
      this.dialog.open(ConfirmationDialogComponent, { data, width: '440px' }).afterClosed(),
    );

    // Dismissing by backdrop or Escape resolves undefined, which is not consent.
    return confirmed === true;
  }

  private describeOutcome(outcome: KeyImportOutcome): string {
    switch (outcome) {
      case 'AlreadyActive':
        return 'That key was already the active one — nothing changed.';
      case 'Reactivated':
        return 'A previously retired key is active again. Licenses signed with it verify once more.';
      default:
        return 'Key imported and made active.';
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
