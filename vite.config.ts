import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { stateFilePlugin } from './server/vitePluginStateFile';

export default defineConfig(({ mode }) => {
  // 実データは開発用リポジトリの外に置けるよう、.env.local の TASK_MAN_DATA_DIR で差し替える
  const env = loadEnv(mode, process.cwd(), 'TASK_MAN_');
  return {
    plugins: [react(), stateFilePlugin({ dir: env.TASK_MAN_DATA_DIR || 'data' })],
    server: { port: 5172, strictPort: true },
  };
});
