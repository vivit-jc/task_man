import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { countByTag } from '../../store/selectors';
import type { SortKey, Tag } from '../../types';
import { ConfirmDialog } from '../common/ConfirmDialog';
import { TagChip } from '../common/TagChip';
import { MediaKindDialog } from '../media/MediaKindDialog';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'manual', label: '手動の並び' },
  { value: 'due', label: '期限が近い順' },
  { value: 'priority', label: '優先度順' },
  { value: 'estimate', label: '短い順' },
];

export function FilterBar() {
  const view = useAppStore((s) => s.ui.view);
  const boardLayout = useAppStore((s) => s.ui.boardLayout);
  const sortKey = useAppStore((s) => s.ui.sortKey);
  const showDone = useAppStore((s) => s.ui.showDone);
  const filterTagIds = useAppStore((s) => s.ui.filterTagIds);
  const tags = useAppStore((s) => s.tags);
  const tasks = useAppStore((s) => s.tasks);
  const setUi = useAppStore((s) => s.setUi);
  const clearCompleted = useAppStore((s) => s.clearCompleted);
  const deleteTag = useAppStore((s) => s.deleteTag);
  const mediaKinds = useAppStore((s) => s.mediaKinds);
  const filterMediaKindIds = useAppStore((s) => s.ui.filterMediaKindIds);
  const doneCount = tasks.filter((t) => t.done).length;
  // イベントはタグも並び順も持たないので、タスク向けの操作は隠す
  const isEvent = view === 'event';
  // たのしみはタグの代わりに種類で絞り込む。済は画面の中で畳んでいるので完了の切り替えも要らない
  const isMedia = view === 'media';
  const isTaskView = !isEvent && !isMedia;
  const [editingKinds, setEditingKinds] = useState(false);

  // タグの整理モード。うっかり消さないよう、ふだんは × を出さない
  const [managing, setManaging] = useState(false);
  const [pendingTag, setPendingTag] = useState<Tag | null>(null);

  // タグが無くなった / タスク以外の画面に移ったら整理モードは畳む
  useEffect(() => {
    if (!isTaskView || tags.length === 0) {
      setManaging(false);
      setPendingTag(null);
    }
  }, [isTaskView, tags.length]);

  const toggleKind = (id: string) => {
    setUi({
      filterMediaKindIds: filterMediaKindIds.includes(id)
        ? filterMediaKindIds.filter((k) => k !== id)
        : [...filterMediaKindIds, id],
    });
  };

  const toggleTag = (id: string) => {
    setUi({
      filterTagIds: filterTagIds.includes(id)
        ? filterTagIds.filter((t) => t !== id)
        : [...filterTagIds, id],
    });
  };

  return (
    <div className="filterbar">
      <div className="filter-tags">
        {isEvent && <span className="filter-hint">イベントは上の検索欄で絞り込めます</span>}
        {isMedia &&
          mediaKinds.map((kind) => (
            <TagChip
              key={kind.id}
              tag={kind}
              active={filterMediaKindIds.includes(kind.id)}
              onClick={() => toggleKind(kind.id)}
            />
          ))}
        {isMedia && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setEditingKinds(true)}>
            種類を編集
          </button>
        )}
        {isMedia && filterMediaKindIds.length > 0 && (
          <button
            type="button"
            className="btn btn-quiet btn-sm"
            onClick={() => setUi({ filterMediaKindIds: [] })}
          >
            絞り込みを解除
          </button>
        )}
        {isTaskView && tags.length === 0 && (
          <span className="filter-hint">タグはタスクの詳細から追加できます</span>
        )}
        {isTaskView &&
          tags.map((tag) =>
            managing ? (
              <TagChip key={tag.id} tag={tag} onDelete={() => setPendingTag(tag)} />
            ) : (
              <TagChip
                key={tag.id}
                tag={tag}
                active={filterTagIds.includes(tag.id)}
                onClick={() => toggleTag(tag.id)}
              />
            ),
          )}
        {isTaskView && tags.length > 0 && (
          <button
            type="button"
            className={`btn btn-quiet btn-sm${managing ? ' is-active' : ''}`}
            onClick={() => {
              setManaging(!managing);
              setPendingTag(null);
            }}
            aria-pressed={managing}
          >
            {managing ? '整理をやめる' : 'タグを整理'}
          </button>
        )}
        {isTaskView && !managing && filterTagIds.length > 0 && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={() => setUi({ filterTagIds: [] })}>
            絞り込みを解除
          </button>
        )}
        {isTaskView && tags.length > 0 && (
          <span className="filter-hint num">
            {managing
              ? '× でタグを削除'
              : filterTagIds.length > 0
                ? `${filterTagIds.map((id) => countByTag(tasks, id)).reduce((a, b) => a + b, 0)}件が該当`
                : ''}
          </span>
        )}
      </div>

      <div className="filter-controls">
        {view === 'board' && (
          <div className="segmented" role="group" aria-label="一覧のレイアウト">
            <button
              type="button"
              className={boardLayout === 'kanban' ? 'is-active' : ''}
              onClick={() => setUi({ boardLayout: 'kanban' })}
            >
              カンバン
            </button>
            <button
              type="button"
              className={boardLayout === 'list' ? 'is-active' : ''}
              onClick={() => setUi({ boardLayout: 'list' })}
            >
              リスト
            </button>
            <button
              type="button"
              className={boardLayout === 'grid' ? 'is-active' : ''}
              onClick={() => setUi({ boardLayout: 'grid' })}
            >
              グリッド
            </button>
          </div>
        )}

        {isTaskView && (
          <label className="inline-field">
            <span className="sr-only">並び替え</span>
            <select
              className="field"
              value={sortKey}
              onChange={(e) => setUi({ sortKey: e.target.value as SortKey })}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {!isMedia && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setUi({ showDone: e.target.checked })}
            />
            完了済みを表示
          </label>
        )}

        {!isMedia && showDone && doneCount > 0 && (
          <button type="button" className="btn btn-quiet btn-sm" onClick={clearCompleted}>
            完了済み{doneCount}件を削除
          </button>
        )}
      </div>

      {isMedia && editingKinds && <MediaKindDialog onClose={() => setEditingKinds(false)} />}

      {pendingTag && (
        <ConfirmDialog
          title="タグを削除する"
          body={(() => {
            const used = tasks.filter((t) => t.tagIds.includes(pendingTag.id)).length;
            return used > 0
              ? `「${pendingTag.name}」を削除します。タスク${used}件からこのタグが外れます（タスク自体は消えません）。`
              : `「${pendingTag.name}」を削除します。このタグが付いたタスクはありません。`;
          })()}
          confirmLabel="削除する"
          danger
          onCancel={() => setPendingTag(null)}
          onConfirm={() => {
            deleteTag(pendingTag.id);
            setPendingTag(null);
          }}
        />
      )}
    </div>
  );
}
