/**
 * Every non-result state in the app: no results, too short, blank search,
 * failed request, missing page.
 *
 * Each one leads with a library stamp, the inked mark a circulation desk puts
 * on a slip. It is the app's voice for "this is the answer, and it is not a
 * book", so all of these states look like one family instead of a stray grey
 * sentence floating where a grid should be.
 *
 * `role` is passed through so an error keeps role="alert" and is announced,
 * while the calm states stay silent.
 */
export default function StatusPanel({ stamp, tone = 'calm', role, children }) {
  return (
    <div className={`status status--${tone}`} role={role}>
      <span className="stamp">{stamp}</span>
      {children}
    </div>
  )
}
