import { MatDialogConfig } from '@angular/material/dialog';

/** Builds the shared MatDialog config used by every dialog in the app. */
export function dialogConfig<T>(data: T, width = '30rem'): MatDialogConfig<T> {
  return {
    data,
    width,
    panelClass: 'app-dialog',
    maxWidth: '96vw',
    autoFocus: 'first-tabbable',
    restoreFocus: true,
  };
}
