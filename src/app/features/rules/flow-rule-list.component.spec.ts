import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { FlowRuleListComponent } from './flow-rule-list.component';
import { Flow } from '../../core/models/enums/flow';
import { FlowRuleOutputDto } from '../../core/models/outputs/flow-rule-output-dto';
import { ToastService } from '../../shared/ui/toast/toast.service';

const rules: FlowRuleOutputDto[] = [
  { id: 'f1', keyword: 'PAYMENT THANK YOU', flow: Flow.Transfer },
  { id: 'f2', keyword: 'PAYROLL', flow: Flow.Income },
];

describe('FlowRuleListComponent', () => {
  let fixture: ComponentFixture<FlowRuleListComponent>;
  let component: FlowRuleListComponent;
  let http: HttpTestingController;
  let toasts: ToastService;

  const root = () => fixture.nativeElement as HTMLElement;
  const rows = () =>
    Array.from(root().querySelectorAll('.rule-row')).map((row) => [
      row.querySelector('.rule-keyword')!.textContent!.trim(),
      row.querySelector('.flow-badge')!.textContent!.trim(),
    ]);
  const messages = () => toasts.toasts().map((t) => t.message);

  async function load(list: FlowRuleOutputDto[] = rules): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: '/api/FlowRules' }).flush(list);
    // Let the load settle: reload() is ignored while a load is still in progress.
    await fixture.whenStable();
  }

  async function reloaded(list: FlowRuleOutputDto[] = rules): Promise<void> {
    // resource.reload() sends its request asynchronously.
    await new Promise((resolve) => setTimeout(resolve));
    await load(list);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FlowRuleListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    fixture = TestBed.createComponent(FlowRuleListComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists the rules with the flow they set, and explains the defaults', async () => {
    await load();

    expect(rows()).toEqual([
      ['PAYMENT THANK YOU', 'Transfer'],
      ['PAYROLL', 'Income'],
    ]);
    expect(root().querySelector('.flow-badge')!.classList).toContain('flow-transfer');
    expect(root().textContent).toContain('When several keywords match, the longest wins.');
    expect(root().textContent).toContain('everything on a savings account is a transfer');
  });

  it('shows an empty state without rules', async () => {
    await load([]);

    expect(root().textContent).toContain('No flow rules yet');
  });

  it('offers a retry when loading fails', async () => {
    TestBed.tick();
    http.expectOne('/api/FlowRules').flush(null, { status: 500, statusText: 'Error' });
    await fixture.whenStable();

    expect(root().querySelector('[role=alert]')!.textContent).toContain(
      'Could not load the flow rules.',
    );
  });

  it('adds a rule, then reloads and confirms', async () => {
    await load();
    component.editing.set(null);

    component.onFormSubmit({ keyword: 'refund', flow: Flow.Refund });
    const request = http.expectOne({ method: 'POST', url: '/api/FlowRules' });
    expect(request.request.body).toEqual({ keyword: 'refund', flow: Flow.Refund });
    request.flush({ id: 'f3', keyword: 'REFUND', flow: Flow.Refund });

    expect(component.editing()).toBeUndefined();
    await reloaded();
    expect(messages()).toEqual(['Added “REFUND”']);
  });

  it('keeps the panel open and explains a duplicate keyword', async () => {
    await load();
    component.editing.set(rules[1]);

    component.onFormSubmit({ keyword: 'PAYMENT THANK YOU', flow: Flow.Income });
    http
      .expectOne({ method: 'PUT', url: '/api/FlowRules/f2' })
      .flush(
        { status: 409, detail: 'A rule for "PAYMENT THANK YOU" already exists.' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.editing()).toBe(rules[1]);
    expect(toasts.toasts()[0]).toEqual(
      expect.objectContaining({
        kind: 'error',
        message: 'A rule for "PAYMENT THANK YOU" already exists.',
      }),
    );
  });

  it('deletes only after confirmation', async () => {
    await load();
    root().querySelector<HTMLButtonElement>('[aria-label="Delete PAYROLL"]')!.click();
    await fixture.whenStable();
    http.expectNone({ method: 'DELETE' });
    expect(root().querySelector('[role=alertdialog]')!.textContent).toContain(
      'will no longer be marked Income',
    );

    component.confirmDelete();
    http.expectOne({ method: 'DELETE', url: '/api/FlowRules/f2' }).flush(null);

    await reloaded(rules.slice(0, 1));
    expect(messages()).toEqual(['Deleted “PAYROLL”']);
  });
});
