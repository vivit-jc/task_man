import { describe, expect, it } from 'vitest';
import { makeTask } from '../store/persist';
import { darkVariant, effectiveColor, normalizeHexColor } from './taskColor';

describe('normalizeHexColor', () => {
  it('# の有無と大文字小文字をそろえる', () => {
    expect(normalizeHexColor('#FDE2E2')).toBe('#fde2e2');
    expect(normalizeHexColor(' fde2e2 ')).toBe('#fde2e2');
  });

  it('6 桁の 16 進数でなければ null', () => {
    expect(normalizeHexColor('#fff')).toBeNull();
    expect(normalizeHexColor('#gggggg')).toBeNull();
    expect(normalizeHexColor('')).toBeNull();
    expect(normalizeHexColor(undefined)).toBeNull();
  });
});

describe('effectiveColor', () => {
  const parent = makeTask({ id: 'p', title: '親', color: '#dde9fb' });
  const child = makeTask({ id: 'c', title: '子', parentId: 'p' });
  const own = makeTask({ id: 'o', title: '子', parentId: 'p', color: '#fde2e2' });
  const tasks = [parent, child, own];

  it('サブタスクは色が無ければ親の色を継ぐ', () => {
    expect(effectiveColor(child, tasks)).toBe('#dde9fb');
  });

  it('自分の色があればそちらを使う', () => {
    expect(effectiveColor(own, tasks)).toBe('#fde2e2');
  });

  it('親子とも色が無ければ null', () => {
    const plain = makeTask({ id: 'q', title: '親' });
    const kid = makeTask({ id: 'k', title: '子', parentId: 'q' });
    expect(effectiveColor(kid, [plain, kid])).toBeNull();
  });
});

describe('darkVariant', () => {
  it('色相を残して暗くする', () => {
    expect(darkVariant('#fde2e2')).toBe('hsl(0 35% 20%)');
    expect(darkVariant('#eeeeee')).toBe('hsl(0 0% 20%)');
  });
});
