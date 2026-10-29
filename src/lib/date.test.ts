import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addDays,
  addMonths,
  eventLevel,
  formatCountdown,
  formatDateRange,
  formatEventPeriod,
  formatTimeRange,
  fromIsoDate,
  isPlausibleIsoDate,
  spanDays,
  monthGrid,
  monthOptions,
  startOfWeek,
  toIsoDate,
  weekDays,
} from './date';

describe('日付ユーティリティ', () => {
  it('ローカル日付として往復できる', () => {
    expect(toIsoDate(fromIsoDate('2026-09-19'))).toBe('2026-09-19');
  });

  it('月をまたいで加算できる', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('月末の繰り上がりを起こさない', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28');
  });

  it('週の開始日を設定に従って求める', () => {
    // 2026-09-19 は土曜
    expect(startOfWeek('2026-09-19', 1)).toBe('2026-09-14');
    expect(startOfWeek('2026-09-19', 0)).toBe('2026-09-13');
  });

  it('週は 7 日連続で返る', () => {
    const days = weekDays('2026-09-19', 1);
    expect(days).toHaveLength(7);
    expect(days[0]).toBe('2026-09-14');
    expect(days[6]).toBe('2026-09-20');
  });

  it('月グリッドは週単位で埋まり、当月をすべて含む', () => {
    const cells = monthGrid('2026-09-19', 1);
    expect(cells.length % 7).toBe(0);
    expect(cells).toContain('2026-09-01');
    expect(cells).toContain('2026-09-30');
  });
});

describe('イベントの日付表示', () => {
  it('時刻の範囲を組み立てる', () => {
    expect(formatTimeRange('10:00', '12:00')).toBe('10:00–12:00');
    expect(formatTimeRange('10:00', null)).toBe('10:00');
    expect(formatTimeRange(null, '12:00')).toBe('');
  });

  it('入力途中の年を弾く', () => {
    expect(isPlausibleIsoDate('2026-10-12')).toBe(true);
    expect(isPlausibleIsoDate('1000-01-01')).toBe(true);
    // 年を打ち直しているあいだの値
    expect(isPlausibleIsoDate('0012-10-12')).toBe(false);
    expect(isPlausibleIsoDate('')).toBe(false);
  });

  it('月セレクタは月末起点でも月を飛ばさない', () => {
    const options = monthOptions('2026-01-31', 3);
    expect(options.map((o) => o.anchor)).toEqual([
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
    ]);
    expect(options.map((o) => o.label)).toEqual(['今月', '+1ヶ月', '+2ヶ月', '+3ヶ月']);
  });
});

describe('複数日のイベントの表示', () => {
  it('期間を日数で数える。単日は 1 日', () => {
    expect(spanDays('2026-10-12', null)).toBe(1);
    expect(spanDays('2026-10-12', '2026-10-12')).toBe(1);
    expect(spanDays('2026-10-12', '2026-10-14')).toBe(3);
    // 月をまたいでも数えられる
    expect(spanDays('2026-10-30', '2026-11-02')).toBe(4);
  });

  it('日付の範囲を組み立てる', () => {
    expect(formatDateRange('2026-10-12', null)).toBe('10/12');
    expect(formatDateRange('2026-10-12', '2026-10-12')).toBe('10/12');
    expect(formatDateRange('2026-10-12', '2026-10-14')).toBe('10/12–10/14');
  });

  it('期間の文言は単日と複数日で書き分ける', () => {
    const base = { date: '2026-10-12', endDate: null, allDay: true, startTime: null, endTime: null };
    expect(formatEventPeriod(base)).toBe('終日');
    expect(
      formatEventPeriod({ ...base, allDay: false, startTime: '10:00', endTime: '17:00' }),
    ).toBe('10:00–17:00');
    // 2026-10-14 は水曜
    expect(formatEventPeriod({ ...base, endDate: '2026-10-14' })).toBe('10/14(水)まで・3日間');
    expect(
      formatEventPeriod({
        ...base,
        endDate: '2026-10-14',
        allDay: false,
        startTime: '10:00',
        endTime: '17:00',
      }),
    ).toBe('10:00 〜 10/14(水) 17:00・3日間');
  });
});

describe('イベントまでの距離', () => {
  // formatCountdown / eventLevel は today() に依存するので日付を固定する
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 19));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('今日・明日・過去を言い分ける', () => {
    expect(formatCountdown('2026-09-19')).toBe('今日');
    expect(formatCountdown('2026-09-20')).toBe('明日');
    expect(formatCountdown('2026-09-22')).toBe('あと3日');
    expect(formatCountdown('2026-09-17')).toBe('2日前');
  });

  it('切迫度は 1 週間を境に分ける', () => {
    expect(eventLevel('2026-09-18')).toBe('past');
    expect(eventLevel('2026-09-19')).toBe('today');
    expect(eventLevel('2026-09-26')).toBe('soon');
    expect(eventLevel('2026-09-27')).toBe('later');
  });

  it('開催中のあいだは終わっていない扱いにする', () => {
    // 昨日始まって明日まで
    expect(formatCountdown('2026-09-18', '2026-09-20')).toBe('開催中');
    expect(eventLevel('2026-09-18', '2026-09-20')).toBe('today');
    // 今日始まる
    expect(formatCountdown('2026-09-19', '2026-09-21')).toBe('今日から');
    // 今日で終わる
    expect(formatCountdown('2026-09-17', '2026-09-19')).toBe('今日まで');
    // 終わった
    expect(formatCountdown('2026-09-15', '2026-09-17')).toBe('2日前');
    expect(eventLevel('2026-09-15', '2026-09-17')).toBe('past');
    // これから始まる複数日は開始日までの距離で言う
    expect(formatCountdown('2026-09-22', '2026-09-24')).toBe('あと3日');
  });
});
