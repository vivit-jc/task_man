import type { Tag } from '../../types';

interface Props {
  tag: Tag;
  active?: boolean;
  onClick?: () => void;
  /** 渡すとタグ自体を消す × を出す（整理モード用） */
  onDelete?: () => void;
  size?: 'sm' | 'md';
}

export function TagChip({ tag, active, onClick, onDelete, size = 'sm' }: Props) {
  const style = {
    '--tag-color': tag.color,
  } as React.CSSProperties;

  if (onDelete) {
    return (
      <span className={`tag-chip tag-${size} tag-removable`} style={style}>
        {tag.name}
        <button
          type="button"
          className="tag-remove"
          onClick={onDelete}
          aria-label={`タグ「${tag.name}」を削除`}
          title={`タグ「${tag.name}」を削除`}
        >
          ×
        </button>
      </span>
    );
  }

  if (!onClick) {
    return (
      <span className={`tag-chip tag-${size}`} style={style}>
        {tag.name}
      </span>
    );
  }
  return (
    <button
      type="button"
      className={`tag-chip tag-${size} tag-button${active ? ' is-active' : ''}`}
      style={style}
      onClick={onClick}
      aria-pressed={active}
    >
      {tag.name}
    </button>
  );
}
