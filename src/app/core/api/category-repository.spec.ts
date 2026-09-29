import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CategoryRepository } from './category-repository';

describe('CategoryRepository', () => {
  let repository: CategoryRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(CategoryRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists, adds and updates categories', () => {
    repository.getAll().subscribe();
    repository.create({ name: 'Coffee', color: '#6F4E37' }).subscribe();
    repository.update('c1', { name: 'Cafés', color: '#6F4E37' }).subscribe();

    http.expectOne({ method: 'GET', url: '/api/Categories' }).flush([]);
    const post = http.expectOne({ method: 'POST', url: '/api/Categories' });
    expect(post.request.body).toEqual({ name: 'Coffee', color: '#6F4E37' });
    post.flush({});
    const put = http.expectOne({ method: 'PUT', url: '/api/Categories/c1' });
    expect(put.request.body).toEqual({ name: 'Cafés', color: '#6F4E37' });
    put.flush({});
  });

  it('deletes, moving what used it to the chosen category', () => {
    repository.delete('c1', 'c2').subscribe();
    repository.delete('c3').subscribe();

    const moving = http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/Categories/c1');
    expect(moving.request.params.get('moveTo')).toBe('c2');
    moving.flush(null);
    const plain = http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/Categories/c3');
    expect(plain.request.params.has('moveTo')).toBe(false);
    plain.flush(null);
  });
});
