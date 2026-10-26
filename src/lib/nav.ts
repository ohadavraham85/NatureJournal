/* lib/nav.ts — lets views navigate without importing main.ts (which
 * imports every view) — main.ts registers the real implementations. */

import type { ViewParams } from '../views/view';

let navigateImpl: (name: string, params?: ViewParams, replace?: boolean) => void = () => {};
let backImpl: () => void = () => {};

export function registerNav(navigate: typeof navigateImpl, back: typeof backImpl): void {
  navigateImpl = navigate;
  backImpl = back;
}

/** `replace` swaps the current history entry instead of pushing a new one. */
export function navigate(name: string, params?: ViewParams, replace = false): void {
  navigateImpl(name, params, replace);
}

export function goBack(): void {
  backImpl();
}
