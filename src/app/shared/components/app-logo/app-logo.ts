import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Renders the app mark, a shield with a keyhole, matching the public/logo.svg favicon. */
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

  /** Draws the mark in currentColor with the keyhole cut out, for coloured backgrounds. */
  @Input() mono = false;

  @Input() label = 'License Management';
}
