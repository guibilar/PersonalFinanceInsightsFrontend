import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, UrlTree } from '@angular/router';
import { rxResource } from '@angular/core/rxjs-interop';
import { TodayRepository } from '../../core/api/today-repository';
import { DataChangesService } from '../../core/data/data-changes.service';
import {
  TodayCard,
  TodayModuleStatus,
  TodaySeverity,
} from '../../core/models/outputs/today-output-dto';
import { AppModule, MODULES } from '../../core/modules/module-registry';
import { ErrorStateComponent } from '../../shared/ui/error-state/error-state.component';
import { IconComponent, IconName } from '../../shared/ui/icon/icon.component';
import { SkeletonComponent } from '../../shared/ui/skeleton/skeleton.component';
import { StatCardComponent, StatTone } from '../../shared/ui/stat-card/stat-card.component';
import { keptValueOf } from '../../shared/utils/resource-value';
import { AuthService } from '../../core/auth/auth.service';
import { fillTodayText, formatTodayValue } from './today-text';
import { AttentionListComponent } from './attention-list/attention-list.component';

/** One module on Today, with its tiles. */
interface ModuleSection {
  /** The registry id ("money"), or the server name in lower case for a module the registry does not know. */
  id: string;
  name: string;
  /** The module home, when the registry has the module and it is active. */
  route: string | null;
  /** The module's icon, beside its name. */
  icon: IconName;
  status: TodayModuleStatus;
  tiles: TodayCard[];
}

/** The module of the server's own alerts (T80): no tiles, and last on Today. */
const SYSTEM_MODULE = 'system';

/** Tile icons by card kind. A kind not in the list gets the module icon. */
const TILE_ICONS: Record<string, IconName> = {
  spent: 'calendar',
  'left-over': 'wallet',
  'net-worth': 'trending-up',
  budgets: 'budgets',
};

const TONES: Record<TodaySeverity, StatTone> = {
  Neutral: 'neutral',
  Good: 'good',
  Warning: 'warning',
  Bad: 'bad',
};

/**
 * Today: the cards of all modules from `GET /api/today` (T08), the Money tiles first (D11). The server owns the card
 * rules; this page only fills the text placeholders with the app's formats (and privacy mode). Modules that have no
 * cards yet show a "Coming soon" card.
 */
