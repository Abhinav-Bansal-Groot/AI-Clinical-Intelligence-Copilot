import { useRef, useState, type DragEvent, type FormEvent } from 'react'
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

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Import Documents</h2>
        <p className="text-sm text-slate-500">
          Upload documents to the knowledge base.
        </p>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
            <CloudUpload className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">Upload PDFs</h3>
            <p className="text-xs text-slate-500">
              Supported documents: PDF (clinical guidelines, SOPs and policies).
            </p>
          </div>
        </div>

        <form onSubmit={handleUpload} className="space-y-3">
          <div
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            className={[
              'flex flex-col items-stretch gap-3 rounded-xl border-2 border-dashed px-4 py-8 transition sm:flex-row sm:items-center sm:justify-between sm:py-6',
              dragOver
                ? 'border-teal-500 bg-teal-50/60'
                : 'border-slate-200 bg-slate-50/60',
            ].join(' ')}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
              <CloudUpload className="h-5 w-5 text-teal-600" />
              <span className="font-medium">
                {selectedFiles.length > 0
                  ? `${selectedFiles.length} PDF${selectedFiles.length === 1 ? '' : 's'} selected`
                  : 'Drag & drop PDFs here'}
              </span>
              <span className="text-slate-400">or</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-teal-600 bg-white px-3 py-1.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
              >
                Choose Files
              </button>
              {selectedFiles.length > 0 ? (
                <button
                  type="button"
                  onClick={clearSelectedFiles}
                  disabled={uploading}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Clear all
                </button>
              ) : null}
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

            <button
              type="submit"
              disabled={selectedFiles.length === 0 || uploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
            >
              <Upload className="h-4 w-4" />
              {uploading
                ? 'Uploading…'
                : `Upload ${selectedFiles.length || ''} PDF${selectedFiles.length === 1 ? '' : 's'}`.trim()}
            </button>
          </div>

          {selectedFiles.length > 0 ? (
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
                    <p className="truncate text-sm font-medium text-slate-800">{file.name}</p>
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
          ) : null}

          {uploadItems.length > 0 ? (
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
          ) : null}
        </form>
      </section>
    </div>
  )
}
