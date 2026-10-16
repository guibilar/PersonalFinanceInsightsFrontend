import { Routes } from '@angular/router';

/** The Calendar module (T104): one page; the address keeps the view, the month, and the day. Loaded lazily. */
export const CALENDAR_ROUTES: Routes = [
  {
    path: '',
    title: 'Calendar · Hestia',
    loadComponent: () =>
      import('./calendar-page/calendar-page.component').then((m) => m.CalendarPageComponent),
  },
];
