export function downloadUrl(url: string, filename: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function downloadText(text: string, filename: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: mime }));
  downloadUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
