/**
 * Hands a blob to the browser as a file download.
 *
 * The API returns license files and key exports as blobs rather than URLs, so there is
 * nothing to link to directly — an object URL is created, clicked, and revoked.
 */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  // Revoking immediately can cancel the download in some browsers; one tick is enough.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Saves a string as a text file, without a round trip to the server. */
export function saveText(content: string, fileName: string, type = 'application/json'): void {
  saveBlob(new Blob([content], { type }), fileName);
}
