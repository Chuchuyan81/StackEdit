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
  Copy,
  Info,
  Clock,
  ChevronRight
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'
import 'katex/dist/katex.min.css'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
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
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { motion, AnimatePresence } from 'framer-motion';

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
  const [previewMode, setPreviewMode] = useState('html') // 'html' | 'word'
  const [isSaved, setIsSaved] = useState(true)
  const saveIndicatorTimerRef = useRef(null)

  // Statistics
  const stats = useMemo(() => {
    const text = content || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const readTime = Math.ceil(words / 200); // Average reading speed 200 wpm
    return { words, chars, readTime };
  }, [content]);

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

      container = previewMode === 'word' ? wordPreviewRef.current : previewRef.current
      if (!container) return
      html = container.innerHTML
      text = container.innerText

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

      requestAnimationFrame(() => {
        isSyncingScrollRef.current = false;
      });
    }
  }

  return (
    <div className={`flex flex-col h-full bg-background transition-all duration-300 ${zenMode ? 'zen-mode' : ''}`}>
      {/* Unified Toolbar - Improved visuals */}
      <div className="flex items-center justify-between p-2 border-b bg-card/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
        <div className="flex items-center space-x-1">
          <div className="flex bg-muted/50 rounded-md p-0.5 mr-2">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={undo} disabled={undoStack.length === 0} title="Undo">
              <Undo className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={redo} disabled={redoStack.length === 0} title="Redo">
              <Redo className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 mx-1" />

          {/* Group: Text Formatting */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1" title="Форматирование текста">
                <Type className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Текст</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuItem onClick={() => insertMarkdown('**', '**')}>
                <Bold className="h-4 w-4 mr-2" /> Жирный <span className="ml-auto text-[10px] opacity-50">**text**</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('*', '*')}>
                <Italic className="h-4 w-4 mr-2" /> Курсив <span className="ml-auto text-[10px] opacity-50">*text*</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('~~', '~~')}>
                <Strikethrough className="h-4 w-4 mr-2" /> Зачеркнутый <span className="ml-auto text-[10px] opacity-50">~~text~~</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => insertMarkdown('# ')}>
                <Heading className="h-4 w-4 mr-2" /> Заголовок <span className="ml-auto text-[10px] opacity-50"># text</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => insertMarkdown('`', '`')}>
                <Code className="h-4 w-4 mr-2" /> Код <span className="ml-auto text-[10px] opacity-50">`text`</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Group: Lists */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 gap-1" title="Списки">
                <List className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Списки</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
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
              <Button variant="ghost" size="sm" className="h-8 gap-1" title="Вставка">
                <PlusSquare className="h-4 w-4" />
                <span className="text-xs font-medium hidden sm:inline">Вставка</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
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

          <AnimatePresence mode="wait">
            <motion.div
              key={isSaved ? 'saved' : 'saving'}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className={`flex items-center text-[10px] uppercase font-bold tracking-widest px-2 py-1 rounded ${isSaved ? 'text-green-500 bg-green-500/10' : 'text-amber-500 bg-amber-500/10 animate-pulse'}`}
            >
              {isSaved ? '● Saved' : '○ Saving...'}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex items-center space-x-1">
          <Button
            variant={zenMode ? "secondary" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setZenMode(!zenMode)}
            title="Zen Mode"
          >
            {zenMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>

          <Separator orientation="vertical" className="h-6 mx-1" />

          <Button
            variant={showPreview ? "secondary" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setShowPreview(!showPreview)}
            title="Toggle Preview"
          >
            {showPreview ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>

          {showPreview && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="default" size="sm" className="h-8 px-3 text-xs shadow-sm">
                  <FileDown className="h-3.5 w-3.5 mr-1.5" /> Экспорт
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={handleSavePreviewAsDoc}>Word (.doc)</DropdownMenuItem>
                <DropdownMenuItem onClick={handleSavePreviewAsDocx}>Word (.docx)</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleCopyPreview}>
                  <Copy className="h-4 w-4 mr-2" /> Копировать HTML
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Main Workspace with Resizable Panels */}
      <div className="flex-1 overflow-hidden">
        <PanelGroup direction="horizontal">
          <Panel defaultSize={50} minSize={20} className="flex flex-col h-full bg-background border-r">
            <div className="bg-muted/30 px-4 py-1.5 border-b text-[11px] font-medium text-muted-foreground flex justify-between items-center shrink-0">
              <div className="flex items-center gap-2">
                <FileText className="h-3 w-3" />
                <span>{currentFile}</span>
              </div>
              <span className="opacity-50">Markdown Editor</span>
            </div>
            <div className="flex-1 overflow-hidden relative">
              <CodeMirror
                value={content}
                height="100%"
                theme={oneDark}
                extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
                onChange={handleContentChange}
                ref={editorRef}
                onScroll={handleScroll}
                className="h-full text-sm"
                basicSetup={{
                  lineNumbers: true,
                  foldGutter: true,
                  highlightActiveLine: true,
                  autocompletion: true,
                }}
              />
            </div>
          </Panel>

          {showPreview && !zenMode && (
            <>
              <PanelResizeHandle className="w-1.5 hover:w-1.5 hover:bg-primary/20 transition-colors flex items-center justify-center group relative">
                <div className="w-px h-8 bg-border group-hover:bg-primary/50 transition-colors" />
              </PanelResizeHandle>
              <Panel defaultSize={50} minSize={20} className="flex flex-col h-full bg-background">
                <div className="bg-muted/30 px-4 py-1 border-b text-[11px] font-medium text-muted-foreground flex justify-between items-center shrink-0">
                  <div className="flex items-center space-x-1 bg-background/50 p-0.5 rounded-md border">
                    <button
                      className={`px-3 py-0.5 rounded text-[10px] transition-all ${previewMode === 'html' ? 'bg-background shadow-sm text-foreground font-semibold' : 'hover:text-foreground/80'}`}
                      onClick={() => setPreviewMode('html')}
                    >
                      HTML
                    </button>
                    <button
                      className={`px-3 py-0.5 rounded text-[10px] transition-all ${previewMode === 'word' ? 'bg-background shadow-sm text-foreground font-semibold' : 'hover:text-foreground/80'}`}
                      onClick={() => setPreviewMode('word')}
                    >
                      Word
                    </button>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="xs"
                      className="h-6 px-2 text-[10px] hover:bg-background border border-transparent hover:border-border transition-all"
                      onClick={handleCopyPreview}
                    >
                      <Copy className="h-3 w-3 mr-1" /> Копировать
                    </Button>
                    <span className="opacity-50">Preview</span>
                  </div>
                </div>

                <div className="flex-1 overflow-auto p-8 bg-muted/5 scroll-smooth" ref={previewRef} onScroll={handleScroll}>
                  {previewMode === 'html' ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="prose prose-sm dark:prose-invert max-w-none"
                    >
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
                                className="rounded-md border my-4"
                                {...props}
                              >
                                {String(children).replace(/\n$/, '')}
                              </SyntaxHighlighter>
                            ) : (
                              <code className={`${className} bg-muted px-1 py-0.5 rounded text-xs`} {...props}>
                                {children}
                              </code>
                            )
                          }
                        }}
                      >
                        {content}
                      </ReactMarkdown>
                    </motion.div>
                  ) : (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.98 }}
                      animate={{ opacity: 1, scale: 1 }}
                      ref={wordScrollWrapperRef}
                      onScroll={handleScroll}
                      className="h-full overflow-auto word-preview-wrapper rounded-lg"
                    >
                      <div ref={wordPreviewRef} className="a4-page shadow-2xl transition-shadow hover:shadow-primary/5">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm, remarkMath]}
                          rehypePlugins={[rehypeKatex]}
                        >
                          {content}
                        </ReactMarkdown>
                      </div>
                    </motion.div>
                  )}
                </div>
              </Panel>
            </>
          )}
        </PanelGroup>
      </div>

      {/* Modern Status Bar */}
      <footer className="h-8 border-t bg-card/80 backdrop-blur-md px-4 flex items-center justify-between text-[10px] text-muted-foreground shrink-0 z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Info className="h-3 w-3" />
            <span className="font-medium uppercase tracking-tighter">Stats:</span>
            <span>{stats.words} words</span>
            <Separator orientation="vertical" className="h-3 mx-1" />
            <span>{stats.chars} chars</span>
          </div>
          <div className="flex items-center gap-1.5 ml-2">
            <Clock className="h-3 w-3" />
            <span>~{stats.readTime} min read</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <span className="opacity-60 whitespace-nowrap">UTF-8</span>
            <ChevronRight className="h-3 w-3 opacity-30" />
            <span className="font-semibold text-foreground/80">Markdown</span>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default App
