// Build/runtime configuration for the frontend.

// The in-site contribution form (replaces the Google Form intake).
export const CONTRIBUTE_URL = '/contribute';

// Guide page explaining how to fill the form.
export const CONTRIBUTE_GUIDE_URL = '/contribute-guide';

// YouTube video explaining the form and its purpose. Empty until the video
// is published; the guide renders the video link only when this is set.
export const HOWTO_VIDEO_URL = '';

// Cloudflare Turnstile site key (PUBLIC — safe to ship). When empty the widget
// is omitted and /api/submit skips the check (fine for local/prototype).
export const TURNSTILE_SITE_KEY = '';

// Legacy Google Form link — kept only for the Report/Remove links until the
// flag flow is moved in-site. Deprecated for new contributions.
export const FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSe3zAfDIp4hZ1CRloK9B5NqWrl-qKZGOPf1dhrYTQYnc-uBxg/viewform';

/** Link to the in-site contribute form, optionally pre-filling the city. */
export function addContactUrl(city?: string): string {
  return city ? `${CONTRIBUTE_URL}?city=${encodeURIComponent(city)}` : CONTRIBUTE_URL;
}
