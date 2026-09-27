import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CategoryRuleRepository } from './category-rule-repository';
import { Category } from '../models/enums/category';

describe('CategoryRuleRepository', () => {
  let repository: CategoryRuleRepository;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    repository = TestBed.inject(CategoryRuleRepository);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists, creates, updates and deletes rules', () => {
    const rule = { keyword: 'CORNER STORE', category: Category.Groceries, position: 0 };
    repository.getAll().subscribe();
    repository.create(rule).subscribe();
    repository.update('r1', rule).subscribe();
    repository.delete('r1').subscribe();

    http.expectOne({ method: 'GET', url: '/api/CategoryRules' }).flush([]);
    expect(http.expectOne({ method: 'POST', url: '/api/CategoryRules' }).request.body).toEqual(
      rule,
    );
    // The position only matters when adding; moving has its own call.
    const update = http.expectOne({ method: 'PUT', url: '/api/CategoryRules/r1' });
    expect(update.request.body).toEqual({ keyword: 'CORNER STORE', category: Category.Groceries });
    http.expectOne({ method: 'DELETE', url: '/api/CategoryRules/r1' }).flush(null);
  });

  it('moves a rule and previews one', () => {
    repository.move('r1', 3).subscribe();
    repository
      .preview({ keyword: 'CORNER', category: Category.Groceries, excludeTransactionId: 't1' })
      .subscribe();

    const move = http.expectOne({ method: 'POST', url: '/api/CategoryRules/r1/Move' });
    expect(move.request.body).toEqual({ position: 3 });
    const preview = http.expectOne({ method: 'POST', url: '/api/CategoryRules/Preview' });
    expect(preview.request.body).toEqual({
      keyword: 'CORNER',
      category: Category.Groceries,
      excludeTransactionId: 't1',
    });
  });
});
