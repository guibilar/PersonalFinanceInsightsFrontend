import { Routes } from '@angular/router';

/** The Home module: the Home page, one room, a new item, and one item. Loaded lazily under `/home`. */
export const HOME_ROUTES: Routes = [
  {
    path: '',
    title: 'Home · Hestia',
    loadComponent: () => import('./home-page/home-page.component').then((m) => m.HomePageComponent),
  },
  {
    // A room id, or "none" for the items without a room.
    path: 'rooms/:id',
    title: 'Room · Hestia',
    loadComponent: () => import('./room-page/room-page.component').then((m) => m.RoomPageComponent),
  },
  {
    path: 'items/new',
    title: 'New item · Hestia',
    loadComponent: () => import('./item-new/item-new.component').then((m) => m.ItemNewComponent),
  },
  {
    // The warranty alert links here, as /home/items/<id>.
    path: 'items/:id',
    title: 'Item · Hestia',
    loadComponent: () =>
      import('./item-detail/item-detail.component').then((m) => m.ItemDetailComponent),
  },
  { path: 'items', pathMatch: 'full', redirectTo: '' },
  { path: 'rooms', pathMatch: 'full', redirectTo: '' },
];
