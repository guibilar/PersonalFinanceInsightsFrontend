import { Injector, provideZonelessChangeDetection, resource } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { valueOf } from './resource-value';

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
