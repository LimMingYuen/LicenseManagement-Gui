import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.models';
import { UserService } from '../../services/user.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import { dialogConfig } from '../../shared/utils/dialog';
import { describeError } from '../../shared/utils/http-error';
import { UserForm, UserFormData } from './user-form';
import { PasswordReset, PasswordResetData } from './password-reset';
import { buildUsersTableConfig } from './users-table.config';

/** Page that lists and manages user accounts. */
@Component({
  selector: 'app-users',
  imports: [MatSnackBarModule, DataTableComponent],
  templateUrl: './users.html',
  styleUrl: './users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Users {
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);

  /** Built once, since the self-deactivation guard depends only on the signed-in user. */
  protected readonly tableConfig = buildUsersTableConfig(this.auth.currentUser()?.id ?? null);

  constructor() {
    void this.load();
  }

  /** Loads all user accounts. */
  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.users.set(await this.userService.list());
    } catch (error) {
      this.notify(describeError(error, 'Could not load users.'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  /** Dispatches a table action. */
  protected handleAction(event: DataActionEvent<User>): void {
    switch (event.action) {
      case 'add':
        void this.openForm(null);
        break;
      case 'refresh':
        void this.load();
        break;
      case 'edit':
        if (event.row) void this.openForm(event.row);
        break;
      case 'reset-password':
        if (event.row) void this.openPasswordReset(event.row);
        break;
      case 'activate':
      case 'deactivate':
        if (event.row) void this.toggleActive(event.row);
        break;
    }
  }

  /** Opens the user dialog, creating a new account when given null. */
  private async openForm(user: User | null): Promise<void> {
    const saved = await firstValueFrom(
      this.dialog.open(UserForm, dialogConfig<UserFormData>({ user })).afterClosed(),
    );

    if (!saved) {
      return;
    }

    const isNew = !this.users().some((u) => u.id === saved.id);

    if (isNew) {
      void this.load();
      this.notify(`${saved.username} was created.`, 'success');
    } else {
      this.replace(saved);
      this.notify(`${saved.username} was updated.`, 'success');
    }
  }

  /** Opens the password reset dialog for an account. */
  private async openPasswordReset(user: User): Promise<void> {
    const done = await firstValueFrom(
      this.dialog.open(PasswordReset, dialogConfig<PasswordResetData>({ user })).afterClosed(),
    );

    if (done) {
      void this.load();
      this.notify(`Password for ${user.username} was reset.`, 'success');
    }
  }

  /** Toggles the account's active status. */
  private async toggleActive(user: User): Promise<void> {
    try {
      const updated = await this.userService.setActive(user.id, !user.isActive);
      this.replace(updated);
      this.notify(
        `${updated.username} was ${updated.isActive ? 'activated' : 'deactivated'}.`,
        'success',
      );
    } catch (error) {
      this.notify(describeError(error, 'Could not change the account status.'), 'error');
    }
  }

  /** Replaces the matching account in the list. */
  private replace(user: User): void {
    this.users.update((list) => list.map((u) => (u.id === user.id ? user : u)));
  }

  /** Shows a success or error snackbar. */
  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
