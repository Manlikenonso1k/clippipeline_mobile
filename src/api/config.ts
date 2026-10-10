/**
 * Use the explicit environment override when provided; otherwise use the live
 * Laravel API for both development and production mobile builds.
 */
const LIVE_API_URL = 'https://clippipeline.nonsostudio.com/api';

export const API_BASE_URL: string =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? LIVE_API_URL;
