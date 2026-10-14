import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HomeRepository } from './home-repository';
import {
  ITEM_ID,
  ROOM_ID,
  testHomeSummary,
  testItem,
  testItemPage,
  testRoom,
} from '../../testing/test-home';

describe('HomeRepository', () => {
  let repository: HomeRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(HomeRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the summary and lists items with only the filters that have a value', () => {
    repository.summary().subscribe((summary) => expect(summary.itemCount).toBe(1));
    http.expectOne('/api/home/summary').flush(testHomeSummary());

    repository.list({ room: 'none', q: '', warranty: 'expiring', page: 1 }).subscribe();
    const request = http.expectOne((r) => r.url === '/api/home/items');
    expect(request.request.params.keys()).toEqual(['room', 'warranty', 'page']);
    request.flush(testItemPage([]));
  });

  it('adds, renames, orders and deletes rooms', () => {
    repository.rooms().subscribe();
    http.expectOne({ method: 'GET', url: '/api/home/rooms' }).flush([testRoom()]);

    repository.createRoom({ name: 'Office' }).subscribe();
    const post = http.expectOne({ method: 'POST', url: '/api/home/rooms' });
    expect(post.request.body).toEqual({ name: 'Office' });
    post.flush(testRoom());

    repository.updateRoom(ROOM_ID, { name: 'Galley' }).subscribe();
    http.expectOne({ method: 'PUT', url: `/api/home/rooms/${ROOM_ID}` }).flush(testRoom());

    repository.orderRooms(['b', 'a']).subscribe();
    const order = http.expectOne({ method: 'PUT', url: '/api/home/rooms/order' });
    expect(order.request.body).toEqual({ roomIds: ['b', 'a'] });
    order.flush([]);

    repository.deleteRoom(ROOM_ID).subscribe();
    http.expectOne({ method: 'DELETE', url: `/api/home/rooms/${ROOM_ID}` }).flush(null);
  });

  it('reads, changes, links and deletes items', () => {
    repository.get(ITEM_ID).subscribe();
    http.expectOne(`/api/home/items/${ITEM_ID}`).flush(testItem());

    repository.listByLink('Documents.Document', 'd1').subscribe();
    const byLink = http.expectOne((r) => r.url === '/api/home/items/by-link');
    expect(byLink.request.params.get('kind')).toBe('Documents.Document');
    expect(byLink.request.params.get('id')).toBe('d1');
    byLink.flush([]);

    repository.addLink(ITEM_ID, { kind: 'Money.Transaction', targetId: 't1' }).subscribe();
    const link = http.expectOne({ method: 'POST', url: `/api/home/items/${ITEM_ID}/links` });
    expect(link.request.body).toEqual({ kind: 'Money.Transaction', targetId: 't1' });
    link.flush({ id: 'l1', kind: 'Money.Transaction', targetId: 't1', createdAt: '' });

    repository.removeLink(ITEM_ID, 'l1').subscribe();
    http.expectOne({ method: 'DELETE', url: `/api/home/items/${ITEM_ID}/links/l1` }).flush(null);

    repository.delete(ITEM_ID).subscribe();
    http.expectOne({ method: 'DELETE', url: `/api/home/items/${ITEM_ID}` }).flush(null);
  });

  it('makes the address of the export, with a filter', () => {
    expect(repository.exportUrl()).toBe('/api/home/items/export.csv');
    expect(repository.exportUrl({ room: ROOM_ID, q: '' })).toBe(
      `/api/home/items/export.csv?room=${ROOM_ID}`,
    );
  });
});
