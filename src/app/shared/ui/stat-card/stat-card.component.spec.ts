import {
  ChangeDetectionStrategy,
  Component,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { StatCardComponent } from './stat-card.component';

@Component({
  imports: [StatCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="width: 11rem">
      <app-stat-card
        label="Net worth"
        icon="trending-up"
        value="$94,512.30"
        hint="+ $3,860.42 since last month"
        hintIcon="trending-up"
        tone="good"
        [compact]="compact()"
      />
    </div>
  `,
})
class HostComponent {
  readonly compact = signal(false);
}

describe('StatCardComponent', () => {
  async function setup(compact: boolean) {
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    const fixture = TestBed.createComponent(HostComponent);
    fixture.componentInstance.compact.set(compact);
    document.body.appendChild(fixture.nativeElement);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  afterEach(() => document.body.querySelectorAll('div[ng-version]').forEach((e) => e.remove()));

  it('shows the label, value and hint', async () => {
    const el = await setup(false);
    expect(el.textContent).toContain('Net worth');
    expect(el.querySelector('.stat-value')?.textContent?.trim()).toBe('$94,512.30');
    expect(el.querySelector('.stat-hint')?.textContent?.trim()).toBe(
      '+ $3,860.42 since last month',
    );
    expect(el.querySelector('.stat-hint')?.classList).toContain('text-success');
  });

  it('compact: the icon is beside the label, and the value has the full width of the card', async () => {
    const el = await setup(true);
    const body = el.querySelector('.card-body')!;
    const value = el.querySelector<HTMLElement>('.stat-value')!;
    expect(el.querySelector('.card')?.classList).toContain('compact');
    expect(value.parentElement).toBe(body);
    expect(value.scrollWidth).toBeLessThanOrEqual(value.clientWidth);
  });

  it('compact: a long hint wraps inside the card', async () => {
    const el = await setup(true);
    const card = el.querySelector('.card')!.getBoundingClientRect();
    const hint = el.querySelector('.stat-hint')!.getBoundingClientRect();
    expect(hint.right).toBeLessThanOrEqual(card.right);
  });
});
