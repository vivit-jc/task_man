import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { startArchiveSync } from './store/archive';
import { loadStateFile, startFileSync } from './store/fileSync';
import { useAppStore } from './store/useAppStore';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/board.css';
import './styles/week.css';
import './styles/month.css';
import './styles/event.css';
import './styles/media.css';

/**
 * 画面を出す前にローカルファイルを読みに行く。
 * ファイルがあればそれが正。無ければ localStorage の内容でそのまま続ける。
 */
async function start() {
  const { available, data, revision } = await loadStateFile();
  if (data) useAppStore.getState().hydrate(data);
  // ファイルが無いときは localStorage の内容に、足りない定期の回を置く（hydrate は自分で置く）
  else useAppStore.getState().expandRecurring();
  if (available) {
    startFileSync(revision);
    startArchiveSync();
  } else useAppStore.getState().setSync('off');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
