interface Props {
  value: number | null;
  /** 渡すと押して付け直せる。同じ星をもう一度押すと外す */
  onChange?: (value: number | null) => void;
}

/** 1〜5 の評価 */
export function RatingStars({ value, onChange }: Props) {
  if (!onChange) {
    return (
      <span className="rating num" aria-label={`評価 ${value ?? 0} / 5`}>
        {'★'.repeat(value ?? 0)}
        <span className="rating-off">{'★'.repeat(5 - (value ?? 0))}</span>
      </span>
    );
  }
  return (
    <span className="rating rating-input" role="group" aria-label="評価">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={value !== null && n <= value ? 'is-on' : ''}
          aria-label={`${n}`}
          aria-pressed={value === n}
          onClick={() => onChange(value === n ? null : n)}
        >
          ★
        </button>
      ))}
    </span>
  );
}
