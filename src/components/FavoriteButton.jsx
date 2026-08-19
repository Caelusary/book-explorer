import { useFavorites } from '../context/FavoritesContext'

export default function FavoriteButton({ book, className = '' }) {
  const { toggleFavorite, isFavorite } = useFavorites()
  const saved = isFavorite(book.key)

  return (
    <button
      type="button"
      className={`favorite ${saved ? 'favorite--on' : ''} ${className}`.trim()}
      aria-pressed={saved}
      aria-label={saved ? `Remove ${book.title} from shelf` : `Save ${book.title} to shelf`}
      title={saved ? 'Remove from shelf' : 'Save to shelf'}
      onClick={(event) => {
        // Cards are wrapped in a link — don't navigate when hitting the heart.
        event.preventDefault()
        event.stopPropagation()
        toggleFavorite(book)
      }}
    >
      {saved ? '♥' : '♡'}
    </button>
  )
}
