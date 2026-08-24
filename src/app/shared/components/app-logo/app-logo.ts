import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/**
 * The app mark: a brand-blue shield with a keyhole cut into it — access control
 * over an entitlement, which is what this product manages.
 *
 * Geometry is kept identical to public/logo.svg (the favicon) so the tab icon
 * and the in-app mark are the same drawing. Change one, change both.
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  templateUrl: './app-logo.html',
  styleUrl: './app-logo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLogoComponent {
  /** Rendered edge length in px. The mark is square. */
  @Input() size = 32;

  /**
   * Draw the shield in `currentColor` with the keyhole knocked out, for placing
   * the mark on a coloured tile or a dark bar. Default is the blue gradient.
   */
  @Input() mono = false;

  @Input() label = 'License Management';
}
