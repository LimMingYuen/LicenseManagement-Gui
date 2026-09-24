import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { Role } from '../../models/role.models';
import { RoleService } from '../../services/role.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import { dialogConfig } from '../../shared/utils/dialog';
import { describeError } from '../../shared/utils/http-error';
import { RoleForm, RoleFormData } from './role-form';
import { buildRolesTableConfig } from './roles-table.config';

/** Page that lists and manages user roles. */
@Component({
  selector: 'app-roles',
  imports: [MatSnackBarModule, DataTableComponent],
  templateUrl: './roles.html',
  styleUrl: './roles.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Roles {
  private readonly roleService = inject(RoleService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  protected readonly roles = signal<Role[]>([]);
  protected readonly loading = signal(true);
  protected readonly tableConfig = buildRolesTableConfig();

  constructor() {
    void this.load();
  }

  /** Loads all roles. */
  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.roles.set(await this.roleService.list());
    } catch (error) {
      this.notify(describeError(error, 'Could not load roles.'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  /** Dispatches a table action. */
  protected handleAction(event: DataActionEvent<Role>): void {
    switch (event.action) {
      case 'add':
        void this.openForm(null);
        break;
      case 'refresh':
        void this.load();
        break;
      case 'view':
        if (event.row) {
          this.dialog.open(
            RoleForm,
            dialogConfig<RoleFormData>({ role: event.row, readonly: true }, '40rem'),
          );
        }
        break;
      case 'edit':
        if (event.row) void this.openForm(event.row);
        break;
      case 'users':
        if (event.row) {
          void this.router.navigate(['/users'], { queryParams: { search: event.row.name } });
        }
        break;
      case 'delete':
        if (event.row) void this.remove(event.row);
        break;
    }
  }

  /** Opens the role dialog, creating a new role when given null. */
  private async openForm(role: Role | null): Promise<void> {
    const saved = await firstValueFrom(
      this.dialog.open(RoleForm, dialogConfig<RoleFormData>({ role }, '40rem')).afterClosed(),
    );

    if (!saved) {
      return;
    }

    const isNew = !this.roles().some((r) => r.id === saved.id);

    if (isNew) {
      void this.load();
      this.notify(`${saved.name} was created.`, 'success');
    } else {
      this.roles.update((list) => list.map((r) => (r.id === saved.id ? saved : r)));
      this.notify(`${saved.name} was updated.`, 'success');
    }
  }

  /** Deletes the role after confirmation. */
  private async remove(role: Role): Promise<void> {
    if (!confirm(`Delete the ${role.name} role? This cannot be undone.`)) {
      return;
    }

    try {
      await this.roleService.remove(role.id);
      this.roles.update((list) => list.filter((r) => r.id !== role.id));
      this.notify(`${role.name} was deleted.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not delete this role.'), 'error');
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
