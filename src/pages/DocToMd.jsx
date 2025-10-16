import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Progress } from '@/components/ui/progress.jsx'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import { importFileToMarkdown, isSupportedImportFile } from '@/lib/importers/index.js'
import { 
  Home, Upload, FileText, Trash2, Copy, FileDown, CheckCircle2, XCircle, Loader2, FolderPlus 
} from 'lucide-react'

// Все комментарии и сообщения — на русском языке.

export default function DocToMd() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)

  const [queueItems, setQueueItems] = useState([])
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrEnabled, setOcrEnabled] = useState(false)

  // Ограничения согласно требованиям
  const MAX_FILES = 100
  const MAX_SIZE = 50 * 1024 * 1024 // 50 МБ

  const selectedItem = useMemo(
    () => queueItems.find((q) => q.id === selectedItemId) || null,
    [queueItems, selectedItemId]
  )

  const overallProgress = useMemo(() => {
    if (queueItems.length === 0) return 0
    const sum = queueItems.reduce((acc, it) => acc + (it.progress || 0), 0)
    return Math.round(sum / queueItems.length)
  }, [queueItems])

  const handleOpenFileDialog = () => {
    try {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
        fileInputRef.current.click()
      }
    } catch (error) {
      console.error('Ошибка при открытии диалога выбора файла:', error)
    }
  }

  const createQueueItem = (file) => ({
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
    name: file.name,
    size: file.size,
    status: 'pending', // pending | processing | done | error
    progress: 0,
    markdown: '',
    warnings: [],
    errorMessage: ''
  })

  const addFilesToQueue = useCallback((filesList) => {
    const arr = Array.from(filesList || [])
    if (arr.length === 0) return

    const currentCount = queueItems.length
    const allowedCount = Math.max(0, MAX_FILES - currentCount)
    const take = arr.slice(0, allowedCount)

    const accepted = []
    const rejected = []
    for (const file of take) {
      const isDocxOrSupported = /\.docx$/i.test(file.name) || /\.doc$/i.test(file.name)
      if (!isDocxOrSupported) {
        rejected.push(`${file.name}: формат не поддерживается этой страницей (разрешены .docx/.doc)`) 
        continue
      }
      if (file.size > MAX_SIZE) {
        rejected.push(`${file.name}: превышает лимит 50 МБ`)
        continue
      }
      accepted.push(file)
    }

    if (rejected.length) {
      toast.error(`Отклонено файлов: ${rejected.length}. Подробности в консоли.`)
      console.warn('Причины отклонения файлов:', rejected)
    }

    if (accepted.length === 0) return

    const items = accepted.map(createQueueItem)
    setQueueItems((prev) => {
      const next = [...prev, ...items]
      if (!selectedItemId && next.length > 0) {
        setSelectedItemId(next[0].id)
      }
      return next
    })
  }, [MAX_FILES, MAX_SIZE, selectedItemId, queueItems.length])

  const onFileChange = (e) => {
    try {
      const files = e.target.files
      if (!files || files.length === 0) return
      addFilesToQueue(files)
    } catch (error) {
      console.error('Ошибка при выборе файлов:', error)
    }
  }

  const handleDragOver = (e) => {
    try {
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
      setIsDragging(true)
    } catch (error) {
      console.error('Ошибка dragover:', error)
    }
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e) => {
    try {
      e.preventDefault()
      setIsDragging(false)
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      addFilesToQueue(files)
    } catch (error) {
      console.error('Ошибка при drop:', error)
    }
  }

  const runMarkdownLint = async (markdownText) => {
    // Используем пакет markdownlint и синхронный API .sync для строки
    try {
      const mod = await import('markdownlint')
      const markdownlint = mod?.default ?? mod
      const options = {
        strings: { 'content.md': String(markdownText ?? '') },
        config: { default: true }
      }
      const result = markdownlint?.sync ? markdownlint.sync(options) : null
      const issues = result && result['content.md'] ? result['content.md'] : []
      if (!issues || !Array.isArray(issues)) return []
      return issues.map((it) => {
        const line = it.lineNumber ? `:${it.lineNumber}` : ''
        const rule = Array.isArray(it.ruleNames) ? it.ruleNames.join('/') : String(it.ruleNames || '')
        const detail = it.errorDetail ? ` — ${it.errorDetail}` : ''
        return `Строка${line} [${rule}]${detail}`
      })
    } catch (error) {
      console.warn('Markdownlint недоступен или произошла ошибка:', error)
      return []
    }
  }

  const applyOcrToMarkdownImages = async (markdownText) => {
    // Экспериментальная функция: распознаёт текст на встроенных изображениях (data URL) и добавляет в alt
    try {
      if (!ocrEnabled) return markdownText
      const matchAll = [...String(markdownText ?? '').matchAll(/!\[([^\]]*)\]\((data:[^)]+)\)/g)]
      if (matchAll.length === 0) return markdownText

      const TesseractModule = await import('tesseract.js')
      const Tesseract = TesseractModule?.default ?? TesseractModule

      let updated = String(markdownText)
      for (let i = 0; i < matchAll.length; i += 1) {
        const m = matchAll[i]
        const full = m[0]
        const alt = m[1]
        const url = m[2]
        try {
          const res = await Tesseract.recognize(url, 'rus+eng')
          const text = (res?.data?.text || '').trim().replace(/\s+/g, ' ')
          if (text) {
            const replacement = `![${text}](${url})`
            updated = updated.replace(full, replacement)
          }
        } catch (e) {
          console.warn('Ошибка OCR для изображения, оставляем без изменений:', e)
        }
      }
      return updated
    } catch (error) {
      console.warn('OCR недоступен, пропускаем:', error)
      return markdownText
    }
  }

  const processItem = async (item) => {
    // В этой реализации мы повторно читаем файл через FileSystem API недоступно; храним сам File в item не можем — мы храним только метаданные
    // Поэтому мы будем использовать File из input напрямую: переделаем добавление — будем хранить File в item
  }

  // Переделаем: храним File внутри элемента очереди
  const addFilesToQueueWithFile = useCallback((filesList) => {
    const arr = Array.from(filesList || [])
    if (arr.length === 0) return

    const currentCount = queueItems.length
    const allowedCount = Math.max(0, MAX_FILES - currentCount)
    const take = arr.slice(0, allowedCount)

    const accepted = []
    const rejected = []
    for (const file of take) {
      const isDocxOrSupported = /\.docx$/i.test(file.name) || /\.doc$/i.test(file.name)
      if (!isDocxOrSupported) {
        rejected.push(`${file.name}: формат не поддерживается этой страницей (разрешены .docx/.doc)`) 
        continue
      }
      if (file.size > MAX_SIZE) {
        rejected.push(`${file.name}: превышает лимит 50 МБ`)
        continue
      }
      accepted.push(file)
    }

    if (rejected.length) {
      toast.error(`Отклонено файлов: ${rejected.length}. Подробности в консоли.`)
      console.warn('Причины отклонения файлов:', rejected)
    }

    if (accepted.length === 0) return

    const items = accepted.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      status: 'pending',
      progress: 0,
      markdown: '',
      warnings: [],
      errorMessage: '',
      file
    }))

    setQueueItems((prev) => {
      const next = [...prev, ...items]
      if (!selectedItemId && next.length > 0) {
        setSelectedItemId(next[0].id)
      }
      return next
    })
  }, [MAX_FILES, MAX_SIZE, selectedItemId, queueItems.length])

  // Заменим использующие addFilesToQueue на новую функцию
  const onFileChange2 = (e) => {
    try {
      const files = e.target.files
      if (!files || files.length === 0) return
      addFilesToQueueWithFile(files)
    } catch (error) {
      console.error('Ошибка при выборе файлов:', error)
    }
  }

  const handleDrop2 = (e) => {
    try {
      e.preventDefault()
      setIsDragging(false)
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      addFilesToQueueWithFile(files)
    } catch (error) {
      console.error('Ошибка при drop:', error)
    }
  }

  const processQueueSequentially = useCallback(async () => {
    if (isProcessing) return
    const pending = queueItems.filter((q) => q.status === 'pending' || q.status === 'error')
    if (pending.length === 0) return
    setIsProcessing(true)
    try {
      for (const q of pending) {
        setQueueItems((prev) => prev.map((it) => it.id === q.id ? { ...it, status: 'processing', progress: 10 } : it))
        try {
          // Конвертация DOCX → Markdown через общий импортёр
          const { markdown, warnings } = await importFileToMarkdown(q.file, { fallbackToPlainText: false })
          setQueueItems((prev) => prev.map((it) => it.id === q.id ? { ...it, progress: 70 } : it))

          // OCR (опционально)
          const mdAfterOcr = await applyOcrToMarkdownImages(markdown)
          setQueueItems((prev) => prev.map((it) => it.id === q.id ? { ...it, progress: 85 } : it))

          // Markdownlint (best-effort)
          const lintWarnings = await runMarkdownLint(mdAfterOcr)

          setQueueItems((prev) => prev.map((it) => it.id === q.id ? {
            ...it,
            status: 'done',
            progress: 100,
            markdown: mdAfterOcr,
            warnings: [...(warnings || []), ...lintWarnings]
          } : it))
        } catch (error) {
          console.error('Ошибка обработки файла:', q.name, error)
          setQueueItems((prev) => prev.map((it) => it.id === q.id ? {
            ...it,
            status: 'error',
            progress: 100,
            errorMessage: String(error?.message || error)
          } : it))
        }
      }
    } finally {
      setIsProcessing(false)
    }
  }, [applyOcrToMarkdownImages, isProcessing, queueItems, runMarkdownLint])

  useEffect(() => {
    // Автозапуск обработки при добавлении новых элементов в статусе pending
    if (queueItems.some((q) => q.status === 'pending') && !isProcessing) {
      processQueueSequentially()
    }
  }, [queueItems, isProcessing, processQueueSequentially])

  const handleCopyMarkdown = async (text) => {
    try {
      if (!text) {
        toast.error('Нет текста для копирования')
        return
      }
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        toast.success('Скопировано в буфер обмена')
        return
      }
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const ok = document.execCommand('copy')
      document.body.removeChild(textarea)
      if (ok) toast.success('Скопировано в буфер обмена')
      else toast.error('Не удалось скопировать')
    } catch (error) {
      console.error('Ошибка копирования:', error)
      toast.error('Ошибка при копировании')
    }
  }

  const downloadAsMd = (name, text) => {
    try {
      const fileName = `${String(name || 'document').replace(/\.[^.]+$/, '')}.md`
      const blob = new Blob([String(text ?? '')], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка скачивания .md:', error)
      toast.error('Ошибка скачивания .md')
    }
  }

  const downloadAllAsZip = async () => {
    try {
      const done = queueItems.filter((q) => q.status === 'done' && q.markdown)
      if (done.length === 0) {
        toast.error('Нет готовых файлов для архивации')
        return
      }
      const JSZipModule = await import('jszip')
      const JSZip = JSZipModule?.default ?? JSZipModule
      const zip = new JSZip()
      for (const it of done) {
        const fileName = `${String(it.name || 'document').replace(/\.[^.]+$/, '')}.md`
        zip.file(fileName, String(it.markdown ?? ''))
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'converted-markdown.zip'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка создания ZIP:', error)
      toast.error('Ошибка создания ZIP')
    }
  }

  const clearQueue = () => {
    setQueueItems([])
    setSelectedItemId(null)
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Шапка */}
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" title="Главное меню" onClick={() => navigate('/')}> 
            <Home className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="text-sm font-medium">Документ → Markdown (локальная конвертация)</div>
        </div>
        <div className="flex items-center space-x-2">
          <label className="flex items-center space-x-2 text-sm select-none cursor-pointer">
            <input type="checkbox" checked={ocrEnabled} onChange={(e) => setOcrEnabled(e.target.checked)} />
            <span>OCR для изображений (экспериментально)</span>
          </label>
        </div>
      </div>

      {/* Контент */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-0 overflow-hidden">
        {/* Левая колонка: зона загрузки и очередь */}
        <div className="border-r flex flex-col min-h-0">
          <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
            <div className="text-sm">Добавьте .docx (до 50 МБ, максимум 100 файлов)</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={handleOpenFileDialog}>
                <Upload className="h-4 w-4 mr-1" /> Выбрать файлы
              </Button>
              <Input type="file" accept=".doc,.docx" className="hidden" multiple ref={fileInputRef} onChange={onFileChange2} />
            </div>
          </div>

          <div
            ref={dropRef}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop2}
            className={`m-3 p-6 rounded border-2 border-dashed text-center text-sm transition-colors ${isDragging ? 'border-primary bg-accent/30' : 'border-muted-foreground/30'}`}
          >
            Перетащите .docx сюда или нажмите «Выбрать файлы»
          </div>

          <div className="px-3 pb-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Очередь ({queueItems.length})
                </CardTitle>
                <CardDescription>Прогресс: {overallProgress}%</CardDescription>
              </CardHeader>
              <CardContent>
                <Progress value={overallProgress} className="h-2 mb-3" />
                <div className="flex items-center gap-2 mb-3">
                  <Button size="sm" variant="secondary" onClick={downloadAllAsZip} disabled={!queueItems.some((q) => q.status === 'done')}>
                    <FileDown className="h-4 w-4 mr-1" /> Скачать всё (.zip)
                  </Button>
                  <Button size="sm" variant="ghost" onClick={clearQueue} disabled={queueItems.length === 0}>
                    <Trash2 className="h-4 w-4 mr-1" /> Очистить
                  </Button>
                </div>

                <div className="space-y-2 max-h-[48vh] overflow-auto">
                  {queueItems.length === 0 && (
                    <div className="text-sm text-muted-foreground">Очередь пуста. Добавьте .docx файлы.</div>
                  )}
                  {queueItems.map((it) => (
                    <div
                      key={it.id}
                      className={`p-2 rounded border cursor-pointer ${selectedItemId === it.id ? 'bg-accent border-primary' : 'hover:bg-accent'}`}
                      onClick={() => setSelectedItemId(it.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm truncate">{it.name}</div>
                        <div className="flex items-center gap-2">
                          {it.status === 'processing' && <Loader2 className="h-4 w-4 animate-spin" />}
                          {it.status === 'done' && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                          {it.status === 'error' && <XCircle className="h-4 w-4 text-red-600" />}
                        </div>
                      </div>
                      <Progress value={it.progress} className="h-1.5 mt-2" />
                      {it.status === 'error' && (
                        <div className="text-xs text-red-600 mt-1">{it.errorMessage}</div>
                      )}
                      {it.status === 'done' && it.warnings?.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-1">Предупреждений: {it.warnings.length}</div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Правая колонка: предпросмотр/результат */}
        <div className="flex flex-col min-h-0">
          <div className="p-3 border-b bg-muted/50 flex items-center justify-between">
            <div className="text-sm font-medium">Результат</div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" disabled={!selectedItem || !selectedItem.markdown} onClick={() => handleCopyMarkdown(selectedItem?.markdown)}>
                <Copy className="h-4 w-4 mr-1" /> Копировать
              </Button>
              <Button size="sm" variant="secondary" disabled={!selectedItem || !selectedItem.markdown} onClick={() => downloadAsMd(selectedItem?.name, selectedItem?.markdown)}>
                <FileDown className="h-4 w-4 mr-1" /> Скачать .md
              </Button>
            </div>
          </div>

          <div className="flex-1 grid grid-rows-2 md:grid-rows-1 md:grid-cols-2 gap-0 overflow-hidden">
            <div className="p-3 border-r overflow-auto">
              <div className="text-xs text-muted-foreground mb-1">Markdown</div>
              <Textarea 
                value={selectedItem?.markdown || ''}
                readOnly
                className="min-h-[38vh] md:min-h-0 h-full resize-none font-mono"
                placeholder="Готовый Markdown появится здесь после конвертации"
              />
            </div>
            <div className="p-3 overflow-auto">
              <div className="text-xs text-muted-foreground mb-1">Предпросмотр</div>
              <div className="prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {selectedItem?.markdown || ''}
                </ReactMarkdown>
              </div>
              {selectedItem?.warnings?.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium mb-1">Предупреждения</div>
                  <ul className="list-disc pl-5 text-xs space-y-1">
                    {selectedItem.warnings.map((w, idx) => (
                      <li key={idx}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* FAQ / Справка */}
          <div className="p-3 border-t text-xs text-muted-foreground">
            Обработка происходит локально в вашем браузере: файлы не покидают устройство.
          </div>
        </div>
      </div>
    </div>
  )
}


