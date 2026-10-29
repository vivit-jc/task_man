import type { HhMm, IsoDate } from '../types';

const WEEKDAY_JA = ['日', '月', '火', '水', '木', '金', '土'];

/** Date → 'YYYY-MM-DD'（ローカルタイムゾーン基準） */
export function toIsoDate(date: Date): IsoDate {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 'YYYY-MM-DD' → Date（ローカル 0 時）。UTC 解釈による 1 日ズレを避ける */
export function fromIsoDate(iso: IsoDate): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function today(): IsoDate {
  return toIsoDate(new Date());
}

export function addDays(iso: IsoDate, days: number): IsoDate {
  const date = fromIsoDate(iso);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
}

export function addMonths(iso: IsoDate, months: number): IsoDate {
  const date = fromIsoDate(iso);
  const targetDay = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  // 月末の繰り上がり（1/31 + 1ヶ月 = 3/3）を防ぐ
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(targetDay, lastDay));
  return toIsoDate(date);
}

/** その日を含む週の開始日 */
export function startOfWeek(iso: IsoDate, weekStartsOn: 0 | 1): IsoDate {
  const date = fromIsoDate(iso);
  const diff = (date.getDay() - weekStartsOn + 7) % 7;
  date.setDate(date.getDate() - diff);
  return toIsoDate(date);
}

/** 週の 7 日分 */
export function weekDays(anchor: IsoDate, weekStartsOn: 0 | 1): IsoDate[] {
  const start = startOfWeek(anchor, weekStartsOn);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** 月ビュー用。前後の月を含めて週単位で埋めたグリッド */
export function monthGrid(anchor: IsoDate, weekStartsOn: 0 | 1): IsoDate[] {
  const date = fromIsoDate(anchor);
  const first = toIsoDate(new Date(date.getFullYear(), date.getMonth(), 1));
  const last = toIsoDate(new Date(date.getFullYear(), date.getMonth() + 1, 0));
  const start = startOfWeek(first, weekStartsOn);
  const cells: IsoDate[] = [];
  let cursor = start;
  // 最終日を含む週の末尾まで埋める
  while (cursor <= last || cells.length % 7 !== 0) {
    cells.push(cursor);
    cursor = addDays(cursor, 1);
    if (cells.length > 42) break;
  }
  return cells;
}

export function weekdayLabel(iso: IsoDate): string {
  return WEEKDAY_JA[fromIsoDate(iso).getDay()] ?? '';
}

export function isWeekend(iso: IsoDate): boolean {
  const day = fromIsoDate(iso).getDay();
  return day === 0 || day === 6;
}

/** 土日の色分け用。平日は null */
export function weekendKind(iso: IsoDate): 'saturday' | 'sunday' | null {
  const day = fromIsoDate(iso).getDay();
  if (day === 6) return 'saturday';
  if (day === 0) return 'sunday';
  return null;
}

export function isSameMonth(a: IsoDate, b: IsoDate): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

/** 今日から見た日数差。過去は負 */
export function daysFromToday(iso: IsoDate): number {
  const diff = fromIsoDate(iso).getTime() - fromIsoDate(today()).getTime();
  return Math.round(diff / 86_400_000);
}

export type DueLevel = 'overdue' | 'today' | 'soon' | 'later';

/** 期限の切迫度。バッジの色分けに使う */
export function dueLevel(iso: IsoDate): DueLevel {
  const diff = daysFromToday(iso);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff <= 3) return 'soon';
  return 'later';
}

/** 期限バッジの文言。近い日付は相対表現の方が読み取りやすい */
export function formatDue(iso: IsoDate): string {
  const diff = daysFromToday(iso);
  if (diff === 0) return '今日';
  if (diff === 1) return '明日';
  if (diff === -1) return '昨日';
  if (diff < 0) return `${-diff}日超過`;
  if (diff <= 6) return `${diff}日後`;
  return formatMonthDay(iso);
}

export function formatMonthDay(iso: IsoDate): string {
  const date = fromIsoDate(iso);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

export function formatMonthTitle(iso: IsoDate): string {
  const date = fromIsoDate(iso);
  return `${date.getFullYear()}年${date.getMonth() + 1}月`;
}

/** 'YYYY/M/D - M/D' の範囲表示 */
export function formatDayRange(start: IsoDate, end: IsoDate): string {
  return `${fromIsoDate(start).getFullYear()}/${formatMonthDay(start)} - ${formatMonthDay(end)}`;
}

export function formatWeekRange(anchor: IsoDate, weekStartsOn: 0 | 1): string {
  const days = weekDays(anchor, weekStartsOn);
  return formatDayRange(days[0]!, days[6]!);
}

/** その月の 1 日。月単位のアンカーを揃えるのに使う */
export function startOfMonth(iso: IsoDate): IsoDate {
  return `${iso.slice(0, 7)}-01`;
}

/**
 * 入力途中の値を弾く。
 * <input type="date"> は 1 文字ごとに change を投げるので、年を打ち直すあいだ
 * `0002-10-12` のような日付が一度ストアに入ってしまう。
 */
export function isPlausibleIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1000-01-01';
}

