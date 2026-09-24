import { HttpErrorResponse } from '@angular/common/http';

/** Converts an API error into a user-facing message. */
export function describeError(error: unknown, fallback = 'Something went wrong.'): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }

  if (error.status === 0) {
    return 'Cannot reach the server. Is the API running?';
  }

  const body = error.error as { title?: string; detail?: string; errors?: Record<string, string[]> } | string | null;

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  if (body && typeof body === 'object') {
    const firstValidationMessage = body.errors && Object.values(body.errors).flat()[0];
    if (firstValidationMessage) {
      return firstValidationMessage;
    }
    if (body.detail) {
      return body.detail;
    }
    if (body.title) {
      return body.title;
    }
  }

  return fallback;
}
