import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatMonthDay, isPlausibleIsoDate, today, weekdayLabel } from '../../lib/date';
import { HORIZON_MONTHS } from '../../lib/recurrence';
import { WEEKDAY_LABEL } from '../../types';
import type { Weekday } from '../../types';
import { formatSeriesRule } from './SeriesSection';

/** 月曜始まりで並べる */
const WEEKDAY_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

/** 「これからの回」に出す件数 */
const UPCOMING_LIMIT = 8;

export function SeriesEditorPanel() {
  const selectedSeriesId = useAppStore((s) => s.selectedSeriesId);
  const series = useAppStore(
    (s) => s.eventSeries.find((r) => r.id === s.selectedSeriesId) ?? null,
  );
  const events = useAppStore((s) => s.events);
  const selectSeries = useAppStore((s) => s.selectSeries);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const updateSeries = useAppStore((s) => s.updateSeries);
  const deleteSeries = useAppStore((s) => s.deleteSeries);

  // 打ちかけの日付を保存しないよう、画面にだけ持たせる（EventEditorPanel と同じ）
  const [startText, setStartText] = useState('');
  useEffect(() => {
    setStartText(series?.startDate ?? '');
  }, [series?.id, series?.startDate]);

  const [endText, setEndText] = useState('');
  useEffect(() => {
    setEndText(series?.endDate ?? '');
  }, [series?.id, series?.endDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectSeries(null);
    };
    if (selectedSeriesId) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedSeriesId, selectSeries]);

  if (!series) return null;

  const now = today();
  const upcoming = events
    .filter((e) => e.seriesId === series.id && (e.occurrenceDate ?? e.date) >= now)
    .sort((a, b) => (a.occurrenceDate ?? a.date).localeCompare(b.occurrenceDate ?? b.date));

  const toggleWeekday = (day: Weekday) => {
    const on = series.weekdays.includes(day);
    // 曜日は 1 つ以上残す
    if (on && series.weekdays.length === 1) return;
    updateSeries(series.id, {
      weekdays: on ? series.weekdays.filter((d) => d !== day) : [...series.weekdays, day],
    });
  };

  return (
    <aside className="editor" aria-label="定期の詳細">
      <div className="editor-head">
        <h2 className="editor-title">定期の詳細</h2>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => selectSeries(null)}>
          閉じる
        </button>
      </div>

      <div className="editor-body">
        <p className="hint num">{formatSeriesRule(series)}</p>

        <label className="label" htmlFor="series-title">
          タイトル
        </label>
        <input
          id="series-title"
          className="field"
          value={series.title}
          onChange={(e) => updateSeries(series.id, { title: e.target.value })}
        />

        <span className="label">曜日</span>
        <div className="segmented" role="group" aria-label="曜日">
          {WEEKDAY_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              className={series.weekdays.includes(day) ? 'is-active' : ''}
              aria-pressed={series.weekdays.includes(day)}
              onClick={() => toggleWeekday(day)}
            >
              {WEEKDAY_LABEL[day]}
            </button>
          ))}
        </div>

        <span className="label">時間</span>
        <div className="segmented" role="group" aria-label="時間">
          <button
            type="button"
            className={series.allDay ? 'is-active' : ''}
            onClick={() => updateSeries(series.id, { allDay: true })}
          >
            終日
          </button>
          <button
            type="button"
            className={!series.allDay ? 'is-active' : ''}
            onClick={() =>
              updateSeries(series.id, { allDay: false, startTime: series.startTime ?? '10:00' })
            }
          >
            時刻を指定
          </button>
        </div>
        {!series.allDay && (
          <div className="row">
            <input
              type="time"
              className="field num"
              value={series.startTime ?? ''}
              aria-label="開始時刻"
              onChange={(e) => updateSeries(series.id, { startTime: e.target.value || null })}
            />
            <span className="hint">〜</span>
            <input
              type="time"
              className="field num"
              value={series.endTime ?? ''}
              aria-label="終了時刻"
              disabled={!series.startTime}
              onChange={(e) => updateSeries(series.id, { endTime: e.target.value || null })}
            />
          </div>
        )}

        <label className="label" htmlFor="series-start">
          開始日
        </label>
        <input
          id="series-start"
          type="date"
          className="field num"
          value={startText}
          onChange={(e) => {
            setStartText(e.target.value);
            if (isPlausibleIsoDate(e.target.value)) {
              updateSeries(series.id, { startDate: e.target.value });
            }
          }}
          onBlur={() => setStartText(series.startDate)}
        />

        <label className="label" htmlFor="series-end">
          終了日
        </label>
        <div className="row">
          <input
            id="series-end"
            type="date"
            className="field num"
            value={endText}
            min={series.startDate}
            onChange={(e) => {
              setEndText(e.target.value);
              if (!e.target.value) updateSeries(series.id, { endDate: null });
              else if (isPlausibleIsoDate(e.target.value)) {
                updateSeries(series.id, { endDate: e.target.value });
              }
            }}
            onBlur={() => setEndText(series.endDate ?? '')}
          />
          {series.endDate && (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => updateSeries(series.id, { endDate: null })}
            >
              終わりなしに戻す
            </button>
          )}
        </div>
        <p className="hint">空のままなら終わりなし。終了日より後の回は中止になります</p>

        <label className="label" htmlFor="series-note">
          メモ
        </label>
        <textarea
          id="series-note"
          className="field"
          rows={3}
          placeholder="各回にも同じメモが入ります"
          value={series.note}
          onChange={(e) => updateSeries(series.id, { note: e.target.value })}
        />

        <span className="label">
          これからの回（{upcoming.filter((e) => !e.cancelled).length}件）
        </span>
        <ul className="editor-subtasks">
          {upcoming.slice(0, UPCOMING_LIMIT).map((event) => (
            <li key={event.id} className={event.cancelled ? 'is-cancelled' : ''}>
              <button type="button" onClick={() => selectEvent(event.id)}>
                {formatMonthDay(event.date)}（{weekdayLabel(event.date)}）
                {!event.allDay && event.startTime ? ` ${event.startTime}` : ''}
                {event.cancelled ? ' 中止' : event.customized ? ' 変更あり' : ''}
              </button>
            </li>
          ))}
        </ul>
        <p className="hint">
          今日から {HORIZON_MONTHS} ヶ月先までの回が、イベントとして置かれます。
          定期を変えると、個別に変えていない回もそれに合わせます
        </p>

        <div className="editor-footer">
          <span className="editor-stamp num">
            作成 {formatMonthDay(series.createdAt.slice(0, 10))}
          </span>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            onClick={() => deleteSeries(series.id)}
          >
            定期を削除
          </button>
        </div>
      </div>
    </aside>
  );
}
