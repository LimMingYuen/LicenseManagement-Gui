/**
 * Where to send someone who has landed on the login page with a session already in hand.
 *
 * The value arrives on the query string, so it is whatever the last redirect put there —
 * or whatever a link handed the browser. Two things are refused: anything that is not a
 * path on this origin (`//evil.example` parses as a protocol-relative URL and would walk
 * the user off the site), and a target pointing back at /login, which would only bounce
 * them straight back to where they already are.
 */
export function safeReturnUrl(returnUrl: unknown, fallback = '/dashboard'): string {
  if (typeof returnUrl !== 'string' || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
    return fallback;
  }

  return returnUrl.startsWith('/login') ? fallback : returnUrl;
}
