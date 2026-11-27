export function isOllamaCloud(baseUrl: string): boolean {
  try {
    const url = new URL(baseUrl);
    const host = url.hostname.toLowerCase();
    return host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  } catch {
    return false;
  }
}
