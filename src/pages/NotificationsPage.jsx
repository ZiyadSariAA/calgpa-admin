import { useState, useEffect } from 'react'
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  orderBy,
  query,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { useTranslation } from '../context/LanguageContext'
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import BulkActionBar from '../components/BulkActionBar'

function formatDate(ts, lang) {
  if (!ts) return '-'
  if (typeof ts === 'string') return ts
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function NotificationsPage() {
  const { t, lang } = useTranslation()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [link, setLink] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const PAGE_SIZE = 10

  const colRef = collection(db, 'notifications')

  async function loadData() {
    setLoading(true)
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      setNotifications([])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  function resetForm() {
    setTitle('')
    setMessage('')
    setLink('')
    setEditingId(null)
  }

  function openAdd() {
    resetForm()
    setShowForm(true)
  }

  function openEdit(n) {
    setEditingId(n.id)
    setTitle(n.title || '')
    setMessage(n.message || '')
    setLink(n.link || '')
    setShowForm(true)
  }

  function openResend(n) {
    resetForm()
    setTitle(n.title || '')
    setMessage(n.message || '')
    setLink(n.link || '')
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    resetForm()
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const data = { title, message, link: link || '' }

    if (editingId) {
      await updateDoc(doc(db, 'notifications', editingId), data)
    } else {
      await addDoc(colRef, {
        ...data,
        date: new Date().toISOString().split('T')[0],
        createdAt: Timestamp.now(),
      })
    }

    closeForm()
    await loadData()
  }

  async function handleDelete(id) {
    if (!confirm(t('confirmDeleteNotification'))) return
    await deleteDoc(doc(db, 'notifications', id))
    await loadData()
  }

  async function handleBulkDelete() {
    if (!confirm(t('confirmBulkDeleteNotifications', { n: selectedIds.length }))) return
    const batch = writeBatch(db)
    selectedIds.forEach(id => batch.delete(doc(db, 'notifications', id)))
    await batch.commit()
    setSelectedIds([])
    await loadData()
  }

  const totalPages = Math.ceil(notifications.length / PAGE_SIZE)
  const paginated = notifications.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const columns = [
    {
      key: 'title',
      label: t('colTitle'),
      render: (row) => <span className="font-medium text-textPrimary">{row.title}</span>,
    },
    {
      key: 'message',
      label: t('colMessage'),
      className: 'max-w-[300px] truncate',
      render: (row) => <span className="text-textSecondary">{row.message}</span>,
    },
    {
      key: 'link',
      label: t('colLink'),
      render: (row) => row.link
        ? <a href={row.link} target="_blank" rel="noreferrer" className="text-primary hover:underline text-sm truncate block max-w-[200px]">{row.link}</a>
        : <span className="text-textSecondary text-sm">-</span>,
    },
    {
      key: 'date',
      label: t('colDate'),
      render: (row) => <span className="text-textSecondary">{row.date || formatDate(row.createdAt, lang)}</span>,
    },
    {
      key: 'actions',
      label: t('colActions'),
      align: 'center',
      stopPropagation: true,
      render: (row) => (
        <>
          <button onClick={() => openResend(row)} className="text-success hover:underline text-sm cursor-pointer me-3">{t('resend')}</button>
          <button onClick={() => openEdit(row)} className="text-primary hover:underline text-sm cursor-pointer me-3">{t('edit')}</button>
          <button onClick={() => handleDelete(row.id)} className="text-danger hover:underline text-sm cursor-pointer">{t('delete')}</button>
        </>
      ),
    },
  ]

  return (
    <div className="pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-1">{t('notifications')}</h2>
          <p className="text-textSecondary text-sm">{t('notificationCount', { n: notifications.length })}</p>
        </div>
        <button
          onClick={openAdd}
          className="px-4 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary-dark transition cursor-pointer w-full sm:w-auto"
        >
          {t('newNotification')}
        </button>
      </div>

      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        emptyIcon="🔔"
        emptyTitle={t('noNotifications')}
        emptySubtitle={t('noNotificationsHint')}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
      />

      <BulkActionBar
        selectedCount={selectedIds.length}
        actions={[
          { label: t('deleteBulkLabel', { n: selectedIds.length }), onClick: handleBulkDelete, variant: 'danger' },
        ]}
      />

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingId ? t('editNotification') : t('newNotificationTitle')}
      >
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">{t('notifFieldTitle')}</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">{t('notifFieldMessage')}</label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
                rows={3}
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-textPrimary mb-1">{t('notifFieldLink')}</label>
              <input
                value={link}
                onChange={(e) => setLink(e.target.value)}
                type="url"
                placeholder="https://example.com"
                dir="ltr"
                className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-left"
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button
              type="submit"
              className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition cursor-pointer"
            >
              {editingId ? t('saveEdit') : t('sendNotification')}
            </button>
            <button
              type="button"
              onClick={closeForm}
              className="flex-1 py-2 bg-background text-textSecondary rounded-lg hover:bg-border transition cursor-pointer"
            >
              {t('cancel')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
