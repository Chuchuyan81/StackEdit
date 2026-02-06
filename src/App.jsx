import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card.jsx'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select.jsx'
import {
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
  Link,
  Image,
  Eye,
  EyeOff,
  FileDown,
  Save,
  Table as TableIcon,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Type,
  PlusSquare,
  Copy
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'
import 'katex/dist/katex.min.css'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { renderAsync } from 'docx-preview'
import { marked } from 'marked'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu.jsx'
import { importFileToMarkdown } from '@/lib/importers/index.js'
import { useFiles } from '@/contexts/FileContext.jsx'
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { oneDark } from '@codemirror/theme-one-dark';
import { Skeleton } from '@/components/ui/skeleton.jsx';

marked.setOptions({ breaks: true, gfm: true })

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const { files, currentFile, content, setContent, switchToFile } = useFiles();

  const [showPreview, setShowPreview] = useState(true)
  const [zenMode, setZenMode] = useState(false)
  const [undoStack, setUndoStack] = useState([])
  const [redoStack, setRedoStack] = useState([])
  const fileInputRef = useRef(null)
  const previewRef = useRef(null)
  const wordPreviewRef = useRef(null)
  const editorRef = useRef(null)
  const wordScrollWrapperRef = useRef(null)
  const isSyncingScrollRef = useRef(false)
  const [fileEncoding, setFileEncoding] = useState('UTF-8')
  const [previewMode, setPreviewMode] = useState('html') // 'html' | 'word' | 'wordOnline'
  const [wordOnlineUrl, setWordOnlineUrl] = useState('')
  const [isSaved, setIsSaved] = useState(true)
  const saveIndicatorTimerRef = useRef(null)

  const addToUndoStack = (oldContent) => {
    setUndoStack(prev => [...prev.slice(-19), oldContent])
    setRedoStack([])
  }

  const handleContentChange = (newContent) => {
    addToUndoStack(content)
    setContent(newContent)
    setIsSaved(false)
    if (saveIndicatorTimerRef.current) clearTimeout(saveIndicatorTimerRef.current)
    saveIndicatorTimerRef.current = setTimeout(() => setIsSaved(true), 2000)
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
    if (!editorRef.current) return;
    const view = editorRef.current.view;
    const selection = view.state.selection.main;
    const selectedText = view.state.sliceDoc(selection.from, selection.to);

    view.dispatch({
      changes: {
        from: selection.from,
        to: selection.to,
        insert: before + selectedText + after
      },
      selection: { anchor: selection.from + before.length, head: selection.from + before.length + selectedText.length }
    });
    view.focus();
  }

  const handleCopyPreview = async () => {
    try {
      let html = ''
      let text = ''
      let container = null

      if (previewMode === 'wordOnline') {
        const htmlFromMd = marked.parse(content ?? '')
        html = htmlFromMd
        const temp = document.createElement('div')
        temp.innerHTML = htmlFromMd
        text = temp.innerText
      } else {
        container = previewMode === 'word' ? wordPreviewRef.current : previewRef.current
        if (!container) return
        html = container.innerHTML
        text = container.innerText
      }

      const blobHtml = new Blob([html], { type: 'text/html' });
      const blobText = new Blob([text], { type: 'text/plain' });
      const data = [new ClipboardItem({ 'text/html': blobHtml, 'text/plain': blobText })];

      await navigator.clipboard.write(data);
      toast.success('Скопировано в буфер обмена');
    } catch (error) {
      console.error('Ошибка при копировании:', error)
      toast.error('Не удалось скопировать');
    }
  }

  const handleSavePreviewAsDoc = () => {
    try {
      const htmlInner = marked.parse(content ?? '')
      const safeTitle = (currentFile || 'document').replace(/\.[^.]+$/, '')
      const fullHtml = buildFullHtmlForWord(htmlInner, safeTitle)
      const blob = new Blob([fullHtml], { type: 'application/msword' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${safeTitle}.doc`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Ошибка при сохранении .doc:', error)
    }
  }

  const buildFullHtmlForWord = (htmlBody, title) => {
    const styles = `
      @page { size: A4; margin: 25.4mm; }
      body { font-family: Calibri, sans-serif; font-size: 11pt; line-height: 1.15; }
      h1, h2, h3 { font-weight: bold; margin-top: 1em; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1pt solid black; padding: 5pt; }
    `
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${title}</title><style>${styles}</style></head><body>${htmlBody}</body></html>`
  }

  const handleSavePreviewAsDocx = async () => {
    try {
      const safeTitle = (currentFile || 'document').replace(/\.[^.]+$/, '')
      const { asBlob } = await import('html-docx-js-typescript')
      const htmlBody = marked.parse(content ?? '')
      const fullHtml = buildFullHtmlForWord(htmlBody, safeTitle)

      const blob = await asBlob(fullHtml)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${safeTitle}.docx`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Файл .docx сохранен')
    } catch (error) {
      console.error('Ошибка при сохранении .docx:', error)
      toast.error('Не удалось сохранить .docx')
    }
  }

  // Scroll Sync (Decoupled from renderWordPreview)

  // Scroll Sync
  const handleScroll = (e) => {
    if (isSyncingScrollRef.current) return;

    const source = e.target;
    const isEditor = source === editorRef.current?.scrollDOM;
    const target = isEditor
      ? (previewMode === 'html' ? previewRef.current : wordScrollWrapperRef.current)
      : editorRef.current?.scrollDOM;

    if (target) {
      isSyncingScrollRef.current = true;
      const ratio = source.scrollTop / (source.scrollHeight - source.clientHeight);
      target.scrollTop = ratio * (target.scrollHeight - target.clientHeight);

      // Use requestAnimationFrame for smoother sync instead of setTimeout
      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
  }

  return (
    <div className={`flex flex-col h-full bg-background ${zenMode ? 'zen-mode' : ''}`}>
      {/* Unified Toolbar */}
      <div className="flex items-center justify-between p-2 border-b bg-card shrink-0">
        <div className="flex items-center space-x-1">
          <Button variant="ghost" size="sm" onClick={undo} disabled={undoStack.length === 0} title="Undo">
            <Undo className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={redo} disabled={redoStack.length === 0} title="Redo">
            <Redo className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Group: Text Formatting */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="Форматирование текста">
                <Type className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => insertMarkdown('**', '**')}>
                <Bold className="h-4 w-4 mr-2" /> Жирный
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('*', '*')}>
                <Italic className="h-4 w-4 mr-2" /> Курсив
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('~~', '~~')}>
                <Strikethrough className="h-4 w-4 mr-2" /> Зачеркнутый
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => insertMarkdown('# ')}>
                <Heading className="h-4 w-4 mr-2" /> Заголовок
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('`', '`')}>
                <Code className="h-4 w-4 mr-2" /> Код
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group: Lists */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="Списки">
                <List className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => insertMarkdown('- ')}>
                <List className="h-4 w-4 mr-2" /> Маркированный
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('1. ')}>
                <ListOrdered className="h-4 w-4 mr-2" /> Нумерованный
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('- [ ] ')}>
                <CheckSquare className="h-4 w-4 mr-2" /> Чек-лист
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group: Insert */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" title="Вставка">
                <PlusSquare className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => insertMarkdown('[Link text](', ')')}>
                <Link className="h-4 w-4 mr-2" /> Ссылка
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('![Alt text](', ')')}>
                <Image className="h-4 w-4 mr-2" /> Изображение
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('> ')}>
                <Quote className="h-4 w-4 mr-2" /> Цитата
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('| Header | Header |\n| --- | --- |\n| Cell | Cell |')}>
                <TableIcon className="h-4 w-4 mr-2" /> Таблица
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <div className={`flex items-center text-[10px] uppercase font-bold tracking-wider transition-opacity duration-500 ${isSaved ? 'text-green-500 opacity-100' : 'text-muted-foreground opacity-50'}`}>
            {isSaved ? '● Saved' : '○ Saving...'}
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant={zenMode ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setZenMode(!zenMode)}
            title="Zen Mode"
          >
            {zenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowPreview(!showPreview)}
            title="Toggle Preview"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          {showPreview && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm">
                  <FileDown className="h-4 w-4 mr-1" /> Экспорт
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleSavePreviewAsDoc}>Word (.doc)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleSavePreviewAsDocx}>Word (.docx)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleCopyPreview}>
                  <Copy className="h-4 w-4 mr-2" /> Копировать HTML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor Section */}
        <div className={`flex flex-col ${showPreview && !zenMode ? 'w-1/2' : 'w-full'} border-r h-full`}>
          <div className="bg-muted/30 px-4 py-1 border-b text-xs font-medium text-muted-foreground flex justify-between items-center">
            <span>{currentFile}</span>
            <span className="opacity-50">Markdown Editor</span>
          </div>
          <CodeMirror
            value={content}
            height="100%"
            theme={oneDark}
            extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
            onChange={handleContentChange}
            ref={editorRef}
            onScroll={handleScroll}
            className="flex-1 text-sm overflow-auto"
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              autocompletion: true,
            }}
          />
        </div>

        {/* Preview Section */}
        {showPreview && !zenMode && (
          <div className="w-1/2 flex flex-col h-full bg-background">
            <div className="bg-muted/30 px-4 py-1 border-b text-xs font-medium text-muted-foreground flex justify-between items-center">
              <div className="flex items-center space-x-2">
                <button
                  className={`px-2 py-0.5 rounded ${previewMode === 'html' ? 'bg-background shadow-sm text-foreground' : 'hover:text-foreground'}`}
                  onClick={() => setPreviewMode('html')}
                >
                  HTML
                </button>
                <button
                  className={`px-2 py-0.5 rounded ${previewMode === 'word' ? 'bg-background shadow-sm text-foreground' : 'hover:text-foreground'}`}
                  onClick={() => setPreviewMode('word')}
                >
                  Word
                </button>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="xs"
                  className="h-6 text-[10px] hover:bg-background"
                  onClick={handleCopyPreview}
                >
                  <Copy className="h-3 w-3 mr-1" /> Копировать
                </Button>
                <span className="opacity-50">Preview</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-8" ref={previewRef} onScroll={handleScroll}>
              {previewMode === 'html' ? (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
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
              ) : (
                <div
                  ref={wordScrollWrapperRef}
                  onScroll={handleScroll}
                  className="h-full overflow-auto bg-muted/10 word-preview-wrapper"
                >
                  <div ref={wordPreviewRef} className="a4-page shadow-xl">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm, remarkMath]}
                      rehypePlugins={[rehypeKatex]}
                    >
                      {content}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default App
