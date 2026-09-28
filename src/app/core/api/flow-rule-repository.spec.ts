import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FlowRuleRepository } from './flow-rule-repository';
import { Flow } from '../models/enums/flow';

describe('FlowRuleRepository', () => {
  let repository: FlowRuleRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(FlowRuleRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists, creates, updates and deletes rules', () => {
    const rule = { keyword: 'PAYROLL', flow: Flow.Income };
    repository.getAll().subscribe();
    repository.create(rule).subscribe();
    repository.update('f1', rule).subscribe();
    repository.delete('f1').subscribe();

    http.expectOne({ method: 'GET', url: '/api/FlowRules' }).flush([]);
    expect(http.expectOne({ method: 'POST', url: '/api/FlowRules' }).request.body).toEqual(rule);
    expect(http.expectOne({ method: 'PUT', url: '/api/FlowRules/f1' }).request.body).toEqual(rule);
    http.expectOne({ method: 'DELETE', url: '/api/FlowRules/f1' }).flush(null);
  });
});
