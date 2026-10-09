import { ChangeDetectionStrategy, Component, provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MoneyPipe } from './money.pipe';
import { PRIVACY_STORAGE_KEY, setAmountsHidden } from '../utils/privacy';

@Component({
  imports: [MoneyPipe],
  template: `<span>{{ 1234.5 | money }}</span>`,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

describe('MoneyPipe', () => {
  afterEach(() => {
    setAmountsHidden(false);
    localStorage.removeItem(PRIVACY_STORAGE_KEY);
  });

  it('formats amounts, and nothing for a missing one', () => {
    const pipe = new MoneyPipe();

    expect(pipe.transform(1234.5)).toBe('$1,234.50');
    expect(pipe.transform(null)).toBe('');
  });

  it('redraws the amounts already on the page when privacy mode switches', async () => {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const text = () => (fixture.nativeElement as HTMLElement).textContent!.trim();
    expect(text()).toBe('$1,234.50');

    setAmountsHidden(true);
    await fixture.whenStable();
    expect(text()).toBe('$•••••');

    setAmountsHidden(false);
    await fixture.whenStable();
    expect(text()).toBe('$1,234.50');
  });
});
