/** タスクの段階。すぐやる / 近いうちにやる / 将来やる */
export type Stage = 'now' | 'soon' | 'later';

export const STAGES: Stage[] = ['now', 'soon', 'later'];

export const STAGE_LABEL: Record<Stage, string> = {
  now: 'すぐやる',
  soon: '近いうちにやる',
  later: '将来やる',
};

export type Priority = 'high' | 'normal' | 'low';

export const PRIORITY_LABEL: Record<Priority, string> = {
  high: '高',
  normal: '中',
  low: '低',
};

/** 'YYYY-MM-DD' 形式のローカル日付 */
export type IsoDate = string;

/** 'HH:MM' 24 時間表記のローカル時刻 */
export type HhMm = string;

export interface Task {
  id: string;
  title: string;
  note: string;
  stage: Stage;
  /** 同じ stage / 同じ親の中での並び順。ドロップのたびに 0..n で再採番する */
  order: number;
  /** サブタスクは 1 段のみ。親タスクは null */
  parentId: string | null;
  /** 旧データ互換のため残している。開閉状態は localStorage（useSubtaskExpanded）で管理 */
  collapsed: boolean;
  estimateMinutes: number | null;
  dueDate: IsoDate | null;
  /** 週タイムラインに配置した日。未配置は null */
  scheduledDate: IsoDate | null;
  /** その日の中での並び順 */
  scheduledOrder: number;
  tagIds: string[];
  /** 紐づけたイベント。1 タスクにつき最大 1 件 */
  eventId: string | null;
  priority: Priority;
  /** 背景色 '#rrggbb'。サブタスクで null なら親の色を継ぐ */
  color: string | null;
  done: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

/**
 * 予定。タスクではないので段階も見積もりも持たない。
 * 終日か開始・終了時刻のどちらかを取り、複数日にまたがることもできる。
 */
export interface AppEvent {
  id: string;
  title: string;
  note: string;
  /** 開始日 */
  date: IsoDate;
  /** 終了日。単日のイベントは null（date と同じ日も null に正規化する） */
  endDate: IsoDate | null;
  /** 終日なら startTime / endTime は必ず null */
  allDay: boolean;
  /** 開始日の時刻 */
  startTime: HhMm | null;
  /** 終了日の時刻。開始が無いときは必ず null。単日なら開始より前にはならない */
  endTime: HhMm | null;
  /** 定期から作った回なら、その定期の id。単発は null */
  seriesId: string | null;
  /** 定期の回が本来あった日。日付を動かしても変えない（同じ回を二度作らないためのキー） */
  occurrenceDate: IsoDate | null;
  /** 中止。定期の回は消すと次の展開でまた作られるので、消さずにこれを立てる */
  cancelled: boolean;
  /** 定期の回を個別に編集したか。立っている回は、定期を変えても追従させない */
  customized: boolean;
  createdAt: string;
  updatedAt: string;
}

/** 曜日。0 = 日曜 〜 6 = 土曜（Date#getDay と同じ） */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const WEEKDAY_LABEL = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * 毎週の定期イベント。これ自体はカレンダーに出ず、
 * 今日から 2 ヶ月先までの回を通常のイベントとして展開する（lib/recurrence.ts）。
 * 時刻の決まりは AppEvent の単日と同じ。
 */
export interface EventSeries {
  id: string;
  title: string;
  note: string;
  /** 毎週の曜日。昇順・重複なし・1 つ以上 */
  weekdays: Weekday[];
  allDay: boolean;
  startTime: HhMm | null;
  endTime: HhMm | null;
  /** この日以降の回を作る */
  startDate: IsoDate;
  /** この日まで（含む）。null なら終わりなし */
  endDate: IsoDate | null;
  createdAt: string;
  updatedAt: string;
}

/** 娯楽の状態。気になる / 進行中 / 中断 / 済 / やめた */
export type MediaStatus = 'want' | 'playing' | 'paused' | 'done' | 'dropped';

export const MEDIA_STATUSES: MediaStatus[] = ['want', 'playing', 'paused', 'done', 'dropped'];

export const MEDIA_STATUS_LABEL: Record<MediaStatus, string> = {
  want: '気になる',
  playing: '進行中',
  paused: '中断',
  done: '済',
  dropped: 'やめた',
};

/** 娯楽の種類（映画・ゲームなど）。タグと同じく自由に足したり消したりできる */
export interface MediaKind {
  id: string;
  name: string;
  color: string;
}

/**
 * 見たい映画、やりかけのゲームなど。タスクではないので段階も見積もりも持たず、
 * 週・月のカレンダーにも出さない。
 */
export interface MediaItem {
  id: string;
  title: string;
  /** 種類。未分類は null。種類を消したときもここが null になる */
  kindId: string | null;
  status: MediaStatus;
  /** 同じ状態の中での並び順。ドロップのたびに 0..n で再採番する */
  order: number;
  /** 「4章まで」「S2E5」など、どこまで進んだかを自由に書く */
  progress: string;
  /** Netflix / Switch / 積読の棚 など */
  where: string;
  note: string;
  /** 1〜5。付けていなければ null */
  rating: number | null;
  /** 初めて進行中にした日 */
  startedAt: IsoDate | null;
  /** 済にした日 */
  finishedAt: IsoDate | null;
  createdAt: string;
  updatedAt: string;
}

export type Theme = 'system' | 'light' | 'dark';
export type View = 'board' | 'week' | 'month' | 'event' | 'media';
export type BoardLayout = 'kanban' | 'list' | 'grid';
export type SortKey = 'manual' | 'due' | 'priority' | 'estimate';

export interface Settings {
  /** 1日あたりの見積もり上限（分）。週ビューの過負荷判定に使う */
  dailyCapacityMinutes: number;
  theme: Theme;
  /** 0 = 日曜始まり, 1 = 月曜始まり */
  weekStartsOn: 0 | 1;
}

export interface UiState {
  view: View;
  boardLayout: BoardLayout;
  /** 週ビューが表示している週に含まれる日 */
  weekAnchor: IsoDate;
  /** 月ビューが表示している月に含まれる日 */
  monthAnchor: IsoDate;
  search: string;
  filterTagIds: string[];
  showDone: boolean;
  sortKey: SortKey;
  /** たのしみ画面で絞り込む種類。空なら全部 */
  filterMediaKindIds: string[];
}

export interface AppData {
  schemaVersion: number;
  tasks: Task[];
  tags: Tag[];
  events: AppEvent[];
  eventSeries: EventSeries[];
  mediaKinds: MediaKind[];
  media: MediaItem[];
  settings: Settings;
  ui: UiState;
}
