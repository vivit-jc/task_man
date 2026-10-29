import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { formatMonthDay, formatTimeRange, isPlausibleIsoDate, today } from '../../lib/date';
import { formatWeekdays } from '../../lib/recurrence';
import type { EventSeries } from '../../types';

/** 定期の決まりを 1 行で。「毎週 火・木 10:00–11:00」 */
export function formatSeriesRule(series: EventSeries): string {
  const time = series.allDay ? '終日' : formatTimeRange(series.startTime, series.endTime);
  return `${formatWeekdays(series)} ${time}`;
}

/**
 * イベント画面の「定期」の欄。定期そのものはカレンダーに出ず、
 * 今日から 2 ヶ月先までの回が「これから」に並ぶ。
 */
export function SeriesSection() {
  const eventSeries = useAppStore((s) => s.eventSeries);
  const selectedSeriesId = useAppStore((s) => s.selectedSeriesId);
  const selectSeries = useAppStore((s) => s.selectSeries);
  const addSeries = useAppStore((s) => s.addSeries);
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState(today());

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    const id = addSeries({
      title: trimmed,
      startDate: isPlausibleIsoDate(startDate) ? startDate : today(),
    });
    setTitle('');
    // 曜日や時刻はパネルで決めてもらう
    if (id) selectSeries(id);
  };

  return (
    <section className="event-section">
      <h3>定期{eventSeries.length > 0 && `（${eventSeries.length}件）`}</h3>
      {eventSeries.length > 0 && (
        <div className="event-list">
          {eventSeries.map((series) => (
            <article
              key={series.id}
              className={`event-card series-card${selectedSeriesId === series.id ? ' is-selected' : ''}`}
            >
              <button type="button" className="event-open" onClick={() => selectSeries(series.id)}>
                <span className="event-body">
                  <span className="event-name">{series.title}</span>
                  <span className="event-meta num">
                    <span>{formatSeriesRule(series)}</span>
                    <span>
                      {formatMonthDay(series.startDate)}から
                      {series.endDate ? ` ${formatMonthDay(series.endDate)}まで` : ''}
                    </span>
                  </span>
                </span>
              </button>
            </article>
          ))}
        </div>
      )}
      <form
        className="quick-add event-add"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <input
          className="field"
          value={title}
          placeholder="毎週の予定を追加（例: 定例ミーティング）"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
              return;
            }
            if (e.key === 'Escape') {
              setTitle('');
              e.currentTarget.blur();
            }
          }}
        />
        <input
          type="date"
          className="field num"
          value={startDate}
          aria-label="定期の開始日（この日の曜日で始まります）"
          onChange={(e) => setStartDate(e.target.value)}
        />
        <button type="submit" className="btn btn-sm" disabled={!title.trim()}>
          追加
        </button>
      </form>
      <p className="hint">開始日の曜日で始まります。曜日や時刻は追加したあとに変えられます</p>
    </section>
  );
}
