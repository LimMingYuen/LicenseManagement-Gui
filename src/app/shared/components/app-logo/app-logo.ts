import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Renders the app mark, a window with a key badge, matching the public/logo.svg favicon. */
@Component({
  selector: 'app-logo',
  standalone: true,
  templateUrl: './app-logo.html',
  styleUrl: './app-logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLogoComponent {
  /** Edge length in px of the square mark. */
  @Input() size = 32;

  @Input() label = 'License Management';
}
