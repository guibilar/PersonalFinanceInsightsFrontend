import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TodayRepository } from './today-repository';

describe('TodayRepository', () => {
  let repository: TodayRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(TodayRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets /api/today, with the server cache', () => {
    repository.get().subscribe();
    const req = http.expectOne('/api/today');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('refresh')).toBe(false);
    req.flush({ date: '2026-10-13', generatedAt: '', modules: [], cards: [] });
  });

  it('asks for a new answer with refresh=true', () => {
    repository.get(true).subscribe();
    const req = http.expectOne('/api/today?refresh=true');
    expect(req.request.method).toBe('GET');
    req.flush({ date: '2026-10-13', generatedAt: '', modules: [], cards: [] });
  });
});
