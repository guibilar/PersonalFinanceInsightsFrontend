import { Routes } from '@angular/router';

/** The People module: the People page, a new person, and one person. Loaded lazily under `/people`. */
export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    title: 'People · Personal Finances',
    loadComponent: () =>
      import('./people-page/people-page.component').then((m) => m.PeoplePageComponent),
  },
  {
    path: 'new',
    title: 'New person · Personal Finances',
    loadComponent: () =>
      import('./person-new/person-new.component').then((m) => m.PersonNewComponent),
  },
  {
    // The People alerts (reach out, birthday, overdue loan) link here, as /people/<id>.
    path: ':id',
    title: 'Person · Personal Finances',
    loadComponent: () =>
      import('./person-detail/person-detail.component').then((m) => m.PersonDetailComponent),
  },
];
