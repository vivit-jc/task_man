import { describe, expect, it } from 'vitest';
import { formatMinutes, parseEstimate } from './estimate';

describe('見積もり時間', () => {
  it('分と時間を読み分ける', () => {
    expect(parseEstimate('90m')).toBe(90);
    expect(parseEstimate('1.5h')).toBe(90);
    expect(parseEstimate('1h30')).toBe(90);
    expect(parseEstimate('2')).toBe(120); // 単位なしは時間
  });

  it('解釈できない入力は null', () => {
    expect(parseEstimate('')).toBeNull();
    expect(parseEstimate('あとで')).toBeNull();
    expect(parseEstimate('0')).toBeNull();
  });

  it('60 分未満は分、以上は時間で表示する', () => {
    expect(formatMinutes(45)).toBe('45m');
    expect(formatMinutes(90)).toBe('1.5h');
    expect(formatMinutes(360)).toBe('6h');
  });
});
