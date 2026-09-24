import { FormGroupDirective, NgForm, UntypedFormControl } from '@angular/forms';
import { ErrorStateMatcher } from '@angular/material/core';

/** Shows a field as invalid when its form group carries the named error. */
export class FormErrorStateMatcher implements ErrorStateMatcher {
  constructor(private readonly formError: string) {}

  /** Reports whether the control is touched and it or the form group is invalid. */
  isErrorState(control: UntypedFormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    const touched = !!control?.touched || !!form?.submitted;
    return touched && (!!control?.invalid || !!form?.hasError(this.formError));
  }
}
