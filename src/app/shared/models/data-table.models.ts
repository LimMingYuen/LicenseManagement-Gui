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
  /** Count rendered to the right of the option label. */
  count?: number;
  /** Tone of a leading status dot. */
  tone?: BadgeTone;
}

export interface DateRangePreset {
  label: string;
  /** Returns the [from, to] window applied when the chip is picked. */
  range: () => { from: Date | null; to: Date | null };
}

/** Applied filter state of one column, separate from the draft staged in an open popover. */
export interface DataColumnFilterEntry {
  type: DataColumnFilterType;
  /** Value of a 'text' filter. */
  value?: string;
  /** Selected values of an 'option' filter. */
  values?: string[];
  /** Bounds of a 'range' filter. */
  min?: number;
  max?: number;
  /** ISO bounds of a 'date' filter. */
  from?: string;
  to?: string;
}

export interface DataColumnConfig<T> {
  key: keyof T;
  header: string;
  sortable?: boolean;
  /** Included in the global search predicate. */
  filterable?: boolean;
  /** CSS width such as '120px' or '12%'. */
  width?: string;
  headerClass?: string;
  cellClass?: string;
  /** Custom cell template; takes precedence over cellType. */
  template?: TemplateRef<any>;
  /** Built-in cell renderer; defaults to 'text'. */
  cellType?: DataCellType;
  /** Display transform, also used for option and global filter matching. */
  transform?: (value: any, row: T) => string;
  /** Maps the transformed display string to a badge tone when cellType is 'badge'. */
  badgeTone?: (display: string, row: T) => BadgeTone;

  /** Enables a header-icon filter popover for the column. */
  columnFilter?: boolean;
  columnFilterType?: DataColumnFilterType;

  /** Options for an 'option' filter; derived from the data when omitted. */
  columnFilterOptions?: DataSelectOption[];

  /** Bounds for a 'range' filter; derived from the data when omitted. */
  rangeMin?: number;
  rangeMax?: number;
  rangeStep?: number;
  /** Suffix shown after numbers in the range popover, such as '%'. */
  rangeUnit?: string;

  /** Preset chips for a 'date' filter. */
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
  /** Material icon rendered before the title. */
  icon?: string;
  subtitle?: string;
  columns: DataColumnConfig<T>[];
  actions?: DataActionConfig<T>[];
  headerActions?: DataHeaderActionConfig[];
  pagination?: DataPaginationConfig;
  filter?: DataFilterConfig;
  empty?: DataEmptyConfig;
  selection?: DataTableSelectionConfig<T>;
  /** Sort applied on mount. */
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
