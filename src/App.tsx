import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useAppStore } from './store/useAppStore';
import type { DropPosition } from './store/useAppStore';
import type { ContainerData, SortableTaskData } from './lib/dnd';
import { parseContainerId } from './lib/dnd';
import type { Task } from './types';
import { TopBar } from './components/shell/TopBar';
import { FilterBar } from './components/shell/FilterBar';
import { useTheme } from './components/shell/useTheme';
import { useShortcuts } from './components/shell/useShortcuts';
import { BoardView } from './components/board/BoardView';
import { TaskCardBody } from './components/board/TaskCard';
import { TaskEditorPanel } from './components/board/TaskEditorPanel';
import { WeekView } from './components/week/WeekView';
import { MonthView } from './components/month/MonthView';
import { EventView } from './components/event/EventView';
import { EventEditorPanel } from './components/event/EventEditorPanel';
import { SeriesEditorPanel } from './components/event/SeriesEditorPanel';
import { MediaView } from './components/media/MediaView';
import { MediaEditorPanel } from './components/media/MediaEditorPanel';
import { Toast } from './components/common/Toast';

/**
 * カードの中にサブタスクの受け皿が入れ子になっているので、まずポインタが実際に
 * 乗っている領域を優先する。角の近さだけで選ぶと、並べ替えのつもりが子になってしまう。
 * ポインタがどこにも乗っていないとき（キーボード操作など）は従来どおり角の近さで決める。
 */
const collisionDetection: CollisionDetection = (rawArgs) => {
  const args = withoutOtherSubtaskLists(rawArgs);
  const withinPointer = pointerWithin(args);
  if (withinPointer.length === 0) return closestCorners(args);
  return snapToNearestTask(args, withinPointer) ?? withinPointer;
};

/**
 * ドラッグでサブタスクにはしない。誤って子になることが多い割に使わないため、
 * 他の親のサブタスク欄（欄そのものと、そこに並ぶサブタスク）を落とし先の候補から外す。
 * サブタスク自身が元の親の中で並べ替える分には、その欄だけ残す。
 */
function withoutOtherSubtaskLists(
  args: Parameters<CollisionDetection>[0],
): Parameters<CollisionDetection>[0] {
  const ownContainer = (args.active.data.current as SortableTaskData | undefined)?.containerId;
  const droppableContainers = args.droppableContainers.filter((c) => {
    const data = c.data.current as SortableTaskData | ContainerData | undefined;
    if (!data?.containerId || data.containerId === ownContainer) return true;
    return parseContainerId(data.containerId)?.kind !== 'parent';
  });
  return { ...args, droppableContainers };
}

/**
 * ポインタがカードの上ではなく並びの余白（先頭の追加欄、カードの隙間、下の余白）にあるときは、
 * その並びで一番近いカードを落とし先にする。並びそのものを落とし先にすると位置が
 * 「末尾」としか決まらず、先頭へ動かそうとしても一番下に入ってしまう。
 */
function snapToNearestTask(
  args: Parameters<CollisionDetection>[0],
  withinPointer: ReturnType<CollisionDetection>,
): ReturnType<CollisionDetection> | null {
  const top = args.droppableContainers.find((c) => c.id === withinPointer[0]!.id);
  const topData = top?.data.current as SortableTaskData | ContainerData | undefined;
  if (topData?.type !== 'container') return null;
  const items = args.droppableContainers.filter((c) => {
    const data = c.data.current as SortableTaskData | ContainerData | undefined;
    return data?.type === 'task' && data.containerId === topData.containerId && c.id !== args.active.id;
  });
  if (items.length === 0) return null;
  const nearest = closestCenter({ ...args, droppableContainers: items });
  return nearest.length > 0 ? nearest : null;
}

export default function App() {
  const view = useAppStore((s) => s.ui.view);
  const theme = useAppStore((s) => s.settings.theme);
  const selectedTaskId = useAppStore((s) => s.selectedTaskId);
  const selectedEventId = useAppStore((s) => s.selectedEventId);
  const selectedSeriesId = useAppStore((s) => s.selectedSeriesId);
  const selectedMediaId = useAppStore((s) => s.selectedMediaId);
  const moveTask = useAppStore((s) => s.moveTask);
  const unscheduleTask = useAppStore((s) => s.unscheduleTask);
  const adoptSortedOrder = useAppStore((s) => s.adoptSortedOrder);
  const showToast = useAppStore((s) => s.showToast);

  const searchRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState<Task | null>(null);

  useTheme(theme);
  useShortcuts(searchRef);

  const sensors = useSensors(
    // 小さな動きはクリック扱い。カードのクリックで詳細を開けるようにする
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (event: DragStartEvent) => {
    const task = useAppStore.getState().tasks.find((t) => t.id === event.active.id);
    setDragging(task ?? null);
    document.body.classList.add('is-dragging-task');
  };

  const endDrag = () => {
    setDragging(null);
    document.body.classList.remove('is-dragging-task');
  };

  const onDragEnd = (event: DragEndEvent) => {
    endDrag();
    const { active, over } = event;
    if (!over) return;

    const overData = over.data.current as SortableTaskData | ContainerData | undefined;
    const activeData = active.data.current as SortableTaskData | undefined;
    let containerId: string;
    let position: DropPosition = Number.MAX_SAFE_INTEGER;

    if (overData?.type === 'task') {
      if (over.id === active.id) return;
      containerId = overData.containerId;
      let after: boolean;
      if (activeData?.containerId === containerId) {
        // 同じ並びの中では、ドラッグ中のアニメーションと同じ規則で前後を決める
        after = activeData.index < overData.index;
      } else {
        // 別の並びから来たときは、落とした位置が相手カードの中央より下なら後ろ。
        // グリッドでは同じ行のカードが横に並ぶので、左右で決める
        const dragged = active.rect.current.translated;
        const isGrid = useAppStore.getState().ui.boardLayout === 'grid';
        after = dragged
          ? isGrid
            ? dragged.left + dragged.width / 2 > over.rect.left + over.rect.width / 2
            : dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2
          : false;
      }
      position = { anchorId: String(over.id), after };
    } else if (overData?.type === 'container') {
      containerId = overData.containerId;
    } else {
      containerId = String(over.id);
    }

    const target = parseContainerId(containerId);
    if (!target) return;

    if (target.kind === 'unscheduled') {
      unscheduleTask(String(active.id));
      return;
    }
    // 期限順などで並べているときは、見えている順と手動の並び順が食い違う。
    // そのまま差し込むと見た目と違う位置に入るので、見えている順を手動の並びとして取り込む
    if (target.kind === 'stage' && adoptSortedOrder()) {
      showToast('並べ替えたので「手動の並び」に切り替えました');
    }
    moveTask(String(active.id), target, position);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      // サブタスクの開閉などで大きさが変わるので、都度測り直す
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <div className={`app${selectedTaskId || selectedEventId || selectedSeriesId || selectedMediaId ? ' has-panel' : ''}`}>
        <TopBar searchRef={searchRef} />
        <FilterBar />
        <div className="app-body">
          <main className="main">
            {view === 'board' && <BoardView />}
            {view === 'week' && <WeekView />}
            {view === 'month' && <MonthView />}
            {view === 'event' && <EventView />}
            {view === 'media' && <MediaView />}
          </main>
          <TaskEditorPanel />
          <EventEditorPanel />
          <SeriesEditorPanel />
          <MediaEditorPanel />
        </div>
        <Toast />
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="drag-preview">
            <TaskCardBody task={dragging} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
