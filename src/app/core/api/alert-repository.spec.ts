import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AlertRepository } from './alert-repository';

describe('AlertRepository', () => {
  let repository: AlertRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(AlertRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('gets /api/alerts, with the stored alerts', () => {
    repository.get().subscribe();
    const req = http.expectOne('/api/alerts');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.has('refresh')).toBe(false);
    req.flush({ checkedAt: null, modules: [], alerts: [] });
  });

  it('asks for a new check with refresh=true', () => {
    repository.get(true).subscribe();
    const req = http.expectOne('/api/alerts?refresh=true');
    expect(req.request.method).toBe('GET');
    req.flush({ checkedAt: null, modules: [], alerts: [] });
  });
  it('asks for the Today order with order=module', () => {
    repository.get(false, 'module').subscribe();
    http.expectOne('/api/alerts?order=module').flush({ checkedAt: null, modules: [], alerts: [] });
  });
});
