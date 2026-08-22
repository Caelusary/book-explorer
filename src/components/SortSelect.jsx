import { SORT_OPTIONS } from '../utils/openLibrary'

/**
 * A native <select> rather than a custom dropdown. It gets keyboard support,
 * screen-reader semantics, and the platform's own mobile picker for free —
 * none of which a div-based menu would have without real work.
 */
export default function SortSelect({ value, onChange, disabled = false }) {
  return (
    <div className="sort">
      <label className="sort__label" htmlFor="sort-select">
        Sort by
      </label>
      <select
        id="sort-select"
        className="sort__select"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
