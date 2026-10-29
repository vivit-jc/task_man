import type { AppEvent, EventSeries, IsoDate } from '../types';
import { WEEKDAY_LABEL } from '../types';
import { makeEvent } from '../store/persist';
import { addDays, addMonths, fromIsoDate } from './date';

/** 定期の回を、今日からこの月数先まで置く */
export const HORIZON_MONTHS = 2;

/**
 * 定期の回の id。同じ定期の同じ日なら、どこで展開しても同じ id になる。
 * アプリと taskman の展開が別々に走っても、同じ回が二重にならないようにするため。
 */
export function occurrenceId(seriesId: string, date: IsoDate): string {
  return `e_${seriesId.replace(/^s_/, '')}_${date.replace(/-/g, '')}`;
}

/** その日が定期の回に当たるか（曜日と期間） */
export function isOccurrenceDate(series: EventSeries, date: IsoDate): boolean {
  if (date < series.startDate) return false;
  if (series.endDate && date > series.endDate) return false;
  return (series.weekdays as number[]).includes(fromIsoDate(date).getDay());
}

/** from〜to（どちらも含む）のうち、定期の回に当たる日 */
export function occurrenceDates(series: EventSeries, from: IsoDate, to: IsoDate): IsoDate[] {
  const dates: IsoDate[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    if (isOccurrenceDate(series, date)) dates.push(date);
  }
  return dates;
}

/** 「毎週 火・木 10:00–11:00」の「毎週 火・木」の部分 */
export function formatWeekdays(series: Pick<EventSeries, 'weekdays'>): string {
  return `毎週 ${series.weekdays.map((d) => WEEKDAY_LABEL[d]).join('・')}`;
}

/** 定期の決まりどおりの回を作る */
function makeOccurrence(series: EventSeries, date: IsoDate, now: string): AppEvent {
  return makeEvent({
    id: occurrenceId(series.id, date),
    title: series.title,
    note: series.note,
    date,
    allDay: series.allDay,
    startTime: series.startTime,
    endTime: series.endTime,
    seriesId: series.id,
    occurrenceDate: date,
    createdAt: now,
    updatedAt: now,
  });
}

function occurrenceKey(seriesId: string, date: IsoDate): string {
  return `${seriesId}|${date}`;
}

/**
 * 今日から HORIZON_MONTHS 先までの回のうち、まだ無いものを足す。
 * 中止にした回や日付を動かした回も「ある」として数えるので、何度呼んでも増えない。
 * 足すものが無ければ同じ配列をそのまま返す。
 */
export function expandSeries(
  seriesList: EventSeries[],
  events: AppEvent[],
  today: IsoDate,
): { events: AppEvent[]; added: number } {
  const existing = new Set<string>();
  const ids = new Set<string>();
  for (const event of events) {
    ids.add(event.id);
    if (event.seriesId && event.occurrenceDate) {
      existing.add(occurrenceKey(event.seriesId, event.occurrenceDate));
    }
  }

  const horizon = addMonths(today, HORIZON_MONTHS);
  const now = new Date().toISOString();
  const added: AppEvent[] = [];
  for (const series of seriesList) {
    const from = series.startDate > today ? series.startDate : today;
    const to = series.endDate && series.endDate < horizon ? series.endDate : horizon;
    for (const date of occurrenceDates(series, from, to)) {
      if (existing.has(occurrenceKey(series.id, date))) continue;
      const occurrence = makeOccurrence(series, date, now);
      if (ids.has(occurrence.id)) continue;
      added.push(occurrence);
    }
  }
  return added.length > 0
    ? { events: [...events, ...added], added: added.length }
    : { events, added: 0 };
}

/**
 * 定期を書き換えたあと、今日以降の回をそれに合わせる。
 * 個別に編集した回と中止した回はそのまま残す。
 * 曜日や期間から外れた回は中止にする（カレンダーに登録済みかもしれないので消さない）。
 */
export function applySeriesChange(
  series: EventSeries,
  events: AppEvent[],
  today: IsoDate,
): AppEvent[] {
  const now = new Date().toISOString();
  return events.map((event) => {
    if (event.seriesId !== series.id || !event.occurrenceDate) return event;
    if (event.occurrenceDate < today || event.customized || event.cancelled) return event;
    if (!isOccurrenceDate(series, event.occurrenceDate)) {
      return { ...event, cancelled: true, updatedAt: now };
    }
    return {
      ...makeOccurrence(series, event.occurrenceDate, now),
      id: event.id,
      createdAt: event.createdAt,
    };
  });
}

/**
 * 定期を消したとき。今日以降のまだ中止していない回は中止にし、
 * どの回も単発のイベントとして残す（過去の記録とカレンダーとの対応を保つため）。
 */
export function detachSeries(seriesId: string, events: AppEvent[], today: IsoDate): AppEvent[] {
  const now = new Date().toISOString();
  return events.map((event) => {
    if (event.seriesId !== seriesId) return event;
    const future = (event.occurrenceDate ?? event.date) >= today;
    return {
      ...event,
      seriesId: null,
      occurrenceDate: null,
      customized: false,
      cancelled: event.cancelled || future,
      updatedAt: future && !event.cancelled ? now : event.updatedAt,
    };
  });
}
