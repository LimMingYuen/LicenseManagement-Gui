/** Returns the login return URL if it is a same-origin path other than /login, else the fallback. */
export function safeReturnUrl(returnUrl: unknown, fallback = '/dashboard'): string {
  if (typeof returnUrl !== 'string' || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return fallback;
  }

  return returnUrl.startsWith('/login') ? fallback : returnUrl;
}
