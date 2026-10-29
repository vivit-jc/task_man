import { useDroppable } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useAppStore } from '../../store/useAppStore';
import { effectiveMinutes, stageBuckets } from '../../store/selectors';
import { formatMinutes } from '../../lib/estimate';
import type { ContainerData } from '../../lib/dnd';
import { containerIds } from '../../lib/dnd';
import type { Stage } from '../../types';
import { STAGE_LABEL } from '../../types';
import { TaskCard, TaskCardBody } from './TaskCard';
import { QuickAdd } from './QuickAdd';

export function StageColumn({ stage }: { stage: Stage }) {
  const tasks = useAppStore((s) => s.tasks);
  const search = useAppStore((s) => s.ui.search);
  const filterTagIds = useAppStore((s) => s.ui.filterTagIds);
  const sortKey = useAppStore((s) => s.ui.sortKey);
  const showDone = useAppStore((s) => s.ui.showDone);
  const addTask = useAppStore((s) => s.addTask);
  const layout = useAppStore((s) => s.ui.boardLayout);

  const { active, done } = stageBuckets(tasks, stage, { search, tagIds: filterTagIds }, sortKey);
  const totalMinutes = active.reduce((acc, task) => acc + effectiveMinutes(task, tasks), 0);

  const containerId = containerIds.stage(stage);
  const data: ContainerData = { type: 'container', containerId };
  const { setNodeRef, isOver } = useDroppable({ id: containerId, data });

  return (
    <section className={`stage-column stage-${stage}${isOver ? ' is-over' : ''}`}>
      <header className="stage-header">
        <span className="stage-bar" aria-hidden="true" />
        <h2 className="stage-name">{STAGE_LABEL[stage]}</h2>
        <span className="stage-count num">{active.length}件</span>
        {totalMinutes > 0 && <span className="stage-total num">{formatMinutes(totalMinutes)}</span>}
      </header>

      <div ref={setNodeRef} className="stage-body">
        {/* 追加欄は列の先頭。カードが増えても下まで探しに行かずに済む */}
        <QuickAdd placeholder="タスクを追加" onAdd={(title) => addTask({ title, stage })} />

        <SortableContext
          id={containerId}
          items={active.map((t) => t.id)}
          // グリッドではカードが横にも並ぶので、縦一列前提の動きにしない
          strategy={layout === 'grid' ? rectSortingStrategy : verticalListSortingStrategy}
        >
          {active.map((task, index) => (
            <TaskCard key={task.id} task={task} containerId={containerId} index={index} />
          ))}
        </SortableContext>

        {active.length === 0 && (
          <p className="empty">
            {search || filterTagIds.length > 0
              ? '条件に合うタスクはありません'
              : 'ここにタスクを追加するか、他の段階からドラッグしてください'}
          </p>
        )}

        {showDone && done.length > 0 && (
          <div className="done-section">
            <h3 className="done-heading num">完了済み {done.length}件</h3>
            {done.map((task) => (
              <TaskCardBody key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
