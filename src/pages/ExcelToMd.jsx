import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button.jsx'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx'
import { Separator } from '@/components/ui/separator.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select.jsx'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip.jsx'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import {
  Upload, FileSpreadsheet, Trash2, Copy, FileDown,
  ArrowLeftRight, SortAsc, AlignLeft, AlignCenter, AlignRight,
  Plus, Minus, Search, ClipboardPaste, Replace, Eraser, Save
} from 'lucide-react'
import { useFiles } from '@/contexts/FileContext.jsx'
import { ConfirmDialog } from '@/components/ConfirmDialog.jsx'

export default function ExcelToMd() {
  const navigate = useNavigate()
  const { setFiles, setCurrentFile, setContent } = useFiles()
  const fileInputRef = useRef(null)

  const [workbook, setWorkbook] = useState(null)
  const [sheetNames, setSheetNames] = useState([])
  const [activeSheet, setActiveSheet] = useState('')
  const [tableData, setTableData] = useState([])
  const [fileName, setFileName] = useState('')
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [useRegex, setUseRegex] = useState(false)

  const [alignment, setAlignment] = useState('left')
  const [boldHeader, setBoldHeader] = useState(true)
  const [boldColumns, setBoldColumns] = useState(false)
  const [showRowNumbers, setShowRowNumbers] = useState(false)
  const [prettyPrint, setPrettyPrint] = useState(true)
  const [outputFormat, setOutputFormat] = useState('markdown')

  const [confirmReset, setConfirmReset] = useState(false)

  // Persistence: Load state from localStorage on mount
  useEffect(() => {
    const savedTableData = localStorage.getItem('excel-to-md-table-data')
    const savedFileName = localStorage.getItem('excel-to-md-file-name')
    if (savedTableData) {
      setTableData(JSON.parse(savedTableData))
    }
    if (savedFileName) {
      setFileName(savedFileName)
    }
  }, [])

  // Persistence: Save state to localStorage on change
  useEffect(() => {
    if (tableData.length > 0) {
      localStorage.setItem('excel-to-md-table-data', JSON.stringify(tableData))
      localStorage.setItem('excel-to-md-file-name', fileName)
    }
  }, [tableData, fileName])

  const handleOpenFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
      fileInputRef.current.click()
    }
  }

  const loadWorkbook = async (file) => {
    try {
      setFileName(file.name)
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      setWorkbook(wb)
      setSheetNames(wb.SheetNames)
      setActiveSheet(wb.SheetNames[0])

      const sheet = wb.Sheets[wb.SheetNames[0]]
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: true })
      setTableData(aoa)
      setPasteMode(false)
      toast.success('Файл успешно загружен')
    } catch (error) {
      console.error('Ошибка загрузки Excel:', error)
      toast.error('Не удалось прочитать Excel файл')
    }
  }

  const onFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) loadWorkbook(file)
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.xls') || file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm'))) {
      loadWorkbook(file)
    } else if (file) {
      toast.error('Поддерживаются только файлы Excel')
    }
  }

  const handleReset = () => {
    setWorkbook(null)
    setSheetNames([])
    setActiveSheet('')
    setTableData([])
    setFileName('')
    setSearchQuery('')
    setReplaceQuery('')
    setPasteMode(false)
    setPasteValue('')
    localStorage.removeItem('excel-to-md-table-data')
    localStorage.removeItem('excel-to-md-file-name')
    toast.success('Все данные сброшены')
  }

  const handlePasteData = () => {
    if (!pasteValue.trim()) return
    try {
      const rows = pasteValue.trim().split('\n').map(row => row.split('\t'))
      setTableData(rows)
      setFileName('Вставленные данные')
      setPasteMode(false)
      setPasteValue('')
      setSheetNames([])
      toast.success('Данные вставлены')
    } catch (e) {
      toast.error('Ошибка разбора данных')
    }
  }

  const handleSheetChange = (name) => {
    setActiveSheet(name)
    if (workbook) {
      const sheet = workbook.Sheets[name]
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: true })
      setTableData(aoa)
    }
  }

  const updateCell = (rowIndex, colIndex, value) => {
    const newData = [...tableData]
    if (!newData[rowIndex]) newData[rowIndex] = []
    newData[rowIndex][colIndex] = value
    setTableData(newData)
  }

  const handleKeyDown = (e, rowIdx, colIdx) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      const nextColIdx = e.shiftKey ? colIdx - 1 : colIdx + 1
      const targetRow = (nextColIdx < 0) ? rowIdx - 1 : (nextColIdx >= tableData[0].length ? rowIdx + 1 : rowIdx)
      const targetCol = (nextColIdx < 0) ? tableData[0].length - 1 : (nextColIdx >= tableData[0].length ? 0 : nextColIdx)

      if (targetRow >= 0 && targetRow < tableData.length) {
        document.querySelector(`input[data-row="${targetRow}"][data-col="${targetCol}"]`)?.focus()
      }
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const nextRowIdx = e.shiftKey ? rowIdx - 1 : rowIdx + 1
      if (nextRowIdx >= 0 && nextRowIdx < tableData.length) {
        document.querySelector(`input[data-row="${nextRowIdx}"][data-col="${colIdx}"]`)?.focus()
      }
    }
  }

  const transposeTable = () => {
    if (tableData.length === 0) return
    const width = tableData[0]?.length || 0
    const newData = Array.from({ length: width }, (_, colIndex) =>
      tableData.map(row => row[colIndex] || '')
    )
    setTableData(newData)
    toast.success('Транспонировано')
  }

  const deleteRow = (index) => {
    const newData = tableData.filter((_, i) => i !== index)
    setTableData(newData)
  }

  const deleteColumn = (colIndex) => {
    const newData = tableData.map(row => row.filter((_, i) => i !== colIndex))
    setTableData(newData)
  }

  const addRow = () => {
    const width = tableData[0]?.length || 1
    setTableData([...tableData, Array(width).fill('')])
  }

  const addColumn = () => {
    const newData = tableData.map(row => [...row, ''])
    setTableData(newData)
  }

  const sortTable = (colIndex) => {
    const header = tableData[0]
    const body = tableData.slice(1)
    body.sort((a, b) => {
      const valA = String(a[colIndex] || '')
      const valB = String(b[colIndex] || '')
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
    })
    setTableData([header, ...body])
  }

  const removeEmptyRows = () => {
    const newData = tableData.filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
    setTableData(newData)
    toast.success('Пустые строки удалены')
  }

  const handleReplace = () => {
    if (!searchQuery) return
    try {
      const newData = tableData.map(row =>
        row.map(cell => {
          const val = String(cell || '')
          if (useRegex) {
            const re = new RegExp(searchQuery, 'g')
            return val.replace(re, replaceQuery)
          }
          return val.split(searchQuery).join(replaceQuery)
        })
      )
      setTableData(newData)
      toast.success('Замена выполнена')
    } catch (e) {
      toast.error('Ошибка в регулярном выражении')
    }
  }

  const resultOutput = useMemo(() => {
    if (tableData.length === 0) return ''
    const rows = tableData
    const width = rows.reduce((w, r) => Math.max(w, r.length), 0)

    const normalize = (val) => {
      if (val === null || val === undefined) return ''
      return String(val).replace(/\|/g, '\\|').replace(/\n/g, '<br>')
    }

    if (outputFormat === 'csv') {
      return rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(',')).join('\n')
    }

    if (outputFormat === 'json') {
      const header = rows[0] || []
      const body = rows.slice(1).map(r => {
        const obj = {}
        header.forEach((h, i) => {
          obj[h || `col_${i + 1}`] = r[i] || null
        })
        return obj
      })
      return JSON.stringify(body, null, 2)
    }

    if (outputFormat === 'html') {
      const headerHtml = `<thead>\n  <tr>\n${(rows[0] || []).map(c => `    <th>${c || ''}</th>`).join('\n')}\n  </tr>\n</thead>`
      const bodyHtml = `<tbody>\n${rows.slice(1).map(r => `  <tr>\n${r.map(c => `    <td>${c || ''}</td>`).join('\n')}\n  </tr>`).join('\n')}\n</tbody>`
      return `<table border="1">\n${headerHtml}\n${bodyHtml}\n</table>`
    }

    // Markdown
    let header = Array.from({ length: width }, (_, i) => {
      let val = normalize(rows[0]?.[i])
      return boldHeader && val ? `**${val}**` : val
    })

    const alignMap = { left: ':---', center: ':---:', right: '---:' }
    let sep = Array.from({ length: width }, () => alignMap[alignment] || '---')

    let body = rows.slice(1).map(r => {
      return Array.from({ length: width }, (_, i) => {
        let val = normalize(r[i])
        return boldColumns && i === 0 && val ? `**${val}**` : val
      })
    })

    if (showRowNumbers) {
      header = ['#', ...header]
      sep = ['---', ...sep]
      body = body.map((r, i) => [String(i + 1), ...r])
    }

    const allRows = [header, sep, ...body]

    if (prettyPrint) {
      const colWidths = Array(allRows[0].length).fill(0)
      allRows.forEach(row => {
        row.forEach((cell, i) => {
          colWidths[i] = Math.max(colWidths[i], String(cell).length)
        })
      })

      return allRows.map(row => {
        return '| ' + row.map((cell, i) => String(cell).padEnd(colWidths[i])).join(' | ') + ' |'
      }).join('\n')
    }

    return allRows.map(row => `| ${row.join(' | ')} |`).join('\n')
  }, [tableData, alignment, boldHeader, boldColumns, showRowNumbers, prettyPrint, outputFormat])

  const handleSaveToEditor = () => {
    if (!resultOutput) return
    const name = `${(fileName || 'table').replace(/\.[^.]+$/, '')}.md`
    setFiles(prev => ({ ...prev, [name]: resultOutput }))
    setCurrentFile(name)
    setContent(resultOutput)
    toast.success(`Таблица добавлена в редактор как "${name}"`)
    navigate('/')
  }

  const handleDownloadMd = () => {
    if (!resultOutput) return
    const name = `${(fileName || 'table').replace(/\.[^.]+$/, '')}.md`
    const blob = new Blob([resultOutput], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Файл "${name}" сохранен`)
  }

  const filteredData = useMemo(() => {
    if (!searchQuery || useRegex) return tableData
    const q = searchQuery.toLowerCase()
    return tableData.filter((row, idx) => {
      if (idx === 0) return true
      return row.some(cell => String(cell || '').toLowerCase().includes(q))
    })
  }, [tableData, searchQuery, useRegex])

  return (
    <TooltipProvider>
      <div className="h-full flex flex-col bg-background p-4 overflow-hidden">
        <div className="flex items-center justify-between mb-4 shrink-0">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-green-600" />
              Excel → Markdown
            </h1>
            <p className="text-sm text-muted-foreground">Редактирование таблиц и экспорт</p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmReset(true)}>
              <Eraser className="h-4 w-4 mr-2" /> Сбросить
            </Button>
            <Button variant="outline" size="sm" onClick={() => setPasteMode(!pasteMode)}>
              <ClipboardPaste className="h-4 w-4 mr-2" /> Вставить данные
            </Button>
            <Button size="sm" onClick={handleOpenFileDialog}>
              <Upload className="h-4 w-4 mr-2" /> {fileName || 'Загрузить Excel'}
            </Button>
            <input type="file" ref={fileInputRef} onChange={onFileChange} accept=".xls,.xlsx,.xlsm" className="hidden" />
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-hidden">
          {/* Editor Area */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="py-2 px-4 border-b bg-muted/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search className="h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-7 w-32 text-xs"
                  />
                  <Replace className="h-3.5 w-3.5 text-muted-foreground ml-2" />
                  <Input
                    placeholder="Замена..."
                    value={replaceQuery}
                    onChange={(e) => setReplaceQuery(e.target.value)}
                    className="h-7 w-32 text-xs"
                  />
                  <Button variant="secondary" size="xs" onClick={handleReplace}>Заменить всё</Button>
                </div>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="xs" onClick={transposeTable}>
                        <ArrowLeftRight className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Транспонировать таблицу</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="xs" onClick={addRow}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Добавить строку</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="xs" onClick={addColumn}>
                        <Plus className="h-3.5 w-3.5 mr-0.5" /><FileSpreadsheet className="h-2.5 w-2.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Добавить колонку</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto p-0">
              {pasteMode && (
                <div className="p-4 border-b bg-accent/5">
                  <Textarea
                    placeholder="Вставьте данные из Excel здесь..."
                    value={pasteValue}
                    onChange={(e) => setPasteValue(e.target.value)}
                    className="min-h-[100px] text-xs font-mono mb-2"
                  />
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="xs" onClick={() => setPasteMode(false)}>Отмена</Button>
                    <Button size="xs" onClick={handlePasteData}>Импортировать</Button>
                  </div>
                </div>
              )}

              {tableData.length > 0 ? (
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead className="w-8 text-center p-0">#</TableHead>
                      {tableData[0]?.map((_, colIdx) => (
                        <TableHead key={colIdx} className="min-w-[100px] py-1">
                          <div className="flex items-center justify-between group">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Кол. {colIdx + 1}</span>
                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => sortTable(colIdx)} className="p-0.5 hover:bg-accent rounded"><SortAsc className="h-3 w-3" /></button>
                              <button onClick={() => deleteColumn(colIdx)} className="p-0.5 hover:bg-destructive/10 text-destructive rounded"><Trash2 className="h-3 w-3" /></button>
                            </div>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        <TableCell className="text-center text-[10px] text-muted-foreground p-0">{rowIdx + 1}</TableCell>
                        {Array.from({ length: tableData[0]?.length || 0 }).map((_, colIdx) => (
                          <TableCell key={colIdx} className="p-0">
                            <input
                              value={row[colIdx] || ''}
                              onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, rowIdx, colIdx)}
                              data-row={rowIdx}
                              data-col={colIdx}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-inset focus:ring-primary px-2 py-1 text-xs"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="w-6 p-0">
                          <button onClick={() => deleteRow(rowIdx)} className="opacity-0 hover:opacity-100 p-1 text-destructive hover:bg-destructive/10 rounded"><Minus className="h-3 w-3" /></button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`h-full flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed m-4 rounded-lg transition-colors ${isDragging ? 'border-primary bg-primary/5' : 'border-muted'}`}
                >
                  <FileSpreadsheet className="h-12 w-12 mb-2 opacity-10" />
                  <p className="text-sm">Загрузите файл или перетащите его сюда</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar Options & Result */}
          <div className="w-full md:w-80 flex flex-col gap-4 shrink-0 overflow-hidden">
            <Card className="shrink-0">
              <CardHeader className="py-3 px-4 border-b">
                <CardTitle className="text-xs uppercase font-bold text-muted-foreground">Настройки вывода</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase font-bold opacity-50">Формат</Label>
                  <Select value={outputFormat} onValueChange={setOutputFormat}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="markdown">Markdown</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                      <SelectItem value="html">HTML</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {outputFormat === 'markdown' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center space-x-2 border rounded p-2 bg-muted/20">
                      <Checkbox id="boldH" checked={boldHeader} onCheckedChange={setBoldHeader} />
                      <Label htmlFor="boldH" className="text-[10px] font-medium cursor-pointer">Жирный заголовок</Label>
                    </div>
                    <div className="flex items-center space-x-2 border rounded p-2 bg-muted/20">
                      <Checkbox id="pretty" checked={prettyPrint} onCheckedChange={setPrettyPrint} />
                      <Label htmlFor="pretty" className="text-[10px] font-medium cursor-pointer">Pretty MD</Label>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="flex-1 flex flex-col min-h-0 overflow-hidden">
              <CardHeader className="py-2 px-4 border-b flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs uppercase font-bold text-muted-foreground">Результат</CardTitle>
                <div className="flex items-center gap-1">
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={() => {
                      navigator.clipboard.writeText(resultOutput)
                      toast.success('Скопировано')
                    }}
                    title="Копировать Markdown"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                  <Button
                    size="xs"
                    variant="ghost"
                    onClick={handleDownloadMd}
                    disabled={!resultOutput || tableData.length === 0}
                    title="Скачать .md файл"
                  >
                    <FileDown className="h-3 w-3" />
                  </Button>
                  <Button size="xs" variant="secondary" onClick={handleSaveToEditor}>
                    <Save className="h-3 w-3 mr-1" /> В редактор
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <Textarea
                  value={resultOutput}
                  readOnly
                  className="h-full w-full resize-none border-0 focus-visible:ring-0 font-mono text-[10px] p-4 bg-muted/5"
                />
              </CardContent>
            </Card>
          </div>
        </div>

        <ConfirmDialog
          open={confirmReset}
          onOpenChange={setConfirmReset}
          title="Сбросить данные?"
          description="Все внесенные изменения будут потеряны."
          onConfirm={handleReset}
          confirmText="Сбросить"
          variant="destructive"
        />
      </div>
    </TooltipProvider>
  )
}
