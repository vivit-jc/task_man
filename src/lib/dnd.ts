import { useCallback } from 'react';
import type { DropTarget } from '../store/useAppStore';
import type { IsoDate, MediaStatus, Stage } from '../types';

/** ドロップ先コンテナの id を文字列に符号化する */
export const containerIds = {
  stage: (stage: Stage) => `stage:${stage}`,
  parent: (parentId: string) => `parent:${parentId}`,
  day: (date: IsoDate) => `day:${date}`,
  unscheduled: 'unscheduled',
} as const;

export type ParsedContainer = DropTarget | { kind: 'unscheduled' };

export function parseContainerId(id: string): ParsedContainer | null {
  if (id === containerIds.unscheduled) return { kind: 'unscheduled' };
  const [kind, ...rest] = id.split(':');
  const value = rest.join(':');
  if (kind === 'stage') return { kind: 'stage', stage: value as Stage };
  if (kind === 'parent') return { kind: 'parent', parentId: value };
  if (kind === 'day') return { kind: 'day', date: value };
  return null;
}

/** 並べ替え可能な要素が data に載せる情報 */
export interface SortableTaskData {
  type: 'task';
  containerId: string;
  index: number;
}

export interface ContainerData {
  type: 'container';
  containerId: string;
}

/**
 * 掴む要素と「キーボードで掴み始められる要素」を同じノードに揃える。
 * activatorNode を指定しないと、dnd-kit はカードの中のどこで Space / Enter を
 * 押してもドラッグを始めてしまう。日本語入力の変換にスペースを使うと、
 * 入力の途中でカードが掴まれて追加ボタンが押せなくなる。
 */
export function useSortableRef(
  setNodeRef: (node: HTMLElement | null) => void,
  setActivatorNodeRef: (node: HTMLElement | null) => void,
): (node: HTMLElement | null) => void {
  return useCallback(
    (node: HTMLElement | null) => {
      setNodeRef(node);
      setActivatorNodeRef(node);
    },
    [setNodeRef, setActivatorNodeRef],
  );
}

/** たのしみのカードが data に載せる情報。containerId は状態そのもの */
export interface SortableMediaData {
  type: 'media';
  status: MediaStatus;
  index: number;
}

export interface MediaContainerData {
  type: 'media-container';
  status: MediaStatus;
}
