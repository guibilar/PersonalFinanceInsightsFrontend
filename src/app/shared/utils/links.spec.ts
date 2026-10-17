import { plainClick } from './links';

describe('plainClick', () => {
  it('is true for a plain click with the main button, and for an event that is not a mouse event', () => {
    expect(plainClick(new MouseEvent('click', { button: 0 }))).toBe(true);
    expect(plainClick(new Event('click'))).toBe(true);
  });

  it('is false with a modifier key or another button, which the browser opens elsewhere', () => {
    expect(plainClick(new MouseEvent('click', { ctrlKey: true }))).toBe(false);
    expect(plainClick(new MouseEvent('click', { metaKey: true }))).toBe(false);
    expect(plainClick(new MouseEvent('click', { shiftKey: true }))).toBe(false);
    expect(plainClick(new MouseEvent('click', { altKey: true }))).toBe(false);
    expect(plainClick(new MouseEvent('click', { button: 1 }))).toBe(false);
  });
});
