/**
 * Whether a click on a link is a plain one, for the app to open in place. Ctrl, Cmd, Shift or Alt (or another button
 * than the main one) asks the browser for a new tab, a new window or a download: that click is left to the browser.
 */
export function plainClick(event: Event): boolean {
  if (!(event instanceof MouseEvent)) return true;
  return event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey;
}
