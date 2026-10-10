import { ChangeDetectionStrategy, Component } from '@angular/core';
import { GenerateLicenseForm } from './generate-license-form';
import { ROBOT_CONFIG } from './generate-license.config';

/** Page that issues robot licenses. */
@Component({
  selector: 'app-robot-license',
  imports: [GenerateLicenseForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './robot-license.html',
  styleUrl: './generate-page.scss',
})
export class RobotLicense {
  protected readonly config = ROBOT_CONFIG;
}
