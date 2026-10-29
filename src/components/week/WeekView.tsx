import { useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { daySummary, overdueScheduled } from '../../store/selectors';
import { formatMinutes, parseEstimate } from '../../lib/estimate';
import {
  addDays,
  formatDayRange,
  formatWeekRange,
  startOfWeek,
  today,
  weekDays,
} from '../../lib/date';
import type { IsoDate } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { DayColumn } from './DayColumn';
import { UnscheduledPane } from './UnscheduledPane';

/** 表示する週の数。次の週まで見えないと、週をまたぐ配置が決めにくい */
const WEEK_COUNT = 2;

export function WeekView() {
  const anchor = useAppStore((s) => s.ui.weekAnchor);
  const weekStartsOn = useAppStore((s) => s.settings.weekStartsOn);
  const capacity = useAppStore((s) => s.settings.dailyCapacityMinutes);
  const tasks = useAppStore((s) => s.tasks);
  const setUi = useAppStore((s) => s.setUi);
  const setSettings = useAppStore((s) => s.setSettings);
  const unscheduleOverdue = useAppStore((s) => s.unscheduleOverdue);
  const [confirmingOverdue, setConfirmingOverdue] = useState(false);
  const overdueCount = overdueScheduled(tasks, today()).length;

  const weeks = Array.from({ length: WEEK_COUNT }, (_, i) => {
    const weekAnchor = addDays(anchor, i * 7);
    return { anchor: weekAnchor, days: weekDays(weekAnchor, weekStartsOn) };
  });
  const totalOf = (days: IsoDate[]) =>
    days.reduce((acc, date) => acc + daySummary(tasks, date).total, 0);
  const spanTotal = weeks.reduce((acc, week) => acc + totalOf(week.days), 0);
  const spanRange = formatDayRange(weeks[0]!.days[0]!, weeks[WEEK_COUNT - 1]!.days[6]!);

  // 今日を含む週を見ているときだけ「今週 / 来週」と呼べる
  const showingThisWeek =
    startOfWeek(anchor, weekStartsOn) === startOfWeek(today(), weekStartsOn);
  const weekLabel = (index: number) =>
    showingThisWeek ? (index === 0 ? '今週' : '来週') : index === 0 ? 'この週' : '次の週';

  return (
    <div className="week-view">
      <div className="week-head">
        <div className="week-nav">
          <button type="button" className="btn btn-sm" onClick={() => setUi({ weekAnchor: addDays(anchor, -7) })}>
            前の週
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setUi({ weekAnchor: today() })}>
            今週
          </button>
          <button type="button" className="btn btn-sm" onClick={() => setUi({ weekAnchor: addDays(anchor, 7) })}>
            次の週
          </button>
          <h2 className="week-range num">{spanRange}</h2>
          <span className="week-total num">{WEEK_COUNT}週間の合計 {formatMinutes(spanTotal)}</span>
        </div>

        <div className="week-tools">
          <button
            type="button"
            className="btn btn-sm"
            disabled={overdueCount === 0}
            onClick={() => setConfirmingOverdue(true)}
            title="昨日以前に配置したまま終わっていないタスクを未配置に戻す"
          >
            昨日以前の未消化を戻す{overdueCount > 0 ? `（${overdueCount}件）` : ''}
          </button>

          <label className="inline-field">
            <span className="label">1日の目安</span>
            <input
              className="field num capacity-field"
              defaultValue={formatMinutes(capacity)}
              onBlur={(e) => {
                const minutes = parseEstimate(e.target.value);
                if (minutes) setSettings({ dailyCapacityMinutes: minutes });
                e.target.value = formatMinutes(minutes ?? capacity);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
            />
          </label>
        </div>
      </div>

      {confirmingOverdue && (
        <ConfirmDialog
          title="未配置に戻す"
          body={`昨日以前に配置されたまま終わっていないタスク${overdueCount}件を、すべて未配置に戻します。`}
          confirmLabel="OK"
          cancelLabel="キャンセル"
          onCancel={() => setConfirmingOverdue(false)}
          onConfirm={() => {
            unscheduleOverdue();
            setConfirmingOverdue(false);
          }}
        />
      )}

      <div className="week-grid">
        <UnscheduledPane />
        <div className="week-weeks">
          {weeks.map((week, index) => (
            <section key={week.anchor} className="week-block">
              <header className="week-block-head">
                <h3>{weekLabel(index)}</h3>
                <span className="week-block-range num">
                  {formatWeekRange(week.anchor, weekStartsOn)}
                </span>
                <span className="week-block-total num">
                  合計 {formatMinutes(totalOf(week.days))}
                </span>
              </header>
              <div className="week-days">
                {week.days.map((date) => (
                  <DayColumn key={date} date={date} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
