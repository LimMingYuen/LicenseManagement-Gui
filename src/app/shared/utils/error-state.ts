import { FormGroupDirective, NgForm, UntypedFormControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

/**
 * Puts a control into its error state when the *form* carries an error, not just the
 * control.
 *
 * Material decides whether to paint a field red — and whether to render its <mat-error> —
 * from the control alone. That is right for "this is required" but wrong for a rule that
 * spans two controls: "these passwords do not match" is recorded on the group, so the
 * confirm box stays innocent and its error never shows. Naming the group error here hands
 * the field back the state it should have had.
 */
export class FormErrorStateMatcher implements ErrorStateMatcher {
  constructor(private readonly formError: string) {}

  isErrorState(control: UntypedFormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const touched = !!control?.touched || !!form?.submitted;
    return touched && (!!control?.invalid || !!form?.hasError(this.formError));
  }
}
