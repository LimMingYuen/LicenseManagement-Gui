import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.models';
import { UserService } from '../../services/user.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import { describeError } from '../../shared/utils/http-error';
import { UserForm } from './user-form';
import { PasswordReset } from './password-reset';
import { buildUsersTableConfig } from './users-table.config';

type Dialog =
  { kind: 'create' } | { kind: 'edit'; user: User } | { kind: 'reset'; user: User } | null;

@Component({
  selector: 'app-users',
  imports: [MatSnackBarModule, DataTableComponent, UserForm, PasswordReset],
  templateUrl: './users.html',
  styleUrl: './users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Users {
  private readonly userService = inject(UserService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(true);
  protected readonly dialog = signal<Dialog>(null);

  /** Built once: the self-guard on deactivate only depends on who is signed in. */
  protected readonly tableConfig = buildUsersTableConfig(this.auth.currentUser()?.id ?? null);

  constructor() {
    void this.load();
  }

  /**
   * The whole list is fetched once and filtered in the table — the account list is
   * small enough that a round trip per keystroke buys nothing.
   */
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

  protected handleAction(event: DataActionEvent<User>): void {
    switch (event.action) {
      case 'add':
        this.dialog.set({ kind: 'create' });
        break;
      case 'refresh':
        void this.load();
        break;
      case 'edit':
        if (event.row) this.dialog.set({ kind: 'edit', user: event.row });
        break;
      case 'reset-password':
        if (event.row) this.dialog.set({ kind: 'reset', user: event.row });
        break;
      case 'activate':
      case 'deactivate':
        if (event.row) void this.toggleActive(event.row);
        break;
    }
  }

  protected onSaved(user: User): void {
    const isNew = !this.users().some((u) => u.id === user.id);
    this.dialog.set(null);

    if (isNew) {
      void this.load();
      this.notify(`${user.username} was created.`, 'success');
    } else {
      this.replace(user);
      this.notify(`${user.username} was updated.`, 'success');
    }
  }

  protected onPasswordReset(username: string): void {
    this.dialog.set(null);
    void this.load();
    this.notify(`Password for ${username} was reset.`, 'success');
  }

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

  private replace(user: User): void {
    this.users.update((list) => list.map((u) => (u.id === user.id ? user : u)));
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
