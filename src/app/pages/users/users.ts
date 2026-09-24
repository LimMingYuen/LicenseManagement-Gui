import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.models';
import { Role } from '../../models/role.models';
import { RoleService } from '../../services/role.service';
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
  private readonly roleService = inject(RoleService);
  private readonly auth = inject(AuthService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly users = signal<User[]>([]);
  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);

  /** Initial table search from the ?search= query parameter. */
  protected readonly initialSearch = signal(
    inject(ActivatedRoute).snapshot.queryParamMap.get('search') ?? '',
  );

  private readonly selfId = this.auth.currentUser()?.id ?? null;

  /** Rebuilt when roles load, since the role filter lists them. */
  protected readonly tableConfig = computed(() => buildUsersTableConfig(this.selfId, this.roles()));

  constructor() {
    void this.load();
  }

  /** Loads all user accounts and the roles they can be assigned. */
  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      const [users, roles] = await Promise.all([this.userService.list(), this.roleService.list()]);
      this.users.set(users);
      this.roles.set(roles);
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
      case 'view':
        if (event.row) void this.openView(event.row);
        break;
      case 'edit':
        if (event.row) void this.openForm(event.row);
        break;
      case 'reset-password':
        if (event.row) void this.openPasswordReset(event.row);
        break;
      case 'delete':
        if (event.row) void this.remove(event.row);
        break;
    }
  }

  /** Opens the user dialog, creating a new account when given null. */
  private async openForm(user: User | null): Promise<void> {
    const saved = await firstValueFrom(
      this.dialog
        .open(UserForm, dialogConfig<UserFormData>({ user, roles: this.roles() }))
        .afterClosed(),
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

  /** Opens the account in a read-only dialog. */
  private async openView(user: User): Promise<void> {
    await firstValueFrom(
      this.dialog
        .open(UserForm, dialogConfig<UserFormData>({ user, roles: this.roles(), readonly: true }))
        .afterClosed(),
    );
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

  /** Permanently deletes the account after confirmation. */
  private async remove(user: User): Promise<void> {
    if (!confirm(`Delete ${user.username}? This cannot be undone.`)) {
      return;
    }

    try {
      await this.userService.remove(user.id);
      this.users.update((list) => list.filter((u) => u.id !== user.id));
      this.notify(`${user.username} was deleted.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not delete this account.'), 'error');
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
