import BookCard from './BookCard'

export default function BookList({ books }) {
  return (
    <ul className="book-list">
      {books.map((book, index) => (
        <BookCard key={book.key} book={book} index={index} />
      ))}
    </ul>
  )
}
