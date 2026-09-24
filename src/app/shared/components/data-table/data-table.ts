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

/** Width bounds in px for a column filter popover. */
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
  /** Time of day from mat-timepicker; only hours and minutes are used. */
  fromTime?: Date | null;
  toTime?: Date | null;
}

/** Calendar header for the date filter whose period button cycles month, year and multi-year. */
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
  /** Advances the calendar to the next view in the month, year, multi-year cycle. */
  override currentPeriodClicked(): void {
    const next: Record<string, 'month' | 'year' | 'multi-year'> = {
      month: 'year',
      year: 'multi-year',
      'multi-year': 'month',
    };
    this.calendar.currentView = next[this.calendar.currentView];
  }
}

/** Renders a configurable table with search, column filters, sorting, paging and selection. */
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
    this.commitFilter();
  }
  get globalFilter(): string { return this._globalFilter; }

  /** Applied per-column filters that drive the data-source filter predicate. */
  appliedFilters: Record<string, DataColumnFilterEntry> = {};

  /** Draft per-column filters edited inside an open popover. */
  draftFilters: Record<string, DraftFilter> = {};

  private readonly selectionIds = new SelectionModel<string>(true, []);

  readonly calendarHeaderComponent = DtCalendarHeader;

  /** Applies config defaults and installs columns, filter predicate and sort accessor. */
  ngOnInit(): void {
    this.applyConfigDefaults();
    this.rebuildDisplayedColumns();
    this.installFilterPredicate();
    this.installSortAccessor();
  }

  /** Syncs the data source and column setup with changed data or config inputs. */
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

  /** Merges the config with the default pagination, empty, filter and style settings. */
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

  /** Rebuilds the displayed column keys, including row-number, selection and action columns. */
  private rebuildDisplayedColumns(): void {
    const keys: string[] = [];
    if (this.config.showRowNumbers) keys.push('__row');
    if (this.config.selection?.enabled) keys.push('__select');
    keys.push(...this.config.columns.map(c => String(c.key)));
    if (this.config.actions?.length) keys.push('__actions');
    this.displayedColumns = keys;
  }

  /** Returns the draft filter for a column, creating an empty one on first access. */
  draftFor(col: DataColumnConfig<T>): DraftFilter {
    const key = String(col.key);
    let d = this.draftFilters[key];
    if (!d) {
      d = this.emptyDraft(col.columnFilterType ?? 'text');
      this.draftFilters[key] = d;
    }
    return d;
  }

  /** Creates an empty draft filter of the given type. */
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

  /** Installs the predicate that applies the global search and column filters to each row. */
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

  /** Installs the sort accessor that compares numbers, ISO dates and strings. */
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

  /** Applies the search box value as the global filter. */
  onGlobalFilterInput(ev: Event): void {
    this.setGlobalFilterFromUI((ev.target as HTMLInputElement).value);
  }

  /** Clears the global search filter. */
  clearGlobalFilter(): void {
    this.setGlobalFilterFromUI('');
  }

  /** Sets the global filter from user input and emits the change. */
  private setGlobalFilterFromUI(value: string): void {
    const next = value ?? '';
    if (this._globalFilter === next) return;
    this._globalFilter = next;
    this.commitFilter();
    this.globalFilterChange.emit(next);
  }

  // -------- per-column popover lifecycle --------

  /** Seeds a column's draft filter from its applied filter when the popover opens. */
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
        draft.fromTime = f && !this.isStartOfDay(f) ? new Date(f) : null;
        draft.toTime = t && !this.isEndOfDay(t) ? new Date(t) : null;
        break;
      }
    }
    this.draftFilters[key] = draft;
  }

  /** Sizes the open filter popover to its column's width within the popover bounds. */
  sizePopoverToColumn(headerContent: HTMLElement): void {
    const th = headerContent.closest('th');
    if (!th) return;
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

  /** Resets a column's draft filter to empty. */
  resetDraft(col: DataColumnConfig<T>): void {
    const key = String(col.key);
    this.draftFilters[key] = this.emptyDraft(col.columnFilterType ?? 'text');
  }

  /** Applies a column's draft filter and closes the popover. */
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

  /** Applies a column's draft filter live without closing the popover. */
  onDraftChanged(col: DataColumnConfig<T>): void {
    const key = String(col.key);
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

  /** Reports whether a date draft has a "to" timestamp earlier than its "from" timestamp. */
  isDateRangeInvalid(col: DataColumnConfig<T>): boolean {
    const d = this.draftFor(col);
    if (d.type !== 'date') return false;
    if (!d.from || !d.to) return false;
    const from = this.combineDateAndTime(d.from, d.fromTime, 'start');
    const to = this.combineDateAndTime(d.to, d.toTime, 'end');
    if (!from || !to) return false;
    return new Date(to).getTime() < new Date(from).getTime();
  }

  /** Returns the minimum date for the "To" picker, the start of the "From" day. */
  dateMinForTo(col: DataColumnConfig<T>): Date | null {
    const f = this.draftFor(col).from;
    return f ? this.atStartOfDay(f) : null;
  }

  /** Returns the minimum "To" time when both dates fall on the same day, else null. */
  timeMinForTo(col: DataColumnConfig<T>): Date | null {
    const d = this.draftFor(col);
    if (!d.from || !d.to) return null;
    if (!this.isSameCalendarDay(d.from, d.to)) return null;
    return d.fromTime instanceof Date ? d.fromTime : null;
  }

  /** Returns a copy of the date set to midnight. */
  private atStartOfDay(d: Date): Date {
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    return out;
  }
  /** Reports whether two dates fall on the same calendar day. */
  private isSameCalendarDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
  }

  /** Closes any open filter popover. */
  private closeOpenMenus(): void {
    this.menuTriggers?.forEach(t => { if (t.menuOpen) t.closeMenu(); });
  }

  /** Converts a draft filter into an applied filter entry. */
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

  /** Reports whether the time is 00:00. */
  private isStartOfDay(d: Date): boolean {
    return d.getHours() === 0 && d.getMinutes() === 0;
  }
  /** Reports whether the time is 23:59. */
  private isEndOfDay(d: Date): boolean {
    return d.getHours() === 23 && d.getMinutes() === 59;
  }

  /** Combines a date and optional time into an ISO timestamp, defaulting to the day boundary. */
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

  /** Reports whether a filter entry has no criteria. */
  private isEntryEmpty(entry: DataColumnFilterEntry): boolean {
    switch (entry.type) {
      case 'text': return !entry.value;
      case 'option': return !entry.values?.length;
      case 'range': return entry.min == null && entry.max == null;
      case 'date': return !entry.from && !entry.to;
    }
  }

  // -------- option filter helpers --------

  /** Returns the configured options, or distinct display values with counts, for an option filter. */
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

  /** Returns the option list narrowed by the popover's search text. */
  filteredOptionList(col: DataColumnConfig<T>): DataSelectOption[] {
    const key = String(col.key);
    const needle = (this.draftFilters[key]?.selectSearch ?? '').toLowerCase().trim();
    const list = this.getOptionList(col);
    if (!needle) return list;
    return list.filter(o => o.label.toLowerCase().includes(needle));
  }

  trackOptionByValue = (_: number, opt: DataSelectOption): string => opt.value;

  /** Toggles an option in a column's draft filter and applies it live. */
  toggleDraftOption(col: DataColumnConfig<T>, value: string): void {
    const draft = this.draftFor(col);
    if (!draft.selectedValues) draft.selectedValues = new Set();
    if (draft.selectedValues.has(value)) draft.selectedValues.delete(value);
    else draft.selectedValues.add(value);
    this.onDraftChanged(col);
  }

  /** Reports whether an option is selected in a column's draft filter. */
  isDraftOptionChecked(col: DataColumnConfig<T>, value: string): boolean {
    return this.draftFor(col).selectedValues?.has(value) ?? false;
  }

  // -------- range filter helpers --------

  /** Returns the configured or data-derived bounds for a range filter. */
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

  /** Returns histogram bar heights and in-range flags for a range filter. */
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

  /** Returns the selected range as percentages of the column bounds. */
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

  // -------- commit & emit --------

  /** Pushes the combined filter state to the data source and emits filterChange. */
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

  /** Clears the applied and draft filter of one column. */
  clearColumnFilter(columnKey: string): void {
    delete this.appliedFilters[columnKey];
    delete this.draftFilters[columnKey];
    this.commitFilter();
  }

  /** Clears the global search and every column filter. */
  clearAllFilters(): void {
    this.appliedFilters = {};
    this.setGlobalFilterFromUI('');
    this.commitFilter();
    this.cdr.markForCheck();
  }

  /** Returns the filtered rows across all pages in the active sort order. */
  getVisibleRows(): T[] {
    const rows = [...(this.dataSource.filteredData ?? [])];
    const s = this.sort;
    return s?.active && s.direction ? this.dataSource.sortData(rows, s) : rows;
  }

  /** Reports whether a global search term or any column filter is applied. */
  hasAnyFilter(): boolean {
    return this.globalFilter.length > 0 || Object.keys(this.appliedFilters).length > 0;
  }

  // -------- cell rendering --------

  /** Returns the display text of a cell. */
  cellDisplay(row: T, col: DataColumnConfig<T>): string {
    const v = (row as any)[col.key];

    if (col.transform) return col.transform(v, row);
    return v == null ? '' : String(v);
  }

  /** Returns the badge tone of a cell. */
  badgeTone(row: T, col: DataColumnConfig<T>): BadgeTone {
    if (!col.badgeTone) return 'neutral';
    return col.badgeTone(this.cellDisplay(row, col), row);
  }

  // -------- selection --------

  /** Returns the selection ID of a row. */
  private selectionKey(row: T): string {
    const k = this.config.selection?.idKey ?? ('id' as keyof T);
    return String((row as any)[k]);
  }

  /** Reports whether a row is selected. */
  isRowSelected(row: T): boolean {
    return this.selectionIds.isSelected(this.selectionKey(row));
  }

  /** Selects or deselects a row within the selection limit. */
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

  /** Returns the filtered rows on the current page. */
  private getCurrentPageRows(): T[] {
    const rows = this.dataSource.filteredData || [];
    if (!this.paginator || !this.config.pagination?.enabled) return rows;
    const start = this.paginator.pageIndex * this.paginator.pageSize;
    return rows.slice(start, start + this.paginator.pageSize);
  }

  /** Reports whether every row on the current page is selected. */
  isAllCurrentPageSelected(): boolean {
    const p = this.getCurrentPageRows();
    return p.length > 0 && p.every(r => this.selectionIds.isSelected(this.selectionKey(r)));
  }

  /** Reports whether any row on the current page is selected. */
  isSomeCurrentPageSelected(): boolean {
    return this.getCurrentPageRows().some(r => this.selectionIds.isSelected(this.selectionKey(r)));
  }

  /** Selects or deselects every row on the current page within the selection limit. */
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

  /** Drops selected IDs that are no longer in the data. */
  private pruneStaleSelection(): void {
    if (!this.config.selection?.enabled) return;
    const valid = new Set((this.data || []).map(r => this.selectionKey(r)));
    for (const id of [...this.selectionIds.selected]) {
      if (!valid.has(id)) this.selectionIds.deselect(id);
    }
    this.emitSelection();
  }

  /** Emits the currently selected rows. */
  private emitSelection(): void {
    if (!this.config.selection?.enabled) return;
    const k = this.config.selection.idKey ?? ('id' as keyof T);
    const rows = (this.data || []).filter(r => this.selectionIds.isSelected(String((r as any)[k])));
    this.selectionChange.emit(rows);
  }

  // -------- misc emitters --------

  /** Emits a sort change. */
  onSortChange(ev: any): void {
    this.sortChange.emit({ column: ev.active, direction: ev.direction });
  }
  /** Emits a page change. */
  onPageChange(ev: any): void {
    this.pageChange.emit({ pageIndex: ev.pageIndex, pageSize: ev.pageSize, length: ev.length });
  }
  /** Emits a row action. */
  onActionClick(actionCfg: DataActionConfig<T>, row: T, rowIndex: number): void {
    this.action.emit({ type: 'action', action: actionCfg.action, row, rowIndex });
  }
  /** Reports whether a header action is disabled while loading or with no filter to clear. */
  isHeaderActionDisabled(actionCfg: DataHeaderActionConfig): boolean {
    if (actionCfg.loading) return true;
    return actionCfg.action === 'clear-filters' && !this.hasAnyFilter();
  }

  /** Handles clear-filters internally and emits every other header action. */
  onHeaderActionClick(actionCfg: { action: string }): void {
    if (actionCfg.action === 'clear-filters') {
      this.clearAllFilters();
      return;
    }
    this.action.emit({ type: 'header-action', action: actionCfg.action, row: null, rowIndex: -1 });
  }
  /** Emits a row click unless the click landed on an interactive control. */
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

  /** Returns a column's key as a string. */
  columnKey(col: DataColumnConfig<T>): string { return String(col.key); }

  /** Reports whether a column has an applied filter. */
  hasAppliedFilter(columnKey: string): boolean {
    return columnKey in this.appliedFilters;
  }

  /** Reports whether a row is rendered muted. */
  rowMuted(row: T): boolean {
    return this.config.rowMutedWhen?.(row) === true;
  }

  /** Reports whether the table has no data and is not loading. */
  isEmpty(): boolean {
    return (this.dataSource.data?.length ?? 0) === 0 && !this.loading;
  }

  /** Reports whether filters are applied and match no rows. */
  shouldShowNoResults(): boolean {
    return this.hasAnyFilter() && (this.dataSource.filteredData?.length ?? 0) === 0 && !this.loading;
  }

  /** Returns the number of filtered rows. */
  paginatorLength(): number {
    return this.dataSource.filteredData?.length ?? this.data?.length ?? 0;
  }

  /** Count pill text for the header bar, or null when there is nothing to count. */
  get headerCount(): string | null {
    if (this.loading || this.isEmpty()) return null;
    const n = this.paginatorLength();
    return `${n} ${n === 1 ? 'Item' : 'Items'}`;
  }

  /** Returns the 1-based row number across pages. */
  rowNumber(i: number): number {
    if (this.paginator && this.config.pagination?.enabled) {
      return this.paginator.pageIndex * this.paginator.pageSize + i + 1;
    }
    return i + 1;
  }
}
