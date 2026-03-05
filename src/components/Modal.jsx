import { useEffect } from 'react'

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-md' }) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className={`bg-surface rounded-xl shadow-lg p-6 w-full ${maxWidth} max-h-[90vh] overflow-y-auto`}
        dir="rtl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-primary">{title}</h3>
          <button
            onClick={onClose}
            className="text-textSecondary hover:text-textPrimary text-xl cursor-pointer"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
