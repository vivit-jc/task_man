import { useDroppable } from '@dnd-kit/core';
import { SortableContext } from '@dnd-kit/sortable';
import type { SortingStrategy } from '@dnd-kit/sortable';
import type { MediaContainerData } from '../../lib/dnd';
import type { MediaItem, MediaStatus } from '../../types';
import { MEDIA_STATUS_LABEL } from '../../types';
import { MediaCard } from './MediaCard';

interface Props {
  status: MediaStatus;
  items: MediaItem[];
  /** 列は縦一列、済・やめたは格子に並べる */
  strategy: SortingStrategy;
  className: string;
  listClassName?: string;
  emptyText: string;
}

/** 1 つの状態の受け皿。空の列にも落とせるよう、列全体を受け皿にする */
export function MediaColumn({ status, items, strategy, className, listClassName, emptyText }: Props) {
  const data: MediaContainerData = { type: 'media-container', status };
  const { setNodeRef, isOver } = useDroppable({ id: `media:${status}`, data });

  return (
    <section ref={setNodeRef} className={`${className} is-${status}${isOver ? ' is-over' : ''}`}>
      <h3>
        {MEDIA_STATUS_LABEL[status]}
        <span className="media-column-count num">{items.length}</span>
      </h3>
      <SortableContext id={`media:${status}`} items={items.map((m) => m.id)} strategy={strategy}>
        <div className={listClassName ?? 'media-list'}>
          {items.map((item, index) => (
            <MediaCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </SortableContext>
      {items.length === 0 && <p className="media-empty">{emptyText}</p>}
    </section>
  );
}
