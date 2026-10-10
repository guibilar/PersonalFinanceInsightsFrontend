import { Resource, Signal, linkedSignal } from '@angular/core';

/**
 * A resource's value, or undefined while it has none: loading the first time, or failed. Reading `value()` on a
 * failed resource throws, which in a template stops the page from rendering at all; this doesn't, so one failed
 * request leaves its own part of the page with an error and the rest working.
 */
export function valueOf<T>(resource: Resource<T>): T | undefined {
  return resource.hasValue() ? resource.value() : undefined;
}

/**
 * Like {@link valueOf}, but keeping the last value while the next one loads. A resource whose request changes (another
 * page, month or filter) drops its value until the answer comes: a page built on it would swap to its skeleton and
 * back, taking the focused control with it. Undefined again only once a request fails or nothing has loaded yet.
 */
export function keptValueOf<T>(resource: Resource<T>): Signal<T | undefined> {
  return linkedSignal<{ value: T | undefined; loading: boolean }, T | undefined>({
    source: () => ({ value: valueOf(resource), loading: resource.isLoading() }),
    computation: ({ value, loading }, previous) =>
      value !== undefined ? value : loading ? previous?.value : undefined,
  });
}
