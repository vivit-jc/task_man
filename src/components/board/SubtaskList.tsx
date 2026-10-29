import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/useAppStore';
import { formatMinutes } from '../../lib/estimate';
import { formatMonthDay } from '../../lib/date';
import { colorStyle } from '../../lib/taskColor';
import type { ContainerData, SortableTaskData } from '../../lib/dnd';
import { containerIds } from '../../lib/dnd';
import type { Task } from '../../types';
import { DueBadge } from '../common/DueBadge';
import { DragHandle } from './DragHandle';
import { QuickAdd } from './QuickAdd';

interface Props {
  parentId: string;
  subtasks: Task[];
}

export function SubtaskList({ parentId, subtasks }: Props) {
  const containerId = containerIds.parent(parentId);
  const addTask = useAppStore((s) => s.addTask);
  const parentStage = useAppStore((s) => s.tasks.find((t) => t.id === parentId)?.stage ?? 'soon');
  const data: ContainerData = { type: 'container', containerId };
  const { setNodeRef, isOver } = useDroppable({ id: containerId, data });

  return (
    <div ref={setNodeRef} className={`subtask-list${isOver ? ' is-over' : ''}`}>
      <SortableContext
        id={containerId}
        items={subtasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        {subtasks.map((subtask, index) => (
          <SubtaskRow key={subtask.id} task={subtask} containerId={containerId} index={index} />
        ))}
      </SortableContext>
      <div className="subtask-add">
        <QuickAdd
          placeholder="サブタスクを追加"
          onAdd={(title) => addTask({ title, stage: parentStage, parentId })}
        />
      </div>
    </div>
  );
}

function SubtaskRow({
  task,
  containerId,
  index,
}: {
  task: Task;
  containerId: string;
  index: number;
}) {
  const toggleDone = useAppStore((s) => s.toggleDone);
  const selectTask = useAppStore((s) => s.selectTask);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
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

  // 親の色はカードの背景として既に見えているので、自分の色を持つときだけ塗る
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, ...colorStyle(task.color) }}
      className={[
        'subtask-row',
        task.color ? 'has-bg' : '',
        task.done ? 'is-done' : '',
        isDragging ? 'is-dragging' : '',
        selectedTaskId === task.id ? 'is-selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => selectTask(task.id)}
    >
      <DragHandle
        ref={setActivatorNodeRef}
        label={`${task.title} を移動`}
        small
        {...attributes}
        {...listeners}
      />
      <input
        type="checkbox"
        className="task-check"
        checked={task.done}
        onChange={() => toggleDone(task.id)}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={`${task.title} を完了にする`}
      />
      <span className="subtask-title">{task.title}</span>
      {task.dueDate && <DueBadge date={task.dueDate} />}
      {task.scheduledDate && (
        <span className="meta-scheduled num">{formatMonthDay(task.scheduledDate)} に配置</span>
      )}
      {task.estimateMinutes != null && (
        <span className="meta-estimate num">{formatMinutes(task.estimateMinutes)}</span>
      )}
    </div>
  );
}
