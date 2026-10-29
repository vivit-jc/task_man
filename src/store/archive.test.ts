import { describe, expect, it } from 'vitest';
import { makeEvent, makeTask } from './persist';
import { makeArchiveEntry } from './archive';

describe('アーカイブの記録', () => {
  it('参照しているタグとイベントだけを写しておく', () => {
    const tags = [
      { id: 'tag-1', name: '仕事', color: '#000' },
      { id: 'tag-2', name: '私用', color: '#fff' },
    ];
    const used = { ...makeEvent({ title: '展示会', date: '2026-10-12' }), id: 'ev-1' };
    const other = { ...makeEvent({ title: '別件', date: '2026-10-20' }), id: 'ev-2' };
    const task = { ...makeTask({ title: '資料', stage: 'now' }), tagIds: ['tag-1'], eventId: 'ev-1', done: true };

    const entry = makeArchiveEntry([task], { tags, events: [used, other] }, 'clear-completed', new Date('2026-10-10T12:00:00Z'));

    expect(entry.reason).toBe('clear-completed');
    expect(entry.archivedAt).toBe('2026-10-10T12:00:00.000Z');
    expect(entry.tasks.map((t) => t.title)).toEqual(['資料']);
    expect(entry.tags.map((t) => t.id)).toEqual(['tag-1']);
    expect(entry.events.map((e) => e.id)).toEqual(['ev-1']);
    expect(entry.id).not.toBe('');
  });
});
