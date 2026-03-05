export default function BulkActionBar({ selectedCount, actions }) {
  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-surface shadow-lg border-t border-border z-40 px-6 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between" dir="rtl">
        <span className="text-sm font-medium text-textPrimary">
          تم تحديد {selectedCount} عنصر
        </span>
        <div className="flex gap-2">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                action.variant === 'danger'
                  ? 'bg-danger text-white hover:bg-red-600'
                  : 'bg-primary text-white hover:bg-primary-dark'
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
