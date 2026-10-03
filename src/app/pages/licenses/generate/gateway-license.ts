import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GenerateLicenseForm } from './generate-license-form';
import { GATEWAY_CONFIG } from './generate-license.config';

/** Page that issues gateway licenses. */
@Component({
  selector: 'app-gateway-license',
  imports: [GenerateLicenseForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-generate-license-form [config]="config" />`,
  styleUrl: './generate-page.scss',
})
export class GatewayLicense {
  protected readonly config = GATEWAY_CONFIG;
}