@Component({
  selector: 'app-today',
  imports: [
    RouterLink,
    AttentionListComponent,
    ErrorStateComponent,
    IconComponent,
    SkeletonComponent,
    StatCardComponent,
  ],
  templateUrl: './today.component.html',
  styles: `
    .today-date {
      font-size: 0.8125rem;
      font-weight: 600;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent, var(--bs-primary-text-emphasis));
    }

    .greeting {
      font-size: clamp(1.75rem, 1.2rem + 2vw, 2.5rem);
      font-weight: 600;
      color: var(--bs-emphasis-color);
    }

    .today-sections {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
      gap: 1.5rem 1rem;
    }

    .today-section.wide {
      grid-column: 1 / -1;
    }

    .section-icon {
      display: inline-flex;
      padding: 0.375rem;
      border-radius: 50%;
      background: var(--accent-bg);
      color: var(--accent);
    }

    .section-title {
      font-family: var(--hestia-display-font);
      font-size: 1.125rem;
      font-weight: 600;
      font-variation-settings: 'SOFT' 100;
    }

    .bell {
      line-height: 1;
    }
    .bell-count {
      position: absolute;
      top: -0.4rem;
      right: -0.4rem;
      font-size: 0.65rem;
    }
    .placeholder-card {
      border-style: dashed;
      background: transparent;
    }

    .module-icon {
      display: inline-flex;
      padding: 0.625rem;
      border-radius: var(--bs-border-radius-lg);
      background: var(--bs-secondary-bg);
      color: var(--bs-secondary-color);
    }

    // A tile that opens its page: the whole tile is the link.
    .stat-link {
      display: block;
      height: 100%;
      color: inherit;
      text-decoration: none;
      border-radius: var(--bs-card-border-radius);

      &:hover ::ng-deep .card {
        border-color: var(--bs-primary-border-subtle);
      }

      &:focus-visible {
        outline: 2px solid var(--bs-primary);
        outline-offset: 2px;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TodayComponent {
  private readonly todayRepository = inject(TodayRepository);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  /** A statement or a transaction added from Capture loads the cards again. */
  private readonly dataChanges = inject(DataChangesService);

  /** Clicks on "Refresh". */
  private readonly refreshes = signal(0);
  /** The data version when the page opened: a later version means the data changed since. */
  private readonly firstVersion = this.dataChanges.version();

  /**
   * The cards. The first load can use the server's short cache. A refresh, or a change to the data from this app, asks
   * for a new answer (`refresh=true`): else the cache can show the cards from before the change.
   */
  readonly todayResource = rxResource({
    params: () => ({ version: this.dataChanges.version(), refreshes: this.refreshes() }),
    stream: ({ params }) =>
      this.todayRepository.get(params.refreshes > 0 || params.version !== this.firstVersion),
  });
  /** The last answer stays on the page while the next one loads, so a refresh does not flash the skeleton. */
  readonly today = keptValueOf(this.todayResource);

  /** "Good evening, Alex": by the time of day, with the user's name (none for the read-only token). */
  readonly greeting = computed(() => {
    const user = this.auth.user();
    const name = user && user.scope !== 'read-only' ? displayName(user.username) : '';
    const part = greetingFor(new Date().getHours());
    return name ? `${part}, ${name}` : part;
  });

  readonly dateLabel = computed(() => {
    const date = this.today()?.date;
    const day = date ? new Date(`${date.slice(0, 10)}T00:00:00`) : new Date();
    return day.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' });
  });

  /**
   * The modules with tiles (or a load problem), in server order, each with its tiles. A module with only "Needs attention"
   * items has no section: its items are in the one list below (T81). `System` (T80) goes last.
   */
  readonly sections = computed<ModuleSection[]>(() =>
    this.allSections()
      .filter((section) => section.tiles.length > 0 || section.status !== 'Complete')
      .sort((a, b) => Number(a.id === SYSTEM_MODULE) - Number(b.id === SYSTEM_MODULE)),
  );

  /** Every module of the answer, also one with no tiles. */
  private readonly allSections = computed<ModuleSection[]>(() => {
    const today = this.today();
    if (!today) return [];
    const names = today.modules.map((m) => m.module);
    for (const card of today.cards) {
      if (!names.includes(card.module)) names.push(card.module);
    }
    return names.map((name) => {
      const known = registryModule(name);
      return {
        id: known?.id ?? name.toLowerCase(),
        name: known?.name ?? name,
        route: known?.status === 'active' ? known.route : null,
        icon: known?.icon ?? 'layout-grid',
        status: today.modules.find((m) => m.module === name)?.status ?? 'Complete',
        tiles: today.cards.filter((card) => card.module === name && card.type === 'Tile'),
      };
    });
  });

  /** All "Needs attention" items, most pressing first (the server's order). */
  readonly attention = computed(() =>
    (this.today()?.cards ?? []).filter((card) => card.type === 'Attention'),
  );

  /** The bell's label (T69): how many items need attention. */
  readonly bellLabel = computed(() => {
    const count = this.attention().length;
    if (count === 0) return 'Nothing needs attention';
    return count === 1 ? '1 item needs attention' : `${count} items need attention`;
  });

  /** The bell (T69): to the "Needs attention" list, with the focus on its heading. */
  showAttention(): void {
    const heading = document.getElementById('today-attention');
    if (!heading) return;
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    heading.setAttribute('tabindex', '-1');
    heading.focus({ preventScroll: true });
  }

  /** Registry modules that are still to come and that the server has no cards for. */
  readonly comingSoon = computed(() => {
    const served = new Set(this.allSections().map((section) => section.id));
    return MODULES.filter((module) => module.status === 'coming-soon' && !served.has(module.id));
  });

  refresh(): void {
    this.refreshes.update((n) => n + 1);
  }

  /** The big value of a tile; "—" when the server does not know it. */
  valueText(card: TodayCard): string {
    return card.value ? formatTodayValue(card.value) : '—';
  }

  /** The tile hint or the attention sentence, with its values filled in. */
  text(card: TodayCard): string {
    return fillTodayText(card.text, card.values);
  }

  tone(card: TodayCard): StatTone {
    return TONES[card.severity] ?? 'neutral';
  }

  trendIcon(card: TodayCard): IconName | null {
    return card.trend === 'Up' ? 'trending-up' : card.trend === 'Down' ? 'trending-down' : null;
  }

  tileIcon(card: TodayCard): IconName {
    return TILE_ICONS[card.kind] ?? registryModule(card.module)?.icon ?? 'dashboard';
  }

  /**
   * The card link as a route of this app, with its query string and fragment. Only a path in this app ("/money/…")
   * becomes a link; anything else gives none.
   */
  linkOf(card: TodayCard): UrlTree | null {
    const link = card.link;
    if (!link || !link.startsWith('/') || link.startsWith('//')) return null;
    return this.router.parseUrl(link);
  }
}

function registryModule(serverName: string): AppModule | undefined {
  const id = serverName.toLowerCase();
  return MODULES.find((module) => module.id === id);
}

/** The part of the day, as people greet each other. */
export function greetingFor(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** A user name as a first name: "alex.smith" or "alex" → "Alex". */
export function displayName(username: string): string {
  const first = username.trim().split(/[\s._@-]+/)[0] ?? '';
  return first ? first[0].toUpperCase() + first.slice(1) : '';
}
