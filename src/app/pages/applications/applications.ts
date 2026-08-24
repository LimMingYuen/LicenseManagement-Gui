import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AuthService } from '../../services/auth.service';
import { Application } from '../../models/application.models';
import { ApplicationService } from '../../services/application.service';
import { DataTableComponent } from '../../shared/components/data-table/data-table';
import { DataActionEvent } from '../../shared/models/data-table.models';
import { describeError } from '../../shared/utils/http-error';
import { ApplicationForm } from './application-form';
import { buildApplicationsTableConfig } from './applications-table.config';

type Dialog = { kind: 'create' } | { kind: 'edit'; application: Application } | null;

@Component({
  selector: 'app-applications',
  imports: [MatSnackBarModule, DataTableComponent, ApplicationForm],
  templateUrl: './applications.html',
  styleUrl: './applications.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Applications {
  private readonly applicationService = inject(ApplicationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  protected readonly applications = signal<Application[]>([]);
  protected readonly loading = signal(true);
  protected readonly dialog = signal<Dialog>(null);

  /** Built once: which actions exist depends only on the signed-in role. */
  protected readonly tableConfig = buildApplicationsTableConfig(
    this.auth.currentUser()?.role === 'SuperAdmin',
  );

  constructor() {
    void this.load();
  }

  /**
   * The whole list is fetched once and filtered in the table — there are only ever a handful
   * of products. Inactive rows are included so they can be reactivated; only the generate
   * forms hide them.
   */
  protected async load(): Promise<void> {
    this.loading.set(true);

    try {
      this.applications.set(await this.applicationService.list());
    } catch (error) {
      this.notify(describeError(error, 'Could not load applications.'), 'error');
    } finally {
      this.loading.set(false);
    }
  }

  protected handleAction(event: DataActionEvent<Application>): void {
    switch (event.action) {
      case 'add':
        this.dialog.set({ kind: 'create' });
        break;
      case 'refresh':
        void this.load();
        break;
      case 'edit':
        if (event.row) this.dialog.set({ kind: 'edit', application: event.row });
        break;
      case 'licenses':
        // The register filters by application key server-side, which is exactly what this
        // link needs — no client-side matching on a display name.
        if (event.row) {
          void this.router.navigate(['/licenses'], {
            queryParams: { application: event.row.key },
          });
        }
        break;
      case 'activate':
      case 'deactivate':
        if (event.row) void this.toggleActive(event.row);
        break;
      case 'delete':
        if (event.row) void this.remove(event.row);
        break;
    }
  }

  protected onSaved(application: Application): void {
    const isNew = !this.applications().some((a) => a.id === application.id);
    this.dialog.set(null);

    if (isNew) {
      void this.load();
      this.notify(`${application.name} was created.`, 'success');
    } else {
      this.replace(application);
      this.notify(`${application.name} was updated.`, 'success');
    }
  }

  private async toggleActive(application: Application): Promise<void> {
    try {
      const updated = await this.applicationService.setActive(
        application.id,
        !application.isActive,
      );
      this.replace(updated);
      this.notify(
        `${updated.name} was ${updated.isActive ? 'activated' : 'deactivated'}.`,
        'success',
      );
    } catch (error) {
      this.notify(describeError(error, 'Could not change the application status.'), 'error');
    }
  }

  private async remove(application: Application): Promise<void> {
    if (!confirm(`Delete ${application.name}? This cannot be undone.`)) {
      return;
    }

    try {
      await this.applicationService.remove(application.id);
      this.applications.update((list) => list.filter((a) => a.id !== application.id));
      this.notify(`${application.name} was deleted.`, 'success');
    } catch (error) {
      this.notify(describeError(error, 'Could not delete this application.'), 'error');
    }
  }

  private replace(application: Application): void {
    this.applications.update((list) =>
      list.map((a) => (a.id === application.id ? application : a)),
    );
  }

  private notify(message: string, tone: 'success' | 'error'): void {
    this.snackBar.open(message, 'Close', {
      duration: tone === 'error' ? 6000 : 3000,
      panelClass: [`${tone}-snackbar`],
    });
  }
}
