/**
 * Tells Google Analytics something happened on the island (the tag and its consent live in
 * layouts/Base.astro). Without a yes to cookies, gtag still sends these, but without cookies.
 */
export function track(event: string, params: Record<string, string | number | boolean> = {}) {
  window.gtag?.('event', event, params);
}

declare global {
  interface Window { gtag?: (...args: unknown[]) => void }
}
