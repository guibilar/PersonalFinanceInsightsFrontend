import { Routes } from '@angular/router';

/** The People module: the People page, a new person, and one person. Loaded lazily under `/people`. */
export const PEOPLE_ROUTES: Routes = [
  {
    path: '',
    title: 'People · Hestia',
    loadComponent: () =>
      import('./people-page/people-page.component').then((m) => m.PeoplePageComponent),
  },
  {
    path: 'new',
    title: 'New person · Hestia',
    loadComponent: () =>
      import('./person-new/person-new.component').then((m) => m.PersonNewComponent),
  },
  {
    // T105: contacts from a vCard file or the phone.
    path: 'import',
    title: 'Import contacts · Hestia',
    loadComponent: () =>
      import('./people-import/people-import.component').then((m) => m.PeopleImportComponent),
  },
  {
    // The People alerts (reach out, birthday, overdue loan) link here, as /people/<id>.
    path: ':id',
    title: 'Person · Hestia',
    loadComponent: () =>
      import('./person-detail/person-detail.component').then((m) => m.PersonDetailComponent),
  },
];
