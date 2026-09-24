import { Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MatDateFormats, NativeDateAdapter } from '@angular/material/core';

/** Material date and time formats that display and parse dates as `YYYY-MM-DD`. */
export const ISO_DATE_FORMATS: MatDateFormats = {
  parse: {
    dateInput: 'YYYY-MM-DD',
    timeInput: null,
  },
  display: {
    dateInput: { year: 'numeric', month: '2-digit', day: '2-digit' },
    monthYearLabel: { year: 'numeric', month: 'short' },
    dateA11yLabel: { year: 'numeric', month: 'long', day: 'numeric' },
    monthYearA11yLabel: { year: 'numeric', month: 'long' },
    timeInput: { hour: '2-digit', minute: '2-digit', hour12: false },
    timeOptionLabel: { hour: '2-digit', minute: '2-digit', hour12: false },
  },
};

/** Date adapter that formats and parses dates in ISO order regardless of browser locale. */
export class IsoDateAdapter extends NativeDateAdapter {
  /** Formats date-only formats as `YYYY-MM-DD` and delegates time formats to the base adapter. */
  override format(date: Date, displayFormat: object): string {
    if (typeof displayFormat === 'object' && this.isDateFormat(displayFormat)) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return super.format(date, displayFormat);
  }

  /** Parses a `YYYY-MM-DD` string as a local date, falling back to the base adapter. */
  override parse(value: any): Date | null {
    if (typeof value === 'string' && value.length > 0) {
      const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (match) return new Date(+match[1], +match[2] - 1, +match[3]);
    }
    return super.parse(value);
  }

  /** Reports whether a display format has date parts and no time parts. */
  private isDateFormat(fmt: any): boolean {
    return ('year' in fmt || 'month' in fmt || 'day' in fmt)
        && !('hour' in fmt) && !('minute' in fmt);
  }
}

/** Returns component providers that make its Material pickers use ISO dates. */
export function provideIsoDates(): Provider[] {
  return [
    { provide: DateAdapter, useClass: IsoDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: ISO_DATE_FORMATS },
  ];
}

/** Formats a picked local Date as `YYYY-MM-DD` from its local parts. */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