export interface MonthOption {
  anchor: IsoDate;
  label: string;
  offset: number;
}

/**
 * 月ビューの月セレクタ用。基準の月から count ヶ月先までの選択肢。
 * 必ず 1 日に揃えてから足す（1/31 起点だと月末クランプで 3 月が飛ぶため）。
 */
export function monthOptions(base: IsoDate, count: number): MonthOption[] {
  const first = startOfMonth(base);
  return Array.from({ length: count + 1 }, (_, offset) => ({
    anchor: offset === 0 ? first : addMonths(first, offset),
    label: offset === 0 ? '今月' : `+${offset}ヶ月`,
    offset,
  }));
}

/** '10:00–12:00' / '10:00' / ''（開始が無ければ空） */
export function formatTimeRange(startTime: string | null, endTime: string | null): string {
  if (!startTime) return '';
  return endTime ? `${startTime}–${endTime}` : startTime;
}

/** 終了日として意味のある値。単日なら開始日そのもの */
function lastDay(date: IsoDate, endDate: IsoDate | null): IsoDate {
  return endDate && endDate > date ? endDate : date;
}

/** 開始日から終了日までの日数。単日は 1 */
export function spanDays(date: IsoDate, endDate: IsoDate | null): number {
  const end = lastDay(date, endDate);
  if (end === date) return 1;
  return Math.round((fromIsoDate(end).getTime() - fromIsoDate(date).getTime()) / 86_400_000) + 1;
}

/** '10/12' / '10/12–10/14' */
export function formatDateRange(date: IsoDate, endDate: IsoDate | null): string {
  const end = lastDay(date, endDate);
  return end === date ? formatMonthDay(date) : `${formatMonthDay(date)}–${formatMonthDay(end)}`;
}

/**
 * イベントまでの距離。期限（formatDue）とは言い回しを変える。
 * 複数日のイベントは、始まってから終わるまで「開催中」とする。
 */
export function formatCountdown(iso: IsoDate, endDate: IsoDate | null = null): string {
  const diff = daysFromToday(iso);
  if (diff === 1) return '明日';
  if (diff > 0) return `あと${diff}日`;

  const endDiff = daysFromToday(lastDay(iso, endDate));
  if (endDiff < 0) return `${-endDiff}日前`;
  if (endDiff === 0) return diff === 0 ? '今日' : '今日まで';
  return diff === 0 ? '今日から' : '開催中';
}

export type EventLevel = 'past' | 'today' | 'soon' | 'later';

/**
 * イベントの切迫度。バッジの色分けに使う。1 週間以内を soon とする。
 * 開催中のあいだは today 扱い。
 */
export function eventLevel(iso: IsoDate, endDate: IsoDate | null = null): EventLevel {
  if (daysFromToday(lastDay(iso, endDate)) < 0) return 'past';
  const diff = daysFromToday(iso);
  if (diff <= 0) return 'today';
  if (diff <= 7) return 'soon';
  return 'later';
}

/** カードに出す「いつやるか」の文言。AppEvent をそのまま渡せる形にしてある */
export interface EventPeriod {
  date: IsoDate;
  endDate: IsoDate | null;
  allDay: boolean;
  startTime: HhMm | null;
  endTime: HhMm | null;
}

export function formatEventPeriod(event: EventPeriod): string {
  const end = lastDay(event.date, event.endDate);
  if (end === event.date) {
    if (event.allDay) return '終日';
    return formatTimeRange(event.startTime, event.endTime) || '時刻未定';
  }

  const endLabel = `${formatMonthDay(end)}(${weekdayLabel(end)})`;
  const days = `${spanDays(event.date, end)}日間`;
  if (event.allDay) return `${endLabel}まで・${days}`;
  // 日をまたぐので、開始と終了はそれぞれ別の日の時刻になる
  const from = event.startTime ?? '時刻未定';
  const to = event.endTime ? ` ${event.endTime}` : '';
  return `${from} 〜 ${endLabel}${to}・${days}`;
}
