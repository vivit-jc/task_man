import { useState } from 'react';
import type { CSSProperties } from 'react';
import { useAppStore } from '../../store/useAppStore';
import {
  dayTasks,
  daySummary,
  eventEnd,
  eventsOn,
  nestedSubtasks,
  scheduledMinutes,
} from '../../store/selectors';
import { formatMinutes } from '../../lib/estimate';
import {
  addMonths,
  formatDateRange,
  formatEventPeriod,
  formatMonthDay,
  formatMonthTitle,
  fromIsoDate,
  isSameMonth,
  monthGrid,
  monthOptions,
  today,
  weekdayLabel,
  weekendKind,
} from '../../lib/date';
import type { IsoDate } from '../../types';

/** ツールチップに並べるタスクの上限。長くなりすぎると読めない */
const TIP_LIMIT = 8;

/** ホバーしているセルと、その画面上の位置 */
interface TipTarget {
  date: IsoDate;
  left: number;
  top: number;
  bottom: number;
}

export function MonthView() {
  const anchor = useAppStore((s) => s.ui.monthAnchor);
  const weekStartsOn = useAppStore((s) => s.settings.weekStartsOn);
  const capacity = useAppStore((s) => s.settings.dailyCapacityMinutes);
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const setUi = useAppStore((s) => s.setUi);
  const [tip, setTip] = useState<TipTarget | null>(null);

  const showTip = (date: IsoDate, cell: HTMLElement) => {
    const rect = cell.getBoundingClientRect();
    setTip({ date, left: rect.left + rect.width / 2, top: rect.top, bottom: rect.bottom });
  };

  const cells = monthGrid(anchor, weekStartsOn);
  // 先の予定を見に行けるよう、今月から 3 ヶ月先までは一押しで移れるようにする
  const months = monthOptions(today(), 3);
  const headerDays = cells.slice(0, 7);
  const monthTotal = cells
    .filter((date) => isSameMonth(date, anchor))
    .reduce((acc, date) => acc + daySummary(tasks, date).total, 0);

  const openWeek = (date: IsoDate) => setUi({ weekAnchor: date, view: 'week' });

  return (
    <div className="month-view">
      <div className="month-head">
        <button type="button" className="btn btn-sm" onClick={() => setUi({ monthAnchor: addMonths(anchor, -1) })}>
          前の月
        </button>
        <button type="button" className="btn btn-sm" onClick={() => setUi({ monthAnchor: addMonths(anchor, 1) })}>
          次の月
        </button>
        <h2 className="month-title num">{formatMonthTitle(anchor)}</h2>
        <div className="segmented month-months" role="group" aria-label="月の切り替え">
          {months.map((month) => (
            <button
              key={month.offset}
              type="button"
              className={isSameMonth(anchor, month.anchor) ? 'is-active' : ''}
              title={formatMonthTitle(month.anchor)}
              onClick={() => setUi({ monthAnchor: month.anchor })}
            >
              {month.label}
            </button>
          ))}
        </div>
        <span className="month-total num">配置の合計 {formatMinutes(monthTotal)}</span>
      </div>

      <div className="month-weekdays">
        {headerDays.map((date) => (
          <span key={date}>{weekdayLabel(date)}</span>
        ))}
      </div>

      <div className="month-grid">
        {cells.map((date, index) => {
          const summary = daySummary(tasks, date);
          const dayEvents = eventsOn(events, date);
          const outside = !isSameMonth(date, anchor);
          const weekend = weekendKind(date);
          const load = summary.total === 0 ? 0 : Math.min(summary.total / capacity, 1);
          return (
            <button
              key={date}
              type="button"
              className={[
                'month-cell',
                weekend ? `is-${weekend}` : '',
                outside ? 'is-outside' : '',
                date === today() ? 'is-today' : '',
                summary.total > capacity ? 'is-over-capacity' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => openWeek(date)}
              onMouseEnter={(e) => showTip(date, e.currentTarget)}
              onMouseLeave={() => setTip(null)}
              onFocus={(e) => showTip(date, e.currentTarget)}
              onBlur={() => setTip(null)}
              aria-label={`${date} の週を開く`}
            >
              <span className="month-daynum num">{fromIsoDate(date).getDate()}</span>
              {dayEvents.length > 0 && (
                <span className="month-events">
                  {dayEvents.slice(0, 2).map((event) => (
                    <span
                      key={event.id}
                      className={[
                        'month-event',
                        event.date === date ? 'is-start' : '',
                        eventEnd(event) === date ? 'is-end' : '',
                        event.cancelled ? 'is-cancelled' : '',
                        // 週をまたぐイベントは、行の先頭でタイトルを出し直す
                        event.date === date || index % 7 === 0 ? 'is-labelled' : '',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      title={`${event.title}（${formatDateRange(event.date, event.endDate)} ${formatEventPeriod(event)}）`}
                    >
                      {event.title}
                    </span>
                  ))}
                  {dayEvents.length > 2 && (
                    <span className="month-more num">＋{dayEvents.length - 2}</span>
                  )}
                </span>
              )}
              {summary.count > 0 && (
                <>
                  <span className="month-count num">
                    {summary.count}件
                    {summary.doneCount > 0 && <span className="month-done"> 済{summary.doneCount}</span>}
                  </span>
                  <span className="month-time num">{formatMinutes(summary.total)}</span>
                  <span className="month-load" style={{ width: `${load * 100}%` }} />
                </>
              )}
            </button>
          );
        })}
      </div>

      {tip && <DaySummaryTip target={tip} />}
    </div>
  );
}

/**
 * セルにマウスを乗せたときに出す、その日の中身の要約。
 * セルは狭くて件数と合計しか置けないので、何が入っているかはここで見せる。
 */
function DaySummaryTip({ target }: { target: TipTarget }) {
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const capacity = useAppStore((s) => s.settings.dailyCapacityMinutes);

  const { date } = target;
  const items = dayTasks(tasks, date);
  const dayEvents = eventsOn(events, date);
  // 何も無い日は、出しても邪魔なだけ
  if (items.length === 0 && dayEvents.length === 0) return null;

  const summary = daySummary(tasks, date);
  const shown = items.slice(0, TIP_LIMIT);
  const rest = items.length - shown.length;

  // 画面の下半分なら上側に出す。高さを測らずに済むよう bottom で留める
  const below = target.bottom < window.innerHeight * 0.55;
  const style: CSSProperties = {
    left: Math.min(Math.max(target.left, 150), window.innerWidth - 150),
    ...(below ? { top: target.bottom + 8 } : { bottom: window.innerHeight - target.top + 8 }),
  };

  return (
    <div className="month-tip" style={style} role="tooltip">
      <div className="month-tip-head num">
        {formatMonthDay(date)}（{weekdayLabel(date)}）
      </div>

      {dayEvents.map((event) => (
        <div key={event.id} className={`month-tip-event${event.cancelled ? ' is-cancelled' : ''}`}>
          {event.cancelled && '【中止】'}
          {event.title}
          <span className="month-tip-period num"> {formatEventPeriod(event)}</span>
        </div>
      ))}

      {shown.length > 0 && (
        <ul className="month-tip-list">
          {shown.map((task) => {
            const minutes = scheduledMinutes(task, tasks);
            return (
              <li key={task.id} className={task.done ? 'is-done' : ''}>
                <span className="month-tip-row">
                  <span className="month-tip-mark">{task.done ? '✓' : '□'}</span>
                  <span className="month-tip-title">{task.title}</span>
                  {minutes > 0 && <span className="month-tip-time num">{formatMinutes(minutes)}</span>}
                </span>
                {/* 親と同じ日に数えている子。時間は親の行にまとめて出している */}
                {nestedSubtasks(tasks, task).map((child) => (
                  <span
                    key={child.id}
                    className={`month-tip-row is-child${child.done ? ' is-done' : ''}`}
                  >
                    <span className="month-tip-mark">{child.done ? '✓' : '□'}</span>
                    <span className="month-tip-title">{child.title}</span>
                  </span>
                ))}
              </li>
            );
          })}
        </ul>
      )}

      {rest > 0 && <div className="month-tip-rest num">ほか {rest}件</div>}

      {summary.count > 0 && (
        <div className="month-tip-foot num">
          合計 {formatMinutes(summary.total)} / 目安 {formatMinutes(capacity)}・{summary.count}件
          {summary.doneCount > 0 && `（済${summary.doneCount}）`}
        </div>
      )}
    </div>
  );
}
