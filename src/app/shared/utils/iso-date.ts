import { Provider } from '@angular/core';
import { DateAdapter, MAT_DATE_FORMATS, MatDateFormats, NativeDateAdapter } from '@angular/material/core';

/**
 * ISO date wiring for every Material datepicker in the app.
 *
 * Material's NativeDateAdapter renders and parses in the browser's locale, which puts a
 * date in a different order depending on who is logged in. Licenses are dated in ISO order
 * everywhere else — the register table, the catalog, the signed file itself — so the
 * pickers are pinned to the same order rather than left to the locale.
 *
 * Applied per component via `provideIsoDates()`, not globally: MatTimepicker reads the same
 * MAT_DATE_FORMATS token, so the time formats below have to travel with the date ones.
 */
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

export class IsoDateAdapter extends NativeDateAdapter {
  override format(date: Date, displayFormat: object): string {
    // Only override for date formats — time formats (hour/minute) must fall
    // through to NativeDateAdapter so MatTimepicker can render them.
    if (typeof displayFormat === 'object' && this.isDateFormat(displayFormat)) {
      const y = date.getFullYear();
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const d = String(date.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    return super.format(date, displayFormat);
  }

  override parse(value: any): Date | null {
    if (typeof value === 'string' && value.length > 0) {
      const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (match) return new Date(+match[1], +match[2] - 1, +match[3]);
    }
    return super.parse(value);
  }

  private isDateFormat(fmt: any): boolean {
    return ('year' in fmt || 'month' in fmt || 'day' in fmt)
        && !('hour' in fmt) && !('minute' in fmt);
  }
}

/** Drop into a component's `providers` to date its pickers in ISO order. */
export function provideIsoDates(): Provider[] {
  return [
    { provide: DateAdapter, useClass: IsoDateAdapter },
    { provide: MAT_DATE_FORMATS, useValue: ISO_DATE_FORMATS },
  ];
}

/**
 * `YYYY-MM-DD` for a Date the user picked. The picker's value is a local Date, so it is
 * formatted from its local parts — toISOString() would shift it a day either side of UTC.
 */
export function toIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
