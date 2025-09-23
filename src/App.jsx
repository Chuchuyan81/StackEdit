import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
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
  FileDown
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'
import { renderAsync } from 'docx-preview'
// Удален html-docx-js из-за проблем совместимости с Vite
import { marked } from 'marked'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu.jsx'
import * as XLSX from 'xlsx'
marked.setOptions({ breaks: true })

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
  const previewRef = useRef(null)
  const wordPreviewRef = useRef(null)
  const [fileEncoding, setFileEncoding] = useState('UTF-8')
  const [previewMode, setPreviewMode] = useState('html') // 'html' | 'word'
  const [isWordRendering, setIsWordRendering] = useState(false)
  const wordRenderTimerRef = useRef(null)
  const [wordOnlineUrl, setWordOnlineUrl] = useState('')

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

  const generateDocxBlobFromMarkdown = (md, title) => {
    // Упрощенная версия без html-docx-js
    const htmlBody = generateHtmlFromMarkdown(md)
    const fullHtml = buildFullHtmlForWord(htmlBody, title)
    return new Blob([fullHtml], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })
  }

  const buildOfficeViewerUrl = (url) => {
    if (!url) return ''
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(url)}`
  }

  const handleSavePreviewAsDocx = async () => {
    try {
      const safeTitle = (currentFile || 'document').replace(/\.[^.]+$/, '')
      const blob = generateDocxBlobFromMarkdown(content, safeTitle)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${safeTitle}.docx`
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
      // Преобразуем Markdown → HTML, чтобы извлечь таблицы
      const htmlFromMd = generateHtmlFromMarkdown(content)

      // Создаём рабочую книгу Excel
      const workbook = XLSX.utils.book_new()

      // Парсим HTML и ищем таблицы
      const temp = document.createElement('div')
      temp.innerHTML = htmlFromMd
      const tables = Array.from(temp.querySelectorAll('table'))

      if (tables.length > 0) {
        tables.forEach((tableElement, index) => {
          const sheet = XLSX.utils.table_to_sheet(tableElement)
          const sheetName = `Table${index + 1}`
          XLSX.utils.book_append_sheet(workbook, sheet, sheetName)
        })
      } else {
        // Если таблиц нет, экспортируем текст построчно в один столбец
        const lines = String(content ?? '').split('\n')
        const aoa = lines.map((line) => [line])
        const sheet = XLSX.utils.aoa_to_sheet(aoa)
        XLSX.utils.book_append_sheet(workbook, sheet, 'Sheet1')
      }

      XLSX.writeFile(workbook, `${safeTitle}.xlsx`)
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
      const blob = generateDocxBlobFromMarkdown(content, safeTitle)
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

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Тосты */}
      {/* Для отображения уведомлений sonner необходимо подключить Toaster в корне */}
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center space-x-2">
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
            {/* Используем иконку папки из уже подключённого пакета, если есть */}
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
        <div className="flex-1 flex">
          {/* Editor */}
          <div className={`${showPreview ? 'w-1/2' : 'w-full'} flex flex-col`}>
            <div className="p-2 border-b bg-muted/50">
              <span className="text-sm font-medium">{currentFile}</span>
            </div>
            <Textarea
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="flex-1 resize-none border-0 rounded-none focus:ring-0 font-mono"
              placeholder="Start writing your markdown..."
            />
          </div>

          {/* Preview */}
          {showPreview && (
            <div className="w-1/2 border-l flex flex-col">
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
                    {/* Иконка копирования */}
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
              <div ref={previewRef} className="flex-1 overflow-auto p-4 prose prose-sm max-w-none">
                <ReactMarkdown
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
                <div className="flex-1 overflow-auto p-4">
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
      {/* Скрытый input для выбора локального файла */}
      <input
        type="file"
        accept=".md,.markdown,.txt"
        className="hidden"
        ref={fileInputRef}
        onChange={handleFileSelected}
      />
    </div>
  )
}

export default App

