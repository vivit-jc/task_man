import { useState } from 'react';
import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/useAppStore';
import { effectiveMinutes, subtasksOf } from '../../store/selectors';
import { formatMinutes } from '../../lib/estimate';
import { formatMonthDay } from '../../lib/date';
import { colorStyle, effectiveColor } from '../../lib/taskColor';
import type { SortableTaskData } from '../../lib/dnd';
import type { Task } from '../../types';
import { DueBadge } from '../common/DueBadge';
import { EventBadge } from '../common/EventBadge';
import { TagChip } from '../common/TagChip';
import { DragHandle } from './DragHandle';
import { QuickAdd } from './QuickAdd';
import { SubtaskList } from './SubtaskList';
import { useSubtaskExpanded } from './useSubtaskExpanded';

interface Props {
  task: Task;
  containerId: string;
  index: number;
}

export function TaskCard({ task, containerId, index }: Props) {
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

  // 掴めるのは持ち手だけ。カード本体はクリックで詳細を開き、文字も選択できる
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`task-card-wrap${isDragging ? ' is-dragging' : ''}`}
    >
      <TaskCardBody
        task={task}
        handle={
          <DragHandle
            ref={setActivatorNodeRef}
            label={`${task.title} を移動`}
            {...attributes}
            {...listeners}
          />
        }
      />
    </div>
  );
}

/** ドラッグ中のプレビューでも使う、カードの見た目そのもの */
export function TaskCardBody({
  task,
  overlay,
  handle,
}: {
  task: Task;
  overlay?: boolean;
  /** 並べ替えの持ち手。並べ替えできない完了済みの欄では渡さない */
  handle?: ReactNode;
}) {
  const tasks = useAppStore((s) => s.tasks);
  const tags = useAppStore((s) => s.tags);
  const events = useAppStore((s) => s.events);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectTask = useAppStore((s) => s.selectTask);
  const toggleDone = useAppStore((s) => s.toggleDone);
  const addTask = useAppStore((s) => s.addTask);
  // グリッドはカード幅が狭いので、配置日をメタ情報の行に回してタイトルの幅を確保する
  const scheduledInMeta = useAppStore((s) => s.ui.view === 'board' && s.ui.boardLayout === 'grid');

  const children = subtasksOf(tasks, task.id);
  const doneChildren = children.filter((c) => c.done).length;
  const event = task.eventId ? events.find((e) => e.id === task.eventId) ?? null : null;
  const minutes = effectiveMinutes(task, tasks);
  const taskTags = task.tagIds
    .map((id) => tags.find((tag) => tag.id === id))
    .filter((tag): tag is NonNullable<typeof tag> => Boolean(tag));

  const [open, setOpen] = useSubtaskExpanded(task.id);
  const expanded = children.length > 0 && open;
  const [adding, setAdding] = useState(false);
  const color = effectiveColor(task, tasks);

  return (
    <article
      className={[
        'task-card',
        `stage-${task.stage}`,
        task.done ? 'is-done' : '',
        task.priority === 'high' ? 'is-high' : '',
        selectedTaskId === task.id ? 'is-selected' : '',
        overlay ? 'is-overlay' : '',
        color ? 'has-bg' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={colorStyle(color)}
      onClick={() => selectTask(task.id)}
    >
      <div className="task-main">
        {overlay ? <DragHandle label="" /> : handle}
        <input
          type="checkbox"
          className="task-check"
          checked={task.done}
          onChange={() => toggleDone(task.id)}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label={`${task.title} を完了にする`}
        />
        <span className="task-title">{task.title}</span>
        {/* 配置日はメタ情報の行に置くと 1 行増えるので、タイトルの横に添える */}
        {task.scheduledDate && !scheduledInMeta && (
          <span className="meta-scheduled num">{formatMonthDay(task.scheduledDate)} に配置</span>
        )}
        {children.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet btn-sm subtask-toggle num"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            aria-expanded={expanded}
          >
            {expanded ? '▾' : '▸'} {doneChildren}/{children.length}
          </button>
        )}
        {/* 追加ボタンに 1 行を使わないよう、子が無いうちは開閉ボタンの位置に置く */}
        {children.length === 0 && !overlay && !adding && (
          <button
            type="button"
            className="btn btn-quiet btn-sm add-subtask"
            onClick={(e) => {
              e.stopPropagation();
              setAdding(true);
            }}
            onPointerDown={(e) => e.stopPropagation()}
            title="サブタスクを追加"
            aria-label={`${task.title} にサブタスクを追加`}
          >
            ＋
          </button>
        )}
      </div>

      <div className="task-meta">
        {task.scheduledDate && scheduledInMeta && (
          <span className="meta-scheduled num">{formatMonthDay(task.scheduledDate)} に配置</span>
        )}
        {minutes > 0 && <span className="meta-estimate num">{formatMinutes(minutes)}</span>}
        {task.dueDate && <DueBadge date={task.dueDate} />}
        {event && <EventBadge event={event} />}
        {task.priority !== 'normal' && (
          <span className={`prio prio-${task.priority}`}>{task.priority === 'high' ? '優先' : '後回し'}</span>
        )}
        {taskTags.map((tag) => (
          <TagChip key={tag.id} tag={tag} />
        ))}
      </div>

      {expanded && !overlay && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <SubtaskList parentId={task.id} subtasks={children} />
        </div>
      )}

      {!expanded && !overlay && children.length === 0 && adding && (
        <div onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
          <div className="subtask-add">
            <QuickAdd
              placeholder="サブタスクに分解する"
              onAdd={(title) => addTask({ title, stage: task.stage, parentId: task.id })}
            />
          </div>
        </div>
      )}
    </article>
  );
}
