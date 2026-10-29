import { dueLevel, formatDue, formatMonthDay } from '../../lib/date';
import type { IsoDate } from '../../types';

export function DueBadge({ date }: { date: IsoDate }) {
  const level = dueLevel(date);
  return (
    <span className={`due-badge due-${level} num`} title={`期限 ${formatMonthDay(date)}`}>
      {formatDue(date)}
    </span>
  );
}
