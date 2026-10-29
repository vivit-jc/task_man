import { useAppStore } from '../../store/useAppStore';
import { eventProgress } from '../../store/selectors';
import { formatMinutes } from '../../lib/estimate';
import {
  eventLevel,
  formatCountdown,
  formatEventPeriod,
  formatMonthDay,
  weekdayLabel,
} from '../../lib/date';
import type { AppEvent } from '../../types';

/** イベント一覧の 1 件。紐づいたタスクもここで開閉せずそのまま並べる */
export function EventCard({ event }: { event: AppEvent }) {
  const tasks = useAppStore((s) => s.tasks);
  const showDone = useAppStore((s) => s.ui.showDone);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const selectTask = useAppStore((s) => s.selectTask);
  const toggleDone = useAppStore((s) => s.toggleDone);

  const progress = eventProgress(event, tasks);
  const level = eventLevel(event.date, event.endDate);
  const visible = showDone ? progress.tasks : progress.tasks.filter((t) => !t.done);
  const ratio = progress.count === 0 ? 0 : progress.doneCount / progress.count;

  return (
    <article
      className={[
        'event-card',
        `is-${level}`,
        event.cancelled ? 'is-cancelled' : '',
        selectedEventId === event.id ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button type="button" className="event-open" onClick={() => selectEvent(event.id)}>
        <span className="event-daybox num">
          <span className="event-md">{formatMonthDay(event.date)}</span>
          <span className="event-wd">{weekdayLabel(event.date)}</span>
        </span>
        <span className="event-body">
          <span className="event-name">
            {event.cancelled && <span className="event-flag is-cancelled">中止</span>}
            {event.seriesId && <span className="event-flag">定期</span>}
            {event.title}
          </span>
          <span className="event-meta num">
            <span>{formatEventPeriod(event)}</span>
            {!event.cancelled && (
              <span className={`event-count is-${level}`}>
                {formatCountdown(event.date, event.endDate)}
              </span>
            )}
            {progress.count > 0 && (
              <span>
                タスク {progress.doneCount}/{progress.count}
              </span>
            )}
            {progress.minutes > 0 && <span>{formatMinutes(progress.minutes)}</span>}
          </span>
        </span>
      </button>

      {progress.count > 0 && (
        <div className="event-bar" title={`${progress.doneCount}/${progress.count} 完了`}>
          <span className="event-bar-fill" style={{ width: `${ratio * 100}%` }} />
        </div>
      )}

      <ul className="event-tasklist">
        {visible.map((task) => (
          <li key={task.id} className={task.done ? 'is-done' : ''}>
            <input
              type="checkbox"
              className="task-check"
              checked={task.done}
              onChange={() => toggleDone(task.id)}
              aria-label={`${task.title} を完了にする`}
            />
            <button type="button" onClick={() => selectTask(task.id)}>
              {task.title}
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}
