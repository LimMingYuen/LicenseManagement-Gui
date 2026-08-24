import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header';
import { GenerateLicenseForm } from './generate-license-form';
import { ROBOT_CONFIG } from './generate-license.config';

/** One page per license type — the form itself is shared. */
@Component({
  selector: 'app-robot-license',
  imports: [PageHeaderComponent, GenerateLicenseForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-page-header
      [title]="config.title"
      [icon]="config.icon"
      [subtitle]="config.subtitle"
    />
    <app-generate-license-form [config]="config" />
  `,
  styleUrl: './generate-page.scss',
})
export class RobotLicense {
  protected readonly config = ROBOT_CONFIG;
}
