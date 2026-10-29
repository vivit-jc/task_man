import { beforeEach, describe, expect, it } from 'vitest';
import { useAppStore } from './useAppStore';
import { today } from '../lib/date';

function occurrences() {
  const { events, eventSeries } = useAppStore.getState();
  return events.filter((e) => e.seriesId === eventSeries[0]?.id);
}

describe('定期の操作', () => {
  beforeEach(() => {
    useAppStore.setState({ events: [], eventSeries: [], undoStack: [] });
    const id = useAppStore.getState().addSeries({ title: '定例', startDate: today() });
    useAppStore.getState().updateSeries(id, { allDay: false, startTime: '10:00', endTime: '11:00' });
  });

  it('追加するとすぐに回が置かれる', () => {
    expect(occurrences().length).toBeGreaterThanOrEqual(8);
    expect(occurrences().every((e) => e.startTime === '10:00')).toBe(true);
  });

  it('回の時刻を変えると個別に編集した回になり、定期の変更に追従しない', () => {
    const first = occurrences()[0]!;
    useAppStore.getState().updateEvent(first.id, { startTime: '13:00', endTime: '14:00' });
    const id = useAppStore.getState().eventSeries[0]!.id;
    useAppStore.getState().updateSeries(id, { startTime: '09:00', endTime: '10:00' });
    const [edited, ...rest] = occurrences();
    expect(edited).toMatchObject({ id: first.id, startTime: '13:00', customized: true });
    expect(rest.every((e) => e.startTime === '09:00')).toBe(true);
  });

  it('回を削除しようとすると中止になり、展開し直しても戻らない', () => {
    const first = occurrences()[0]!;
    useAppStore.getState().deleteEvent(first.id);
    expect(useAppStore.getState().events.find((e) => e.id === first.id)?.cancelled).toBe(true);
    expect(useAppStore.getState().expandRecurring()).toBe(0);
    useAppStore.getState().setEventCancelled(first.id, false);
    expect(useAppStore.getState().events.find((e) => e.id === first.id)?.cancelled).toBe(false);
  });

  it('定期を消すと取り消しで戻せる', () => {
    const id = useAppStore.getState().eventSeries[0]!.id;
    const count = occurrences().length;
    useAppStore.getState().deleteSeries(id);
    expect(useAppStore.getState().eventSeries).toHaveLength(0);
    useAppStore.getState().undo();
    expect(occurrences()).toHaveLength(count);
  });
});
