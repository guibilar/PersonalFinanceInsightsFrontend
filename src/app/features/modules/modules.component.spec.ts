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

  it('opens Money and shows the other modules as coming soon', async () => {
    const fixture = TestBed.createComponent(ModulesComponent);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;

    const money = root.querySelector<HTMLAnchorElement>('a[data-module="money"]')!;
    expect(money.getAttribute('href')).toBe('/money');
    expect(money.textContent).not.toContain('Coming soon');

    const comingSoon = Array.from(root.querySelectorAll('.coming-soon'));
    expect(comingSoon.map((card) => card.getAttribute('data-module'))).toEqual([
      'documents',
      'home',
      'people',
      'journal',
      'tasks',
    ]);
    for (const card of comingSoon) {
      expect(card.tagName).not.toBe('A');
      expect(card.textContent).toContain('Coming soon');
    }
  });
});
