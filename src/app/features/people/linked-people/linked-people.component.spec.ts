import { Component, provideZonelessChangeDetection, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import {
  LinkedPeopleComponent,
  LinkedPeopleOwner,
  PeopleOwnerLink,
} from './linked-people.component';
import { DataChangesService } from '../../../core/data/data-changes.service';
import { PersonSummaryDto } from '../../../core/models/outputs/people-output-dto';
import { ToastService } from '../../../shared/ui/toast/toast.service';
import { provideReadOnlyUser } from '../../../testing/test-auth';
import {
  PERSON_ID,
  testPeoplePage,
  testPerson,
  testPersonSummary,
} from '../../../testing/test-people';

const OWNER_ID = '0199f1a0-7777-7000-8000-000000000007';

@Component({
  imports: [LinkedPeopleComponent],
  template: `<app-linked-people
    [kind]="kind()"
    [ownerId]="ownerId"
    [ownerLinks]="links()"
    (changed)="changes = changes + 1"
  />`,
})
class HostComponent {
  readonly kind = signal<LinkedPeopleOwner>('Documents.Document');
  readonly ownerId = OWNER_ID;
  readonly links = signal<PeopleOwnerLink[]>([]);
  changes = 0;
}

describe('LinkedPeopleComponent', () => {
  let http: HttpTestingController;

  const messages = () =>
    TestBed.inject(ToastService)
      .toasts()
      .map((t) => t.message);
  const confirmButton = (label: string) =>
    Array.from(document.querySelectorAll<HTMLButtonElement>('app-confirm-dialog button')).find(
      (b) => b.textContent!.trim() === label,
    )!;

  /** Lets the page update; `whenStable` would wait for a pending request. */
  async function settle(fixture: { detectChanges(): void }): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    fixture.detectChanges();
  }

  async function create(
    kind: LinkedPeopleOwner,
    links: PeopleOwnerLink[],
    people: PersonSummaryDto[],
  ) {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.kind.set(kind);
    fixture.componentInstance.links.set(links);
    TestBed.tick();
    const request = http.expectOne((r) => r.url === '/api/people/by-link');
    expect(request.request.params.get('kind')).toBe(kind);
    expect(request.request.params.get('id')).toBe(OWNER_ID);
    request.flush(people);
    await settle(fixture);
    return fixture;
  }

  function configure(extra: unknown[] = []): void {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        ...(extra as []),
      ],
    });
    http = TestBed.inject(HttpTestingController);
  }

  afterEach(() => http.verify());

  it('shows the linked people, each opening the person', async () => {
    configure();
    const fixture = await create('Documents.Document', [], [testPersonSummary()]);
    const root = fixture.nativeElement as HTMLElement;

    const row = root.querySelector<HTMLElement>('[data-testid="linked-people"] li')!;
    expect(row.innerText.replace(/\s+/g, ' ').trim()).toContain(
      'Marco Silva Friend · Gaming group',
    );
    expect(row.querySelector('a')!.getAttribute('href')).toBe(`/people/${PERSON_ID}`);
  });

  it('links a person from a task, with the kind People.Person', async () => {
    configure();
    const fixture = await create('Tasks.Task', [], []);
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="no-people"]')!.textContent).toContain('Call Marco');
    const changes = TestBed.inject(DataChangesService).version();

    root.querySelector<HTMLButtonElement>('button')!.click();
    await settle(fixture);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/people').flush(testPeoplePage([testPersonSummary()]));
    await settle(fixture);
    document.querySelector<HTMLButtonElement>('[data-testid="picker-people"] button')!.click();

    const post = http.expectOne({ method: 'POST', url: `/api/tasks/${OWNER_ID}/links` });
    expect(post.request.body).toEqual({ kind: 'People.Person', targetId: PERSON_ID });
    post.flush({ id: 'l1', kind: 'People.Person', targetId: PERSON_ID, createdAt: '' });
    await settle(fixture);

    expect(messages()).toEqual(['Linked to “Marco Silva”']);
    expect(fixture.componentInstance.changes).toBe(1);
    expect(TestBed.inject(DataChangesService).version()).toBe(changes + 1);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/people/by-link').flush([testPersonSummary()]);
  });

  it('links a person from a document', async () => {
    configure();
    const fixture = await create('Documents.Document', [], []);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('button')!.click();
    await settle(fixture);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/people').flush(testPeoplePage([testPersonSummary()]));
    await settle(fixture);
    document.querySelector<HTMLButtonElement>('[data-testid="picker-people"] button')!.click();

    const post = http.expectOne({ method: 'POST', url: `/api/documents/${OWNER_ID}/links` });
    expect(post.request.body).toEqual({ kind: 'People.Person', targetId: PERSON_ID });
    post.flush({ id: 'l1', kind: 'People.Person', targetId: PERSON_ID, createdAt: '' });
    await settle(fixture);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/people/by-link').flush([testPersonSummary()]);
  });

  it('unlinks a link of the document itself', async () => {
    configure();
    const own = { id: 'own', kind: 'People.Person', targetId: PERSON_ID };
    const fixture = await create('Documents.Document', [own], [testPersonSummary()]);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('[aria-label="Unlink Marco Silva"]')!.click();
    await settle(fixture);
    confirmButton('Unlink').click();
    http.expectOne({ method: 'DELETE', url: `/api/documents/${OWNER_ID}/links/own` }).flush(null);
    await settle(fixture);

    expect(messages()).toEqual(['Unlinked']);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/people/by-link').flush([]);
  });

  it('unlinks a link that the person has to the task', async () => {
    configure();
    const fixture = await create('Tasks.Task', [], [testPersonSummary()]);
    const root = fixture.nativeElement as HTMLElement;

    root.querySelector<HTMLButtonElement>('[aria-label="Unlink Marco Silva"]')!.click();
    await settle(fixture);
    confirmButton('Unlink').click();
    http.expectOne({ method: 'GET', url: `/api/people/${PERSON_ID}` }).flush(
      testPerson({
        links: [{ id: 'person-link', kind: 'Tasks.Task', targetId: OWNER_ID, createdAt: '' }],
      }),
    );
    http
      .expectOne({ method: 'DELETE', url: `/api/people/${PERSON_ID}/links/person-link` })
      .flush(null);
    await settle(fixture);

    expect(messages()).toEqual(['Unlinked']);
    TestBed.tick();
    http.expectOne((r) => r.url === '/api/people/by-link').flush([]);
  });

  it('shows the people without link or unlink to a read-only user', async () => {
    configure([provideReadOnlyUser()]);
    const fixture = await create('Documents.Document', [], [testPersonSummary()]);
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('[data-testid="linked-people"]')).not.toBeNull();
    expect(root.querySelectorAll('button').length).toBe(0);
  });
});
