import { inject } from '@angular/core';
import { Route, Router, Routes } from '@angular/router';

/** Where the Money module lives. Every finance page is under it. */
export const MONEY_ROOT = '/money';

/** The absolute path of a Money page, for example `moneyPath('transactions')` is `/money/transactions`. */
export function moneyPath(page = ''): string {
  return page ? `${MONEY_ROOT}/${page}` : MONEY_ROOT;
}

/**
 * The finance pages before Money was a module, each with its page under Money. Old bookmarks and links (also from
 * the Android app) open the same page, with the same query string and fragment.
 * The old home, `/`, now opens Today; the Dashboard is the Money home.
 */
export const LEGACY_FINANCE_PATHS: readonly string[] = [
  'transactions',
  'budgets',
  'subscriptions',
  'net-worth',
  'review',
  'rules',
  'categories',
  'tags',
  'accounts',
];

/**
 * Redirects for {@link LEGACY_FINANCE_PATHS}, for the children of the signed-in shell. A string `redirectTo` to an
 * absolute path drops the query string and the fragment, so each redirect builds the new address with both.
 */
export const LEGACY_FINANCE_REDIRECTS: Routes = LEGACY_FINANCE_PATHS.map((path): Route => ({
  path,
  pathMatch: 'full',
  redirectTo: ({ queryParams, fragment }) =>
    inject(Router).createUrlTree([moneyPath(path)], {
      queryParams,
      fragment: fragment ?? undefined,
    }),
}));
