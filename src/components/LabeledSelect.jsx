/**
 * A labelled dropdown: the shape both of this app's result controls take.
 *
 * One component rather than two near-identical ones, because the requirement
 * is that they look and behave the same — "Search by" and "Sort by" sitting
 * side by side in different clothes is what made the page feel unsettled in
 * the first place. Two callers is normally too few to extract for, but here
 * the duplication would be total and the coupling is the point.
 *
 * A native <select> throughout: it brings keyboard support, screen-reader
 * semantics, and the platform's own mobile picker at no cost. Only the painted
 * chrome is replaced — see `.control__select` for why that is necessary.
 */
export default function LabeledSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled = false,
}) {
  return (
    <div className="control">
      <label className="control__label" htmlFor={id}>
        {label}
      </label>

      {/* The chevron is drawn on this wrapper rather than on the select, so it
          can sit over the control without being clipped by its padding box. */}
      <span className="control__field">
        <select
          id={id}
          className="control__select"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </span>
    </div>
  )
}
