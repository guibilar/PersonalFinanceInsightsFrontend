import { Resource } from '@angular/core';

/**
 * A resource's value, or undefined while it has none: loading the first time, or failed. Reading `value()` on a
 * failed resource throws, which in a template stops the page from rendering at all; this doesn't, so one failed
 * request leaves its own part of the page with an error and the rest working.
 */
export function valueOf<T>(resource: Resource<T>): T | undefined {
  return resource.hasValue() ? resource.value() : undefined;
}
