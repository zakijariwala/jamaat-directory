import type { APIRoute } from 'astro';

// Generated at build from the access posture. Default (unlisted) disallows all
// crawlers; set NOINDEX="false" for the fully-public posture to allow indexing.
export const GET: APIRoute = () => {
  const noindex = (import.meta.env.NOINDEX ?? 'true') !== 'false';
  const body = noindex ? 'User-agent: *\nDisallow: /\n' : 'User-agent: *\nAllow: /\n';
  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
