import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.jsx'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.jsx'
import { 
  FolderPlus, 
  FilePlus, 
  Trash2, 
  Edit3, 
  Save, 
  Undo, 
  Redo, 
  Bold, 
  Italic, 
  Heading, 
  Strikethrough, 
  List, 
  ListOrdered, 
  CheckSquare, 
  Quote, 
  Code, 
  Table, 
  Link, 
  Image,
  Menu,
  X,
  Eye,
  EyeOff,
  FileText,
  FileDown,
  Home
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'
import { renderAsync } from 'docx-preview'
// Удален html-docx-js из-за проблем совместимости с Vite
import { marked } from 'marked'
// Импорт html-to-docx переведён на динамический внутри функции, чтобы избежать падения в браузере при сборке
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu.jsx'
import * as XLSX from 'xlsx'
import { importFileToMarkdown, isSupportedImportFile } from '@/lib/importers/index.js'
marked.setOptions({ breaks: true, gfm: true })

// Default welcome content
const DEFAULT_CONTENT = `# Welcome to StackEdit Clone!

Hi! I'm your first Markdown file in **StackEdit Clone**. If you want to learn about StackEdit Clone, you can read me. If you want to play with Markdown, you can edit me. Once you have finished with me, you can create new files by opening the **file explorer** on the left corner of the navigation bar.

## Files

StackEdit Clone stores your files in your browser, which means all your files are automatically saved locally and are accessible **offline!**

## Create files and folders

The file explorer is accessible using the button in left corner of the navigation bar. You can create a new file by clicking the **New file** button in the file explorer. You can also create folders by clicking the **New folder** button.

## Switch to another file

All your files and folders are presented as a tree in the file explorer. You can switch from one to another by clicking a file in the tree.

## Rename a file

You can rename the current file by clicking the **Rename** button in the file explorer.

## Delete a file

You can delete the current file by clicking the **Delete** button in the file explorer.

> **Note:** This is a simplified clone of StackEdit with local file management. Advanced features like cloud synchronization and publishing are not included in this version.
`

function App() {
  const [files, setFiles] = useState({})
  const [currentFile, setCurrentFile] = useState('Welcome.md')
  const [content, setContent] = useState(DEFAULT_CONTENT)
  const [showExplorer, setShowExplorer] = useState(true)
  const [showPreview, setShowPreview] = useState(true)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const fileInputRef = useRef(null)
  const importInputRef = useRef(null)
  const previewRef = useRef(null)
  const wordPreviewRef = useRef(null)
  const editorRef = useRef(null)
  const wordScrollWrapperRef = useRef(null)
  const isSyncingScrollRef = useRef(false)
  const [fileEncoding, setFileEncoding] = useState('UTF-8')
  const [previewMode, setPreviewMode] = useState('html') // 'html' | 'word'
  const [isWordRendering, setIsWordRendering] = useState(false)
  const wordRenderTimerRef = useRef(null)
  const [wordOnlineUrl, setWordOnlineUrl] = useState('')
  const [isImportDragging, setIsImportDragging] = useState(false)
  const [appMode, setAppMode] = useState(() => {
    // При первом запуске показываем меню. Далее — восстанавливаем последний режим.
    try {
      const saved = localStorage.getItem('stackedit-last-mode')
      return saved || 'menu'
    } catch (_) {
      return 'menu'
    }
  }) // 'menu' | 'mdToDoc' | 'docToMd'

  // Load files from localStorage on component mount
  useEffect(() => {
    const savedFiles = localStorage.getItem('stackedit-files')
    if (savedFiles) {
      const parsedFiles = JSON.parse(savedFiles)
      setFiles(parsedFiles)
      
      // If Welcome.md exists, load it
      if (parsedFiles['Welcome.md']) {
        setContent(parsedFiles['Welcome.md'])
      }
    } else {
      // Initialize with welcome file
      const initialFiles = { 'Welcome.md': DEFAULT_CONTENT }
      setFiles(initialFiles)
      localStorage.setItem('stackedit-files', JSON.stringify(initialFiles))
    }
  }, [])

  // Save current file content
  useEffect(() => {
    if (currentFile && content !== undefined) {
      const updatedFiles = { ...files, [currentFile]: content }
      setFiles(updatedFiles)
      localStorage.setItem('stackedit-files', JSON.stringify(updatedFiles))
    }
  }, [content, currentFile])

  const createNewFile = () => {
    const fileName = `Untitled-${Date.now()}.md`
    const newContent = '# New Document\n\nStart writing your content here...'
    const updatedFiles = { ...files, [fileName]: newContent }
    setFiles(updatedFiles)
    setCurrentFile(fileName)
    setContent(newContent)
    localStorage.setItem('stackedit-files', JSON.stringify(updatedFiles))
  }

  const deleteCurrentFile = () => {
    if (Object.keys(files).length <= 1) {
      alert('Cannot delete the last file!')
      return
    }
    
    const updatedFiles = { ...files }
    delete updatedFiles[currentFile]
    setFiles(updatedFiles)
    
    // Switch to the first available file
    const remainingFiles = Object.keys(updatedFiles)
    if (remainingFiles.length > 0) {
      const nextFile = remainingFiles[0]
      setCurrentFile(nextFile)
      setContent(updatedFiles[nextFile])
    }
    
    localStorage.setItem('stackedit-files', JSON.stringify(updatedFiles))
  }

  const renameFile = () => {
    if (!newFileName.trim() || newFileName === currentFile) {
      setIsRenaming(false)
      setNewFileName('')
      return
    }

    if (files[newFileName]) {
      alert('A file with this name already exists!')
      return
    }

    const updatedFiles = { ...files }
    updatedFiles[newFileName] = updatedFiles[currentFile]
    delete updatedFiles[currentFile]
    
    setFiles(updatedFiles)
    setCurrentFile(newFileName)
    setIsRenaming(false)
    setNewFileName('')
    localStorage.setItem('stackedit-files', JSON.stringify(updatedFiles))
  }

  const switchToFile = (fileName) => {
    setCurrentFile(fileName)
    setContent(files[fileName])
  }

  const addToUndoStack = (content) => {
    setUndoStack(prev => [...prev.slice(-19), content])
    setRedoStack([])
  }

  const handleContentChange = (newContent) => {
    addToUndoStack(content)
    setContent(newContent)
  }

  const undo = () => {
    if (undoStack.length > 0) {
      const previousContent = undoStack[undoStack.length - 1]
      setRedoStack(prev => [content, ...prev])
      setUndoStack(prev => prev.slice(0, -1))
      setContent(previousContent)
    }
  }

  const redo = () => {
    if (redoStack.length > 0) {
      const nextContent = redoStack[0]
      setUndoStack(prev => [...prev, content])
      setRedoStack(prev => prev.slice(1))
      setContent(nextContent)
    }
  }

  const insertMarkdown = (before, after = '') => {
    const textarea = document.querySelector('textarea')
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selectedText = content.substring(start, end)
    const newContent = content.substring(0, start) + before + selectedText + after + content.substring(end)
    
    addToUndoStack(content)
    setContent(newContent)
    
    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length)
    }, 0)
  }

  const handleOpenFileButton = () => {
    try {
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
        fileInputRef.current.click()
      }
    } catch (error) {
      console.error('Ошибка при открытии диалога выбора файла:', error)
    }
  }

  const handleCopyPreview = async () => {
    try {
      let html = ''
      let text = ''
      let container = null

      if (previewMode === 'wordOnline') {
        // Копируем из HTML, сгенерированного из Markdown, т.к. доступ к iframe ограничен
        const htmlFromMd = generateHtmlFromMarkdown(content)
        html = htmlFromMd
        const temp = document.createElement('div')
        temp.innerHTML = htmlFromMd
        text = temp.innerText
      } else {
        container = previewMode === 'word' ? wordPreviewRef.current : previewRef.current
      if (!container) {
        console.warn('Контейнер предпросмотра не найден для копирования')
        return
      }
        html = container.innerHTML
        text = container.innerText
      }

      if (window.ClipboardItem && navigator.clipboard && navigator.clipboard.write) {
        const item = new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
        await navigator.clipboard.write([item])
        toast.success('Скопировано в буфер обмена', { duration: 1300, position: 'bottom-right' })
        return
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text)
        toast.success('Скопировано в буфер обмена', { duration: 1300, position: 'bottom-right' })
        return
      }

      if (container) {
        const selection = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(container)
        selection.removeAllRanges()
        selection.addRange(range)
        const success = document.execCommand('copy')
        selection.removeAllRanges()
        if (!success) {
          console.warn('Не удалось скопировать содержимое предпросмотра')
        }
        if (success) {
          toast.success('Скопировано в буфер обмена', { duration: 1300, position: 'bottom-right' })
        }
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = text
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        const success = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (!success) {
          console.warn('Не удалось скопировать содержимое предпросмотра')
        }
        if (success) {
          toast.success('Скопировано в буфер обмена', { duration: 1300, position: 'bottom-right' })
        }
      }
    } catch (error) {
      console.error('Ошибка при копировании предпросмотра:', error)
    }
  }

  const handleSavePreviewAsDoc = () => {
    try {
      const htmlInner = generateHtmlFromMarkdown(content)
      const safeTitle = (currentFile || 'document').replace(/\.[^.]+$/, '')

      const styles = `
        body { font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial, Noto Sans, "Apple Color Emoji", "Segoe UI Emoji"; line-height: 1.6; color: #111827; }
        .prose { max-width: none; }
        h1 { font-size: 2em; margin: 0.67em 0; }
        h2 { font-size: 1.5em; margin: 0.75em 0; }
        h3 { font-size: 1.25em; margin: 0.85em 0; }
        h4 { font-size: 1.1em; margin: 0.95em 0; }
        p { margin: 0.5em 0; }
        ul, ol { margin: 0.5em 1.25em; }
        blockquote { margin: 0.5em 0; padding-left: 1em; border-left: 4px solid #e5e7eb; color: #6b7280; }
        code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; background: #f3f4f6; padding: 0.1em 0.25em; border-radius: 4px; }
        pre { background: #0b1021; color: #e2e8f0; padding: 1em; border-radius: 6px; overflow: auto; }
        pre code { background: transparent; padding: 0; }
        table { border-collapse: collapse; }
        th, td { border: 1px solid #e5e7eb; padding: 6px 8px; }
        img { max-width: 100%; height: auto; }
        a { color: #2563eb; text-decoration: underline; }
      `

      const fullHtml = buildFullHtmlForWord(htmlInner, safeTitle)

      const blob = new Blob([fullHtml], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${safeTitle}.doc`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка при сохранении предпросмотра в Word:', error)
    }
  }

  const generateHtmlFromMarkdown = (md) => {
    try {
      // Базовая конвертация Markdown → HTML для генерации DOC/DOCX
      return marked.parse(md ?? '')
    } catch (error) {
      console.error('Ошибка при преобразовании Markdown в HTML:', error)
      return (md ?? '')
    }
  }

  const buildFullHtmlForWord = (htmlBody, title) => {
    const safeTitle = (title || 'document').replace(/\.[^.]+$/, '')
      const styles = `
      /* Базовые стили, ориентированные на Word */
      @page { size: A4; margin: 25.4mm 25.4mm 25.4mm 25.4mm; }
      body { font-family: Calibri, 'Segoe UI', Arial, 'Times New Roman', sans-serif; font-size: 11pt; line-height: 1.15; color: #000; }
      h1 { font-size: 20pt; font-weight: 700; margin: 0.67em 0; }
      h2 { font-size: 16pt; font-weight: 700; margin: 0.67em 0; }
      h3 { font-size: 14pt; font-weight: 700; margin: 0.67em 0; }
      h4 { font-size: 12pt; font-weight: 700; margin: 0.67em 0; }
      p { margin: 0 0 10pt 0; }
      strong { font-weight: 700; }
      em { font-style: italic; }
      u { text-decoration: underline; }
      ul, ol { margin: 0 0 10pt 24pt; }
      li { margin: 0 0 6pt 0; }
      blockquote { margin: 0 0 10pt 12pt; padding-left: 12pt; border-left: 3pt solid #d0d0d0; color: #555; }
      code { font-family: 'Courier New', Consolas, 'Liberation Mono', monospace; background: #f2f2f2; padding: 0 2pt; }
      pre { font-family: 'Courier New', Consolas, monospace; background: #f2f2f2; padding: 8pt; border-radius: 4pt; overflow: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1pt solid #d0d0d0; padding: 6pt 8pt; vertical-align: top; }
        img { max-width: 100%; height: auto; }
      a { color: #0563c1; text-decoration: underline; }
      `

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${safeTitle}</title>
  <style>${styles}</style>
</head>
<body>
  ${htmlBody}
</body>
</html>`
  }

  const generateDocxBlobFromMarkdown = async (md, title) => {
    try {
      const htmlBody = generateHtmlFromMarkdown(md)
      // Выделяем CSS отдельно — html-to-docx лучше работает с отдельной строкой стилей
      const baseCss = `
      @page { size: A4; margin: 25.4mm 25.4mm 25.4mm 25.4mm; }
      body { font-family: Calibri, 'Segoe UI', Arial, 'Times New Roman', sans-serif; font-size: 11pt; line-height: 1.15; color: #000; }
      h1 { font-size: 20pt; font-weight: 700; margin: 0.67em 0; }
      h2 { font-size: 16pt; font-weight: 700; margin: 0.67em 0; }
      h3 { font-size: 14pt; font-weight: 700; margin: 0.67em 0; }
      h4 { font-size: 12pt; font-weight: 700; margin: 0.67em 0; }
      p { margin: 0 0 10pt 0; }
      strong { font-weight: 700; }
      em { font-style: italic; }
      u { text-decoration: underline; }
      ul, ol { margin: 0 0 10pt 24pt; }
      li { margin: 0 0 6pt 0; }
      blockquote { margin: 0 0 10pt 12pt; padding-left: 12pt; border-left: 3pt solid #d0d0d0; color: #555; }
      code { font-family: 'Courier New', Consolas, 'Liberation Mono', monospace; background: #f2f2f2; padding: 0 2pt; }
      pre { font-family: 'Courier New', Consolas, monospace; background: #f2f2f2; padding: 8pt; border-radius: 4pt; overflow: auto; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1pt solid #d0d0d0; padding: 6pt 8pt; vertical-align: top; }
      img { max-width: 100%; height: auto; }
      a { color: #0563c1; text-decoration: underline; }
      `
      const { default: HTMLtoDOCX } = await import('html-to-docx')
      // Передаём только тело HTML и CSS отдельно
      const arrayBuffer = await HTMLtoDOCX(htmlBody, baseCss, {
        page: {
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        },
        table: {
          row: { cantSplit: true }
        }
      })
      const blob = arrayBuffer instanceof Blob
        ? arrayBuffer
        : new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
      return blob
    } catch (error) {
      console.error('Ошибка при генерации DOCX через html-to-docx:', error)
      try {
        // Повторная попытка: без CSS
        const { default: HTMLtoDOCX } = await import('html-to-docx')
        const htmlBody = generateHtmlFromMarkdown(md)
        const arrayBuffer = await HTMLtoDOCX(htmlBody)
        const blob = arrayBuffer instanceof Blob
          ? arrayBuffer
          : new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
        return blob
      } catch (err2) {
        console.error('Повторная попытка DOCX без CSS не удалась:', err2)
        try {
          // Минимизированная разметка (убираем код-блоки и лишние стили)
          const plain = String(md ?? '')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/`([^`]+)`/g, '$1')
          const htmlBody = marked.parse(plain)
          const { default: HTMLtoDOCX } = await import('html-to-docx')
          const arrayBuffer = await HTMLtoDOCX(htmlBody)
          const blob = arrayBuffer instanceof Blob
            ? arrayBuffer
            : new Blob([arrayBuffer], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
          return blob
        } catch (err3) {
          console.error('Минимизированная генерация DOCX также не удалась:', err3)
          // Окончательный фолбэк: сохранение .doc (HTML)
          toast.error('Не удалось сформировать DOCX. Будет сохранён .doc (HTML).')
          const safeTitle = (title || 'document').replace(/\.[^.]+$/, '')
          const htmlBody = generateHtmlFromMarkdown(md)
          const fullHtml = buildFullHtmlForWord(htmlBody, safeTitle)
          return new Blob([fullHtml], { type: 'application/msword' })
        }
      }
    }
  }

  const buildOfficeViewerUrl = (url) => {
    if (!url) return ''
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
  }

  const handleSavePreviewAsDocx = async () => {
    try {
      const safeTitle = (currentFile || 'document').replace(/\.[^.]+$/, '')
      const blob = await generateDocxBlobFromMarkdown(content, safeTitle)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      // Если фолбэк создал .doc, определим расширение по типу
      const isDocx = blob.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      link.download = isDocx ? `${safeTitle}.docx` : `${safeTitle}.doc`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка при сохранении предпросмотра в DOCX:', error)
    }
  }

  const handleSavePreviewAsXlsx = () => {
    try {
      const safeTitle = (currentFile || 'document').replace(/\.[^.]+$/, '')
      // Генерируем полноформатный HTML как для Word, но с mime Excel — это сохранит форматирование
      const htmlBody = generateHtmlFromMarkdown(content)
      const fullHtml = buildFullHtmlForWord(htmlBody, safeTitle)
      const blob = new Blob([fullHtml], { type: 'application/vnd.ms-excel' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${safeTitle}.xls`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка при сохранении предпросмотра в XLSX:', error)
    }
  }

  const renderWordPreview = async () => {
    try {
      const container = wordPreviewRef.current
      if (!container) return
      setIsWordRendering(true)
      // Очистка контейнера перед рендером
      container.innerHTML = ''
      const safeTitle = (currentFile || 'document').replace(/\.[^.]+$/, '')
      const blob = await generateDocxBlobFromMarkdown(content, safeTitle)
      await renderAsync(blob, container, undefined, { inWrapper: true })
    } catch (error) {
      console.error('Ошибка при рендеринге Word-превью:', error)
    } finally {
      setIsWordRendering(false)
    }
  }

  useEffect(() => {
    if (previewMode !== 'word') return
    // Дебаунс рендеринга для производительности
    if (wordRenderTimerRef.current) clearTimeout(wordRenderTimerRef.current)
    wordRenderTimerRef.current = setTimeout(() => {
      renderWordPreview()
    }, 300)
    return () => {
      if (wordRenderTimerRef.current) clearTimeout(wordRenderTimerRef.current)
    }
  }, [content, previewMode, currentFile])

  // При выборе режима "Документ в маркдаун" сразу открываем диалог импорта
  useEffect(() => {
    if (appMode === 'docToMd') {
      // Небольшая задержка, чтобы гарантировать готовность input
      setTimeout(() => {
        try {
          handleOpenImportDialog()
        } catch (e) {
          console.error('Не удалось открыть диалог импорта при старте режима:', e)
        }
      }, 0)
    }
  }, [appMode])

  // Сохраняем последний выбранный режим (кроме меню)
  useEffect(() => {
    try {
      if (appMode && appMode !== 'menu') {
        localStorage.setItem('stackedit-last-mode', appMode)
      }
    } catch (e) {
      // Молча игнорируем ошибки доступа к localStorage
    }
  }, [appMode])

  const normalizeEncodingLabel = (label) => {
    if (!label) return 'utf-8'
    const lower = String(label).toLowerCase()
    if (lower.includes('1251')) return 'windows-1251'
    return 'utf-8'
  }

  const readFileAsTextWithEncoding = (file, encodingLabel) => {
    return new Promise((resolve, reject) => {
      try {
        const reader = new FileReader()
        reader.onload = () => {
          try {
            const buffer = reader.result
            const normalized = normalizeEncodingLabel(encodingLabel)
            let text = ''
            try {
              text = new TextDecoder(normalized).decode(buffer)
            } catch (e) {
              console.warn('Выбранная кодировка не поддерживается, используем UTF-8 по умолчанию')
              text = new TextDecoder('utf-8').decode(buffer)
            }
            resolve(text)
          } catch (err) {
            reject(err)
          }
        }
        reader.onerror = (e) => reject(e)
        reader.readAsArrayBuffer(file)
      } catch (error) {
        reject(error)
      }
    })
  }

  const openFileObject = async (file) => {
    try {
      const text = await readFileAsTextWithEncoding(file, fileEncoding)
      const fileName = file.name
      const updatedFiles = { ...files, [fileName]: text }
      setFiles(updatedFiles)
      setCurrentFile(fileName)
      setContent(text)
      localStorage.setItem('stackedit-files', JSON.stringify(updatedFiles))
    } catch (error) {
      console.error('Ошибка при открытии файла:', error)
    }
  }

  const handleFileSelected = (event) => {
    try {
      const input = event.target
      const file = input.files && input.files[0]
      if (!file) return
      openFileObject(file)
    } catch (error) {
      console.error('Ошибка при выборе файла:', error)
    }
  }

  // Импорт документов → Markdown
  const handleOpenImportDialog = () => {
    try {
      if (importInputRef.current) {
        importInputRef.current.value = ''
        importInputRef.current.click()
      }
    } catch (error) {
      console.error('Ошибка при открытии диалога импорта:', error)
    }
  }

  const ensureUniqueMarkdownFileName = (baseName) => {
    const base = `${baseName.replace(/\.[^.]+$/, '')}.md`
    if (!files[base]) return base
    let index = 1
    while (files[`${base.replace(/\.md$/, '')} (${index}).md`]) {
      index += 1
    }
    return `${base.replace(/\.md$/, '')} (${index}).md`
  }

  const createImportedFile = (originalName, markdownText) => {
    const safeBase = (originalName || 'Imported').replace(/\s+/g, ' ').trim() || 'Imported'
    const newName = ensureUniqueMarkdownFileName(safeBase)
    const updatedFiles = { ...files, [newName]: markdownText }
    setFiles(updatedFiles)
    setCurrentFile(newName)
    setContent(markdownText)
    localStorage.setItem('stackedit-files', JSON.stringify(updatedFiles))
    toast.success('Импорт завершён', { duration: 1300, position: 'bottom-right' })
  }

  const importFile = async (file) => {
    if (!file) return
    try {
      toast.message('Импорт…', { duration: 900, position: 'bottom-right' })
      const { markdown, warnings } = await importFileToMarkdown(file, { encoding: fileEncoding, fallbackToPlainText: false })
      if (warnings && warnings.length) {
        console.warn('Предупреждения импорта:', warnings)
      }
      createImportedFile(file.name, markdown)
    } catch (error) {
      console.error('Ошибка импорта:', error)
      const confirmFallback = window.confirm('Не удалось конвертировать файл. Импортировать как простой текст?')
      if (confirmFallback) {
        try {
          const { markdown } = await importFileToMarkdown(file, { encoding: fileEncoding, fallbackToPlainText: true })
          createImportedFile(file.name, markdown)
        } catch (err2) {
          console.error('Фолбэк тоже не удался:', err2)
          toast.error('Импорт не выполнен', { duration: 1600, position: 'bottom-right' })
        }
      } else {
        toast.error('Импорт отменён пользователем', { duration: 1200, position: 'bottom-right' })
      }
    }
  }

  const handleImportFileSelected = (event) => {
    try {
      const input = event.target
      const file = input.files && input.files[0]
      if (!file) return
      importFile(file)
    } catch (error) {
      console.error('Ошибка при выборе файла для импорта:', error)
    }
  }

  // Копирование импортированного текста в буфер обмена
  const handleCopyImportedText = async () => {
    try {
      if (!content) {
        toast.error('Нет текста для копирования', { duration: 1300, position: 'bottom-right' })
        return
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(content)
        toast.success('Текст скопирован в буфер обмена', { duration: 1300, position: 'bottom-right' })
        return
      }

      // Фолбэк для старых браузеров
      const textarea = document.createElement('textarea')
      textarea.value = content
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      const success = document.execCommand('copy')
      document.body.removeChild(textarea)
      
      if (success) {
        toast.success('Текст скопирован в буфер обмена', { duration: 1300, position: 'bottom-right' })
      } else {
        toast.error('Не удалось скопировать текст', { duration: 1300, position: 'bottom-right' })
      }
    } catch (error) {
      console.error('Ошибка при копировании текста:', error)
      toast.error('Ошибка при копировании', { duration: 1300, position: 'bottom-right' })
    }
  }

  // Сохранение импортированного текста в .md файл
  const handleSaveImportedAsMd = () => {
    try {
      if (!content) {
        toast.error('Нет текста для сохранения', { duration: 1300, position: 'bottom-right' })
        return
      }

      const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${currentFile.replace(/\.[^.]+$/, '')}.md`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      
      toast.success('Файл сохранён', { duration: 1300, position: 'bottom-right' })
    } catch (error) {
      console.error('Ошибка при сохранении файла:', error)
      toast.error('Ошибка при сохранении файла', { duration: 1300, position: 'bottom-right' })
    }
  }

  const handleImportDragOver = (event) => {
    try {
      event.preventDefault()
      setIsImportDragging(true)
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    } catch (error) {
      console.error('Ошибка при dragover в зоне импорта:', error)
    }
  }

  const handleImportDragLeave = () => {
    setIsImportDragging(false)
  }

  const handleImportDrop = (event) => {
    try {
      event.preventDefault()
      event.stopPropagation()
      setIsImportDragging(false)
      const filesList = event.dataTransfer?.files
      if (!filesList || filesList.length === 0) return
      const file = Array.from(filesList).find((f) => isSupportedImportFile(f.name))
      if (!file) {
        toast.error('Формат не поддерживается зоной импорта', { duration: 1500, position: 'bottom-right' })
        return
      }
      importFile(file)
    } catch (error) {
      console.error('Ошибка при drop в зоне импорта:', error)
    }
  }

  const handleDragOver = (event) => {
    try {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
    } catch (error) {
      console.error('Ошибка при обработке dragover:', error)
    }
  }

  const handleDrop = (event) => {
    try {
      event.preventDefault()
      const filesList = event.dataTransfer?.files
      if (!filesList || filesList.length === 0) return
      const filesArray = Array.from(filesList)
      const supported = filesArray.find((f) => /\.(md|markdown|txt)$/i.test(f.name)) || filesArray[0]
      if (supported) {
        openFileObject(supported)
      }
    } catch (error) {
      console.error('Ошибка при обработке drop:', error)
    }
  }

  // ===== Синхронизация прокрутки редактор ⇄ превью =====
  /**
   * Возвращает отношение текущей прокрутки к максимальной (0..1).
   */
  const getScrollRatio = (element) => {
    if (!element) return 0
    const maxScroll = element.scrollHeight - element.clientHeight
    if (maxScroll <= 0) return 0
    return element.scrollTop / maxScroll
  }

  /**
   * Устанавливает прокрутку элемента по отношению (0..1).
   */
  const setScrollByRatio = (element, ratio) => {
    if (!element) return
    const maxScroll = element.scrollHeight - element.clientHeight
    const next = Math.max(0, Math.min(1, ratio)) * (maxScroll <= 0 ? 0 : maxScroll)
    element.scrollTop = Math.round(next)
  }

  /**
   * Прокрутка из редактора в активное превью (HTML или Word). Word Online не поддерживается.
   */
  const syncFromEditor = () => {
    if (!showPreview) return
    if (isSyncingScrollRef.current) return
    const editorEl = editorRef.current
    const ratio = getScrollRatio(editorEl)
    const targetEl = previewMode === 'html'
      ? previewRef.current
      : (previewMode === 'word' ? wordScrollWrapperRef.current : null)
    if (!targetEl) return
    isSyncingScrollRef.current = true
    setScrollByRatio(targetEl, ratio)
    // Сбрасываем флаг на следующем кадре, чтобы не зациклиться
    requestAnimationFrame(() => { isSyncingScrollRef.current = false })
  }

  /**
   * Прокрутка из превью (HTML/Word) в редактор.
   */
  const syncFromPreview = () => {
    if (isSyncingScrollRef.current) return
    const sourceEl = previewMode === 'html'
      ? previewRef.current
      : (previewMode === 'word' ? wordScrollWrapperRef.current : null)
    const editorEl = editorRef.current
    if (!sourceEl || !editorEl) return
    const ratio = getScrollRatio(sourceEl)
    isSyncingScrollRef.current = true
    setScrollByRatio(editorEl, ratio)
    requestAnimationFrame(() => { isSyncingScrollRef.current = false })
  }

  // Обработчики событий прокрутки
  const handleEditorScroll = () => {
    // Синхронизируем при прокрутке редактора
    syncFromEditor()
  }

  const handleHtmlPreviewScroll = () => {
    // Синхронизируем при прокрутке HTML-превью
    if (!showPreview || previewMode !== 'html') return
    syncFromPreview()
  }

  const handleWordPreviewScroll = () => {
    // Синхронизируем при прокрутке Word-превью
    if (!showPreview || previewMode !== 'word') return
    syncFromPreview()
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {appMode === 'menu' ? (
        <div className="flex-1 grid place-items-center p-6">
          <div className="w-full max-w-3xl">
            <div className="text-center mb-6">
              <div className="text-2xl font-semibold">Выберите режим</div>
              <div className="text-sm text-muted-foreground mt-1">Что вы хотите сделать?</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card role="button" tabIndex={0} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setAppMode('mdToDoc')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileDown className="h-5 w-5" />
                    Маркдаун в документ
                  </CardTitle>
                  <CardDescription>Редактор и экспорт в DOC/DOCX/XLSX</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full" onClick={() => setAppMode('mdToDoc')}>Открыть</Button>
                </CardContent>
              </Card>
              <Card role="button" tabIndex={0} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setAppMode('docToMd')}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Документ в маркдаун
                  </CardTitle>
                  <CardDescription>Импорт DOC/DOCX/XLS/XLSX/PDF → Markdown</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="secondary" className="w-full" onClick={() => setAppMode('docToMd')}>Выбрать файл</Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Header */}
          <div className="flex items-center justify-between p-2 border-b bg-card">
            <div className="flex items-center space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAppMode('menu')}
                title="Главное меню"
              >
                <Home className="h-4 w-4" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowExplorer(!showExplorer)}
                title="Toggle explorer"
              >
                <Menu className="h-4 w-4" />
              </Button>
              
              <Separator orientation="vertical" className="h-6" />
              
              <Button variant="ghost" size="sm" onClick={handleOpenFileButton} title="Открыть файл (.md, .txt)">
                <span className="text-xs">Открыть</span>
              </Button>
              <Select value={fileEncoding} onValueChange={setFileEncoding}>
                <SelectTrigger size="sm" className="h-8">
                  <SelectValue placeholder="Кодировка" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTF-8">UTF-8</SelectItem>
                  <SelectItem value="Windows-1251">Windows-1251</SelectItem>
                </SelectContent>
              </Select>

              <Separator orientation="vertical" className="h-6" />

              <Button variant="ghost" size="sm" onClick={undo} disabled={undoStack.length === 0} title="Undo">
                <Undo className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={redo} disabled={redoStack.length === 0} title="Redo">
                <Redo className="h-4 w-4" />
              </Button>
              
              <Separator orientation="vertical" className="h-6" />
              
              {/* Formatting buttons */}
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('**', '**')} title="Bold">
                <Bold className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('*', '*')} title="Italic">
                <Italic className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('# ', '')} title="Heading">
                <Heading className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('~~', '~~')} title="Strikethrough">
                <Strikethrough className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('- ', '')} title="Unordered list">
                <List className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('1. ', '')} title="Ordered list">
                <ListOrdered className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('- [ ] ', '')} title="Check list">
                <CheckSquare className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('> ', '')} title="Blockquote">
                <Quote className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('`', '`')} title="Code">
                <Code className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('[Link text](', ')')} title="Link">
                <Link className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => insertMarkdown('![Alt text](', ')')} title="Image">
                <Image className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Кнопки для режима "Документ в маркдаун" */}
              {appMode === 'docToMd' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyImportedText}
                    title="Скопировать импортированный текст"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveImportedAsMd}
                    title="Сохранить как .md файл"
                  >
                    <Save className="h-4 w-4" />
                  </Button>
                  <Separator orientation="vertical" className="h-6" />
                </>
              )}
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                title="Toggle preview"
              >
                {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden" onDragOver={handleDragOver} onDrop={handleDrop}>
            {/* File Explorer */}
            {showExplorer && (
              <div className="w-64 border-r bg-card flex flex-col">
                <div className="p-2 border-b">
                  <div className="flex space-x-1 mb-2">
                    <Button variant="ghost" size="sm" onClick={createNewFile} title="New file">
                      <FilePlus className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={deleteCurrentFile} title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setIsRenaming(true)} title="Rename">
                      <Edit3 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleOpenImportDialog} title="Импортировать в Markdown">
                      <span className="text-xs">Импорт</span>
                    </Button>
                  </div>
                  
                  {isRenaming && (
                    <div className="flex space-x-1">
                      <Input
                        value={newFileName}
                        onChange={(e) => setNewFileName(e.target.value)}
                        placeholder={currentFile}
                        className="text-sm"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') renameFile()
                          if (e.key === 'Escape') {
                            setIsRenaming(false)
                            setNewFileName('')
                          }
                        }}
                        autoFocus
                      />
                      <Button size="sm" onClick={renameFile}>
                        <Save className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-auto p-2">
                  {/* Зона drag-and-drop для импорта DOC/DOCX/XLS/XLSX/PDF */}
                  <div
                    className={`text-xs mb-2 p-3 rounded border-2 border-dashed ${isImportDragging ? 'border-primary bg-accent/30' : 'border-muted-foreground/30'}`}
                    onDragOver={handleImportDragOver}
                    onDragLeave={handleImportDragLeave}
                    onDrop={handleImportDrop}
                  >
                    <div className="font-medium mb-1">Импортировать в Markdown</div>
                    <div className="text-muted-foreground">Перетащите DOC/DOCX/XLS/XLSX/PDF сюда или нажмите «Импорт»</div>
                  </div>
                  {Object.keys(files).map((fileName) => (
                    <div
                      key={fileName}
                      className={`flex items-center space-x-2 p-2 rounded cursor-pointer hover:bg-accent ${
                        fileName === currentFile ? 'bg-accent' : ''
                      }`}
                      onClick={() => switchToFile(fileName)}
                    >
                      <FileText className="h-4 w-4" />
                      <span className="text-sm truncate">{fileName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col md:flex-row">
              {/* Editor */}
              <div className={`${showPreview ? 'md:w-1/2 w-full' : 'w-full'} flex flex-col max-h-full` }>
                <div className="p-2 border-b bg-muted/50">
                  <span className="text-sm font-medium">{currentFile}</span>
                </div>
                <Textarea
                  value={content}
                  onChange={(e) => handleContentChange(e.target.value)}
                  ref={editorRef}
                  onScroll={handleEditorScroll}
                  className="flex-1 border-0 rounded-none focus:ring-0 font-mono overflow-auto"
                  placeholder="Start writing your markdown..."
                />
              </div>

              {/* Preview */}
              {showPreview && (
                <div className="md:w-1/2 w-full border-t md:border-t-0 md:border-l flex flex-col max-h-full">
                  <div className="p-2 border-b bg-muted/50 flex items-center justify-between">
                    <span className="text-sm font-medium">Preview</span>
                    <div className="flex items-center space-x-1">
                      <Select value={previewMode} onValueChange={setPreviewMode}>
                        <SelectTrigger size="sm" className="h-8">
                          <SelectValue placeholder="Режим" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="html">HTML</SelectItem>
                          <SelectItem value="word">Word</SelectItem>
                          <SelectItem value="wordOnline">Word Online</SelectItem>
                        </SelectContent>
                      </Select>
                      {previewMode === 'wordOnline' && (
                        <Input
                          value={wordOnlineUrl}
                          onChange={(e) => setWordOnlineUrl(e.target.value)}
                          placeholder="Публичная ссылка на .docx"
                          className="h-8 w-64"
                        />
                      )}
                      <Button variant="ghost" size="sm" onClick={handleCopyPreview} title="Скопировать предпросмотр">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" title="Скачать...">
                            <FileDown className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={handleSavePreviewAsDoc}>
                            <Save className="h-4 w-4" />
                            <span>Word (.doc)</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleSavePreviewAsDocx}>
                            <FileDown className="h-4 w-4" />
                            <span>Word (.docx)</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={handleSavePreviewAsXlsx}>
                            <Table className="h-4 w-4" />
                            <span>Excel (.xlsx)</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {previewMode === 'html' ? (
                  <div ref={previewRef} onScroll={handleHtmlPreviewScroll} className="flex-1 overflow-auto p-4 prose prose-sm max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        code({ node, inline, className, children, ...props }) {
                          const match = /language-(\w+)/.exec(className || '')
                          return !inline && match ? (
                            <SyntaxHighlighter
                              style={tomorrow}
                              language={match[1]}
                              PreTag="div"
                              {...props}
                            >
                              {String(children).replace(/\n$/, '')}
                            </SyntaxHighlighter>
                          ) : (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                  ) : previewMode === 'word' ? (
                    <div ref={wordScrollWrapperRef} onScroll={handleWordPreviewScroll} className="flex-1 overflow-auto p-4">
                      {isWordRendering && (
                        <div className="text-xs text-muted-foreground mb-2">Отрисовка Word-превью…</div>
                      )}
                      <div ref={wordPreviewRef} className="word-preview-container" />
                    </div>
                  ) : (
                    <div className="flex-1 overflow-hidden">
                      {wordOnlineUrl ? (
                        <iframe
                          title="Word Online Preview"
                          src={buildOfficeViewerUrl(wordOnlineUrl)}
                          className="w-full h-full border-0"
                        />
                      ) : (
                        <div className="p-4 text-sm text-muted-foreground">
                          Вставьте публичную ссылку на .docx, чтобы отобразить Word Online-превью.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {/* Скрытый input для выбора локального файла */}
      <input
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelected}
      />
      {/* Скрытый input для импорта документов → Markdown */}
      <input
        type="file"
        accept=".doc,.docx,.xls,.xlsx,.pdf"
        className="hidden"
        ref={importInputRef}
        onChange={handleImportFileSelected}
      />
    </div>
  )
}

export default App

