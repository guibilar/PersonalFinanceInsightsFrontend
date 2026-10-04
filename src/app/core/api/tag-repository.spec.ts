import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TagRepository } from './tag-repository';

describe('TagRepository', () => {
  let repository: TagRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(TagRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists, adds, renames and deletes tags', () => {
    repository.getAll().subscribe();
    http.expectOne({ method: 'GET', url: '/api/Tags' }).flush([]);

    repository.create({ name: 'Gifts' }).subscribe();
    expect(http.expectOne({ method: 'POST', url: '/api/Tags' }).request.body).toEqual({
      name: 'Gifts',
    });

    repository.rename('g1', { name: 'Presents' }).subscribe();
    expect(http.expectOne({ method: 'PUT', url: '/api/Tags/g1' }).request.body).toEqual({
      name: 'Presents',
    });

    repository.delete('g1').subscribe();
    http.expectOne({ method: 'DELETE', url: '/api/Tags/g1' }).flush(null);
  });
});
