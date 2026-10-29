import { useAppStore } from '../../store/useAppStore';
import { STAGES } from '../../types';
import { StageColumn } from './StageColumn';

export function BoardView() {
  const layout = useAppStore((s) => s.ui.boardLayout);

  return (
    <div className={`board board-${layout}`}>
      {STAGES.map((stage) => (
        <StageColumn key={stage} stage={stage} />
      ))}
    </div>
  );
}
