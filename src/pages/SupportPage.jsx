import { useState, useEffect } from 'react'
import {
  collection,
  getDocs,
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
import FilterBar from '../components/FilterBar'
import SearchInput from '../components/SearchInput'
import BulkActionBar from '../components/BulkActionBar'

function formatDate(ts, lang) {
  if (!ts) return '-'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SupportPage() {
  const { t, lang } = useTranslation()

  const statusOptions = [
    { value: 'new', label: t('statusNew'), bg: 'bg-blue-50', text: 'text-blue-600' },
    { value: 'in-progress', label: t('statusInProgress'), bg: 'bg-yellow-50', text: 'text-yellow-600' },
    { value: 'done', label: t('statusDone'), bg: 'bg-green-50', text: 'text-success' },
  ]

  function getStatusInfo(value) {
    return statusOptions.find(s => s.value === value) || statusOptions[0]
  }

  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [selectedMessage, setSelectedMessage] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedIds, setSelectedIds] = useState([])
  const [replyText, setReplyText] = useState('')
  const [replying, setReplying] = useState(false)
  const PAGE_SIZE = 10

  const colRef = collection(db, 'supportMessages')

  async function loadData() {
    setLoading(true)
    try {
      const q = query(colRef, orderBy('createdAt', 'desc'))
      const snap = await getDocs(q)
      setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() })))
    } catch {
      setMessages([])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  async function handleStatusChange(id, newStatus) {
    await updateDoc(doc(db, 'supportMessages', id), { status: newStatus })
    loadData()
  }

  async function handleDelete(id) {
    if (!confirm(t('confirmDeleteMessage'))) return
    await deleteDoc(doc(db, 'supportMessages', id))
    if (selectedMessage?.id === id) setSelectedMessage(null)
    loadData()
  }

  async function handleBulkDelete() {
    if (!confirm(t('confirmBulkDeleteMessages', { n: selectedIds.length }))) return
    const batch = writeBatch(db)
    selectedIds.forEach(id => batch.delete(doc(db, 'supportMessages', id)))
    await batch.commit()
    setSelectedIds([])
    loadData()
  }

  async function handleBulkStatusChange(newStatus) {
    const batch = writeBatch(db)
    selectedIds.forEach(id => batch.update(doc(db, 'supportMessages', id), { status: newStatus }))
    await batch.commit()
    setSelectedIds([])
    loadData()
  }

  async function handleReply() {
    if (!replyText.trim() || !selectedMessage) return
    setReplying(true)
    const updates = {
      adminReply: replyText.trim(),
      repliedAt: Timestamp.now(),
      repliedBy: localStorage.getItem('adminName') || (lang === 'ar' ? 'مدير' : 'Admin'),
    }
    if (selectedMessage.status === 'new') {
      updates.status = 'in-progress'
    }
    await updateDoc(doc(db, 'supportMessages', selectedMessage.id), updates)
    setSelectedMessage({ ...selectedMessage, ...updates, repliedAt: new Date() })
    setReplyText('')
    setReplying(false)
    loadData()
  }

  function openDetail(msg) {
    setSelectedMessage(msg)
    setReplyText('')
  }

  const filtered = messages
    .filter(m => activeTab === 'all' || m.status === activeTab)
    .filter(m => {
      if (!searchQuery) return true
      const q = searchQuery.toLowerCase()
      return (
        (m.title || '').toLowerCase().includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.message || '').toLowerCase().includes(q)
      )
    })

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)

  const columns = [
    {
      key: 'title',
      label: t('colTitle'),
      render: (row) => (
        <span className="font-medium text-textPrimary flex items-center gap-2">
          {row.adminReply && <span className="inline-block w-2 h-2 rounded-full bg-success shrink-0" title={t('replied')} />}
          {row.title || '-'}
        </span>
      ),
    },
    { key: 'email', label: t('colEmail'), className: 'text-textSecondary', render: (row) => <span dir="ltr">{row.email || '-'}</span> },
    { key: 'message', label: t('colMessage'), className: 'text-textSecondary max-w-[200px] truncate', render: (row) => row.message || '-' },
    {
      key: 'status',
      label: t('colStatus'),
      render: (row) => {
        const status = getStatusInfo(row.status)
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>{status.label}</span>
      },
    },
    { key: 'createdAt', label: t('colDate'), render: (row) => <span className="text-textSecondary">{formatDate(row.createdAt, lang)}</span> },
    {
      key: 'actions',
      label: t('colActions'),
      align: 'center',
      stopPropagation: true,
      render: (row) => (
        <>
          <select
            value={row.status || 'new'}
            onChange={e => handleStatusChange(row.id, e.target.value)}
            className="px-2 py-1 border border-border rounded-lg bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer me-2"
          >
            {statusOptions.map(s => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button onClick={() => handleDelete(row.id)} className="text-danger hover:underline cursor-pointer">{t('delete')}</button>
        </>
      ),
    },
  ]

  return (
    <div className="pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-1">{t('supportTitle')}</h2>
          <p className="text-textSecondary text-sm">{t('messageCount', { n: messages.length })}</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={searchQuery}
            onChange={v => { setSearchQuery(v); setCurrentPage(1) }}
            placeholder={t('searchSupport')}
          />
        </div>
        <FilterBar
          filters={[
            { key: 'all', label: t('filterAll'), count: messages.length },
            { key: 'new', label: t('statusNew'), count: messages.filter(m => m.status === 'new').length },
            { key: 'in-progress', label: t('statusInProgress'), count: messages.filter(m => m.status === 'in-progress').length },
            { key: 'done', label: t('statusDone'), count: messages.filter(m => m.status === 'done').length },
          ]}
          activeKey={activeTab}
          onChange={k => { setActiveTab(k); setCurrentPage(1) }}
        />
      </div>

      <DataTable
        columns={columns}
        data={paginated}
        loading={loading}
        emptyIcon="📩"
        emptyTitle={t('noMessages')}
        emptySubtitle={t('noMessagesHint')}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        onRowClick={openDetail}
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
          { label: t('statusDone'), onClick: () => handleBulkStatusChange('done') },
          { label: t('statusInProgress'), onClick: () => handleBulkStatusChange('in-progress') },
        ]}
      />

      <Modal
        open={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        title={t('messageDetails')}
      >
        {selectedMessage && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">{t('colTitle')}</label>
                <p className="text-textPrimary">{selectedMessage.title || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">{t('fieldEmail')}</label>
                <p className="text-textPrimary" dir="ltr">{selectedMessage.email || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">{t('fieldMessage')}</label>
                <p className="text-textPrimary whitespace-pre-wrap">{selectedMessage.message || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">{t('fieldStatus')}</label>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusInfo(selectedMessage.status).bg} ${getStatusInfo(selectedMessage.status).text}`}>
                  {getStatusInfo(selectedMessage.status).label}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">{t('fieldDate')}</label>
                <p className="text-textPrimary">{formatDate(selectedMessage.createdAt, lang)}</p>
              </div>

              {/* Existing reply */}
              {selectedMessage.adminReply && (
                <div className="bg-primary-light rounded-lg p-4 border border-primary/20">
                  <label className="block text-sm font-medium text-primary mb-1">{t('adminReply')}</label>
                  <p className="text-textPrimary whitespace-pre-wrap">{selectedMessage.adminReply}</p>
                  <p className="text-xs text-textSecondary mt-2">
                    {selectedMessage.repliedBy} — {formatDate(selectedMessage.repliedAt, lang)}
                  </p>
                </div>
              )}

              {/* Reply textarea */}
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">
                  {selectedMessage.adminReply ? t('editReply') : t('writeReply')}
                </label>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={3}
                  placeholder={t('replyPlaceholder')}
                  className="w-full px-3 py-2 border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary resize-none text-sm"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleReply}
                disabled={!replyText.trim() || replying}
                className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition cursor-pointer disabled:opacity-50"
              >
                {replying ? t('sending') : t('sendReply')}
              </button>
              <select
                value={selectedMessage.status || 'new'}
                onChange={e => {
                  handleStatusChange(selectedMessage.id, e.target.value)
                  setSelectedMessage({ ...selectedMessage, status: e.target.value })
                }}
                className="flex-1 py-2 px-3 border border-border rounded-lg bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer"
              >
                {statusOptions.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
