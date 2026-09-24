import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { GenerateLicenseForm } from './generate-license-form';
import { ROBOT_CONFIG } from './generate-license.config';

/** Page that issues robot licenses. */
@Component({
  selector: 'app-robot-license',
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
export class RobotLicense {
  protected readonly config = ROBOT_CONFIG;
}
