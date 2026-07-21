import { useRef, useState, type DragEvent, type FormEvent } from 'react'
import {
  CheckCircle2,
  CloudUpload,
  FileText,
  Upload,
  X,
} from 'lucide-react'
import { ApiError } from '../api/client'
import { uploadKnowledgePdf } from '../api/knowledge'
import { useAuth } from '../auth/AuthContext'

type UploadedFileInfo = {
  name: string
  sizeLabel: string
  progress: number
  done: boolean
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ImportDocumentsPage() {
  const { token } = useAuth()
  const [error, setError] = useState('')
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadInfo, setUploadInfo] = useState<UploadedFileInfo | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const clearSelectedFile = () => {
    setSelectedFile(null)
    setUploadInfo(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const pickFile = (file: File | null) => {
    if (!file) return
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF uploads are supported.')
      return
    }
    setError('')
    setSelectedFile(file)
    setUploadInfo(null)
  }

  const handleUpload = async (event?: FormEvent) => {
    event?.preventDefault()
    if (!token || !selectedFile || uploading) return

    setUploading(true)
    setError('')
    setUploadInfo({
      name: selectedFile.name,
      sizeLabel: formatFileSize(selectedFile.size),
      progress: 35,
      done: false,
    })

    try {
      const result = await uploadKnowledgePdf(token, selectedFile)
      setUploadInfo({
        name: selectedFile.name,
        sizeLabel: `${formatFileSize(selectedFile.size)} · ${result.indexed_chunks} chunks`,
        progress: 100,
        done: true,
      })
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch (err) {
      setUploadInfo(null)
      setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (event: DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    pickFile(event.dataTransfer.files?.[0] ?? null)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-900">Import Documents</h2>
        <p className="text-sm text-slate-500">
          Upload clinical guidelines, SOPs, and protocols to the knowledge base.
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
            <h3 className="text-base font-semibold text-slate-900">Upload PDF</h3>
            <p className="text-xs text-slate-500">
              Supported format: PDF (clinical guidelines, SOPs, protocols)
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
              {selectedFile ? (
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 font-medium text-teal-900">
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{selectedFile.name}</span>
                  <button
                    type="button"
                    onClick={clearSelectedFile}
                    disabled={uploading}
                    className="ml-0.5 rounded-md p-0.5 text-teal-700 transition hover:bg-teal-100 hover:text-teal-950 disabled:opacity-50"
                    aria-label="Remove selected PDF"
                    title="Remove selected PDF"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </span>
              ) : (
                <span className="font-medium">Drag & drop your PDF here</span>
              )}
              <span className="text-slate-400">or</span>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-teal-600 bg-white px-3 py-1.5 text-sm font-semibold text-teal-700 transition hover:bg-teal-50"
              >
                Choose File
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(event) => pickFile(event.target.files?.[0] ?? null)}
              />
            </div>

            <button
              type="submit"
              disabled={!selectedFile || uploading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60 sm:shrink-0"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload PDF'}
            </button>
          </div>

          {uploadInfo ? (
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 text-red-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {uploadInfo.name}
                    </p>
                    <div className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
                      {uploadInfo.done ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
                      {uploadInfo.progress}%
                    </div>
                  </div>
                  <p className="text-xs text-slate-500">{uploadInfo.sizeLabel}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-teal-500 transition-all"
                      style={{ width: `${uploadInfo.progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </form>
      </section>

    </div>
  )
}
