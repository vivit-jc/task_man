/** 見積もり入力のプリセット（分） */
export const ESTIMATE_PRESETS = [15, 30, 60, 120, 240, 480];

/** 分 → '45m' / '1.5h' の表示文字列 */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const hours = minutes / 60;
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`;
}

export function formatMinutesOrDash(minutes: number | null): string {
  return minutes == null ? '—' : formatMinutes(minutes);
}

/**
 * '1.5h' '90m' '2' '1h30' といった自由入力を分に変換する。
 * 解釈できなければ null。
 */
export function parseEstimate(input: string): number | null {
  const text = input.trim().toLowerCase().replace(/\s+/g, '');
  if (!text) return null;

  const combined = text.match(/^(\d+(?:\.\d+)?)h(\d+(?:m)?)?$/);
  if (combined) {
    const hours = Number(combined[1]);
    const mins = combined[2] ? Number(combined[2].replace('m', '')) : 0;
    const total = Math.round(hours * 60 + mins);
    return total > 0 ? total : null;
  }

  const minutesOnly = text.match(/^(\d+(?:\.\d+)?)m$/);
  if (minutesOnly) {
    const total = Math.round(Number(minutesOnly[1]));
    return total > 0 ? total : null;
  }

  // 単位なしは時間として扱う（「2」= 2h）
  const bare = text.match(/^(\d+(?:\.\d+)?)$/);
  if (bare) {
    const total = Math.round(Number(bare[1]) * 60);
    return total > 0 ? total : null;
  }

  return null;
}

/** null を 0 として合計する */
export function sumMinutes(values: (number | null)[]): number {
  return values.reduce<number>((acc, v) => acc + (v ?? 0), 0);
}
