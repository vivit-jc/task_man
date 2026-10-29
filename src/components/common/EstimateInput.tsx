import { useEffect, useState } from 'react';
import { ESTIMATE_PRESETS, formatMinutes, parseEstimate } from '../../lib/estimate';

interface Props {
  value: number | null;
  onChange: (minutes: number | null) => void;
}

/** プリセットのボタンと自由入力（1.5h / 90m / 2）の両方を受け付ける */
export function EstimateInput({ value, onChange }: Props) {
  const [text, setText] = useState(value == null ? '' : formatMinutes(value));

  useEffect(() => {
    setText(value == null ? '' : formatMinutes(value));
  }, [value]);

  const commit = () => {
    const parsed = parseEstimate(text);
    onChange(parsed);
    setText(parsed == null ? '' : formatMinutes(parsed));
  };

  return (
    <div className="estimate-input">
      <input
        className="field num"
        value={text}
        placeholder="1.5h / 90m"
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            commit();
          }
        }}
      />
      <div className="estimate-presets">
        {ESTIMATE_PRESETS.map((minutes) => (
          <button
            key={minutes}
            type="button"
            className={`btn btn-sm num${value === minutes ? ' is-on' : ''}`}
            onClick={() => onChange(value === minutes ? null : minutes)}
          >
            {formatMinutes(minutes)}
          </button>
        ))}
      </div>
    </div>
  );
}
