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
import { Role, SUPER_ADMIN_ROLE } from '../../models/role.models';
import { PageDto } from '../../models/page.models';
import { PageService } from '../../services/page.service';
import { RoleService } from '../../services/role.service';
import { describeError } from '../../shared/utils/http-error';

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
  template: `
    <form class="dialog-form" [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <h2 mat-dialog-title>{{ title }}</h2>

      @if (error(); as message) {
        <p class="alert alert-error dialog-alert" role="alert">{{ message }}</p>
      }

      <mat-dialog-content>
        <mat-tab-group
          mat-stretch-tabs="false"
          mat-align-tabs="start"
          animationDuration="0ms"
          [selectedIndex]="selectedTab()"
          (selectedIndexChange)="selectedTab.set($event)"
        >
          <mat-tab label="Details">
            <div class="tab-body">
              <mat-form-field>
                <mat-label>Role name</mat-label>
                <input
                  matInput
                  type="text"
                  formControlName="name"
                  maxlength="50"
                  class="mono"
                  autocapitalize="none"
                  spellcheck="false"
                />
                <mat-hint>
                  @if (isSystem) {
                    System role — the portal checks this name, so it cannot be renamed.
                  } @else {
                    Letters, digits, dot, underscore and hyphen only.
                  }
                </mat-hint>
                <mat-error>Letters, digits, dot, underscore or hyphen only.</mat-error>
              </mat-form-field>

              <mat-form-field>
                <mat-label>Description</mat-label>
                <input matInput type="text" formControlName="description" maxlength="200" />
                <mat-hint>Shown next to the role when assigning it to a user.</mat-hint>
              </mat-form-field>
            </div>
          </mat-tab>

          <mat-tab [label]="pageTabLabel()">
            <div class="tab-body">
              @if (isSuperAdmin) {
                <p class="notice">
                  <mat-icon>verified_user</mat-icon>
                  {{ superAdminRole }} always opens every page, including RSA Keys, Users and Roles.
                </p>
              } @else if (loadingPages()) {
                <div class="loading"><mat-spinner diameter="32" /></div>
              } @else if (pages().length === 0) {
                <p class="notice">
                  <mat-icon>info</mat-icon>
                  No pages registered yet. They are added when a {{ superAdminRole }} signs in.
                </p>
              } @else {
                <div class="page-list">
                  <div class="page-row page-row--all">
                    <mat-icon class="page-icon">select_all</mat-icon>
                    <div class="page-text">
                      <div class="page-title">All pages</div>
                      <div class="page-caption">
                        {{ selected().size }} of {{ pages().length }} switched on
                      </div>
                    </div>
                    <mat-slide-toggle
                      aria-label="All pages"
                      [disabled]="readonly"
                      [checked]="allSelected()"
                      (change)="toggleAll($event.checked)"
                    />
                  </div>

                  @for (page of pages(); track page.id) {
                    <div class="page-row" [class.page-row--on]="selected().has(page.id)">
                      <mat-icon class="page-icon">{{ page.icon || 'web' }}</mat-icon>
                      <div class="page-text">
                        <div class="page-title">{{ page.name }}</div>
                        <div class="page-caption mono">{{ page.path }}</div>
                      </div>
                      <mat-slide-toggle
                        [attr.aria-label]="page.name"
                        [disabled]="readonly"
                        [checked]="selected().has(page.id)"
                        (change)="toggle(page.id, $event.checked)"
                      />
                    </div>
                  }
                </div>

                <span class="field-hint">
                  Dashboard and Change password are open to every account. RSA Keys, Users and Roles
                  stay {{ superAdminRole }}-only.
                </span>
              }
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-dialog-content>

      <mat-dialog-actions>
        @if (readonly) {
          <button type="button" matButton="filled" mat-dialog-close>Close</button>
        } @else {
          <button type="button" matButton="outlined" mat-dialog-close>Cancel</button>
          <button type="submit" matButton="filled" [disabled]="saving() || loadingPages()">
            {{ saving() ? 'Saving…' : 'Save' }}
          </button>
        }
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .tab-body {
      display: flex;
      flex-direction: column;
      gap: var(--sp-3);
      min-height: 22rem;
      padding-top: var(--sp-4);
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: var(--sp-6);
    }

    .notice {
      display: flex;
      align-items: center;
      gap: var(--sp-2);
      margin: 0;
      font-size: var(--fs-md);
      color: var(--brand-text-muted);
    }

    .page-list {
      border: 1px solid var(--brand-border-soft);
      border-radius: var(--r-md);
      max-height: 24rem;
      overflow-y: auto;
    }

    .page-row {
      display: flex;
      align-items: center;
      gap: var(--sp-3);
      min-height: 52px;
      padding: var(--sp-1) var(--sp-4);
      border-bottom: 1px solid var(--brand-border-soft);

      &:last-child {
        border-bottom: none;
      }
    }

    .page-row--all {
      position: sticky;
      top: 0;
      z-index: 1;
      background: var(--brand-surface);
    }

    .page-icon {
      flex-shrink: 0;
      color: var(--brand-text-subtle);
    }

    .page-row--on .page-icon {
      color: var(--brand-success);
    }

    .page-text {
      flex: 1;
      min-width: 0;
    }

    .page-title {
      font-size: var(--fs-base);
      color: var(--brand-text);
    }

    .page-caption {
      font-size: var(--fs-sm);
      color: var(--brand-text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class RoleForm {
  private readonly roles = inject(RoleService);
  private readonly pageService = inject(PageService);
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

      if (!this.isSuperAdmin) {
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
