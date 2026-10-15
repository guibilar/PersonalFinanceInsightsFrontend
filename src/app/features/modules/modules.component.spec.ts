import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ModulesComponent } from './modules.component';

describe('ModulesComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ModulesComponent],
      providers: [provideZonelessChangeDetection(), provideRouter([])],
    });
  });

  it('opens every module: Money, Documents, Tasks, Home, People and Journal', async () => {
    const fixture = TestBed.createComponent(ModulesComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const money = root.querySelector<HTMLAnchorElement>('a[data-module="money"]')!;
    expect(money.getAttribute('href')).toBe('/money');
    expect(money.textContent).not.toContain('Coming soon');
    const documents = root.querySelector<HTMLAnchorElement>('a[data-module="documents"]')!;
    expect(documents.getAttribute('href')).toBe('/documents');
    expect(documents.textContent).not.toContain('Coming soon');
    const tasks = root.querySelector<HTMLAnchorElement>('a[data-module="tasks"]')!;
    expect(tasks.getAttribute('href')).toBe('/tasks');
    expect(tasks.textContent).not.toContain('Coming soon');
    const home = root.querySelector<HTMLAnchorElement>('a[data-module="home"]')!;
    expect(home.getAttribute('href')).toBe('/home');
    expect(home.textContent).not.toContain('Coming soon');
    const people = root.querySelector<HTMLAnchorElement>('a[data-module="people"]')!;
    expect(people.getAttribute('href')).toBe('/people');
    expect(people.textContent).not.toContain('Coming soon');

    const journal = root.querySelector<HTMLAnchorElement>('a[data-module="journal"]')!;
    expect(journal.getAttribute('href')).toBe('/journal');
    expect(journal.textContent).not.toContain('Coming soon');

    expect(root.querySelectorAll('.coming-soon').length).toBe(0);
  });
});
