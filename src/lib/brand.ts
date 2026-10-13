// ClipPipeline design tokens — single source for the custom UI you're about to
// build. Mirrors google_stitch.md §2 so Stitch/Claude designs and the app agree.
import type { Platform as SocialPlatform, DistributionStatus } from '@/api/types';

export const colors = {
  background: '#0B0B0F',
  surface: '#16161D',
  surfaceRaised: '#1E1E28',
  border: '#2A2A36',
  textPrimary: '#FFFFFF',
  textSecondary: '#A1A1AE',
  accent: '#7C5CFF',
  accentTo: '#B14CFF',
  success: '#28C76F',
  warning: '#FF9F43',
  danger: '#EA5455',
};

export const platformColor: Record<SocialPlatform, string> = {
  tiktok: '#FE2C55',
  youtube: '#FF0000',
  instagram: '#DD2A7B',
  facebook: '#1877F2',
};

export const statusColor: Record<DistributionStatus, string> = {
  queued: colors.warning,
  uploading: colors.warning,
  processing: colors.warning,
  published: colors.success,
  failed: colors.danger,
};

export const statusLabel: Record<DistributionStatus, string> = {
  queued: 'Queued',
  uploading: 'Uploading',
  processing: 'Processing',
  published: 'Published',
  failed: 'Failed',
};

export const radius = { card: 20, input: 12, pill: 999 };
export const space = (n: number) => n * 8; // 8pt grid
