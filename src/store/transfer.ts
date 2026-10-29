import type { AppData } from '../types';
import { ImportError, SCHEMA_VERSION, parseAppData } from './persist';
import { today } from '../lib/date';

/** エクスポートするファイルの中身を作る */
export function toExportJson(data: AppData): string {
  return JSON.stringify(
    {
      schemaVersion: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: data.tasks,
      tags: data.tags,
      events: data.events,
      eventSeries: data.eventSeries,
      mediaKinds: data.mediaKinds,
      media: data.media,
      settings: data.settings,
      ui: data.ui,
    },
    null,
    2,
  );
}

export function exportFileName(): string {
  return `task-man-backup-${today()}.json`;
}

/** JSON をダウンロードさせる */
export function downloadJson(json: string, fileName: string): void {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** 読み込んだテキストを AppData にする。壊れていれば ImportError */
export function parseImportText(text: string): AppData {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new ImportError('JSON として読み取れませんでした。ファイルが壊れていないか確認してください。');
  }
  return parseAppData(raw);
}

export { ImportError };
