import { Injector, provideZonelessChangeDetection, resource, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { keptValueOf, valueOf } from './resource-value';

describe('valueOf', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }),
  );

  async function settled<T>(loader: () => Promise<T>) {
    const loaded = resource({ loader, injector: TestBed.inject(Injector) });
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
    return loaded;
  }

  it('is the value once loaded', async () => {
    expect(valueOf(await settled(() => Promise.resolve(42)))).toBe(42);
  });

  it('is undefined, not an exception, when loading failed', async () => {
    const failed = await settled<number>(() => Promise.reject(new Error('500')));

    expect(failed.status()).toBe('error');
    expect(() => failed.value()).toThrow();
    expect(valueOf(failed)).toBeUndefined();
  });
});

describe('keptValueOf', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideZonelessChangeDetection()] }),
  );

  const flush = async () => {
    await new Promise((resolve) => setTimeout(resolve));
    TestBed.tick();
    await new Promise((resolve) => setTimeout(resolve));
  };

  it('keeps the last value while another request loads, and drops it when that fails', async () => {
    const page = signal(1);
    let release!: (value: string) => void;
    const answers: Record<number, () => Promise<string>> = {
      1: () => Promise.resolve('page 1'),
      2: () => new Promise((resolve) => (release = resolve)),
      3: () => Promise.reject(new Error('500')),
    };
    const loaded = resource({
      params: () => page(),
      loader: ({ params }) => answers[params](),
      injector: TestBed.inject(Injector),
    });
    const kept = TestBed.runInInjectionContext(() => keptValueOf(loaded));
    await flush();
    expect(kept()).toBe('page 1');

    page.set(2);
    TestBed.tick();
    expect(valueOf(loaded)).toBeUndefined();
    expect(kept()).toBe('page 1');

    release('page 2');
    await flush();
    expect(kept()).toBe('page 2');

    page.set(3);
    await flush();
    expect(kept()).toBeUndefined();
  });
});
