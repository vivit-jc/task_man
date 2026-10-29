import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { groupEvents, subtasksOf } from '../../store/selectors';
import { formatCountdown, formatMonthDay, today } from '../../lib/date';
import type { Priority, Stage } from '../../types';
import { PRIORITY_LABEL, STAGES, STAGE_LABEL } from '../../types';
import { EstimateInput } from '../common/EstimateInput';
import { TagChip } from '../common/TagChip';
import { QuickAdd } from './QuickAdd';
import { TaskColorPicker } from './TaskColorPicker';

const PRIORITIES: Priority[] = ['high', 'normal', 'low'];

export function TaskEditorPanel() {
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const task = useAppStore((s) => s.tasks.find((t) => t.id === s.selectedTaskId) ?? null);
  const tasks = useAppStore((s) => s.tasks);
  const tags = useAppStore((s) => s.tags);
  const events = useAppStore((s) => s.events);
  const selectTask = useAppStore((s) => s.selectTask);
  const updateTask = useAppStore((s) => s.updateTask);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const moveTask = useAppStore((s) => s.moveTask);
  const toggleTaskTag = useAppStore((s) => s.toggleTaskTag);
  const addTag = useAppStore((s) => s.addTag);
  const addTask = useAppStore((s) => s.addTask);
  const unscheduleTask = useAppStore((s) => s.unscheduleTask);
  const setTaskEvent = useAppStore((s) => s.setTaskEvent);

  const [newTag, setNewTag] = useState('');

  const submitTag = () => {
    const id = addTag(newTag);
    if (id && task && !task.tagIds.includes(id)) toggleTaskTag(task.id, id);
    setNewTag('');
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectTask(null);
    };
    if (selectedTaskId) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedTaskId, selectTask]);

  if (!task) return null;

  const children = subtasksOf(tasks, task.id);
  const parent = task.parentId ? tasks.find((t) => t.id === task.parentId) : null;
  // 終わったイベントに紐づいたままのタスクもあるので、選択肢には全件を出す
  const grouped = groupEvents(events, today());
  // 中止になった回は、いま紐づいているもの以外は選ばせない
  const eventOptions = [...grouped.upcoming, ...grouped.past].filter(
    (event) => !event.cancelled || event.id === task.eventId,
  );
  const linkedEvent = task.eventId ? events.find((e) => e.id === task.eventId) ?? null : null;

  return (
    <aside className="editor" aria-label="タスクの詳細">
      <div className="editor-head">
        <h2 className="editor-title">タスクの詳細</h2>
        <button type="button" className="btn btn-quiet btn-sm" onClick={() => selectTask(null)}>
          閉じる
        </button>
      </div>

      <div className="editor-body">
        {parent && (
          <button type="button" className="parent-link" onClick={() => selectTask(parent.id)}>
            ↑ {parent.title} のサブタスク
          </button>
        )}

        <label className="label" htmlFor="editor-title">
          タイトル
        </label>
        <input
          id="editor-title"
          className="field"
          value={task.title}
          onChange={(e) => updateTask(task.id, { title: e.target.value })}
        />

        <label className="label" htmlFor="editor-note">
          メモ
        </label>
        <textarea
          id="editor-note"
          className="field"
          rows={3}
          placeholder="手順、参考リンク、気づいたことなど"
          value={task.note}
          onChange={(e) => updateTask(task.id, { note: e.target.value })}
        />

        {!parent && (
          <>
            <span className="label">サブタスク {children.length > 0 && `（${children.length}件）`}</span>
            <ul className="editor-subtasks">
              {children.map((child) => (
                <li key={child.id}>
                  <button type="button" onClick={() => selectTask(child.id)}>
                    {child.done ? '✓ ' : ''}
                    {child.title}
                  </button>
                </li>
              ))}
            </ul>
            <QuickAdd
              placeholder="サブタスクを追加"
              onAdd={(title) => addTask({ title, stage: task.stage, parentId: task.id })}
            />
          </>
        )}

        {!parent && (
          <>
            <span className="label">段階</span>
            <div className="segmented" role="group" aria-label="段階">
              {STAGES.map((stage: Stage) => (
                <button
                  key={stage}
                  type="button"
                  className={task.stage === stage ? 'is-active' : ''}
                  onClick={() => moveTask(task.id, { kind: 'stage', stage }, 0)}
                >
                  {STAGE_LABEL[stage]}
                </button>
              ))}
            </div>
          </>
        )}

        <span className="label">見積もり</span>
        <EstimateInput
          value={task.estimateMinutes}
          onChange={(minutes) => updateTask(task.id, { estimateMinutes: minutes })}
        />

        <label className="label" htmlFor="editor-due">
          期限
        </label>
        <div className="row">
          <input
            id="editor-due"
            type="date"
            className="field num"
            value={task.dueDate ?? ''}
            onChange={(e) => updateTask(task.id, { dueDate: e.target.value || null })}
          />
          {task.dueDate && (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => updateTask(task.id, { dueDate: null })}
            >
              消す
            </button>
          )}
        </div>

        <span className="label">優先度</span>
        <div className="segmented" role="group" aria-label="優先度">
          {PRIORITIES.map((priority) => (
            <button
              key={priority}
              type="button"
              className={task.priority === priority ? 'is-active' : ''}
              onClick={() => updateTask(task.id, { priority })}
            >
              {PRIORITY_LABEL[priority]}
            </button>
          ))}
        </div>

        <span className="label">背景色</span>
        <TaskColorPicker
          value={task.color}
          onChange={(color) => updateTask(task.id, { color })}
          inherited={parent ? parent.color : undefined}
        />

        <label className="label" htmlFor="editor-scheduled">
          週タイムラインへの配置
        </label>
        <div className="row">
          <input
            id="editor-scheduled"
            type="date"
            className="field num"
            value={task.scheduledDate ?? ''}
            onChange={(e) => {
              const date = e.target.value;
              if (date) moveTask(task.id, { kind: 'day', date }, Number.MAX_SAFE_INTEGER);
              else unscheduleTask(task.id);
            }}
          />
          {task.scheduledDate && (
            <button
              type="button"
              className="btn btn-quiet btn-sm"
              onClick={() => unscheduleTask(task.id)}
            >
              外す
            </button>
          )}
        </div>
        {parent && (
          <p className="hint">
            {task.scheduledDate
              ? `この日は「${parent.title}」とは別に数えます`
              : parent.scheduledDate
                ? `未指定のあいだは「${parent.title}」の ${formatMonthDay(parent.scheduledDate)} に含まれます`
                : '日を決めると、親とは別にその日へ置けます'}
          </p>
        )}

        <label className="label" htmlFor="editor-event">
          イベント
        </label>
        <select
          id="editor-event"
          className="field"
          value={task.eventId ?? ''}
          disabled={events.length === 0}
          onChange={(e) => setTaskEvent(task.id, e.target.value || null)}
        >
          <option value="">（紐づけない）</option>
          {eventOptions.map((event) => (
            <option key={event.id} value={event.id}>
              {`${formatMonthDay(event.date)} ${event.title}${event.cancelled ? '（中止）' : ''}`}
            </option>
          ))}
        </select>
        {events.length === 0 ? (
          <p className="hint">イベントは「イベント」画面（4）で作れます</p>
        ) : linkedEvent ? (
          <p className="hint num">
            {formatCountdown(linkedEvent.date)}・このタスクはイベントの進み具合に数えられます
          </p>
        ) : null}

        <span className="label">タグ</span>
        <div className="tag-picker">
          {tags.map((tag) => (
            <TagChip
              key={tag.id}
              tag={tag}
              active={task.tagIds.includes(tag.id)}
              onClick={() => toggleTaskTag(task.id, tag.id)}
            />
          ))}
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            submitTag();
          }}
        >
          <input
            className="field"
            value={newTag}
            placeholder="新しいタグ"
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submitTag();
              }
            }}
          />
          <button type="submit" className="btn btn-sm" disabled={!newTag.trim()}>
            追加
          </button>
        </form>
        {tags.length > 0 && (
          <p className="hint">タグ自体を消すときは、上のタグ行の「タグを整理」から</p>
        )}

        <div className="editor-footer">
          <span className="editor-stamp num">
            作成 {formatMonthDay(task.createdAt.slice(0, 10))}
            {task.completedAt && ` / 完了 ${formatMonthDay(task.completedAt.slice(0, 10))}`}
          </span>
          <button type="button" className="btn btn-danger btn-sm" onClick={() => deleteTask(task.id)}>
            削除
          </button>
        </div>
      </div>
    </aside>
  );
}
