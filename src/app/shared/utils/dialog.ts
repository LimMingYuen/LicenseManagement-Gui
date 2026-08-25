import { MatDialogConfig } from '@angular/material/dialog';

/**
 * Config every dialog in the app opens with.
 *
 * Dialogs go through MatDialog rather than a component-level overlay: the CDK renders them
 * on <body>, clear of the sidenav's stacking context and of the z-index the CDK table writes
 * inline onto its sticky header cells. An in-page overlay loses to both.
 */
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
