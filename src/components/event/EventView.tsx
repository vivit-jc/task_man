import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { groupEvents, matchesEventText } from '../../store/selectors';
import { formatCountdown, formatMonthDay, today } from '../../lib/date';
import { EventCard } from './EventCard';
import { EventQuickAdd } from './EventQuickAdd';
import { SeriesSection } from './SeriesSection';

/** 予定の一覧。これからの分を上に、終わった分は畳んで下に置く */
export function EventView() {
  const events = useAppStore((s) => s.events);
  const search = useAppStore((s) => s.ui.search);
  const [showPast, setShowPast] = useState(false);

  const filtered = events.filter((event) => matchesEventText(event, search));
  const { upcoming, past } = groupEvents(filtered, today());
  const next = upcoming.find((event) => !event.cancelled);

  return (
    <div className="event-view">
      <div className="event-head">
        <h2 className="event-heading">イベント</h2>
        {next && (
          <span className="event-next num">
            次は {formatMonthDay(next.date)} {next.title}（{formatCountdown(next.date)}）
          </span>
        )}
      </div>

      <EventQuickAdd />

      <section className="event-section">
        <h3>これから{upcoming.length > 0 && `（${upcoming.length}件）`}</h3>
        {upcoming.length === 0 ? (
          <p className="empty">
            {search ? '条件に合うイベントはありません' : '予定はまだありません。上の欄から追加できます'}
          </p>
        ) : (
          <div className="event-list">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        )}
      </section>

      <SeriesSection />

      {past.length > 0 && (
        <section className="event-section">
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => setShowPast(!showPast)}
            aria-expanded={showPast}
          >
            {showPast ? '▾' : '▸'} 終わったイベント（{past.length}件）
          </button>
          {showPast && (
            <div className="event-list">
              {past.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
