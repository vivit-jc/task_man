import type { ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppStore } from '../../store/useAppStore';
import type { SortableMediaData } from '../../lib/dnd';
import type { MediaItem, MediaStatus } from '../../types';
import { DragHandle } from '../board/DragHandle';
import { TagChip } from '../common/TagChip';
import { RatingStars } from './RatingStars';

/** カードから一押しで進める先。中断・やめたは詳細から選ぶ */
const NEXT_ACTION: Partial<Record<MediaStatus, { status: MediaStatus; label: string }>> = {
  want: { status: 'playing', label: '始める' },
  playing: { status: 'done', label: '済にする' },
  paused: { status: 'playing', label: '再開' },
};

/** 並べ替えできるカード。掴めるのは持ち手だけで、本文はクリックで詳細を開く */
export function MediaCard({ item, index }: { item: MediaItem; index: number }) {
  const data: SortableMediaData = { type: 'media', status: item.status, index };
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`media-card-wrap${isDragging ? ' is-dragging' : ''}`}
    >
      <MediaCardBody
        item={item}
        handle={
          <DragHandle
            ref={setActivatorNodeRef}
            label={`${item.title} を移動`}
            {...attributes}
            {...listeners}
          />
        }
      />
    </div>
  );
}

/** ドラッグ中のプレビューでも使う、カードの見た目そのもの */
export function MediaCardBody({
  item,
  handle,
  overlay,
}: {
  item: MediaItem;
  handle?: ReactNode;
  overlay?: boolean;
}) {
  const kind = useAppStore((s) => s.mediaKinds.find((k) => k.id === item.kindId) ?? null);
  const selectedMediaId = useAppStore((s) => s.selectedMediaId);
  const selectMedia = useAppStore((s) => s.selectMedia);
  const setMediaStatus = useAppStore((s) => s.setMediaStatus);
  const next = NEXT_ACTION[item.status];

  return (
    <article
      className={[
        'media-card',
        `is-${item.status}`,
        selectedMediaId === item.id && !overlay ? 'is-selected' : '',
        overlay ? 'is-overlay' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={kind ? ({ '--kind-color': kind.color } as React.CSSProperties) : undefined}
    >
      <div className="media-main">
        {overlay ? <DragHandle label="" /> : handle}
        {/* カード全体をボタンにすると中にボタンを置けないので、本文だけを押せるようにする */}
        <button type="button" className="media-open" onClick={() => selectMedia(item.id)}>
          <span className="media-title">{item.title}</span>
          {(item.progress || item.where) && (
            <span className="media-meta">
              {item.progress && <span>{item.progress}</span>}
              {item.where && <span className="media-where">{item.where}</span>}
            </span>
          )}
        </button>
      </div>
      <div className="media-foot">
        {kind ? <TagChip tag={kind} /> : <span className="media-unkind">未分類</span>}
        {item.rating !== null && <RatingStars value={item.rating} />}
        <span className="media-foot-spacer" />
        {next && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => setMediaStatus(item.id, next.status)}
          >
            {next.label}
          </button>
        )}
      </div>
    </article>
  );
}
