/**
 * DataTable (v2) configuration types.
 *
 * Forked from table.models.ts so the v2 component can evolve independently
 * without affecting pages still using app-generic-table.
 */

import { TemplateRef } from '@angular/core';

export type DataColumnFilterType = 'text' | 'option' | 'range' | 'date';

export type DataCellType = 'text' | 'badge' | 'tnum' | 'mono';

export type BadgeTone =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

export interface DataSelectOption {
  value: string;
  label: string;
  /** Optional count rendered to the right of the option label. */
  count?: number;
  /** Optional tone for a leading status dot (e.g. info/success). */
  tone?: BadgeTone;
}

export interface DateRangePreset {
  /** Preset chip label, e.g. "Today", "Last 4h". */
  label: string;
  /** Returns the [from, to] window when the chip is picked. */
  range: () => { from: Date | null; to: Date | null };
}

/**
 * Active filter state — what the table is currently filtering by.
 * Distinct from the draft state inside an open popover, which is staged
 * until the user clicks Apply.
 */
export interface DataColumnFilterEntry {
  type: DataColumnFilterType;
  /** text. */
  value?: string;
  /** option (multi-select). */
  values?: string[];
  /** range (numeric). */
  min?: number;
  max?: number;
  /** date (ISO strings). */
  from?: string;
  to?: string;
}

export interface DataColumnConfig<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  /** Included in the global search predicate. */
  filterable?: boolean;
  /** CSS width (e.g. '120px', '12%'). */
  width?: string;
  headerClass?: string;
  cellClass?: string;
  /** Custom cell template — wins over cellType. */
  template?: TemplateRef<any>;
  /** Built-in cell renderer. Defaults to 'text'. */
  cellType?: DataCellType;
  /** Display transform for the cell (and for select/global filter matching). */
  transform?: (value: any, row: T) => string;
  /**
   * Map a cell value to a badge tone. Only used when cellType === 'badge'.
   * Receives the *transformed* display string.
   */
  badgeTone?: (display: string, row: T) => BadgeTone;

  /** Whether this column has a header-icon filter popover. */
  columnFilter?: boolean;
  columnFilterType?: DataColumnFilterType;

  /** Options for 'option' filter; auto-derived from data if omitted. */
  columnFilterOptions?: DataSelectOption[];

  /** Bounds for 'range' filter; auto-derived from data if omitted. */
  rangeMin?: number;
  rangeMax?: number;
  rangeStep?: number;
  /** Suffix shown after numbers in the range popover, e.g. '%', ' totes'. */
  rangeUnit?: string;

  /** Presets for 'date' filter. */
  datePresets?: DateRangePreset[];
}

export interface DataActionConfig<T = any> {
  action: string;
  label: string;
  icon?: string;
  type?: 'icon' | 'button' | 'menu-item';
  color?: 'primary' | 'accent' | 'warn';
  tooltip?: string;
  disabled?: (row: T) => boolean;
  hidden?: (row: T) => boolean;
  cssClass?: string;
}

export interface DataHeaderActionConfig {
  action: string;
  label: string;
  icon?: string;
  type?: 'icon' | 'button' | 'raised' | 'stroked';
  color?: 'primary' | 'accent' | 'warn';
  tooltip?: string;
  loading?: boolean;
  cssClass?: string;
}

export interface DataPaginationConfig {
  pageSizeOptions: number[];
  pageSize: number;
  showFirstLastButtons?: boolean;
  enabled?: boolean;
}

export interface DataFilterConfig {
  placeholder: string;
  enabled?: boolean;
  fields?: string[];
}

export interface DataEmptyConfig {
  message: string;
  icon?: string;
}

export interface DataTableSelectionConfig<T = any> {
  enabled: boolean;
  max?: number;
  idKey?: keyof T;
}

export interface DataTableConfig<T> {
  title: string;
  /** Material icon rendered before the title. Omit for a title-only header. */
  icon?: string;
  /** Optional subtitle line under the title. */
  subtitle?: string;
  columns: DataColumnConfig<T>[];
  actions?: DataActionConfig<T>[];
  headerActions?: DataHeaderActionConfig[];
  pagination?: DataPaginationConfig;
  filter?: DataFilterConfig;
  empty?: DataEmptyConfig;
  selection?: DataTableSelectionConfig<T>;
  /** Default sort applied on mount. */
  defaultSort?: {
    column: keyof T;
    direction: 'asc' | 'desc';
  };
  showRowNumbers?: boolean;
  rowClickable?: boolean;
  rowMutedWhen?: (row: T) => boolean;
  bordered?: boolean;
  striped?: boolean;
  hoverable?: boolean;
  compact?: boolean;
  cssClass?: string;
}

export interface DataActionEvent<T = any> {
  type: 'action' | 'header-action';
  action: string;
  row: T | null;
  rowIndex: number;
}

export interface DataSortEvent {
  column: string;
  direction: 'asc' | 'desc' | '';
}

export interface DataPageEvent {
  pageIndex: number;
  pageSize: number;
  length: number;
}

export interface DataFilterEvent {
  global: string;
  columnFilters: Record<string, DataColumnFilterEntry>;
}

export interface DataCombinedFilterState {
  global: string;
  columns: Record<string, DataColumnFilterEntry>;
}

export const DEFAULT_DATE_PRESETS: DateRangePreset[] = [
  {
    label: 'Today',
    range: () => {
      const from = new Date(); from.setHours(0, 0, 0, 0);
      const to = new Date(); to.setHours(23, 59, 59, 999);
      return { from, to };
    }
  },
  {
    label: 'Last 4h',
    range: () => {
      const to = new Date();
      const from = new Date(to.getTime() - 4 * 60 * 60 * 1000);
      return { from, to };
    }
  },
  {
    label: '24h',
    range: () => {
      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      return { from, to };
    }
  },
  {
    label: '7d',
    range: () => {
      const to = new Date();
      const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { from, to };
    }
  }
];

export const DEFAULT_DATA_PAGINATION: DataPaginationConfig = {
  pageSizeOptions: [50, 100, 150, 200],
  pageSize: 50,
  showFirstLastButtons: true,
  enabled: true
};

export const DEFAULT_DATA_EMPTY: DataEmptyConfig = {
  message: 'No data available',
  icon: 'inbox'
};

export const DEFAULT_DATA_FILTER: DataFilterConfig = {
  placeholder: 'Search...',
  enabled: true
};
