import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GenerateLicenseForm } from './generate-license-form';
import { MACHINE_CONFIG } from './generate-license.config';

/** Page that issues machine licenses. */
@Component({
  selector: 'app-machine-license',
  imports: [GenerateLicenseForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-generate-license-form [config]="config" />`,
  styleUrl: './generate-page.scss',
})
export class MachineLicense {
  protected readonly config = MACHINE_CONFIG;
}
