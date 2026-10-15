import { Routes } from '@angular/router';

/** The Documents module: the list, the upload, and one document. Loaded lazily under `/documents`. */
export const DOCUMENTS_ROUTES: Routes = [
  {
    path: '',
    title: 'Documents · Hestia',
    loadComponent: () =>
      import('./document-list/document-list.component').then((m) => m.DocumentListComponent),
  },
  {
    path: 'new',
    title: 'Add document · Hestia',
    loadComponent: () =>
      import('./document-upload/document-upload.component').then((m) => m.DocumentUploadComponent),
  },
  {
    // Today links here ("expires soon"), as /documents/<id>.
    path: ':id',
    title: 'Document · Hestia',
    loadComponent: () =>
      import('./document-detail/document-detail.component').then((m) => m.DocumentDetailComponent),
  },
];
