import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform, Share } from 'react-native';

import { fetchAnalyticsCsv } from '@/api/hooks';
import type { Period } from '@/api/types';

/** GET /analytics/export (§14) → save as a CSV in the cache dir → system share sheet (I2 / R7). */
export async function exportAnalyticsCsv(period: Period): Promise<void> {
  const csv = await fetchAnalyticsCsv(period);
  const name = `clippipeline-analytics-${period}.csv`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(csv);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      UTI: 'public.comma-separated-values-text',
      dialogTitle: 'Export analytics',
    });
  } else {
    await Share.share({ message: csv, title: name });
  }
}
