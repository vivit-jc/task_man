/** 配列の要素を from から to へ移動した新しい配列を返す */
export function arrayMove<T>(items: T[], from: number, to: number): T[] {
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return next;
  next.splice(to, 0, moved);
  return next;
}

/** 並び順を 0..n-1 に振り直す。ドロップのたびに呼んで order の破綻を防ぐ */
export function reindex<T>(items: T[], assign: (item: T, index: number) => T): T[] {
  return items.map(assign);
}
