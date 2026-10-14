/**
 * Use the explicit environment override when provided; otherwise use the live
 * Laravel API for both development and production mobile builds.
 */
const LIVE_API_URL = 'https://clippipeline.nonsostudio.com/api';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? LIVE_API_URL;

/** Web origin (for public pages: /terms, /privacy, /delete-account, /billing). */
export const WEB_BASE_URL: string = API_BASE_URL.replace(/\/api\/?$/, '');

/** Used until GET /me returns `flags` (CONTRACT §10). */
export const FALLBACK_FLAGS = {
  tiktok_audited: false,
  youtube_audited: false,
  support_email: 'support@nonsostudio.com',
  privacy_url: `${WEB_BASE_URL}/privacy`,
  terms_url: `${WEB_BASE_URL}/terms`,
  delete_account_url: `${WEB_BASE_URL}/delete-account`,
} as const;
