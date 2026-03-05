export default function Pagination({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null

  return (
    <div className="flex items-center justify-center gap-2 mt-4">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-3 py-1.5 rounded-lg text-sm bg-surface hover:bg-primary-light disabled:opacity-40 cursor-pointer transition"
      >
        السابق
      </button>
      <span className="text-sm text-textSecondary px-2">
        {currentPage} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-3 py-1.5 rounded-lg text-sm bg-surface hover:bg-primary-light disabled:opacity-40 cursor-pointer transition"
      >
        التالي
      </button>
    </div>
  )
}
