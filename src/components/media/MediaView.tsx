import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { CollisionDetection, DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import {
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAppStore } from '../../store/useAppStore';
import type { DropPosition } from '../../store/useAppStore';
import { groupMediaByStatus, matchesMediaKind, matchesMediaText } from '../../store/selectors';
import type { MediaContainerData, SortableMediaData } from '../../lib/dnd';
import type { MediaItem, MediaStatus } from '../../types';
import { MediaCardBody } from './MediaCard';
import { MediaColumn } from './MediaColumn';
import { MediaQuickAdd } from './MediaQuickAdd';

/** 列に並べる状態。済・やめたは下に畳んでおく */
const COLUMNS: MediaStatus[] = ['want', 'playing', 'paused'];
const FINISHED: MediaStatus[] = ['done', 'dropped'];

type OverData = SortableMediaData | MediaContainerData | undefined;

/**
 * 列の中にカードがあるので、ポインタが乗っているカードを列より優先する。
 * ポインタがどこにも乗っていないとき（キーボード操作など）は角の近さで決める。
 */
const collisionDetection: CollisionDetection = (args) => {
  const withinPointer = pointerWithin(args);
  if (withinPointer.length === 0) return closestCorners(args);
  const cards = withinPointer.filter(
    (c) => (args.droppableContainers.find((d) => d.id === c.id)?.data.current as OverData)?.type === 'media',
  );
  return cards.length > 0 ? cards : withinPointer;
};

/**
 * 見たい映画、やりかけのゲームなど。タスクとは混ぜずに眺める。
 * ドラッグはタスクのものと混ざらないよう、この画面だけの DndContext で受ける。
 */
export function MediaView() {
  const media = useAppStore((s) => s.media);
  const search = useAppStore((s) => s.ui.search);
  const filterMediaKindIds = useAppStore((s) => s.ui.filterMediaKindIds);
  const moveMedia = useAppStore((s) => s.moveMedia);
  const [showFinished, setShowFinished] = useState(false);
  const [dragging, setDragging] = useState<MediaItem | null>(null);

  const sensors = useSensors(
    // 小さな動きはクリック扱い
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const filtered = media.filter(
    (item) => matchesMediaText(item, search) && matchesMediaKind(item, filterMediaKindIds),
  );
  const groups = groupMediaByStatus(filtered);
  const finishedCount = FINISHED.reduce((sum, status) => sum + groups[status].length, 0);
  const narrowed = search !== '' || filterMediaKindIds.length > 0;
  const emptyText = narrowed ? '該当なし' : 'まだありません';

  const onDragStart = (event: DragStartEvent) => {
    setDragging(media.find((m) => m.id === event.active.id) ?? null);
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
    const overData = over.data.current as OverData;
    const activeData = active.data.current as SortableMediaData | undefined;
    if (!overData) return;

    if (overData.type === 'media-container') {
      // 列の空いているところに落としたら末尾へ
      moveMedia(String(active.id), overData.status, Number.MAX_SAFE_INTEGER);
      return;
    }
    if (over.id === active.id) return;
    let after: boolean;
    if (activeData?.status === overData.status) {
      // 同じ列の中では、ドラッグ中のアニメーションと同じ規則で前後を決める
      after = activeData.index < overData.index;
    } else {
      // 別の列から来たときは、落とした位置が相手カードの中央より下なら後ろ
      const dragged = active.rect.current.translated;
      after = dragged ? dragged.top + dragged.height / 2 > over.rect.top + over.rect.height / 2 : false;
    }
    // 絞り込みで間引かれた並びなので、番号ではなく相手のカードを基準に差し込む
    const position: DropPosition = { anchorId: String(over.id), after };
    moveMedia(String(active.id), overData.status, position);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={collisionDetection}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragCancel={endDrag}
    >
      <div className="media-view">
        <div className="media-head">
          <h2 className="media-heading">たのしみ</h2>
          {groups.playing.length > 0 && (
            <span className="media-summary num">進行中 {groups.playing.length}件</span>
          )}
        </div>

        <MediaQuickAdd />

        <div className="media-columns">
          {COLUMNS.map((status) => (
            <MediaColumn
              key={status}
              status={status}
              items={groups[status]}
              strategy={verticalListSortingStrategy}
              className="media-column"
              emptyText={emptyText}
            />
          ))}
        </div>

        {/* 0 件でも開けるようにしておく。開いていれば、ドラッグで済・やめたへ移せる */}
        <section className="media-finished">
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => setShowFinished(!showFinished)}
            aria-expanded={showFinished}
          >
            {showFinished ? '▾' : '▸'} 済・やめた（{finishedCount}件）
          </button>
          {showFinished &&
            FINISHED.map((status) => (
              <MediaColumn
                key={status}
                status={status}
                items={groups[status]}
                strategy={rectSortingStrategy}
                className="media-finished-group"
                listClassName="media-grid"
                emptyText="ここに落とすと移せます"
              />
            ))}
        </section>
      </div>

      <DragOverlay dropAnimation={null}>
        {dragging ? (
          <div className="drag-preview">
            <MediaCardBody item={dragging} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
