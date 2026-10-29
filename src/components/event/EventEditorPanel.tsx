import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { eventProgress } from '../../store/selectors';
import { formatMinutes } from '../../lib/estimate';
import {
  addDays,
  formatCountdown,
  formatMonthDay,
  isPlausibleIsoDate,
  spanDays,
} from '../../lib/date';
import { QuickAdd } from '../board/QuickAdd';
import { formatSeriesRule } from './SeriesSection';

export function EventEditorPanel() {
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const event = useAppStore((s) => s.events.find((e) => e.id === s.selectedEventId) ?? null);
  const tasks = useAppStore((s) => s.tasks);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const selectTask = useAppStore((s) => s.selectTask);
  const updateEvent = useAppStore((s) => s.updateEvent);
  const deleteEvent = useAppStore((s) => s.deleteEvent);
  const setEventCancelled = useAppStore((s) => s.setEventCancelled);
  const selectSeries = useAppStore((s) => s.selectSeries);
  const series = useAppStore((s) =>
    event?.seriesId ? s.eventSeries.find((r) => r.id === event.seriesId) ?? null : null,
  );
  const addTask = useAppStore((s) => s.addTask);
  const setTaskEvent = useAppStore((s) => s.setTaskEvent);

  // date 入力は 1 文字ごとに change を投げるので、打ちかけの値は画面にだけ持たせる。
  // そのまま保存すると 0012 年のイベントになって一覧から消えてしまう
  const [dateText, setDateText] = useState('');
  useEffect(() => {
    setDateText(event?.date ?? '');
  }, [event?.id, event?.date]);

  const [endDateText, setEndDateText] = useState('');
  useEffect(() => {
    setEndDateText(event?.endDate ?? '');
  }, [event?.id, event?.endDate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectEvent(null);
    };
    if (selectedEventId) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedEventId, selectEvent]);

  if (!event) return null;

  const progress = eventProgress(event, tasks);

  return (
    <aside className="editor" aria-label="イベントの詳細">
      <div className="editor-head">
        <h2 className="editor-title">イベントの詳細</h2>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => selectEvent(null)}>
          閉じる
        </button>
      </div>

      <div className="editor-body">
        {event.cancelled && <p className="editor-notice is-cancelled">この回は中止です</p>}
        {series && (
          <p className="hint num">
            定期「{series.title}」{formatSeriesRule(series)} の回
            {event.customized ? '（個別に変更済み）' : ''}{' '}
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => selectSeries(series.id)}
            >
              定期を開く
            </button>
          </p>
        )}

        <label className="label" htmlFor="event-title">
          タイトル
        </label>
        <input
          id="event-title"
          className="field"
          value={event.title}
          onChange={(e) => updateEvent(event.id, { title: e.target.value })}
        />

        <label className="label" htmlFor="event-date">
          日付
        </label>
        <input
          id="event-date"
          type="date"
          className="field num"
          value={dateText}
          onChange={(e) => {
            setDateText(e.target.value);
            if (isPlausibleIsoDate(e.target.value)) updateEvent(event.id, { date: e.target.value });
          }}
          onBlur={() => setDateText(event.date)}
        />
        <p className="hint num">{formatCountdown(event.date, event.endDate)}</p>

        <label className="label" htmlFor="event-end-date">
          終了日
        </label>
        <div className="row">
          <input
            id="event-end-date"
            type="date"
            className="field num"
            value={endDateText}
            min={addDays(event.date, 1)}
            onChange={(e) => {
              setEndDateText(e.target.value);
              // 開始日以前を指したときは単日に戻す（makeEvent が null にする）
              if (!e.target.value) updateEvent(event.id, { endDate: null });
              else if (isPlausibleIsoDate(e.target.value)) {
                updateEvent(event.id, { endDate: e.target.value });
              }
            }}
            onBlur={() => setEndDateText(event.endDate ?? '')}
          />
          {event.endDate && (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => updateEvent(event.id, { endDate: null })}
            >
              単日に戻す
            </button>
          )}
        </div>
        <p className="hint num">
          {event.endDate
            ? `${spanDays(event.date, event.endDate)}日間`
            : '空のままなら 1 日のイベントです'}
        </p>

        <span className="label">時間</span>
        <div className="segmented" role="group" aria-label="時間">
          <button
            type="button"
            className={event.allDay ? 'is-active' : ''}
            onClick={() => updateEvent(event.id, { allDay: true })}
          >
            終日
          </button>
          <button
            type="button"
            className={!event.allDay ? 'is-active' : ''}
            // allDay だけ渡すと再正規化で時刻が空のまま。既定の開始時刻を添える
            onClick={() =>
              updateEvent(event.id, { allDay: false, startTime: event.startTime ?? '10:00' })
            }
          >
            時刻を指定
          </button>
        </div>
        {!event.allDay && (
          <div className="row">
            <input
              type="time"
              className="field num"
              value={event.startTime ?? ''}
              aria-label={event.endDate ? '開始日の時刻' : '開始時刻'}
              onChange={(e) => updateEvent(event.id, { startTime: e.target.value || null })}
            />
            <span className="hint">〜</span>
            <input
              type="time"
              className="field num"
              value={event.endTime ?? ''}
              aria-label={event.endDate ? '終了日の時刻' : '終了時刻'}
              disabled={!event.startTime}
              onChange={(e) => updateEvent(event.id, { endTime: e.target.value || null })}
            />
          </div>
        )}
        {!event.allDay && event.endDate && (
          <p className="hint num">
            {formatMonthDay(event.date)} の開始時刻と {formatMonthDay(event.endDate)} の終了時刻です
          </p>
        )}

        <label className="label" htmlFor="event-note">
          メモ
        </label>
        <textarea
          id="event-note"
          className="field"
          rows={4}
          placeholder="場所、持ち物、連絡先など"
          value={event.note}
          onChange={(e) => updateEvent(event.id, { note: e.target.value })}
        />

        <span className="label">
          紐づいたタスク
          {progress.count > 0 &&
            `（${progress.doneCount}/${progress.count} 完了・${formatMinutes(progress.minutes)}）`}
        </span>
        <ul className="editor-subtasks">
          {progress.tasks.map((task) => (
            <li key={task.id}>
              <button type="button" onClick={() => selectTask(task.id)}>
                {task.done ? '✓ ' : ''}
                {task.title}
              </button>
            </li>
          ))}
        </ul>
        <QuickAdd
          placeholder="このイベントまでにやることを追加"
          onAdd={(title) => {
            const id = addTask({ title, stage: 'soon' });
            if (id) setTaskEvent(id, event.id);
          }}
        />
        <p className="hint">タスクの詳細からも、あとでイベントを選べます</p>

        <div className="editor-footer">
          <span className="editor-stamp num">作成 {formatMonthDay(event.createdAt.slice(0, 10))}</span>
          {/* 定期の回は消すとまた作られるので、中止で残す。単発は中止も削除もできる */}
          <span className="row">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => setEventCancelled(event.id, !event.cancelled)}
            >
              {event.cancelled ? '中止を取り消す' : '中止にする'}
            </button>
            {!event.seriesId && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => deleteEvent(event.id)}
              >
                削除
              </button>
            )}
          </span>
        </div>
      </div>
    </aside>
  );
}
