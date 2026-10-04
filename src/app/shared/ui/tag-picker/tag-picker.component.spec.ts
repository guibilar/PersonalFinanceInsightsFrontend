import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TagPickerComponent } from './tag-picker.component';
import { TEST_TAGS } from '../../../testing/test-tags';

describe('TagPickerComponent', () => {
  let fixture: ComponentFixture<TagPickerComponent>;
  let component: TagPickerComponent;
  let http: HttpTestingController;

  const root = () => fixture.nativeElement as HTMLElement;
  const chips = () =>
    Array.from(root().querySelectorAll('[aria-label="Chosen tags"] li')).map((li) =>
      li.textContent?.trim(),
    );

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TagPickerComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TagPickerComponent);
    fixture.componentRef.setInput('tags', TEST_TAGS);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  it('picks a tag there is by its name, ignoring case and spaces, without adding it again', () => {
    component.onInput('  vacation   2026 ');
    expect(component.isNew()).toBe(false);
    component.add();
    fixture.detectChanges();

    expect(component.selected()).toEqual(['g-trip']);
    expect(chips()).toEqual(['#Vacation 2026']);
    expect(component.text()).toBe('');
    // Only the tags not chosen yet are suggested.
    expect(component.offered().map((t) => t.name)).toEqual(['Tax deductible']);
  });

  it('adds a tag there is not yet, and chooses it', () => {
    component.onInput('Gifts');
    expect(component.isNew()).toBe(true);
    component.add();

    const request = http.expectOne({ method: 'POST', url: '/api/Tags' });
    expect(request.request.body).toEqual({ name: 'Gifts' });
    request.flush({ id: 'g-new', name: 'Gifts', transactionCount: 0 });
    fixture.detectChanges();

    expect(component.selected()).toEqual(['g-new']);
    expect(chips()).toEqual(['#Gifts']);
  });

  it('says why a tag could not be added', () => {
    component.onInput('Gifts');
    component.add();
    http
      .expectOne('/api/Tags')
      .flush(
        { detail: 'A tag named “Gifts” already exists.' },
        { status: 409, statusText: 'Conflict' },
      );
    fixture.detectChanges();

    expect(component.selected()).toEqual([]);
    expect(root().querySelector('.invalid-feedback')?.textContent).toContain('already exists');
  });

  it('removes a chosen tag', () => {
    component.selected.set(['g-trip', 'g-tax']);
    fixture.detectChanges();
    expect(chips()).toEqual(['#Tax deductible', '#Vacation 2026']);

    root().querySelector<HTMLButtonElement>('[aria-label="Remove Vacation 2026"]')!.click();

    expect(component.selected()).toEqual(['g-tax']);
  });
});
