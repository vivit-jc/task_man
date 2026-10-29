import { useEffect, useState } from 'react';
import { TASK_COLOR_PRESETS, normalizeHexColor } from '../../lib/taskColor';

interface Props {
  value: string | null;
  onChange: (color: string | null) => void;
  /** サブタスクのとき、未設定なら継ぐ親の色 */
  inherited?: string | null;
}

/** プリセット 6 色 + カラーピッカー + 16 進数の直接入力 */
export function TaskColorPicker({ value, onChange, inherited }: Props) {
  const [draft, setDraft] = useState(value ?? '');

  // 他の入力手段やタスクの切り替えで値が変わったら、入力欄も追従させる
  useEffect(() => setDraft(value ?? ''), [value]);

  const shown = value ?? inherited ?? null;

  return (
    <div className="color-picker">
      <div className="color-swatches" role="group" aria-label="背景色のプリセット">
        <button
          type="button"
          className={`color-swatch is-none${value === null ? ' is-active' : ''}`}
          onClick={() => onChange(null)}
          title={inherited !== undefined ? '親と同じ色' : '色なし'}
          aria-pressed={value === null}
        >
          {inherited !== undefined ? '親' : '✕'}
        </button>
        {TASK_COLOR_PRESETS.map((preset) => (
          <button
            key={preset.color}
            type="button"
            className={`color-swatch${value === preset.color ? ' is-active' : ''}`}
            style={{ '--swatch': preset.color } as React.CSSProperties}
            onClick={() => onChange(preset.color)}
            title={preset.name}
            aria-label={preset.name}
            aria-pressed={value === preset.color}
          />
        ))}
      </div>
      <div className="row">
        <input
          type="color"
          className="color-input"
          value={shown ?? '#ffffff'}
          onChange={(e) => onChange(normalizeHexColor(e.target.value))}
          aria-label="色を選ぶ"
        />
        <input
          className="field num color-hex"
          value={draft}
          placeholder="#rrggbb"
          maxLength={7}
          spellCheck={false}
          aria-label="16 進数で指定"
          onChange={(e) => {
            setDraft(e.target.value);
            const color = normalizeHexColor(e.target.value);
            if (color) onChange(color);
            else if (e.target.value.trim() === '') onChange(null);
          }}
          // 6 桁になっていない入力は、離れたときに今の色へ戻す
          onBlur={() => setDraft(value ?? '')}
        />
      </div>
      {inherited !== undefined && value === null && (
        <p className="hint">{inherited ? '親タスクの色を使っています' : '親タスクに色を付けるとその色になります'}</p>
      )}
    </div>
  );
}
