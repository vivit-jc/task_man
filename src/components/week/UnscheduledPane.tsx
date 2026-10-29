import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/useAppStore';
import {
  allSubtasksDone,
  allSubtasksScheduled,
  scheduledMinutes,
  unscheduledDraggables,
  unscheduledGroups,
} from '../../store/selectors';
import { formatMinutes } from '../../lib/estimate';
import type { ContainerData, SortableTaskData } from '../../lib/dnd';
import { containerIds, useSortableRef } from '../../lib/dnd';
import { colorStyle, effectiveColor } from '../../lib/taskColor';
import type { Stage, Task } from '../../types';
import { STAGES, STAGE_LABEL } from '../../types';
import { DueBadge } from '../common/DueBadge';

export function UnscheduledPane() {
  const tasks = useAppStore((s) => s.tasks);
  const search = useAppStore((s) => s.ui.search);
  const filterTagIds = useAppStore((s) => s.ui.filterTagIds);
  const groups = unscheduledGroups(tasks, { search, tagIds: filterTagIds });
  const draggables = unscheduledDraggables(groups);
  // 開いている段階。最初は「すぐやる」だけ開いておく
  const [openStages, setOpenStages] = useState<Stage[]>(['now']);
  const toggleStage = (stage: Stage) =>
    setOpenStages((prev) =>
      prev.includes(stage) ? prev.filter((s) => s !== stage) : [...prev, stage],
    );
  const sections = STAGES.map((stage) => {
    const stageGroups = groups.filter((g) => g.task.stage === stage);
    return { stage, groups: stageGroups, count: unscheduledDraggables(stageGroups).length };
  }).filter((section) => section.groups.length > 0);
  // 閉じた段階の行は描画しないので、並びに入れるのも見えている行だけ
  const visibleDraggables = unscheduledDraggables(
    sections.filter((section) => openStages.includes(section.stage)).flatMap((section) => section.groups),
  );

  const containerId = containerIds.unscheduled;
  const data: ContainerData = { type: 'container', containerId };
  const { setNodeRef, isOver } = useDroppable({ id: containerId, data });

  // SortableContext には掴める行だけを並べる（見出しだけの親は対象外）
  let index = 0;

  return (
    <section className={`unscheduled${isOver ? ' is-over' : ''}`}>
      <header className="unscheduled-head">
        <h2>未配置</h2>
        <span className="num">{draggables.length}件</span>
      </header>
      <div ref={setNodeRef} className="unscheduled-body">
        <SortableContext
          id={containerId}
          items={visibleDraggables.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {sections.map((section) => {
            const open = openStages.includes(section.stage);
            return (
              <div key={section.stage} className="unscheduled-section">
                <button
                  type="button"
                  className="unscheduled-section-head"
                  aria-expanded={open}
                  onClick={() => toggleStage(section.stage)}
                >
                  <span className="unscheduled-section-caret" aria-hidden>
                    {open ? '▾' : '▸'}
                  </span>
                  <span className={`unscheduled-section-title stage-${section.stage}`}>
                    {STAGE_LABEL[section.stage]}
                  </span>
                  <span className="num">{section.count}件</span>
                </button>
                {open &&
                  section.groups.map((group) => (
                    <div key={group.task.id} className="unscheduled-group">
                      <UnscheduledRow task={group.task} containerId={containerId} index={index++} />
                      {group.children.map((child) => (
                        <UnscheduledRow
                          key={child.id}
                          task={child}
                          containerId={containerId}
                          index={index++}
                          isChild
                        />
                      ))}
                    </div>
                  ))}
              </div>
            );
          })}
        </SortableContext>
        {groups.length === 0 && (
          <p className="empty">
            {search || filterTagIds.length > 0
              ? '条件に合う未配置タスクはありません'
              : 'すべてのタスクが配置済みです'}
          </p>
        )}
      </div>
    </section>
  );
}

function UnscheduledRow({
  task,
  containerId,
  index,
  isChild,
}: {
  task: Task;
  containerId: string;
  index: number;
  isChild?: boolean;
}) {
  const tasks = useAppStore((s) => s.tasks);
  const selectTask = useAppStore((s) => s.selectTask);
  const minutes = scheduledMinutes(task, tasks);
  // 子が全部どこかの日に入っているか全部完了していると、この行の下には何も出ない。その旨を添える
  const allDone = !isChild && allSubtasksDone(tasks, task);
  const allPlaced = !isChild && !allDone && allSubtasksScheduled(tasks, task);
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
  const color = effectiveColor(task, tasks);

  return (
    <div
      ref={sortableRef}
      style={{ transform: CSS.Translate.toString(transform), transition, ...colorStyle(color) }}
      className={`chip stage-${task.stage}${isChild ? ' is-child' : ''}${isDragging ? ' is-dragging' : ''}${color ? ' has-bg' : ''}`}
      onClick={() => selectTask(task.id)}
      title={isChild ? 'サブタスク' : STAGE_LABEL[task.stage]}
      {...attributes}
      {...listeners}
    >
      <div className="chip-row">
        <span className="chip-title" title={task.title}>
          {task.title}
        </span>
      </div>
      {(task.dueDate || minutes > 0 || allPlaced || allDone) && (
        <div className="chip-meta">
          {task.dueDate && <DueBadge date={task.dueDate} />}
          {minutes > 0 && <span className="chip-time num">{formatMinutes(minutes)}</span>}
          {allPlaced && <span className="chip-note">サブタスク全配置済</span>}
          {allDone && <span className="chip-note">サブタスク全完了</span>}
        </div>
      )}
    </div>
  );
}
