import { SUBJECTS } from '../utils/openLibrary'

export default function SubjectChips({ activeSubject, onSelect }) {
  return (
    <ul className="chips">
      {SUBJECTS.map((subject) => (
        <li key={subject.slug}>
          <button
            type="button"
            className={
              'chip' + (subject.slug === activeSubject ? ' chip--active' : '')
            }
            aria-pressed={subject.slug === activeSubject}
            onClick={() => onSelect(subject.slug)}
          >
            {subject.label}
          </button>
        </li>
      ))}
    </ul>
  )
}
