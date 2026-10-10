import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { TagListComponent } from './tag-list.component';
import { TagOutputDto } from '../../core/models/outputs/tag-output-dto';
import { ToastService } from '../../shared/ui/toast/toast.service';
import { TEST_TAGS } from '../../testing/test-tags';

describe('TagListComponent', () => {
  let fixture: ComponentFixture<TagListComponent>;
  let component: TagListComponent;
  let http: HttpTestingController;
  let toasts: ToastService;

  const root = () => fixture.nativeElement as HTMLElement;
  const rows = () =>
    Array.from(root().querySelectorAll<HTMLElement>('.tag-row')).map((e) =>
      e.innerText.replace(/\s+/g, ' ').trim(),
    );
  const messages = () => toasts.toasts().map((t) => t.message);

  async function load(list: TagOutputDto[] = TEST_TAGS): Promise<void> {
    TestBed.tick();
    http.expectOne({ method: 'GET', url: '/api/Tags' }).flush(list);
    await fixture.whenStable();
  }

  async function reloaded(list: TagOutputDto[] = TEST_TAGS): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    await load(list);
  }

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TagListComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    fixture = TestBed.createComponent(TagListComponent);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    toasts = TestBed.inject(ToastService);
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('lists the tags with how many transactions have each, linking to them', async () => {
    await load();

    expect(rows()).toEqual(['Tax deductible 1 transaction', 'Vacation 2026 3 transactions']);
    const link = root().querySelector<HTMLAnchorElement>('.tag-row a')!;
    expect(link.getAttribute('href')).toBe('/transactions?tagId=g-tax');
  });

  it('says how to add one when there are none', async () => {
    await load([]);

    expect(root().textContent).toContain('No tags yet.');
  });

  it('adds a tag, trimmed', async () => {
    await load();
    component.addName.setValue('  Gifts ');
    component.add();

    const request = http.expectOne({ method: 'POST', url: '/api/Tags' });
    expect(request.request.body).toEqual({ name: 'Gifts' });
    request.flush({ id: 'g-new', name: 'Gifts', transactionCount: 0 });
    await reloaded();

    expect(component.addName.value).toBe('');
    expect(messages()).toEqual(['Added “Gifts”']);
  });

  it('says why a name is taken', async () => {
    await load();
    component.addName.setValue('vacation 2026');
    component.add();
    http
      .expectOne('/api/Tags')
      .flush(
        { detail: 'A tag named “Vacation 2026” already exists.' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(messages()).toEqual(['A tag named “Vacation 2026” already exists.']);
  });

  it('renames in place, and leaves an unchanged name alone', async () => {
    await load();
    root().querySelector<HTMLButtonElement>('[aria-label="Rename Vacation 2026"]')!.click();
    await fixture.whenStable();
    expect(component.renameName.value).toBe('Vacation 2026');

    component.rename();
    expect(component.renaming()).toBeNull();

    component.startRename(TEST_TAGS[1]);
    component.renameName.setValue('Trip to Japan');
    component.rename();
    const request = http.expectOne({ method: 'PUT', url: '/api/Tags/g-trip' });
    expect(request.request.body).toEqual({ name: 'Trip to Japan' });
    request.flush({ id: 'g-trip', name: 'Trip to Japan', transactionCount: 3 });
    await reloaded();

    expect(messages()).toEqual(['Renamed to “Trip to Japan”']);
  });

  it('keeps the focus on the row: the field when renaming starts, Rename again when it ends', async () => {
    await load();
    root().querySelector<HTMLButtonElement>('[aria-label="Rename Vacation 2026"]')!.click();
    await fixture.whenStable();
    expect(document.activeElement?.id).toBe('rename-g-trip');

    Array.from(root().querySelectorAll<HTMLButtonElement>('form button'))
      .find((button) => button.textContent!.trim() === 'Cancel')!
      .click();
    await fixture.whenStable();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Rename Vacation 2026');
  });

  it('deletes after confirming, saying the transactions stay', async () => {
    await load();
    root().querySelector<HTMLButtonElement>('[aria-label="Delete Vacation 2026"]')!.click();
    await fixture.whenStable();
    expect(root().textContent).toContain('It comes off the 3 transactions that have it.');

    component.confirmDelete();
    http.expectOne({ method: 'DELETE', url: '/api/Tags/g-trip' }).flush(null);
    await reloaded([TEST_TAGS[0]]);

    expect(rows()).toEqual(['Tax deductible 1 transaction']);
    expect(messages()).toEqual(['Deleted “Vacation 2026”']);
  });
});
