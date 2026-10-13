import { HttpErrorResponse } from '@angular/common/http';
import {
  DOCUMENT_LIMITS,
  changeError,
  checkFiles,
  daysUntil,
  expiryText,
  expirySoonRange,
  formatSize,
  parseTags,
  previewKind,
  titleFromFileName,
} from './documents';
import { testDocument } from '../../testing/test-documents';

function file(name: string, size: number, type = ''): File {
  const file = new File(['x'], name, { type });
  // A real file of 25 MB is slow to make: only the reported size matters here.
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

const MB = 1024 * 1024;

describe('document helpers', () => {
  describe('checkFiles', () => {
    it('accepts PDF, JPEG, PNG, HEIC and WebP files up to 25 MB', () => {
      expect(
        checkFiles([
          file('a.pdf', 25 * MB, 'application/pdf'),
          file('b.jpg', MB, 'image/jpeg'),
          file('c.png', MB, 'image/png'),
          file('d.webp', MB, 'image/webp'),
          // Some systems give no type for HEIC: the name decides.
          file('IMG_0001.HEIC', MB),
        ]),
      ).toEqual([]);
    });

    it('refuses other types, files over 25 MB, and empty files', () => {
      expect(
        checkFiles([
          file('notes.txt', 100, 'text/plain'),
          file('scan.pdf', 25 * MB + 1, 'application/pdf'),
          file('empty.png', 0, 'image/png'),
        ]),
      ).toEqual([
        '“notes.txt” is not a PDF, JPEG, PNG, HEIC or WebP file.',
        '“scan.pdf” is larger than 25 MB.',
        '“empty.png” is empty.',
      ]);
    });

    it('refuses more than 100 MB in one upload, and more than 10 files', () => {
      const big = Array.from({ length: 5 }, (_, i) =>
        file(`p${i}.pdf`, 21 * MB, 'application/pdf'),
      );
      expect(checkFiles(big)).toEqual([
        'The files together are larger than 100 MB. Upload them as two documents.',
      ]);

      const many = Array.from({ length: DOCUMENT_LIMITS.files + 1 }, (_, i) =>
        file(`p${i}.png`, MB, 'image/png'),
      );
      expect(checkFiles(many)).toEqual(['A document can have at most 10 files.']);
    });
  });

  it('makes a title from a file name', () => {
    expect(titleFromFileName('Kettle receipt.pdf')).toBe('Kettle receipt');
    expect(titleFromFileName('scan')).toBe('scan');
    expect(titleFromFileName('.hidden')).toBe('.hidden');
  });

  it('reads tags typed with commas: trimmed, lower case, once each', () => {
    expect(parseTags(' Kitchen, appliances,,kitchen ')).toEqual(['kitchen', 'appliances']);
    expect(parseTags('')).toEqual([]);
  });

  it('counts the days to an expiry, and says them', () => {
    const today = new Date(2026, 9, 13, 18, 30);
    expect(daysUntil('2026-10-13', today)).toBe(0);
    expect(daysUntil('2026-11-04', today)).toBe(22);
    expect(daysUntil('2026-10-10', today)).toBe(-3);

    expect(expiryText(0)).toBe('Expires today');
    expect(expiryText(1)).toBe('In 1 day');
    expect(expiryText(22)).toBe('In 22 days');
    expect(expiryText(-1)).toBe('Expired 1 day ago');
    expect(expiryText(-3)).toBe('Expired 3 days ago');
  });

  it('has the "Expire soon" window from today to 30 days ahead', () => {
    expect(expirySoonRange(new Date(2026, 9, 13))).toEqual({
      expiresFrom: '2026-10-13',
      expiresTo: '2026-11-12',
    });
  });

  it('formats sizes', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(820_000)).toBe('801 KB');
    expect(formatSize(2.5 * MB)).toBe('2.5 MB');
    expect(formatSize(20 * MB)).toBe('20 MB');
  });

  it('previews PDFs and the images a browser shows, not HEIC', () => {
    const [pdf, jpeg] = testDocument().files;
    expect(previewKind(pdf)).toBe('pdf');
    expect(previewKind(jpeg)).toBe('image');
    expect(previewKind({ ...jpeg, contentType: 'image/heic' })).toBeNull();
  });

  it('explains a refused change', () => {
    const error = (status: number, body: unknown = null) =>
      new HttpErrorResponse({ status, error: body });

    expect(changeError(error(403), 'x')).toBe('This account can only read documents.');
    expect(changeError(error(404), 'x')).toBe('This document does not exist any more.');
    expect(changeError(error(502), 'x')).toBe(
      'The server could not check with Money. Try again later.',
    );
    expect(changeError(error(400, { errors: { files: ['The upload is too big.'] } }), 'x')).toBe(
      'The upload is too big.',
    );
    expect(changeError(error(500), 'Could not save.')).toBe('Could not save.');
  });
});
