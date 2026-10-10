import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTabsModule } from '@angular/material/tabs';
import { Role, SUPER_ADMIN_ROLE } from '../../../models/role.models';
import { PageDto } from '../../../models/page.models';
import { PageService } from '../../../services/page.service';
import { AuthService } from '../../../services/auth.service';
import { RoleService } from '../../../services/role.service';
import { describeError } from '../../../shared/utils/http-error';

export interface RoleFormData {
  /** Null to create a new role, otherwise the one to edit. */
  role: Role | null;
  /** Shows the role and its page access without allowing changes. */
  readonly?: boolean;
}

/** Dialog that creates or edits a role and the pages it may open. */
@Component({
  selector: 'app-role-form',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatTabsModule,
    MatButtonModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './role-form.html',
  styleUrl: './role-form.scss',
})
export class RoleForm {
  private readonly roles = inject(RoleService);
  private readonly pageService = inject(PageService);
  private readonly auth = inject(AuthService);
  private readonly dialogRef = inject<MatDialogRef<RoleForm, Role>>(MatDialogRef);

  /** Null when creating a new role. */
  private readonly data = inject<RoleFormData>(MAT_DIALOG_DATA);

  /** Null when creating a new role. */
  private readonly role = this.data.role;

  protected readonly readonly = this.data.readonly ?? false;

  /** The stored role, set after a create so a retry after a failed permission save updates it. */
  private saved: Role | null = this.role;

  protected readonly superAdminRole = SUPER_ADMIN_ROLE;
  protected readonly isSystem = this.role?.isSystem ?? false;
  protected readonly isSuperAdmin = this.role?.name === SUPER_ADMIN_ROLE;

  /** Whether a non-SuperAdmin is editing the role they hold, whose page access they cannot change. */
  protected readonly isOwnRole =
    !this.auth.isSuperAdmin() && !!this.role && this.role.name === this.auth.currentUser()?.role;

  protected readonly pagesLocked = this.readonly || this.isOwnRole;
  protected readonly title = this.readonly
    ? (this.role?.name ?? '')
    : this.role
      ? `Edit ${this.role.name}`
      : 'New role';

  protected readonly saving = signal(false);
  protected readonly loadingPages = signal(!this.isSuperAdmin);
  protected readonly error = signal<string | null>(null);

  protected readonly pages = signal<PageDto[]>([]);
  protected readonly selected = signal<ReadonlySet<number>>(new Set());

  protected readonly selectedTab = signal(0);

  protected readonly pageTabLabel = computed(() =>
    this.isSuperAdmin || this.loadingPages()
      ? 'Page access'
      : `Page access (${this.selected().size}/${this.pages().length})`,
  );

  protected readonly allSelected = computed(
    () => this.pages().length > 0 && this.selected().size === this.pages().length,
  );

  protected readonly form = inject(FormBuilder).nonNullable.group({
    name: [
      '',
      [Validators.required, Validators.pattern(/^[A-Za-z0-9._-]+$/), Validators.maxLength(50)],
    ],
    description: ['', Validators.maxLength(200)],
  });

  constructor() {
    const existing = this.role;

    if (existing) {
      this.form.patchValue({ name: existing.name, description: existing.description });

      if (existing.isSystem || this.readonly) {
        this.form.controls.name.disable();
      }

      if (this.readonly) {
        this.form.controls.description.disable();
      }
    }

    if (!this.isSuperAdmin) {
      void this.loadPages();
    }
  }

  /** Ticks or unticks one page. */
  protected toggle(pageId: number, checked: boolean): void {
    this.selected.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(pageId);
      } else {
        next.delete(pageId);
      }
      return next;
    });
  }

  /** Ticks or unticks every page. */
  protected toggleAll(checked: boolean): void {
    this.selected.set(new Set(checked ? this.pages().map((p) => p.id) : []));
  }

  /** Validates the form, saves the role, then saves its page access. */
  protected async submit(): Promise<void> {
    if (this.readonly) {
      return;
    }

    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      this.selectedTab.set(0);
      return;
    }

    this.saving.set(true);
    this.error.set(null);

    const value = this.form.getRawValue();
    const request = { name: value.name.trim(), description: value.description.trim() };

    try {
      const current = this.saved;
      let result = current
        ? await this.roles.update(current.id, request)
        : await this.roles.create(request);
      this.saved = result;

      if (!this.isSuperAdmin && !this.isOwnRole) {
        const selected = this.selected();
        await this.roles.setPermissions(result.id, {
          pages: this.pages().map((p) => ({ pageId: p.id, canAccess: selected.has(p.id) })),
        });
        result = { ...result, pageCount: selected.size };
      }

      this.dialogRef.close(result);
    } catch (error) {
      this.error.set(describeError(error, 'Could not save this role.'));
    } finally {
      this.saving.set(false);
    }
  }

  /** Loads the grantable pages and, when editing, the ones the role already has. */
  private async loadPages(): Promise<void> {
    try {
      const existing = this.role;

      if (existing) {
        const permissions = await this.roles.permissions(existing.id);
        this.pages.set(
          permissions.map((p, index) => ({
            id: p.pageId,
            path: p.path,
            name: p.name,
            icon: p.icon,
            sortOrder: index,
          })),
        );
        this.selected.set(new Set(permissions.filter((p) => p.canAccess).map((p) => p.pageId)));
      } else {
        this.pages.set(await this.pageService.list());
      }
    } catch (error) {
      this.error.set(describeError(error, 'Could not load the page list.'));
    } finally {
      this.loadingPages.set(false);
    }
  }
}
