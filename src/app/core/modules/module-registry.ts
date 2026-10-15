import { IconName } from '../../shared/ui/icon/icon.component';

/** `active`: the module works and opens. `coming-soon`: shown, so the place for it is clear, but not open yet. */
export type ModuleStatus = 'active' | 'coming-soon';

/** One area of the app, like Money or Documents. The Modules page, the menu and Today read this list. */
export interface AppModule {
  /** Stable key, also used in tests and test ids. */
  readonly id: string;
  readonly name: string;
  /** One short line for the Modules page. */
  readonly description: string;
  readonly icon: IconName;
  /** Absolute route of the module's home page. */
  readonly route: string;
  readonly status: ModuleStatus;
}

/** All modules, in the order the Modules page shows them. Add a new module here, with its routes. */
export const MODULES: readonly AppModule[] = [
  {
    id: 'money',
    name: 'Money',
    description: 'Spending, budgets, subscriptions and net worth',
    icon: 'banknote',
    route: '/money',
    status: 'active',
  },
  {
    id: 'documents',
    name: 'Documents',
    description: 'Scans, receipts and the dates they expire',
    icon: 'file-text',
    route: '/documents',
    status: 'active',
  },
  {
    id: 'tasks',
    name: 'Tasks',
    description: 'To-dos and maintenance that comes back',
    icon: 'list-checks',
    route: '/tasks',
    status: 'active',
  },
  {
    id: 'home',
    name: 'Home',
    description: 'The home, what is in it, and its upkeep',
    icon: 'house',
    route: '/home',
    status: 'active',
  },
  {
    id: 'people',
    name: 'People',
    description: 'Birthdays, gifts and lent items',
    icon: 'users',
    route: '/people',
    status: 'active',
  },
  {
    id: 'journal',
    name: 'Journal',
    description: 'Notes on the day, and on this day in other years',
    icon: 'book-open',
    route: '/journal',
    status: 'active',
  },
];

/** The modules that open today. */
export function activeModules(modules: readonly AppModule[] = MODULES): AppModule[] {
  return modules.filter((module) => module.status === 'active');
}

/** One entry of the main menu (the sidebar on wide screens, the bottom bar on narrow ones). */
export interface MainMenuItem {
  readonly label: string;
  readonly icon: IconName;
  readonly route: string;
  /** The centre action of the bottom bar. */
  readonly primary?: boolean;
}

/** The main menu, the same on the web and Android (D11). */
export const MAIN_MENU: readonly MainMenuItem[] = [
  { label: 'Today', icon: 'sunrise', route: '/today' },
  { label: 'Timeline', icon: 'history', route: '/timeline' },
  { label: 'Capture', icon: 'plus', route: '/capture', primary: true },
  { label: 'Modules', icon: 'layout-grid', route: '/modules' },
  { label: 'Search', icon: 'search', route: '/search' },
];
