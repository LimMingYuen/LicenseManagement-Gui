import { safeReturnUrl } from './return-url';

describe('safeReturnUrl', () => {
  it('keeps a path on this origin', () => {
    expect(safeReturnUrl('/licenses/catalog')).toBe('/licenses/catalog');
  });

  it('refuses a protocol-relative URL, which would leave the origin', () => {
    expect(safeReturnUrl('//evil.example/steal')).toBe('/dashboard');
  });

  it('refuses an absolute URL', () => {
    expect(safeReturnUrl('https://evil.example')).toBe('/dashboard');
  });

  it('refuses a target that points back at the login page', () => {
    expect(safeReturnUrl('/login?returnUrl=%2Flogin')).toBe('/dashboard');
  });

  it('falls back when there is no return URL at all', () => {
    expect(safeReturnUrl(null)).toBe('/dashboard');
    expect(safeReturnUrl(undefined)).toBe('/dashboard');
    expect(safeReturnUrl(['/a', '/b'])).toBe('/dashboard');
  });
});
