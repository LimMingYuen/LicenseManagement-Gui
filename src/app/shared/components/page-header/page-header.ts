import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';

/** Renders the shared page header with a title and a projected slot for right-aligned controls. */
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

  /** Pre-formatted value shown as a pill after the title. */
  @Input() count?: string | number | null;

  @Input() showBack = false;
  @Input() backTooltip = 'Back';

  @Output() back = new EventEmitter<void>();
}
