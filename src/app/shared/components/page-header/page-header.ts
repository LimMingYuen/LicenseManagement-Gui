import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/**
 * The one page header. Pale brand bar, title on the left, controls anchored
 * right — every page and the data table render this rather than their own copy.
 *
 * The right-hand side is a single unnamed slot: pass whatever the page needs
 * (buttons, pills, status indicators) and page-header.scss sizes it to the
 * 34px / 13px control rhythm. There is no action-config model here on purpose —
 * the data table keeps its own `headerActions` config and simply projects the
 * buttons it builds from it.
 */
@Component({
  selector: 'app-page-header',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatTooltipModule],
  templateUrl: './page-header.html',
  styleUrl: './page-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PageHeaderComponent {
  @Input() title = '';
  @Input() icon?: string;

  /** Second line under the title. Omit for a single-line bar. */
  @Input() subtitle?: string;

  /** Renders a pill after the title. Pass a formatted string. */
  @Input() count?: string | number | null;

  @Input() showBack = false;
  @Input() backTooltip = 'Back';

  @Output() back = new EventEmitter<void>();
}
