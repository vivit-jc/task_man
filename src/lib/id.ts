/** 衝突しない程度に短い ID。crypto.randomUUID が無い環境でも動くようにしておく */
export function createId(prefix = 't'): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}
