import { eventLevel, formatCountdown, formatDateRange, formatEventPeriod } from '../../lib/date';
import type { AppEvent } from '../../types';

/** タスクに紐づいたイベントを示すバッジ。「10/12–10/14 展示会 開催中」 */
export function EventBadge({ event }: { event: AppEvent }) {
  // 中止の回は、過ぎたイベントと同じく目立たせない
  const level = event.cancelled ? 'past' : eventLevel(event.date, event.endDate);
  return (
    <span
      className={`event-badge is-${level} num`}
      title={`イベント ${formatDateRange(event.date, event.endDate)} ${formatEventPeriod(event)} ${event.title}`}
    >
      {formatDateRange(event.date, event.endDate)} {event.title}
      <span className="event-badge-left">
        {event.cancelled ? '中止' : formatCountdown(event.date, event.endDate)}
      </span>
    </span>
  );
}
