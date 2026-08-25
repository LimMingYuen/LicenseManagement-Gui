import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { GenerateLicenseForm } from './generate-license-form';
import { GATEWAY_CONFIG } from './generate-license.config';

/** One page per license type — the form itself is shared. */
@Component({
  selector: 'app-gateway-license',
  imports: [PageHeaderComponent, GenerateLicenseForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      [title]="config.title"
      [icon]="config.icon"
    />
    <app-generate-license-form [config]="config" />
  `,
  styleUrl: './generate-page.scss',
})
export class GatewayLicense {
  protected readonly config = GATEWAY_CONFIG;
}
