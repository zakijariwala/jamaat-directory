// Build/runtime configuration for the frontend.

// The Google Form used for contributions (Add / Report / Remove).
// Replace with the real published form URL once it exists.
export const FORM_URL = 'https://forms.gle/REPLACE_WITH_REAL_FORM';

// To pre-fill the city on the form, set the form's city-field entry id
// (looks like 'entry.1234567890'). Until then, links open the plain form.
export const FORM_CITY_ENTRY = '';

/** Google Form link, optionally pre-filled with a city name. */
export function addContactUrl(city?: string): string {
  if (!city || !FORM_CITY_ENTRY) return FORM_URL;
  const sep = FORM_URL.includes('?') ? '&' : '?';
  return `${FORM_URL}${sep}usp=pp_url&${FORM_CITY_ENTRY}=${encodeURIComponent(city)}`;
}
