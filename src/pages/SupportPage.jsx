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
import Modal from '../components/Modal'
import DataTable from '../components/DataTable'
import Pagination from '../components/Pagination'
import FilterBar from '../components/FilterBar'
import SearchInput from '../components/SearchInput'
import BulkActionBar from '../components/BulkActionBar'

const statusOptions = [
  { value: 'new', label: 'جديدة', bg: 'bg-blue-50', text: 'text-blue-600' },
  { value: 'in-progress', label: 'قيد المعالجة', bg: 'bg-yellow-50', text: 'text-yellow-600' },
  { value: 'done', label: 'تم الحل', bg: 'bg-green-50', text: 'text-success' },
]

function getStatusInfo(value) {
  return statusOptions.find(s => s.value === value) || statusOptions[0]
}

function formatDate(ts) {
  if (!ts) return '-'
  const date = ts.toDate ? ts.toDate() : new Date(ts)
  return date.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function SupportPage() {
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
    if (!confirm('هل أنت متأكد من حذف هذه الرسالة؟')) return
    await deleteDoc(doc(db, 'supportMessages', id))
    if (selectedMessage?.id === id) setSelectedMessage(null)
    loadData()
  }

  async function handleBulkDelete() {
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.length} رسالة؟`)) return
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
      repliedBy: localStorage.getItem('adminName') || 'مدير',
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
      label: 'العنوان',
      render: (row) => (
        <span className="font-medium text-textPrimary flex items-center gap-2">
          {row.adminReply && <span className="inline-block w-2 h-2 rounded-full bg-success shrink-0" title="تم الرد" />}
          {row.title || '-'}
        </span>
      ),
    },
    { key: 'email', label: 'البريد', className: 'text-textSecondary', render: (row) => <span dir="ltr">{row.email || '-'}</span> },
    { key: 'message', label: 'الرسالة', className: 'text-textSecondary max-w-[200px] truncate', render: (row) => row.message || '-' },
    {
      key: 'status',
      label: 'الحالة',
      render: (row) => {
        const status = getStatusInfo(row.status)
        return <span className={`px-2 py-1 rounded-full text-xs font-medium ${status.bg} ${status.text}`}>{status.label}</span>
      },
    },
    { key: 'createdAt', label: 'التاريخ', render: (row) => <span className="text-textSecondary">{formatDate(row.createdAt)}</span> },
    {
      key: 'actions',
      label: 'إجراءات',
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
          <button onClick={() => handleDelete(row.id)} className="text-danger hover:underline cursor-pointer">حذف</button>
        </>
      ),
    },
  ]

  return (
    <div className="pb-16">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-primary mb-1">الدعم الفني</h2>
          <p className="text-textSecondary text-sm">{messages.length} رسالة</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="flex-1 max-w-sm">
          <SearchInput
            value={searchQuery}
            onChange={v => { setSearchQuery(v); setCurrentPage(1) }}
            placeholder="بحث بالعنوان، البريد، الرسالة..."
          />
        </div>
        <FilterBar
          filters={[
            { key: 'all', label: 'الكل', count: messages.length },
            { key: 'new', label: 'الجديدة', count: messages.filter(m => m.status === 'new').length },
            { key: 'in-progress', label: 'قيد المعالجة', count: messages.filter(m => m.status === 'in-progress').length },
            { key: 'done', label: 'تم الحل', count: messages.filter(m => m.status === 'done').length },
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
        emptyTitle="لا توجد رسائل"
        emptySubtitle="لم يتم استلام أي رسائل دعم بعد"
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
          { label: `حذف (${selectedIds.length})`, onClick: handleBulkDelete, variant: 'danger' },
          { label: 'تم الحل', onClick: () => handleBulkStatusChange('done') },
          { label: 'قيد المعالجة', onClick: () => handleBulkStatusChange('in-progress') },
        ]}
      />

      <Modal
        open={!!selectedMessage}
        onClose={() => setSelectedMessage(null)}
        title="تفاصيل الرسالة"
      >
        {selectedMessage && (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">العنوان</label>
                <p className="text-textPrimary">{selectedMessage.title || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">البريد الإلكتروني</label>
                <p className="text-textPrimary" dir="ltr">{selectedMessage.email || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">الرسالة</label>
                <p className="text-textPrimary whitespace-pre-wrap">{selectedMessage.message || '-'}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">الحالة</label>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusInfo(selectedMessage.status).bg} ${getStatusInfo(selectedMessage.status).text}`}>
                  {getStatusInfo(selectedMessage.status).label}
                </span>
              </div>
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">التاريخ</label>
                <p className="text-textPrimary">{formatDate(selectedMessage.createdAt)}</p>
              </div>

              {/* Existing reply */}
              {selectedMessage.adminReply && (
                <div className="bg-primary-light rounded-lg p-4 border border-primary/20">
                  <label className="block text-sm font-medium text-primary mb-1">رد المدير</label>
                  <p className="text-textPrimary whitespace-pre-wrap">{selectedMessage.adminReply}</p>
                  <p className="text-xs text-textSecondary mt-2">
                    {selectedMessage.repliedBy} — {formatDate(selectedMessage.repliedAt)}
                  </p>
                </div>
              )}

              {/* Reply textarea */}
              <div>
                <label className="block text-sm font-medium text-textSecondary mb-1">
                  {selectedMessage.adminReply ? 'تعديل الرد' : 'كتابة رد'}
                </label>
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  rows={3}
                  placeholder="اكتب ردك هنا..."
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
                {replying ? 'جاري الإرسال...' : 'إرسال الرد'}
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
