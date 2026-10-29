import type { IncomingMessage, ServerResponse } from 'node:http';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { Plugin } from 'vite';
import { appendArchive, isArchiveEntry, removeArchive } from './archiveFile';
import { ConflictError, readState, writeState } from './stateFile';

/** 受け付けるリクエストの上限。タスクの JSON がこれを超えることはまずない */
const MAX_BODY_BYTES = 8 * 1024 * 1024;

/** dev サーバー経由かどうかをクライアントが判別するための印 */
const MARKER_HEADER = 'x-task-man-state';
/** クライアントが把握しているファイルの版 */
const REVISION_HEADER = 'x-task-man-revision';

export interface StateFileOptions {
  /** state.json を置くディレクトリ。相対パスはプロジェクトルートから、`~/` はホームから */
  dir: string;
  path?: string;
  /** 削除した完了済みタスクを追記するエンドポイント */
  archivePath?: string;
}

/** データの置き場所を絶対パスにする。開発用リポジトリの外（`~/TaskManData` など）も指せるように `~` を展開する */
export function resolveDataDir(root: string, dir: string): string {
  if (dir === '~') return homedir();
  if (dir.startsWith('~/')) return join(homedir(), dir.slice(2));
  return resolve(root, dir);
}

/**
 * 開発サーバーに保存用のエンドポイントを足すプラグイン。
 * GET  でファイルの内容を返し、PUT / POST で丸ごと書き換える。
 * 本番ビルドには含まれないので、静的に配信したときはクライアント側が localStorage に落ちる。
 */
export function stateFilePlugin(options: StateFileOptions): Plugin {
  const endpoint = options.path ?? '/api/state';
  const archiveEndpoint = options.archivePath ?? '/api/archive';

  return {
    name: 'task-man-state-file',
    apply: 'serve',
    configureServer(server) {
      const dir = resolveDataDir(server.config.root, options.dir);

      server.middlewares.use(endpoint, (req, res) => {
        res.setHeader(MARKER_HEADER, '1');
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Access-Control-Expose-Headers', `${MARKER_HEADER}, ${REVISION_HEADER}`);

        void handle(req, res, dir).catch((error: unknown) => {
          server.config.logger.error(
            `[task-man] 保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          );
          send(res, 500, { error: '保存に失敗しました' });
        });
      });

      server.middlewares.use(archiveEndpoint, (req, res) => {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');

        void handleArchive(req, res, dir).catch((error: unknown) => {
          server.config.logger.error(
            `[task-man] アーカイブに失敗しました: ${error instanceof Error ? error.message : String(error)}`,
          );
          send(res, 500, { error: 'アーカイブに失敗しました' });
        });
      });

      server.config.logger.info(`  ➜  データ:   ${dir}/state.json`);
    },
  };
}

async function handle(req: IncomingMessage, res: ServerResponse, dir: string): Promise<void> {
  if (req.method === 'GET') {
    const state = await readState(dir);
    if (state === null) {
      send(res, 404, { error: 'まだ保存されたデータがありません' });
      return;
    }
    res.setHeader(REVISION_HEADER, state.revision);
    res.statusCode = 200;
    res.end(state.text);
    return;
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = await readBody(req);
    try {
      JSON.parse(body);
    } catch {
      // 壊れた JSON でファイルを上書きしない
      send(res, 400, { error: 'JSON として読めません' });
      return;
    }
    // 版の指定が無いときは無条件に上書きする（sendBeacon はヘッダを付けられない）
    const header = req.headers[REVISION_HEADER];
    const expected = typeof header === 'string' ? (header === '' ? null : header) : undefined;
    try {
      const result = await writeState(dir, body, new Date(), expected);
      res.setHeader(REVISION_HEADER, result.revision);
      send(res, 200, result);
    } catch (error) {
      if (error instanceof ConflictError) {
        res.setHeader(REVISION_HEADER, error.revision ?? '');
        send(res, 409, { error: error.message, revision: error.revision });
        return;
      }
      throw error;
    }
    return;
  }

  send(res, 405, { error: `${req.method ?? '?'} は受け付けません` });
}

/**
 * POST でエントリ（1 件または配列）を archive.json に追記し、
 * DELETE /api/archive/<id> で取り消された分を外す。
 */
async function handleArchive(req: IncomingMessage, res: ServerResponse, dir: string): Promise<void> {
  if (req.method === 'POST') {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readBody(req));
    } catch {
      send(res, 400, { error: 'JSON として読めません' });
      return;
    }
    const entries = Array.isArray(parsed) ? parsed : [parsed];
    if (!entries.every(isArchiveEntry)) {
      send(res, 400, { error: 'アーカイブの形になっていません' });
      return;
    }
    send(res, 200, { added: await appendArchive(dir, entries) });
    return;
  }

  if (req.method === 'DELETE') {
    // middleware に渡る url はマウント先を取り除いた残り（/<id>）
    const id = decodeURIComponent((req.url ?? '').replace(/^\//, '').split('?')[0] ?? '');
    if (id === '') {
      send(res, 400, { error: 'id がありません' });
      return;
    }
    send(res, 200, { removed: await removeArchive(dir, id) });
    return;
  }

  send(res, 405, { error: `${req.method ?? '?'} は受け付けません` });
}

function send(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.end(JSON.stringify(payload));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectPromise(new Error('リクエストが大きすぎます'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', rejectPromise);
  });
}
