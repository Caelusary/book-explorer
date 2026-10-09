/**
 * A row of plain spines under the lobby search: the one picture the app draws
 * of itself. No covers, no titles, nothing fetched. Heights, widths and tints
 * are fixed so the row is identical on every visit and costs nothing to lay
 * out. Purely decorative, so it is hidden from assistive tech.
 */
const SPINES = [
  [78, 14, 'rust'], [92, 18, 'ink'], [70, 12, 'ochre'], [86, 20, 'slate'],
  [96, 16, 'paper'], [74, 13, 'olive'], [88, 22, 'rust'], [64, 11, 'ink'],
  [82, 17, 'slate'], [94, 15, 'ochre'], [72, 19, 'paper'], [90, 12, 'olive'],
  [80, 21, 'ink'], [68, 14, 'rust'], [92, 16, 'slate'], [76, 18, 'ochre'],
  [86, 13, 'paper'], [70, 20, 'olive'], [95, 15, 'rust'], [78, 12, 'ink'],
  [84, 18, 'slate'], [66, 16, 'ochre'], [90, 14, 'paper'], [74, 19, 'olive'],
]

// Three passes over the set, each shifted, so the row fills a desktop width
// without visibly repeating. Narrow screens clip the overflow.
const TINTS = ['rust', 'ink', 'ochre', 'slate', 'paper', 'olive']
const ROW = [0, 7, 13].flatMap((shift) =>
  SPINES.map(([, width, tint], index) => [
    SPINES[(index + shift) % SPINES.length][0],
    shift ? SPINES[(index + shift * 2) % SPINES.length][1] : width,
    shift ? TINTS[(TINTS.indexOf(tint) + shift) % TINTS.length] : tint,
  ]),
)

export default function Shelf() {
  return (
    <div className="shelf" aria-hidden="true">
      {ROW.map(([height, width, tint], index) => (
        <span
          key={index}
          className={`shelf__spine shelf__spine--${tint}`}
          style={{ '--h': `${height}%`, '--w': `${width}px`, '--i': index % 24 }}
        />
      ))}
    </div>
  )
}
