'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface Rulebook {
  id: string
  title: string
  version_label: string | null
  status: 'processing' | 'ready' | 'failed' | 'archived'
  is_active: boolean
  effective_date: string | null
  uploaded_at: string
  page_count: number | null
  chunk_count: number | null
  processing_error: string | null
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/* ── SVG Icons ─────────────────────────────────────────────────────── */

function UploadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function AlertIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  )
}

function ArchiveIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="21 8 21 21 3 21 3 8" />
      <rect x="1" y="3" width="22" height="5" />
      <line x1="10" y1="12" x2="14" y2="12" />
    </svg>
  )
}

function RefreshIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
    </svg>
  )
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

/* ── Status Badge ──────────────────────────────────────────────────── */

function StatusBadge({ status }: { status: Rulebook['status'] }) {
  const styles: Record<string, string> = {
    processing: 'bg-status-yellow/20 text-status-yellow border-status-yellow/30',
    ready: 'bg-status-green/20 text-status-green border-status-green/30',
    failed: 'bg-status-red/20 text-status-red border-status-red/30',
    archived: 'bg-text-muted/20 text-text-muted border-text-muted/30',
  }
  const icons: Record<string, React.ReactNode> = {
    processing: <SpinnerIcon className="w-3 h-3" />,
    ready: <CheckIcon className="w-3 h-3" />,
    failed: <AlertIcon className="w-3 h-3" />,
    archived: <ArchiveIcon className="w-3 h-3" />,
  }

  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded border ${styles[status]}`}>
      {icons[status]}
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

/* ── Main Dashboard ────────────────────────────────────────────────── */

export default function RulebookAdminDashboard({ accessToken }: { accessToken: string | null }) {
  const authHeaders: HeadersInit = accessToken
    ? { Authorization: `Bearer ${accessToken}` }
    : {}

  const [rulebooks, setRulebooks] = useState<Rulebook[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState('')
  const [uploadError, setUploadError] = useState('')
  const [isActivating, setIsActivating] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [versionLabel, setVersionLabel] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  const fetchRulebooks = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/rulebooks/list', {
        headers: authHeaders,
      })
      if (res.ok) {
        const data = await res.json()
        setRulebooks(data.rulebooks || [])
      }
    } catch {
      // silently fail on poll
    }
  }, [accessToken]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchRulebooks()
  }, [fetchRulebooks])

  useEffect(() => {
    const hasProcessing = rulebooks.some((r) => r.status === 'processing')

    if (hasProcessing) {
      pollingRef.current = setInterval(fetchRulebooks, 5000)
    } else if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current)
    }
  }, [rulebooks, fetchRulebooks])

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') {
      setSelectedFile(file)
      if (!title) setTitle(file.name.replace(/\.pdf$/i, ''))
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      if (!title) setTitle(file.name.replace(/\.pdf$/i, ''))
    }
  }

  const handleUpload = async () => {
    if (!selectedFile || !title.trim()) return

    setIsUploading(true)
    setUploadProgress('Uploading PDF...')
    setUploadError('')

    const formData = new FormData()
    formData.append('file', selectedFile)
    formData.append('title', title.trim())
    if (versionLabel.trim()) formData.append('version_label', versionLabel.trim())

    try {
      const res = await fetch('/api/admin/rulebooks/upload', {
        method: 'POST',
        headers: authHeaders,
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setUploadError(data.error || 'Upload failed.')
        setUploadProgress('')
      } else {
        setUploadProgress('Upload complete. Processing started — the list will update automatically.')
        setSelectedFile(null)
        setTitle('')
        setVersionLabel('')
        if (fileInputRef.current) fileInputRef.current.value = ''
        fetchRulebooks()
      }
    } catch {
      setUploadError('Network error. Please try again.')
      setUploadProgress('')
    } finally {
      setIsUploading(false)
    }
  }

  const handleActivate = async (rulebookId: string) => {
    setIsActivating(rulebookId)
    try {
      const res = await fetch('/api/admin/rulebooks/activate', {
        method: 'POST',
        headers: { ...authHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ rulebook_id: rulebookId }),
      })

      if (res.ok) {
        await fetchRulebooks()
      }
    } catch {
      // ignore
    } finally {
      setIsActivating(null)
    }
  }

  return (
    <div className="max-w-4xl">
      {/* Upload Section */}
      <div className="bg-bg-card border border-border-default rounded-lg p-5 mb-8">
        <h2 className="section-header flex items-center gap-2 mb-4">
          <UploadIcon className="w-4 h-4 text-accent-orange" />
          Upload Rulebook
        </h2>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors mb-4 ${
            dragOver
              ? 'border-accent-orange bg-accent-orange-dim'
              : selectedFile
                ? 'border-status-green/50 bg-status-green/5'
                : 'border-border-subtle hover:border-text-muted'
          }`}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={handleFileSelect}
          />
          {selectedFile ? (
            <div className="flex items-center justify-center gap-3">
              <FileIcon className="w-8 h-8 text-status-green" />
              <div className="text-left">
                <p className="text-text-primary text-sm font-medium">{selectedFile.name}</p>
                <p className="text-text-muted text-xs">
                  {(selectedFile.size / 1024 / 1024).toFixed(1)} MB — click to change
                </p>
              </div>
            </div>
          ) : (
            <>
              <UploadIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <p className="text-text-secondary text-sm">
                Drag & drop a PDF here, or <span className="text-accent-orange">click to browse</span>
              </p>
              <p className="text-text-muted text-xs mt-1">PDF only, 15 MB max</p>
            </>
          )}
        </div>

        {/* Title and Version */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-text-secondary text-xs uppercase tracking-wider mb-1 block">
              Title <span className="text-accent-orange">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. 2026 Series Rulebook"
              className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent-orange"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs uppercase tracking-wider mb-1 block">
              Version Label
            </label>
            <input
              type="text"
              value={versionLabel}
              onChange={(e) => setVersionLabel(e.target.value)}
              placeholder="e.g. v2026.1"
              className="w-full bg-bg-elevated border border-border-subtle rounded px-3 py-2 text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent-orange"
            />
          </div>
        </div>

        {/* Upload button */}
        <button
          onClick={handleUpload}
          disabled={isUploading || !selectedFile || !title.trim()}
          className="px-4 py-2 bg-accent-orange text-white text-sm font-semibold rounded hover:bg-accent-amber transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isUploading ? (
            <>
              <SpinnerIcon className="w-4 h-4" />
              Uploading...
            </>
          ) : (
            <>
              <UploadIcon className="w-4 h-4" />
              Upload & Process
            </>
          )}
        </button>

        {/* Status messages */}
        {uploadProgress && (
          <p className="text-status-green text-sm mt-3 flex items-center gap-2">
            <CheckIcon className="w-4 h-4" />
            {uploadProgress}
          </p>
        )}
        {uploadError && (
          <p className="text-status-red text-sm mt-3 flex items-center gap-2">
            <AlertIcon className="w-4 h-4" />
            {uploadError}
          </p>
        )}
      </div>

      {/* Rulebook List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header flex items-center gap-2">
            <FileIcon className="w-4 h-4 text-accent-orange" />
            Rulebooks
          </h2>
          <button
            onClick={fetchRulebooks}
            className="p-2 text-text-muted hover:text-text-primary transition-colors rounded hover:bg-bg-hover cursor-pointer"
            title="Refresh"
          >
            <RefreshIcon className="w-4 h-4" />
          </button>
        </div>

        {rulebooks.length === 0 ? (
          <div className="bg-bg-card border border-border-default rounded-lg text-center py-12">
            <FileIcon className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <p className="text-text-muted text-sm">No rulebooks uploaded yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {rulebooks.map((rb) => (
              <div
                key={rb.id}
                className="bg-bg-card border border-border-default rounded-lg p-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-text-primary font-medium text-sm">{rb.title}</h3>
                      {rb.version_label && (
                        <span className="text-text-muted text-xs">({rb.version_label})</span>
                      )}
                      <StatusBadge status={rb.status} />
                      {rb.is_active && (
                        <span className="inline-flex items-center text-xs font-bold px-2 py-0.5 rounded bg-accent-orange-dim text-accent-orange border border-accent-orange/30 uppercase tracking-wider">
                          Active
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {formatDate(rb.uploaded_at)}
                      </span>
                      {rb.page_count != null && (
                        <span>{rb.page_count} pages</span>
                      )}
                      {rb.chunk_count != null && (
                        <span>{rb.chunk_count} chunks</span>
                      )}
                    </div>

                    {rb.status === 'failed' && rb.processing_error && (
                      <p className="text-status-red/80 text-xs mt-2 bg-status-red/10 rounded px-2 py-1 border border-status-red/20">
                        Error: {rb.processing_error}
                      </p>
                    )}
                  </div>

                  {/* Activate button */}
                  {rb.status === 'ready' && !rb.is_active && (
                    <button
                      onClick={() => handleActivate(rb.id)}
                      disabled={isActivating === rb.id}
                      className="flex-shrink-0 text-xs font-medium uppercase tracking-wider px-4 py-2 rounded bg-accent-orange-dim text-accent-orange border border-accent-orange/30 hover:bg-accent-orange hover:text-white transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {isActivating === rb.id ? (
                        <span className="flex items-center gap-1">
                          <SpinnerIcon className="w-3 h-3" />
                          Activating...
                        </span>
                      ) : (
                        'Activate'
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
