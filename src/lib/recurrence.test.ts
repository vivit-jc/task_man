import { describe, expect, it } from 'vitest';
import { makeEvent, makeEventSeries, parseAppData } from '../store/persist';
import {
  applySeriesChange,
  detachSeries,
  expandSeries,
  occurrenceDates,
  occurrenceId,
} from './recurrence';
import { fromIsoDate } from './date';

// 2026-11-02 は月曜
const TODAY = '2026-11-02';

function weekly(patch: Parameters<typeof makeEventSeries>[0]) {
  return makeEventSeries({ startDate: '2026-10-01', ...patch });
}

describe('定期の回の列挙', () => {
  it('複数の曜日を拾い、終了日で止まる', () => {
    const series = weekly({ title: '定例', weekdays: [2, 4], endDate: '2026-11-12' });
    expect(occurrenceDates(series, TODAY, '2026-11-30')).toEqual([
      '2026-11-03',
      '2026-11-05',
      '2026-11-10',
      '2026-11-12',
    ]);
  });

  it('開始日より前は拾わない', () => {
    const series = weekly({ title: '定例', weekdays: [1], startDate: '2026-11-10' });
    expect(occurrenceDates(series, TODAY, '2026-11-20')).toEqual(['2026-11-16']);
  });

  it('曜日が無ければ開始日の曜日にする', () => {
    const series = makeEventSeries({ title: '定例', weekdays: [], startDate: '2026-11-04' });
    expect(series.weekdays).toEqual([3]);
  });
});

describe('展開', () => {
  const series = weekly({
    title: '定例',
    weekdays: [2],
    allDay: false,
    startTime: '10:00',
    endTime: '11:00',
  });

  it('今日から 2 ヶ月先までを置き、時刻を写す', () => {
    const { events, added } = expandSeries([series], [], TODAY);
    // 11/3 〜 12/29 の火曜
    expect(added).toBe(9);
    expect(events[0]).toMatchObject({
      id: occurrenceId(series.id, '2026-11-03'),
      date: '2026-11-03',
      occurrenceDate: '2026-11-03',
      seriesId: series.id,
      startTime: '10:00',
      endTime: '11:00',
      cancelled: false,
    });
  });

  it('2 回続けて展開しても増えない', () => {
    const first = expandSeries([series], [], TODAY);
    const second = expandSeries([series], first.events, TODAY);
    expect(second.added).toBe(0);
    expect(second.events).toBe(first.events);
  });

  it('中止にした回は置き直さない', () => {
    const { events } = expandSeries([series], [], TODAY);
    const cancelled = events.map((e) => (e.date === '2026-11-10' ? { ...e, cancelled: true } : e));
    const again = expandSeries([series], cancelled, TODAY);
    expect(again.added).toBe(0);
    expect(again.events.filter((e) => e.occurrenceDate === '2026-11-10')).toHaveLength(1);
  });

  it('日付を動かした回は二重にならない', () => {
    const { events } = expandSeries([series], [], TODAY);
    const moved = events.map((e) =>
      e.date === '2026-11-10' ? { ...e, date: '2026-11-11', customized: true } : e,
    );
    const again = expandSeries([series], moved, TODAY);
    expect(again.added).toBe(0);
  });

  it('日が進むと先の回が足される', () => {
    const { events } = expandSeries([series], [], TODAY);
    const later = expandSeries([series], events, '2026-11-09');
    expect(later.added).toBe(1);
    expect(later.events.at(-1)?.date).toBe('2027-01-05');
  });
});

describe('定期を変えたとき', () => {
  const series = weekly({
    title: '定例',
    weekdays: [2],
    allDay: false,
    startTime: '10:00',
    endTime: '11:00',
  });

  it('個別に変えていない回だけが追従する', () => {
    const { events } = expandSeries([series], [], TODAY);
    const edited = events.map((e) =>
      e.date === '2026-11-10' ? { ...e, startTime: '13:00', endTime: '14:00', customized: true } : e,
    );
    const next = { ...series, startTime: '09:00', endTime: '10:00' };
    const result = applySeriesChange(next, edited, TODAY);
    expect(result.find((e) => e.date === '2026-11-03')?.startTime).toBe('09:00');
    expect(result.find((e) => e.date === '2026-11-10')?.startTime).toBe('13:00');
  });

  it('過去の回はそのまま', () => {
    const past = makeEvent({
      id: occurrenceId(series.id, '2026-10-27'),
      title: '定例',
      date: '2026-10-27',
      allDay: false,
      startTime: '10:00',
      seriesId: series.id,
      occurrenceDate: '2026-10-27',
    });
    const result = applySeriesChange({ ...series, title: '新しい名前' }, [past], TODAY);
    expect(result[0]?.title).toBe('定例');
  });

  it('曜日から外れた回は中止にする', () => {
    const { events } = expandSeries([series], [], TODAY);
    const next = { ...series, weekdays: [4 as const] };
    const result = applySeriesChange(next, events, TODAY);
    expect(result.every((e) => e.cancelled)).toBe(true);
    const expanded = expandSeries([next], result, TODAY);
    const live = expanded.events.filter((e) => !e.cancelled);
    expect(live.length).toBeGreaterThan(0);
    expect(live.every((e) => fromIsoDate(e.date).getDay() === 4)).toBe(true);
  });

  it('定期を消すと今日以降の回は中止にし、どの回も単発になる', () => {
    const past = makeEvent({
      title: '定例',
      date: '2026-10-27',
      seriesId: series.id,
      occurrenceDate: '2026-10-27',
    });
    const { events } = expandSeries([series], [past], TODAY);
    const result = detachSeries(series.id, events, TODAY);
    expect(result.every((e) => e.seriesId === null)).toBe(true);
    expect(result.find((e) => e.date === '2026-10-27')?.cancelled).toBe(false);
    expect(result.filter((e) => e.date >= TODAY).every((e) => e.cancelled)).toBe(true);
  });
});

describe('読み込み', () => {
  it('v3 のデータは定期 0 件・単発のイベントとして読む', () => {
    const data = parseAppData({
      schemaVersion: 3,
      tasks: [],
      events: [{ id: 'e_1', title: '展示会', date: '2026-11-10' }],
    });
    expect(data.eventSeries).toEqual([]);
    expect(data.events[0]).toMatchObject({ seriesId: null, occurrenceDate: null, cancelled: false });
  });

  it('消えた定期を指している回は単発に戻す', () => {
    const data = parseAppData({
      tasks: [],
      events: [{ id: 'e_1', title: '定例', date: '2026-11-10', seriesId: 's_gone', occurrenceDate: '2026-11-10' }],
    });
    expect(data.events[0]).toMatchObject({ seriesId: null, occurrenceDate: null });
  });
});
