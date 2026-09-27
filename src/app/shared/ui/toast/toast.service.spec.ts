import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] });
    service = TestBed.inject(ToastService);
  });

  afterEach(() => vi.useRealTimers());

  it('removes success toasts after a while', () => {
    service.success('Saved');
    expect(service.toasts().map((t) => t.message)).toEqual(['Saved']);

    vi.advanceTimersByTime(ToastService.DURATION_MS);
    expect(service.toasts()).toEqual([]);
  });

  it('keeps errors until dismissed', () => {
    service.error('Failed');
    vi.advanceTimersByTime(ToastService.DURATION_MS * 2);
    expect(service.toasts().length).toBe(1);

    service.dismiss(service.toasts()[0].id);
    expect(service.toasts()).toEqual([]);
  });

  it('shows at most four at a time, newest last', () => {
    ['a', 'b', 'c', 'd', 'e'].forEach((m) => service.error(m));

    expect(service.toasts().map((t) => t.message)).toEqual(['b', 'c', 'd', 'e']);
  });
});
