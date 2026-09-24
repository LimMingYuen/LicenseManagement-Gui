/** Saves a blob as a file download through a temporary object URL. */
export function saveBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Saves a string as a text file download. */
export function saveText(content: string, fileName: string, type = 'application/json'): void {
  saveBlob(new Blob([content], { type }), fileName);
}
