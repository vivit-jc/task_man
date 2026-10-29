import type { CSSProperties } from 'react';
import type { Task } from '../types';

/** タスクの背景色のプリセット。文字が読めるよう、どれも薄めにしてある */
export const TASK_COLOR_PRESETS: { name: string; color: string }[] = [
  { name: '赤', color: '#fde2e2' },
  { name: '橙', color: '#fdebd3' },
  { name: '黄', color: '#fbf5c8' },
  { name: '緑', color: '#dff3e0' },
  { name: '青', color: '#dde9fb' },
  { name: '紫', color: '#ece2f8' },
];

/** '#RRGGBB' / 'RRGGBB' を '#rrggbb' にそろえる。6 桁の 16 進数でなければ null */
export function normalizeHexColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value.trim());
  return match ? `#${match[1]!.toLowerCase()}` : null;
}

/** 表示に使う色。サブタスクは自分の色が無ければ親の色を継ぐ */
export function effectiveColor(task: Task, tasks: Task[]): string | null {
  if (task.color) return task.color;
  if (!task.parentId) return null;
  return tasks.find((t) => t.id === task.parentId)?.color ?? null;
}

/**
 * ダークテーマ用の色。薄い色をそのまま暗い画面に置くと眩しく文字も読めないので、
 * 色相だけ残して暗く落とす。
 */
export function darkVariant(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return `hsl(${Math.round(((h * 60) + 360) % 360)} ${Math.round(Math.min(s, 0.35) * 100)}% 20%)`;
}

/** 背景色を CSS 変数として渡す。色が無ければ何も足さない */
export function colorStyle(color: string | null): CSSProperties | undefined {
  if (!color) return undefined;
  return { '--task-bg': color, '--task-bg-dark': darkVariant(color) } as CSSProperties;
}
