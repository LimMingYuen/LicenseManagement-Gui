import {
  computed,
  Directive,
  inject,
  Injectable,
  input,
  OnDestroy,
  OnInit,
  signal,
  TemplateRef,
} from '@angular/core';

/** Holds the controls the active page shows in the shell header. */
@Injectable({ providedIn: 'root' })
export class PageHeaderSlot {
  private readonly owner = signal<PageHeaderActions | null>(null);

  readonly template = computed(() => this.owner()?.template ?? null);
  readonly count = computed(() => this.owner()?.count() ?? null);

  attach(owner: PageHeaderActions): void {
    this.owner.set(owner);
  }

  /** Clears the slot unless a newer page has already taken it over. */
  detach(owner: PageHeaderActions): void {
    if (this.owner() === owner) {
      this.owner.set(null);
    }
  }
}

/**
 * Renders the marked template in the shell header's control area while the page is alive.
 * Use once per page: a second instance replaces the first.
 */
@Directive({ selector: 'ng-template[appPageHeaderActions]' })
export class PageHeaderActions implements OnInit, OnDestroy {
  readonly template = inject<TemplateRef<unknown>>(TemplateRef);

  /** Pre-formatted value shown as a pill after the title. */
  readonly count = input<string | number | null>(null);

  private readonly slot = inject(PageHeaderSlot);

  ngOnInit(): void {
    this.slot.attach(this);
  }

  ngOnDestroy(): void {
    this.slot.detach(this);
  }
}
