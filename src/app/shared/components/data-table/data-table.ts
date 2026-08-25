import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ViewChildren,
  ViewEncapsulation,
  QueryList,
  OnChanges,
  OnInit,
  SimpleChanges
} from '@angular/core';

import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
import { MatPaginator, MatPaginatorModule } from '@angular/material/paginator';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCardModule } from '@angular/material/card';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule, MatMenuTrigger } from '@angular/material/menu';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule, MatCalendarHeader } from '@angular/material/datepicker';
import { MatTimepickerModule } from '@angular/material/timepicker';
import { provideIsoDates } from '../../utils/iso-date';
import { SelectionModel } from '@angular/cdk/collections';

import { PageHeaderComponent } from '../page-header/page-header';

import {
  DataTableConfig,
  DataColumnConfig,
  DataColumnFilterEntry,
  DataColumnFilterType,
  DataCombinedFilterState,
  DataActionConfig,
  DataHeaderActionConfig,
  DataActionEvent,
  DataSortEvent,
  DataPageEvent,
  DataFilterEvent,
  DataSelectOption,
  BadgeTone,
  DEFAULT_DATA_PAGINATION,
  DEFAULT_DATA_EMPTY,
  DEFAULT_DATA_FILTER
} from '../../models/data-table.models';

/**
 * Filter popover sizing. The popover takes its column's width, clamped so a
 * narrow column still gets a usable body (the date filter needs room for a
 * date + time pair) and a very wide one doesn't get an absurdly wide panel.
 */
const POPOVER_MIN_WIDTH = 280;
const POPOVER_MAX_WIDTH = 420;

interface DraftFilter {
  type: DataColumnFilterType;
  text?: string;
  selectedValues?: Set<string>;
  selectSearch?: string;
  min?: number | null;
  max?: number | null;
  from?: Date | null;
  to?: Date | null;
  /** Time-of-day picked via mat-timepicker. Only hours+minutes are read off this Date. */
  fromTime?: Date | null;
  toTime?: Date | null;
}

/**
 * Custom calendar header for the filter popover.
 *
 * Defaults: clicking the period label toggles month ↔ multi-year (year picker).
 * Here we toggle month ↔ year (month-of-year picker) — picking a date by month
 * is the common path in this app, and the year picker is reached via the
 * back-arrow inside the year view.
 *
 * Template is copied from Material's MatCalendarHeader so we keep the same
 * look; the only behavioral change is the override of currentPeriodClicked().
 */
