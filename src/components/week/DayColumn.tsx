import { useState } from 'react';
import { useDraggable, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
  formatDateRange,
  formatEventPeriod,
  formatMonthDay,
  today,
  weekdayLabel,
  weekendKind,
} from '../../lib/date';
import type { ContainerData, SortableTaskData } from '../../lib/dnd';
import { containerIds, useSortableRef } from '../../lib/dnd';
import { colorStyle, effectiveColor } from '../../lib/taskColor';
import type { IsoDate, Task } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { DueBadge } from '../common/DueBadge';
import { useLongPress } from './useLongPress';

export function DayColumn({ date }: { date: IsoDate }) {
  const tasks = useAppStore((s) => s.tasks);
  const events = useAppStore((s) => s.events);
  const selectEvent = useAppStore((s) => s.selectEvent);
  const capacity = useAppStore((s) => s.settings.dailyCapacityMinutes);
  const unscheduleDay = useAppStore((s) => s.unscheduleDay);
  const [confirming, setConfirming] = useState(false);
  const dayEvents = eventsOn(events, date);
  const items = dayTasks(tasks, date);
  const summary = daySummary(tasks, date);
  const over = summary.total > capacity;
  const isToday = date === today();
  const weekend = weekendKind(date);

  const containerId = containerIds.day(date);
  const data: ContainerData = { type: 'container', containerId };
  const { setNodeRef, isOver } = useDroppable({ id: containerId, data });
  // 長押しでその日のタスクをまとめて未配置に戻す。配置が無い日は何もしない
  const longPress = useLongPress(() => {
    if (items.length > 0) setConfirming(true);
  });

  return (
    <section
      {...longPress.handlers}
      className={[
        'day-column',
        isToday ? 'is-today' : '',
        weekend ? `is-${weekend}` : '',
        isOver ? 'is-over' : '',
        longPress.pressing && items.length > 0 ? 'is-pressing' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <header className="day-header">
        <span className="day-date num">{formatMonthDay(date)}</span>
        <span className="day-weekday">{weekdayLabel(date)}</span>
        <span className={`day-total num${over ? ' is-over-capacity' : ''}`}>
          {summary.total > 0 ? formatMinutes(summary.total) : ''}
        </span>
      </header>

      {dayEvents.length > 0 && (
        <div className="day-events">
          {dayEvents.map((event) => {
            const isStart = event.date === date;
            return (
              <button
                key={event.id}
                type="button"
                className={[
                  'day-event',
                  isStart ? 'is-start' : '',
                  eventEnd(event) === date ? 'is-end' : '',
                  event.cancelled ? 'is-cancelled' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => selectEvent(event.id)}
                title={`${event.cancelled ? '【中止】' : ''}${event.title}（${formatDateRange(event.date, event.endDate)} ${formatEventPeriod(event)}）`}
              >
                {/* 時刻は始まる日にだけ出す。間の日は帯が続いていることだけ示す */}
                {isStart && !event.allDay && event.startTime && (
                  <span className="day-event-time num">{event.startTime}</span>
                )}
                <span className="day-event-title">{event.title}</span>
              </button>
            );
          })}
        </div>
      )}

      <CapacityBar date={date} capacity={capacity} />

      <div ref={setNodeRef} className="day-body">
        <SortableContext
          id={containerId}
          items={items.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((task, index) => (
            <ScheduledChip key={task.id} task={task} containerId={containerId} index={index} />
          ))}
        </SortableContext>
        {items.length === 0 && <div className="day-drop-hint">ここへドラッグ</div>}
      </div>

      {confirming && (
        <ConfirmDialog
          title="未配置に戻す"
          body={`${formatMonthDay(date)}（${weekdayLabel(date)}）に配置されたタスク${items.length}件を、すべて未配置に戻します。`}
          confirmLabel="OK"
          cancelLabel="キャンセル"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            unscheduleDay(date);
            setConfirming(false);
          }}
        />
      )}
    </section>
  );
}

/**
 * その日が何で埋まっているかを示す積み上げバー。
 * 段階ごとの色で並べ、1 日の目安を超えた分は超過として描き分ける。
 */
function CapacityBar({ date, capacity }: { date: IsoDate; capacity: number }) {
  const tasks = useAppStore((s) => s.tasks);
  const items = dayTasks(tasks, date);
  const total = items.reduce((acc, task) => acc + scheduledMinutes(task, tasks), 0);
  if (total === 0) return <div className="capacity-bar is-empty" aria-hidden="true" />;

  const scale = Math.max(total, capacity);
  return (
    <div
      className="capacity-bar"
      title={`合計 ${formatMinutes(total)} / 目安 ${formatMinutes(capacity)}`}
    >
      {items.map((task) => {
        const minutes = scheduledMinutes(task, tasks);
        if (minutes === 0) return null;
        return (
          <span
            key={task.id}
            className={`capacity-seg stage-${task.stage}${task.done ? ' is-done' : ''}`}
            style={{ width: `${(minutes / scale) * 100}%` }}
          />
        );
      })}
      {total > capacity && (
        <span className="capacity-mark" style={{ left: `${(capacity / scale) * 100}%` }} />
      )}
    </div>
  );
}

function ScheduledChip({
  task,
  containerId,
  index,
}: {
  task: Task;
  containerId: string;
  index: number;
}) {
  const tasks = useAppStore((s) => s.tasks);
  const toggleDone = useAppStore((s) => s.toggleDone);
  const selectTask = useAppStore((s) => s.selectTask);
  const unschedule = useAppStore((s) => s.unscheduleTask);
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) ?? null : null;
  const minutes = scheduledMinutes(task, tasks);
  // 日を決めていない子は親と同じ日に数えているので、ここに並べて見えるようにする
  const nested = nestedSubtasks(tasks, task);
  const color = effectiveColor(task, tasks);
  const data: SortableTaskData = { type: 'task', containerId, index };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id, data });
  const sortableRef = useSortableRef(setNodeRef, setActivatorNodeRef);

  return (
    <div
      ref={sortableRef}
      style={{ transform: CSS.Translate.toString(transform), transition, ...colorStyle(color) }}
      className={[
        'chip',
        `stage-${task.stage}`,
        parent ? 'is-child' : '',
        task.done ? 'is-done' : '',
        color ? 'has-bg' : '',
        isDragging ? 'is-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => selectTask(task.id)}
      {...attributes}
      {...listeners}
    >
      {parent && (
        <span className="chip-parent" title={`${parent.title} のサブタスク`}>
          {parent.title}
        </span>
      )}
      <div className="chip-row">
        <input
          type="checkbox"
          className="task-check"
          checked={task.done}
          onChange={() => toggleDone(task.id)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`${task.title} を完了にする`}
        />
        <span className="chip-title" title={task.title}>
          {task.title}
        </span>
        <button
          type="button"
          className="chip-remove"
          aria-label="この日から外す"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            unschedule(task.id);
          }}
        >
          ✕
        </button>
      </div>
      {(task.dueDate || minutes > 0) && (
        <div className="chip-meta">
          {task.dueDate && <DueBadge date={task.dueDate} />}
          {minutes > 0 && <span className="chip-time num">{formatMinutes(minutes)}</span>}
        </div>
      )}

      {nested.length > 0 && (
        <div
          className="chip-subtasks"
          // 子を掴んだときに親のチップまで動かさない
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {nested.map((child) => (
            <NestedSubtask key={child.id} task={child} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * 親のチップの中に並ぶサブタスク。
 * 単独で他の日へ動かせるよう、掴めるようにしてある（並べ替えは親の中の順のまま）。
 */
function NestedSubtask({ task }: { task: Task }) {
  const toggleDone = useAppStore((s) => s.toggleDone);
  const selectTask = useAppStore((s) => s.selectTask);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, isDragging } = useDraggable({
    id: task.id,
  });
  const dragRef = useSortableRef(setNodeRef, setActivatorNodeRef);

  return (
    <div
      ref={dragRef}
      // 親のチップの中にあるので、自分の色を持つときだけ塗る
      className={`chip-subtask${task.done ? ' is-done' : ''}${isDragging ? ' is-dragging' : ''}${task.color ? ' has-bg' : ''}`}
      style={colorStyle(task.color)}
      onClick={() => selectTask(task.id)}
      {...attributes}
      {...listeners}
    >
      <input
        type="checkbox"
        className="task-check"
        checked={task.done}
        onChange={() => toggleDone(task.id)}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`${task.title} を完了にする`}
      />
      <span className="chip-subtask-title" title={task.title}>
        {task.title}
      </span>
      {task.estimateMinutes != null && (
        <span className="chip-subtask-time num">{formatMinutes(task.estimateMinutes)}</span>
      )}
    </div>
  );
}
