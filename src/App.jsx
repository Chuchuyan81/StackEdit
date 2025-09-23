import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
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
  FileText
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { tomorrow } from 'react-syntax-highlighter/dist/esm/styles/prism'
import './App.css'

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

  return (
    <div className="h-screen flex flex-col bg-background">
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

      <div className="flex flex-1 overflow-hidden">
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
              <div className="p-2 border-b bg-muted/50">
                <span className="text-sm font-medium">Preview</span>
              </div>
              <div className="flex-1 overflow-auto p-4 prose prose-sm max-w-none">
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default App