@Component({
  selector: 'app-dt-calendar-header',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatTooltipModule],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mat-calendar-header">
      <div class="mat-calendar-controls">
        <button matButton type="button" class="mat-calendar-period-button"
                (click)="currentPeriodClicked()"
                [attr.aria-label]="periodButtonLabel">
          <span aria-hidden="true">{{ periodButtonText }}</span>
          <svg class="mat-calendar-arrow"
               [class.mat-calendar-invert]="calendar.currentView !== 'month'"
               viewBox="0 0 10 5" focusable="false" aria-hidden="true">
            <polygon points="0,0 5,5 10,0"/>
          </svg>
        </button>
        <div class="mat-calendar-spacer"></div>
        <ng-content></ng-content>
        <button matIconButton type="button" class="mat-calendar-previous-button"
                [disabled]="!previousEnabled()" (click)="previousClicked()"
                [matTooltip]="prevButtonLabel"
                [attr.aria-label]="prevButtonLabel">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>
        <button matIconButton type="button" class="mat-calendar-next-button"
                [disabled]="!nextEnabled()" (click)="nextClicked()"
                [matTooltip]="nextButtonLabel"
                [attr.aria-label]="nextButtonLabel">
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class DtCalendarHeader<D> extends MatCalendarHeader<D> {
  override currentPeriodClicked(): void {
    // Cycle month → year (pick month) → multi-year (pick year) → month.
    // Default Material behavior skips the month-picker step (month ↔ multi-year);
    // this gives users a one-click path to month selection while still keeping
    // the year picker reachable.
    const next: Record<string, 'month' | 'year' | 'multi-year'> = {
      month: 'year',
      year: 'multi-year',
      'multi-year': 'month',
    };
    this.calendar.currentView = next[this.calendar.currentView];
  }
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTableModule,
    MatPaginatorModule,
    MatSortModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCardModule,
    MatTooltipModule,
    MatMenuModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatTimepickerModule,
    PageHeaderComponent
],
  providers: [provideIsoDates()],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss'
})
export class DataTableComponent<T = any>
  implements OnInit, OnChanges
{
  @Input() data: T[] = [];
  @Input() config!: DataTableConfig<T>;
  @Input() loading = false;

  @Output() action = new EventEmitter<DataActionEvent<T>>();
  @Output() sortChange = new EventEmitter<DataSortEvent>();
  @Output() pageChange = new EventEmitter<DataPageEvent>();
  @Output() filterChange = new EventEmitter<DataFilterEvent>();
  @Output() rowClick = new EventEmitter<{ row: T; index: number }>();
  @Output() selectionChange = new EventEmitter<T[]>();
  @Output() globalFilterChange = new EventEmitter<string>();

  private _paginator?: MatPaginator;
  private _sort?: MatSort;

  @ViewChild(MatPaginator)
  set paginator(p: MatPaginator | undefined) {
    if (this._paginator === p) return;
    this._paginator = p;
    if (!p) return;
    // Defer the dataSource wiring to a microtask so this side-effect
    // doesn't run inside Angular's current change detection cycle
    // (which would emit page/length changes mid-CD and crash).
    Promise.resolve().then(() => {
      if (this._paginator !== p) return;
      if (this.config?.pagination?.enabled) {
        this.dataSource.paginator = p;
        p.length = this.dataSource.filteredData?.length ?? this.data?.length ?? 0;
      }
    });
  }
  get paginator(): MatPaginator | undefined { return this._paginator; }

  @ViewChild(MatSort)
  set sort(s: MatSort | undefined) {
    if (this._sort === s) return;
    this._sort = s;
    if (!s) return;
    // Same reason as paginator: s.sort() emits sortChange synchronously.
    // Wiring it inside the setter would mutate state inside CD and
    // throw ExpressionChangedAfterItHasBeenChecked.
    Promise.resolve().then(() => {
      if (this._sort !== s) return;
      this.dataSource.sort = s;
      if (this.config?.defaultSort && !s.active) {
        s.sort({
          id: this.config.defaultSort.column as string,
          start: this.config.defaultSort.direction,
          disableClear: false
        });
      }
    });
  }
  get sort(): MatSort | undefined { return this._sort; }

  @ViewChildren(MatMenuTrigger) menuTriggers!: QueryList<MatMenuTrigger>;

  dataSource = new MatTableDataSource<T>();
  displayedColumns: string[] = [];

  private readonly cdr = inject(ChangeDetectorRef);

  private _globalFilter = '';
  @Input()
  set globalFilter(value: string) {
    const next = value ?? '';
    if (this._globalFilter === next) return;
    this._globalFilter = next;
    // commitFilter may run before the data source is initialised on first
    // change-detection pass; the predicate runs against an empty data set
    // in that case, which is fine.
    this.commitFilter();
  }
  get globalFilter(): string { return this._globalFilter; }

  /** Applied per-column filters (drive the data-source filter predicate). */
  appliedFilters: Record<string, DataColumnFilterEntry> = {};

  /** Draft per-column filters (live state inside an open popover). */
  draftFilters: Record<string, DraftFilter> = {};

  private readonly selectionIds = new SelectionModel<string>(true, []);

  /** Custom header so the period click goes month ↔ year (not multi-year). */
  readonly calendarHeaderComponent = DtCalendarHeader;

  ngOnInit(): void {
    this.applyConfigDefaults();
    this.rebuildDisplayedColumns();
    this.installFilterPredicate();
    this.installSortAccessor();
  }

  // Sort and paginator are wired through @ViewChild setters above, which also
  // handle the case where the table renders after data arrives (loading ->
  // table view transition) — so no ngAfterViewInit is needed.

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      this.dataSource.data = this.data || [];
      this.pruneStaleSelection();
      if (this.paginator) this.paginator.length = this.data?.length ?? 0;
    }
    if (changes['config']) {
      this.applyConfigDefaults();
      this.rebuildDisplayedColumns();
      this.installFilterPredicate();
      this.installSortAccessor();
    }
  }

  // -------- config / columns --------

  private applyConfigDefaults(): void {
    this.config = {
      ...this.config,
      pagination: { ...DEFAULT_DATA_PAGINATION, ...this.config?.pagination },
      empty: { ...DEFAULT_DATA_EMPTY, ...this.config?.empty },
      filter: { ...DEFAULT_DATA_FILTER, ...this.config?.filter },
      bordered: this.config?.bordered ?? true,
      striped: this.config?.striped ?? false,
      hoverable: this.config?.hoverable ?? true,
      showRowNumbers: this.config?.showRowNumbers ?? false
    };
  }

  private rebuildDisplayedColumns(): void {
    const keys: string[] = [];
    if (this.config.showRowNumbers) keys.push('__row');
    if (this.config.selection?.enabled) keys.push('__select');
    keys.push(...this.config.columns.map(c => String(c.key)));
    if (this.config.actions?.length) keys.push('__actions');
    this.displayedColumns = keys;
  }

  /**
   * Lazily return the draft state for a column's popover, creating an empty
   * one on first access. Used from the template so that bindings inside
   * mat-menu content never read `undefined` — regardless of when the
   * menu's template instantiates vs. when (menuOpened) fires.
   */
  draftFor(col: DataColumnConfig<T>): DraftFilter {
    const key = String(col.key);
    let d = this.draftFilters[key];
    if (!d) {
      d = this.emptyDraft(col.columnFilterType ?? 'text');
      this.draftFilters[key] = d;
    }
    return d;
  }

  private emptyDraft(type: DataColumnFilterType): DraftFilter {
    return {
      type,
      text: '',
      selectedValues: new Set<string>(),
      selectSearch: '',
      min: null,
      max: null,
      from: null,
      to: null,
      fromTime: null,
      toTime: null
    };
  }

  // -------- filter predicate & sort accessor --------

  private installFilterPredicate(): void {
    this.dataSource.filterPredicate = (row: T, raw: string) => {
      if (!raw) return true;
      let state: DataCombinedFilterState;
      try { state = JSON.parse(raw); } catch { return true; }

      if (state.global) {
        const needle = state.global.toLowerCase();
        const filterable = this.config.columns.filter(c => c.filterable);
        const ok = filterable.some(col => {
          const v = (row as any)[col.key];
          if (v == null) return false;
          const display = col.transform
            ? (col.transform(v, row) ?? '').toLowerCase()
            : String(v).toLowerCase();
          return display.includes(needle);
        });
        if (!ok) return false;
      }

      for (const [colKey, entry] of Object.entries(state.columns)) {
        if (!entry) continue;
        const col = this.config.columns.find(c => String(c.key) === colKey);
        if (!col) continue;
        const raw = (row as any)[col.key];

        switch (entry.type) {
          case 'text': {
            if (!entry.value) continue;
            if (raw == null) return false;
            const display = col.transform
              ? (col.transform(raw, row) ?? '').toLowerCase()
              : String(raw).toLowerCase();
            if (!display.includes(entry.value.toLowerCase())) return false;
            break;
          }
          case 'option': {
            if (!entry.values?.length) continue;
            if (raw == null) return false;
            const display = col.transform ? col.transform(raw, row) : String(raw);
            if (!entry.values.includes(display)) return false;
            break;
          }
          case 'range': {
            if (entry.min == null && entry.max == null) continue;
            const num = typeof raw === 'number' ? raw : Number(raw);
            if (!isFinite(num)) return false;
            if (entry.min != null && num < entry.min) return false;
            if (entry.max != null && num > entry.max) return false;
            break;
          }
          case 'date': {
            if (!entry.from && !entry.to) continue;
            if (raw == null) return false;
            const d = new Date(raw as any);
            if (isNaN(d.getTime())) return false;
            if (entry.from && d < new Date(entry.from)) return false;
            if (entry.to && d > new Date(entry.to)) return false;
            break;
          }
        }
      }

      return true;
    };
  }

  private installSortAccessor(): void {
    this.dataSource.sortingDataAccessor = (row: T, id: string) => {
      const col = this.config.columns.find(c => String(c.key) === id);
      const v = col ? (row as any)[col.key] : (row as any)[id];
      if (v == null) return '';
      if (typeof v === 'number') return v;
      const asDate = Date.parse(v);
      if (!isNaN(asDate) && /^\d{4}-\d{2}-\d{2}/.test(String(v))) return asDate;
      return String(v);
    };
  }

  // -------- global filter --------

  onGlobalFilterInput(ev: Event): void {
    this.setGlobalFilterFromUI((ev.target as HTMLInputElement).value);
  }

  clearGlobalFilter(): void {
    this.setGlobalFilterFromUI('');
  }

  private setGlobalFilterFromUI(value: string): void {
    const next = value ?? '';
    if (this._globalFilter === next) return;
    this._globalFilter = next;
    this.commitFilter();
    this.globalFilterChange.emit(next);
  }

  // -------- per-column popover lifecycle --------

  onPopoverOpened(col: DataColumnConfig<T>): void {
    const key = String(col.key);
    const applied = this.appliedFilters[key];
    const type = col.columnFilterType ?? 'text';
    const draft = this.emptyDraft(type);
    switch (type) {
      case 'text':
        draft.text = applied?.value ?? '';
        break;
      case 'option':
        draft.selectedValues = new Set(applied?.values ?? []);
        break;
      case 'range':
        draft.min = applied?.min ?? null;
        draft.max = applied?.max ?? null;
        break;
      case 'date': {
        const f = applied?.from ? new Date(applied.from) : null;
        const t = applied?.to ? new Date(applied.to) : null;
        draft.from = f;
        draft.to = t;
        // Only treat the time component as "user-set" when it isn't the implicit
        // day-boundary default we apply on commit (00:00 for start, 23:59 for end).
        draft.fromTime = f && !this.isStartOfDay(f) ? new Date(f) : null;
        draft.toTime = t && !this.isEndOfDay(t) ? new Date(t) : null;
        break;
      }
    }
    this.draftFilters[key] = draft;
  }

  /**
   * Give the filter popover its column's width. The .dt-th__anchor span spans
   * the header cell, so Material already opens the panel at the column's left
   * edge; this just stops it being a fixed 280px regardless of the column.
   */
  sizePopoverToColumn(headerContent: HTMLElement): void {
    const th = headerContent.closest('th');
    if (!th) return;
    // The panel only enters the DOM when the overlay attaches — measure next frame.
    requestAnimationFrame(() => {
      const panel = document.querySelector<HTMLElement>('.mat-mdc-menu-panel.dt-filter-menu');
      if (!panel) return;
      const width = Math.min(
        Math.max(th.getBoundingClientRect().width, POPOVER_MIN_WIDTH),
        POPOVER_MAX_WIDTH
      );
      panel.style.width = `${width}px`;
    });
  }

  resetDraft(col: DataColumnConfig<T>): void {
    const key = String(col.key);
    this.draftFilters[key] = this.emptyDraft(col.columnFilterType ?? 'text');
  }

  applyDraft(col: DataColumnConfig<T>): void {
    if (this.isDateRangeInvalid(col)) return;
    const key = String(col.key);
    const entry = this.buildEntryFromDraft(this.draftFor(col));
    if (this.isEntryEmpty(entry)) {
      delete this.appliedFilters[key];
    } else {
      this.appliedFilters[key] = entry;
    }
    this.commitFilter();
    this.closeOpenMenus();
  }

  /** Apply the current draft live (no menu close). Called on every change inside the popover. */
  onDraftChanged(col: DataColumnConfig<T>): void {
    const key = String(col.key);
    // Hold off committing an inverted date range — the inline error tells the
    // user what's wrong; pushing the bad range through would empty the table.
    if (this.isDateRangeInvalid(col)) return;
    const entry = this.buildEntryFromDraft(this.draftFor(col));
    if (this.isEntryEmpty(entry)) {
      if (key in this.appliedFilters) {
        delete this.appliedFilters[key];
        this.commitFilter();
      }
    } else {
      this.appliedFilters[key] = entry;
      this.commitFilter();
    }
  }

  /** True when the draft has both edges set and the "to" timestamp is earlier than "from". */
  isDateRangeInvalid(col: DataColumnConfig<T>): boolean {
    const d = this.draftFor(col);
    if (d.type !== 'date') return false;
    if (!d.from || !d.to) return false;
    const from = this.combineDateAndTime(d.from, d.fromTime, 'start');
    const to = this.combineDateAndTime(d.to, d.toTime, 'end');
    if (!from || !to) return false;
    return new Date(to).getTime() < new Date(from).getTime();
  }

  /** Lower bound for the "To" date input — the currently-picked From date (calendar day). */
  dateMinForTo(col: DataColumnConfig<T>): Date | null {
    const f = this.draftFor(col).from;
    return f ? this.atStartOfDay(f) : null;
  }

  /**
   * Lower bound for the "To" time input — only constraining when From and To
   * are on the same calendar day; otherwise the time is free to be anything.
   */
  timeMinForTo(col: DataColumnConfig<T>): Date | null {
    const d = this.draftFor(col);
    if (!d.from || !d.to) return null;
    if (!this.isSameCalendarDay(d.from, d.to)) return null;
    return d.fromTime instanceof Date ? d.fromTime : null;
  }

  private atStartOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
  }
  private isSameCalendarDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  private closeOpenMenus(): void {
    this.menuTriggers?.forEach(t => { if (t.menuOpen) t.closeMenu(); });
  }

  private buildEntryFromDraft(d: DraftFilter): DataColumnFilterEntry {
    switch (d.type) {
      case 'text':
        return { type: 'text', value: (d.text ?? '').trim() };
      case 'option':
        return { type: 'option', values: Array.from(d.selectedValues ?? []) };
      case 'range':
        return {
          type: 'range',
          min: d.min == null || isNaN(d.min) ? undefined : d.min,
          max: d.max == null || isNaN(d.max) ? undefined : d.max
        };
      case 'date':
        return {
          type: 'date',
          from: this.combineDateAndTime(d.from, d.fromTime, 'start'),
          to: this.combineDateAndTime(d.to, d.toTime, 'end')
        };
    }
  }

  private isStartOfDay(d: Date): boolean {
    return d.getHours() === 0 && d.getMinutes() === 0;
  }
  private isEndOfDay(d: Date): boolean {
    return d.getHours() === 23 && d.getMinutes() === 59;
  }

  /**
   * Combine a calendar date with a time-of-day Date (mat-timepicker value)
   * into an ISO timestamp. If no date is picked, returns undefined.
   * If no time is picked, defaults to 00:00 for the start edge of the range
   * and 23:59:59 for the end so a date-only range still feels like an
   * inclusive day.
   */
  private combineDateAndTime(
    date: Date | null | undefined,
    time: Date | null | undefined,
    edge: 'start' | 'end'
  ): string | undefined {
    if (!date) return undefined;
    const out = new Date(date);
    if (time instanceof Date && !isNaN(time.getTime())) {
      out.setHours(time.getHours(), time.getMinutes(), 0, 0);
    } else if (edge === 'end') {
      out.setHours(23, 59, 59, 999);
    } else {
      out.setHours(0, 0, 0, 0);
    }
    return out.toISOString();
  }

  private isEntryEmpty(entry: DataColumnFilterEntry): boolean {
    switch (entry.type) {
      case 'text': return !entry.value;
      case 'option': return !entry.values?.length;
      case 'range': return entry.min == null && entry.max == null;
      case 'date': return !entry.from && !entry.to;
    }
  }

  // -------- option filter helpers --------

  getOptionList(col: DataColumnConfig<T>): DataSelectOption[] {
    if (col.columnFilterOptions) return col.columnFilterOptions;
    const counts = new Map<string, number>();
    for (const row of this.data || []) {
      const v = (row as any)[col.key];
      if (v == null) continue;
      const display = col.transform ? col.transform(v, row) : String(v);
      counts.set(display, (counts.get(display) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([value, count]) => ({ value, label: value, count }));
  }

  filteredOptionList(col: DataColumnConfig<T>): DataSelectOption[] {
    const key = String(col.key);
    const needle = (this.draftFilters[key]?.selectSearch ?? '').toLowerCase().trim();
    const list = this.getOptionList(col);
    if (!needle) return list;
    return list.filter(o => o.label.toLowerCase().includes(needle));
  }

  trackOptionByValue = (_: number, opt: DataSelectOption): string => opt.value;

  toggleDraftOption(col: DataColumnConfig<T>, value: string): void {
    const draft = this.draftFor(col);
    if (!draft.selectedValues) draft.selectedValues = new Set();
    if (draft.selectedValues.has(value)) draft.selectedValues.delete(value);
    else draft.selectedValues.add(value);
    this.onDraftChanged(col);
  }

  isDraftOptionChecked(col: DataColumnConfig<T>, value: string): boolean {
    return this.draftFor(col).selectedValues?.has(value) ?? false;
  }

  // -------- range filter helpers --------

  getRangeBounds(col: DataColumnConfig<T>): { min: number; max: number } {
    if (col.rangeMin != null && col.rangeMax != null) {
      return { min: col.rangeMin, max: col.rangeMax };
    }
    let min = Infinity, max = -Infinity;
    for (const row of this.data || []) {
      const v = (row as any)[col.key];
      const n = typeof v === 'number' ? v : Number(v);
      if (isFinite(n)) {
        if (n < min) min = n;
        if (n > max) max = n;
      }
    }
    if (!isFinite(min)) return { min: 0, max: 0 };
    return { min, max };
  }

  histogramBins(col: DataColumnConfig<T>, count = 10): { height: number; inRange: boolean }[] {
    const { min, max } = this.getRangeBounds(col);
    if (max <= min) return Array.from({ length: count }, () => ({ height: 0, inRange: false }));
    const width = (max - min) / count;
    const counts = new Array<number>(count).fill(0);
    for (const row of this.data || []) {
      const v = (row as any)[col.key];
      const n = typeof v === 'number' ? v : Number(v);
      if (!isFinite(n)) continue;
      const i = Math.min(count - 1, Math.max(0, Math.floor((n - min) / width)));
      counts[i]++;
    }
    const peak = Math.max(...counts, 1);
    const draft = this.draftFor(col);
    const lo = draft.min ?? min;
    const hi = draft.max ?? max;
    return counts.map((c, i) => {
      const binStart = min + i * width;
      const binEnd = binStart + width;
      return {
        height: (c / peak) * 100,
        inRange: binEnd >= lo && binStart <= hi,
      };
    });
  }

  rangeFillPct(col: DataColumnConfig<T>): { lo: number; hi: number } {
    const { min, max } = this.getRangeBounds(col);
    if (max <= min) return { lo: 0, hi: 100 };
    const draft = this.draftFor(col);
    const lo = draft.min ?? min;
    const hi = draft.max ?? max;
    return {
      lo: Math.max(0, Math.min(100, ((lo - min) / (max - min)) * 100)),
      hi: Math.max(0, Math.min(100, ((hi - min) / (max - min)) * 100)),
    };
  }

  // -------- date preset --------

  // -------- commit & emit --------

  private commitFilter(): void {
    const state: DataCombinedFilterState = {
      global: this.globalFilter.trim().toLowerCase(),
      columns: { ...this.appliedFilters }
    };
    const hasFilter =
      state.global.length > 0 || Object.keys(state.columns).length > 0;
    this.dataSource.filter = hasFilter ? JSON.stringify(state) : '';
    if (this.paginator) this.paginator.firstPage();
    this.filterChange.emit({
      global: this.globalFilter,
      columnFilters: { ...this.appliedFilters }
    });
  }

  clearColumnFilter(columnKey: string): void {
    delete this.appliedFilters[columnKey];
    delete this.draftFilters[columnKey];
    this.commitFilter();
  }

  clearAllFilters(): void {
    this.appliedFilters = {};
    this.setGlobalFilterFromUI('');
    // setGlobalFilterFromUI already commits, but only when value changed;
    // re-commit so cleared column filters also take effect when search is unchanged.
    this.commitFilter();
    // Pages with their own toolbar call this from outside the view, where no
    // event binding of ours has marked the component dirty.
    this.cdr.markForCheck();
  }

  /**
   * The rows the grid is currently showing across all pages — filtered by the
   * search box and column popovers, in the active sort order. Pages exporting
   * the grid read this so the file matches what the operator sees.
   */
  getVisibleRows(): T[] {
    const rows = [...(this.dataSource.filteredData ?? [])];
    const s = this.sort;
    return s?.active && s.direction ? this.dataSource.sortData(rows, s) : rows;
  }

  /** True when a global search term or any column filter is currently applied. */
  hasAnyFilter(): boolean {
    return this.globalFilter.length > 0 || Object.keys(this.appliedFilters).length > 0;
  }

  // -------- cell rendering --------

  cellDisplay(row: T, col: DataColumnConfig<T>): string {
    const v = (row as any)[col.key];

    // A transform sees null/undefined too: that is where a column decides what an absent
    // value reads as ('Never', 'Perpetual', an em dash). Only untransformed columns blank out.
    if (col.transform) return col.transform(v, row);
    return v == null ? '' : String(v);
  }

  badgeTone(row: T, col: DataColumnConfig<T>): BadgeTone {
    if (!col.badgeTone) return 'neutral';
    return col.badgeTone(this.cellDisplay(row, col), row);
  }

  // -------- selection --------

  private selectionKey(row: T): string {
    const k = this.config.selection?.idKey ?? ('id' as keyof T);
    return String((row as any)[k]);
  }

  isRowSelected(row: T): boolean {
    return this.selectionIds.isSelected(this.selectionKey(row));
  }

  onRowCheckboxChange(row: T, checked: boolean): void {
    if (!this.config.selection?.enabled) return;
    const id = this.selectionKey(row);
    const max = this.config.selection.max ?? 200;
    if (checked) {
      if (!this.selectionIds.isSelected(id) && this.selectionIds.selected.length >= max) return;
      this.selectionIds.select(id);
    } else {
      this.selectionIds.deselect(id);
    }
    this.emitSelection();
  }

  private getCurrentPageRows(): T[] {
    const rows = this.dataSource.filteredData || [];
    if (!this.paginator || !this.config.pagination?.enabled) return rows;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return rows.slice(start, start + this.paginator.pageSize);
  }

  isAllCurrentPageSelected(): boolean {
    const p = this.getCurrentPageRows();
    return p.length > 0 && p.every(r => this.selectionIds.isSelected(this.selectionKey(r)));
  }

  isSomeCurrentPageSelected(): boolean {
    return this.getCurrentPageRows().some(r => this.selectionIds.isSelected(this.selectionKey(r)));
  }

  onMasterCheckboxChange(checked: boolean): void {
    if (!this.config.selection?.enabled) return;
    const page = this.getCurrentPageRows();
    if (checked) {
      const max = this.config.selection.max ?? 200;
      for (const row of page) {
        if (this.selectionIds.selected.length >= max) break;
        this.selectionIds.select(this.selectionKey(row));
      }
    } else {
      for (const row of page) this.selectionIds.deselect(this.selectionKey(row));
    }
    this.emitSelection();
  }

  private pruneStaleSelection(): void {
    if (!this.config.selection?.enabled) return;
    const valid = new Set((this.data || []).map(r => this.selectionKey(r)));
    for (const id of [...this.selectionIds.selected]) {
      if (!valid.has(id)) this.selectionIds.deselect(id);
    }
    this.emitSelection();
  }

  private emitSelection(): void {
    if (!this.config.selection?.enabled) return;
    const k = this.config.selection.idKey ?? ('id' as keyof T);
    const rows = (this.data || []).filter(r => this.selectionIds.isSelected(String((r as any)[k])));
    this.selectionChange.emit(rows);
  }

  // -------- misc emitters --------

  onSortChange(ev: any): void {
    this.sortChange.emit({ column: ev.active, direction: ev.direction });
  }
  onPageChange(ev: any): void {
    this.pageChange.emit({ pageIndex: ev.pageIndex, pageSize: ev.pageSize, length: ev.length });
  }
  onActionClick(actionCfg: DataActionConfig<T>, row: T, rowIndex: number): void {
    this.action.emit({ type: 'action', action: actionCfg.action, row, rowIndex });
  }
  /** Reset-filters is dead weight with nothing applied, so grey it out. */
  isHeaderActionDisabled(actionCfg: DataHeaderActionConfig): boolean {
    if (actionCfg.loading) return true;
    return actionCfg.action === 'clear-filters' && !this.hasAnyFilter();
  }

  onHeaderActionClick(actionCfg: { action: string }): void {
    if (actionCfg.action === 'clear-filters') {
      this.clearAllFilters();
      return;
    }
    this.action.emit({ type: 'header-action', action: actionCfg.action, row: null, rowIndex: -1 });
  }
  onRowClick(ev: MouseEvent, row: T, index: number): void {
    if (!this.config.rowClickable) return;
    const t = ev.target as HTMLElement;
    if (
      t.closest('button') || t.closest('a') || t.closest('input') ||
      t.closest('mat-checkbox') || t.closest('.mat-mdc-checkbox') ||
      t.closest('.mat-mdc-menu-trigger') || t.closest('.dt-filter-icon')
    ) return;
    this.rowClick.emit({ row, index });
  }

  // -------- view helpers --------

  columnKey(col: DataColumnConfig<T>): string { return String(col.key); }

  hasAppliedFilter(columnKey: string): boolean {
    return columnKey in this.appliedFilters;
  }

  rowMuted(row: T): boolean {
    return this.config.rowMutedWhen?.(row) === true;
  }

  isEmpty(): boolean {
    return (this.dataSource.data?.length ?? 0) === 0 && !this.loading;
  }

  shouldShowNoResults(): boolean {
    return this.hasAnyFilter() && (this.dataSource.filteredData?.length ?? 0) === 0 && !this.loading;
  }

  paginatorLength(): number {
    return this.dataSource.filteredData?.length ?? this.data?.length ?? 0;
  }

  /** Count pill text for the header bar, or null while there is nothing to count. */
  get headerCount(): string | null {
    if (this.loading || this.isEmpty()) return null;
    const n = this.paginatorLength();
    return `${n} ${n === 1 ? 'Item' : 'Items'}`;
  }

  rowNumber(i: number): number {
    if (this.paginator && this.config.pagination?.enabled) {
      return this.paginator.pageIndex * this.paginator.pageSize + i + 1;
    }
    return i + 1;
  }
}
