import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react'
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  Trash2,
  Upload,
} from 'lucide-react'
import { ApiError } from '../api/client'
import { uploadKnowledgePdfs } from '../api/knowledge'
import { useAuth } from '../auth/AuthContext'

type UploadItem = {
  id: string
  file: File
  sizeLabel: string
  progress: number
  done: boolean
  error?: string
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function ImportDocumentsPage() {
  const { token } = useAuth()
  const [error, setError] = useState('')
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [uploadItems, setUploadItems] = useState<UploadItem[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const clearStatusTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (clearStatusTimeoutRef.current != null) {
        window.clearTimeout(clearStatusTimeoutRef.current)
      }
    }
  }, [])

  const clearSelectedFiles = () => {
    setSelectedFiles([])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const addFiles = (incoming: FileList | File[] | null) => {
    if (!incoming) return
    const list = Array.from(incoming)
    const pdfs = list.filter((file) => file.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length === 0) {
      setError('Only PDF uploads are supported.')
      return
    }
    if (pdfs.length !== list.length) {
      setError('Some files were skipped because only PDF uploads are supported.')
    } else {
      setError('')
    }

    setSelectedFiles((prev) => {
      const existing = new Set(prev.map((file) => `${file.name}:${file.size}`))
      const next = [...prev]
      for (const file of pdfs) {
        const key = `${file.name}:${file.size}`
        if (!existing.has(key)) {
          next.push(file)
          existing.add(key)
        }
      }
      return next
    })
    setUploadItems([])
  }

  const handleUpload = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token || selectedFiles.length === 0 || uploading) return

    setUploading(true)
    setError('')
    if (clearStatusTimeoutRef.current != null) {
      window.clearTimeout(clearStatusTimeoutRef.current)
      clearStatusTimeoutRef.current = null
    }
    setUploadItems(
      selectedFiles.map((file) => ({
        id: createId(),
        file,
        sizeLabel: formatFileSize(file.size),
        progress: 35,
        done: false,
      })),
    )

    try {
      const result = await uploadKnowledgePdfs(token, selectedFiles)
      setUploadItems(
        selectedFiles.map((file) => ({
          id: createId(),
          file,
          sizeLabel: `${formatFileSize(file.size)} · ${result.indexed_chunks} total chunks indexed`,
          progress: 100,
          done: true,
        })),
      )
      setError('')
      setSelectedFiles([])
      if (fileInputRef.current) fileInputRef.current.value = ''

      clearStatusTimeoutRef.current = window.setTimeout(() => {
        setUploadItems([])
        clearStatusTimeoutRef.current = null
      }, 2000)
    } catch (err) {
      setUploadItems([])
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    addFiles(event.dataTransfer.files)
  }

  const hasFiles = selectedFiles.length > 0 || uploadItems.length > 0

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Import Documents</h2>
        <p className="text-sm text-slate-500">
          Upload clinical guidelines, SOPs, and policies to the knowledge base.
        </p>
      </div>

      {error ? (
        <div className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex shrink-0 items-start gap-3 border-b border-slate-200 bg-slate-800 px-4 py-3 sm:px-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-teal-300">
            <CloudUpload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Upload PDFs</h3>
            <p className="text-xs text-slate-300">
              Supported format: PDF. You can select or drag multiple files at once.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleUpload}
          className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5"
        >
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={[
              'flex min-h-[220px] flex-1 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition',
              dragOver
                ? 'border-teal-500 bg-teal-50/70'
                : 'border-slate-200 bg-slate-50/80',
            ].join(' ')}
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-100 text-teal-700">
              <CloudUpload className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <p className="text-base font-semibold text-slate-800">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} PDF${selectedFiles.length === 1 ? '' : 's'} selected`
                  : 'Drag & drop PDFs here'}
              </p>
              <p className="text-sm text-slate-500">
                or choose files from your computer to index into Knowledge Assistant
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-xl border border-teal-600 bg-white px-4 py-2.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
              >
                Choose Files
              </button>
              {selectedFiles.length > 0 ? (
                <button
                  type="button"
                  onClick={clearSelectedFiles}
                  disabled={uploading}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear all
                </button>
              ) : null}
              <button
                type="submit"
                disabled={selectedFiles.length === 0 || uploading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Upload className="h-4 w-4" />
                {uploading
                  ? 'Uploading…'
                  : `Upload ${selectedFiles.length || ''} PDF${selectedFiles.length === 1 ? '' : 's'}`.trim()}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(event) => {
                  addFiles(event.target.files)
                  event.target.value = ''
                }}
              />
            </div>
          </div>

          {hasFiles ? (
            <div className="grid max-h-[40%] min-h-0 gap-4 overflow-y-auto lg:grid-cols-2">
              {selectedFiles.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Selected ({selectedFiles.length})
                  </p>
                  <ul className="space-y-2">
                    {selectedFiles.map((file, index) => (
                      <li
                        key={`${file.name}-${file.size}-${index}`}
                        className="flex items-center gap-3 rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {file.name}
                          </p>
                          <p className="text-xs text-slate-500">{formatFileSize(file.size)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSelectedFile(index)}
                          disabled={uploading}
                          className="rounded-md p-1 text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                          aria-label={`Remove ${file.name}`}
                          title="Remove"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {uploadItems.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                    Upload status
                  </p>
                  <ul className="space-y-2">
                    {uploadItems.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                            <FileText className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="truncate text-sm font-medium text-slate-800">
                                {item.file.name}
                              </p>
                              <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                                {item.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                                {item.progress}%
                              </div>
                            </div>
                            <p className="text-xs text-slate-500">{item.sizeLabel}</p>
                            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className="h-full rounded-full bg-teal-500 transition-all"
                                style={{ width: `${item.progress}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </form>
      </section>
    </div>
  )
}
