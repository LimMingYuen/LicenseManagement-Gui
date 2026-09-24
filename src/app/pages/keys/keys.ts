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

/** Page that shows, generates, rotates and imports the RSA signing key. */
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

  protected readonly importFile = signal<File | null>(null);
  protected readonly importPassphrase = signal('');
  protected readonly importing = signal(false);

  /** Whether the regenerate control is revealed. */
  protected readonly showRotation = signal(false);

  /** Algorithm and size of a newly generated key pair, e.g. "RSA-2048". */
  protected readonly keyLabel = computed(() => {
    const specs = this.status()?.cryptoSpecs;
    return specs ? `${specs.keyAlgorithm}-${specs.keySize}` : '';
  });

  constructor() {
    void this.load();
  }

  protected formatDate = formatIsoDateTime;

  /** Loads the signing key status. */
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

  /** Copies the public key PEM to the clipboard. */
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

  /** Downloads the public key as publickey.pem. */
  protected async exportForServer(): Promise<void> {
    try {
      saveBlob(await this.keys.downloadPublicKey(), 'publickey.pem');
      this.notify('publickey.pem downloaded.', 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not export the public key.'), 'error');
    }
  }

  /** Generates the first signing key pair. */
  protected async generate(): Promise<void> {
    await this.runKeyOperation('Signing key generated.');
  }

  /** Replaces the signing key with a new pair after confirmation. */
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

  /** Stores the chosen key file and resets the file input. */
  protected onFileChosen(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.importFile.set(input.files?.[0] ?? null);
    input.value = '';
  }

  /** Imports an existing key pair as the active signing key. */
  protected async importKey(): Promise<void> {
    const file = this.importFile();

    if (!file) {
      this.notify('Choose a key file first.', 'error');
      return;
    }

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

  /** Asks the user to confirm replacing the current key with the chosen file. */
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

    return confirmed === true;
  }

  /** Describes a key import outcome for the snackbar. */
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

  /** Generates a new key pair and reports the result. */
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

  /** Shows a success or error snackbar. */
  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
