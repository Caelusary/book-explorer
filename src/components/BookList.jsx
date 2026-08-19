import BookCard from './BookCard'

export default function BookList({ books, onSelectBook }) {
  return (
    <ul className="book-list">
      {books.map((book) => (
        <BookCard key={book.key} book={book} onSelect={onSelectBook} />
      ))}
    </ul>
  )
}
