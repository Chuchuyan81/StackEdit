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
import { importFileToMarkdown } from '@/lib/importers/index.js'
import { 
  Upload, FileText, Trash2, Copy, FileDown, CheckCircle2, XCircle, Loader2, Save
} from 'lucide-react'
import { useFiles } from '@/contexts/FileContext.jsx'
import { Skeleton } from '@/components/ui/skeleton.jsx'
import { ConfirmDialog } from '@/components/ConfirmDialog.jsx'

export default function DocToMd() {
  const navigate = useNavigate()
  const { setFiles, setCurrentFile, setContent } = useFiles()
  const fileInputRef = useRef(null)
  const dropRef = useRef(null)

  const [queueItems, setQueueItems] = useState([])
  const [selectedItemId, setSelectedItemId] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [ocrEnabled, setOcrEnabled] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)

  const MAX_FILES = 100
  const MAX_SIZE = 50 * 1024 * 1024

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
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const addFilesToQueue = useCallback((filesList) => {
    const arr = Array.from(filesList || [])
    if (arr.length === 0) return

    const currentCount = queueItems.length
    const allowedCount = Math.max(0, MAX_FILES - currentCount)
    const take = arr.slice(0, allowedCount)

    const accepted = []
    const rejected = []
    for (const file of take) {
      const isSupported = /\.docx$/i.test(file.name) || /\.doc$/i.test(file.name) || /\.pdf$/i.test(file.name)
      if (!isSupported) {
        rejected.push(`${file.name}: формат не поддерживается`) 
        continue
      }
      if (file.size > MAX_SIZE) {
        rejected.push(`${file.name}: превышает лимит 50 МБ`)
        continue
      }
      accepted.push(file)
    }

    if (rejected.length) {
      toast.error(`Отклонено файлов: ${rejected.length}`)
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

  const onFileChange = (e) => {
    const files = e.target.files
    if (files?.length) addFilesToQueue(files)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer?.files
    if (files?.length) addFilesToQueue(files)
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
          const { markdown, warnings } = await importFileToMarkdown(q.file, { fallbackToPlainText: false })
          setQueueItems((prev) => prev.map((it) => it.id === q.id ? {
            ...it,
            status: 'done',
            progress: 100,
            markdown: markdown,
            warnings: warnings || []
          } : it))
        } catch (error) {
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
  }, [isProcessing, queueItems])

  useEffect(() => {
    if (queueItems.some((q) => q.status === 'pending') && !isProcessing) {
      processQueueSequentially()
    }
  }, [queueItems, isProcessing, processQueueSequentially])

  const handleCopyToEditor = (text, name) => {
    const fileName = `${name.replace(/\.[^.]+$/, '')}.md`
    setFiles(prev => ({ ...prev, [fileName]: text }))
    setCurrentFile(fileName)
    setContent(text)
    toast.success(`Файл "${fileName}" добавлен в редактор`)
    navigate('/')
  }

  return (
    <div className="h-full flex flex-col bg-background p-4 overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold">Конвертер документов</h1>
          <p className="text-sm text-muted-foreground">Импорт .docx, .doc, .pdf в Markdown</p>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} disabled={queueItems.length === 0}>
            <Trash2 className="h-4 w-4 mr-2" /> Очистить очередь
          </Button>
          <Button size="sm" onClick={handleOpenFileDialog}>
            <Upload className="h-4 w-4 mr-2" /> Выбрать файлы
          </Button>
          <Input type="file" accept=".doc,.docx,.pdf" className="hidden" multiple ref={fileInputRef} onChange={onFileChange} />
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        {/* Queue Column */}
        <Card className="flex flex-col min-h-0">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm">Очередь ({queueItems.length})</CardTitle>
            <Progress value={overallProgress} className="h-1" />
          </CardHeader>
          <CardContent className="flex-1 overflow-auto px-2 pb-2">
            {queueItems.length === 0 ? (
              <div 
                onDragOver={handleDragOver}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                className={`h-full border-2 border-dashed rounded-lg flex flex-col items-center justify-center text-muted-foreground transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted'}`}
              >
                <Upload className="h-8 w-8 mb-2 opacity-20" />
                <p className="text-xs">Перетащите файлы сюда</p>
              </div>
            ) : (
              <div className="space-y-2">
                {queueItems.map((it) => (
                  <div
                    key={it.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${selectedItemId === it.id ? 'bg-accent border-primary ring-1 ring-primary' : 'hover:bg-accent/50'}`}
                    onClick={() => setSelectedItemId(it.id)}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="text-sm font-medium truncate">{it.name}</div>
                      {it.status === 'processing' && <Loader2 className="h-3 w-3 animate-spin" />}
                      {it.status === 'done' && <CheckCircle2 className="h-3 w-3 text-green-600" />}
                      {it.status === 'error' && <XCircle className="h-3 w-3 text-red-600" />}
                    </div>
                    <Progress value={it.progress} className="h-1" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Markdown Column */}
        <Card className="md:col-span-2 flex flex-col min-h-0">
          <CardHeader className="py-3 px-4 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Результат: {selectedItem?.name || 'Нет файла'}</CardTitle>
            <div className="flex items-center space-x-2">
              <Button size="xs" variant="ghost" disabled={!selectedItem?.markdown} onClick={() => {
                navigator.clipboard.writeText(selectedItem.markdown)
                toast.success('Скопировано')
              }}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
              <Button size="xs" variant="secondary" disabled={!selectedItem?.markdown} onClick={() => handleCopyToEditor(selectedItem.markdown, selectedItem.name)}>
                <Save className="h-3.5 w-3.5 mr-1" /> В редактор
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 overflow-hidden p-4 pt-0">
            <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-muted/10">
              <div className="px-3 py-1 border-b bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground">Markdown</div>
              {selectedItem?.status === 'processing' ? (
                <div className="p-4 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : (
                <Textarea 
                  value={selectedItem?.markdown || ''}
                  readOnly
                  className="flex-1 resize-none border-0 focus-visible:ring-0 font-mono text-xs bg-transparent"
                  placeholder="Здесь появится Markdown..."
                />
              )}
            </div>
            <div className="flex flex-col h-full border rounded-lg overflow-hidden bg-background">
              <div className="px-3 py-1 border-b bg-muted/30 text-[10px] uppercase font-bold text-muted-foreground">Предпросмотр</div>
              <div className="flex-1 overflow-auto p-4 prose prose-sm dark:prose-invert max-w-none">
                {selectedItem?.status === 'processing' ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-[200px]" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {selectedItem?.markdown || ''}
                  </ReactMarkdown>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog 
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Очистить очередь?"
        description="Все добавленные файлы и результаты конвертации будут удалены из этого списка."
        onConfirm={() => {
          setQueueItems([])
          setSelectedItemId(null)
        }}
        confirmText="Очистить"
        variant="destructive"
      />
    </div>
  )
}
