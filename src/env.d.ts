/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Access posture: "true" (default) ships noindex; "false" allows indexing. */
  readonly NOINDEX?: string;
  /** Cloudflare Web Analytics token; unset disables the beacon. */
  readonly CF_ANALYTICS_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
