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

  it('opens Money, Documents, Tasks and Home, and shows the other modules as coming soon', async () => {
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

    const comingSoon = Array.from(root.querySelectorAll('.coming-soon'));
    expect(comingSoon.map((card) => card.getAttribute('data-module'))).toEqual([
      'people',
      'journal',
    ]);
    for (const card of comingSoon) {
      expect(card.tagName).not.toBe('A');
      expect(card.textContent).toContain('Coming soon');
    }
  });
});
