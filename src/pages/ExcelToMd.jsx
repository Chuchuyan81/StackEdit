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
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { 
  Home, Upload, FileSpreadsheet, Trash2, Copy, FileDown, 
  ArrowLeftRight, SortAsc, Bold, AlignLeft, AlignCenter, AlignRight,
  Plus, Minus, Search, ClipboardPaste, Replace, Eraser, ListOrdered
} from 'lucide-react'

// Все комментарии и сообщения — на русском языке.

export default function ExcelToMd() {
  const navigate = useNavigate()
  const fileInputRef = useRef(null)
  
  const [workbook, setWorkbook] = useState(null)
  const [sheetNames, setSheetNames] = useState([])
  const [activeSheet, setActiveSheet] = useState('')
  const [tableData, setTableData] = useState([]) // Array of Arrays (AOA)
  const [fileName, setFileName] = useState('')
  const [pasteMode, setPasteMode] = useState(false)
  const [pasteValue, setPasteValue] = useState('')
  const [isDragging, setIsDragging] = useState(false)
  
  // Настройки поиска и замены
  const [searchQuery, setSearchQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [useRegex, setUseRegex] = useState(false)

  // Настройки конвертации
  const [alignment, setAlignment] = useState('left') // left | center | right
  const [boldHeader, setBoldHeader] = useState(true)
  const [boldColumns, setBoldColumns] = useState(false)
  const [showRowNumbers, setShowRowNumbers] = useState(false)
  const [prettyPrint, setPrettyPrint] = useState(true)
  const [outputFormat, setOutputFormat] = useState('markdown') // markdown | csv | json | html

  // Загрузка файла
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
    e.stopPropagation()
    setIsDragging(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    const file = e.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.xls') || file.name.endsWith('.xlsx') || file.name.endsWith('.xlsm'))) {
      loadWorkbook(file)
    } else if (file) {
      toast.error('Поддерживаются только файлы Excel (.xls, .xlsx, .xlsm)')
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
    toast.success('Все данные сброшены')
  }

  const handlePasteData = () => {
    if (!pasteValue.trim()) return
    try {
      // Пытаемся распарсить как TSV (копипаст из Excel обычно TSV)
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

  // Переключение листов
  const handleSheetChange = (name) => {
    setActiveSheet(name)
    if (workbook) {
      const sheet = workbook.Sheets[name]
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, blankrows: true })
      setTableData(aoa)
    }
  }

  // Редактирование ячейки
  const updateCell = (rowIndex, colIndex, value) => {
    const newData = [...tableData]
    if (!newData[rowIndex]) newData[rowIndex] = []
    newData[rowIndex][colIndex] = value
    setTableData(newData)
  }

  // Транспонирование
  const transposeTable = () => {
    if (tableData.length === 0) return
    const width = tableData[0]?.length || 0
    const newData = Array.from({ length: width }, (_, colIndex) => 
      tableData.map(row => row[colIndex] || '')
    )
    setTableData(newData)
    toast.success('Таблица транспонирована')
  }

  // Удаление строки
  const deleteRow = (index) => {
    const newData = tableData.filter((_, i) => i !== index)
    setTableData(newData)
  }

  // Удаление колонки
  const deleteColumn = (colIndex) => {
    const newData = tableData.map(row => row.filter((_, i) => i !== colIndex))
    setTableData(newData)
  }

  // Добавление строки
  const addRow = () => {
    const width = tableData[0]?.length || 1
    setTableData([...tableData, Array(width).fill('')])
  }

  // Добавление колонки
  const addColumn = () => {
    const newData = tableData.map(row => [...row, ''])
    setTableData(newData)
  }

  // Сортировка по колонке
  const sortTable = (colIndex) => {
    const header = tableData[0]
    const body = tableData.slice(1)
    body.sort((a, b) => {
      const valA = String(a[colIndex] || '')
      const valB = String(b[colIndex] || '')
      return valA.localeCompare(valB, undefined, { numeric: true, sensitivity: 'base' })
    })
    setTableData([header, ...body])
    toast.success('Отсортировано по колонке ' + (colIndex + 1))
  }

  // Очистка пустых строк
  const removeEmptyRows = () => {
    const newData = tableData.filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== ''))
    setTableData(newData)
    toast.success('Пустые строки удалены')
  }

  // Удаление дубликатов
  const removeDuplicates = () => {
    const seen = new Set()
    const newData = tableData.filter(row => {
      const s = JSON.stringify(row)
      if (seen.has(s)) return false
      seen.add(s)
      return true
    })
    setTableData(newData)
    toast.success('Дубликаты удалены')
  }

  // Поиск и замена
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

  // Генерация результата
  const resultOutput = useMemo(() => {
    if (tableData.length === 0) return ''
    
    // Фильтруем данные для вывода (убираем совсем пустые если надо, но здесь берем все как есть)
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
          colWidths[i] = Math.max(colWidths[i], cell.length)
        })
      })

      return allRows.map(row => {
        return '| ' + row.map((cell, i) => cell.padEnd(colWidths[i])).join(' | ') + ' |'
      }).join('\n')
    }

    return allRows.map(row => `| ${row.join(' | ')} |`).join('\n')
  }, [tableData, alignment, boldHeader, boldColumns, showRowNumbers, prettyPrint, outputFormat])

  const handleCopy = async () => {
    if (!resultOutput) return
    try {
      await navigator.clipboard.writeText(resultOutput)
      toast.success('Результат скопирован')
    } catch (e) {
      toast.error('Ошибка копирования')
    }
  }

  const downloadResult = () => {
    if (!resultOutput) return
    const extensions = { markdown: 'md', csv: 'csv', json: 'json', html: 'html' }
    const mimes = { markdown: 'text/markdown', csv: 'text/csv', json: 'application/json', html: 'text/html' }
    const blob = new Blob([resultOutput], { type: mimes[outputFormat] })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.replace(/\.[^.]+$/, '') || 'table'}.${extensions[outputFormat]}`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Фильтрация данных для отображения (поиск)
  const filteredData = useMemo(() => {
    if (!searchQuery || useRegex) return tableData
    const q = searchQuery.toLowerCase()
    return tableData.filter((row, idx) => {
      if (idx === 0) return true // Всегда показываем заголовок
      return row.some(cell => String(cell || '').toLowerCase().includes(q))
    })
  }, [tableData, searchQuery, useRegex])

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Шапка */}
      <div className="flex items-center justify-between p-2 border-b bg-card">
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" title="Главное меню" onClick={() => navigate('/')}> 
            <Home className="h-4 w-4" />
          </Button>
          <Separator orientation="vertical" className="h-6" />
          <div className="text-sm font-medium flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
            Excel → Markdown
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => setPasteMode(!pasteMode)} title="Вставить данные из буфера">
            <ClipboardPaste className="h-4 w-4 mr-2" />
            Вставить данные
          </Button>
          <Button size="sm" variant="outline" onClick={handleOpenFileDialog}>
            <Upload className="h-4 w-4 mr-2" />
            {fileName || 'Загрузить Excel'}
          </Button>
          <input type="file" ref={fileInputRef} onChange={onFileChange} accept=".xls,.xlsx,.xlsm" className="hidden" />
          
          <Separator orientation="vertical" className="h-6" />
          
          <Button size="sm" variant="ghost" disabled={!resultOutput} onClick={handleCopy}>
            <Copy className="h-4 w-4 mr-2" /> Копировать
          </Button>
          <Button size="sm" variant="ghost" onClick={handleReset} title="Сбросить все данные">
            <Trash2 className="h-4 w-4 mr-2 text-destructive" />
            <span className="text-destructive">Сбросить</span>
          </Button>
          <Button size="sm" variant="secondary" disabled={!resultOutput} onClick={downloadResult}>
            <FileDown className="h-4 w-4 mr-2" /> Скачать
          </Button>
        </div>
      </div>

      <div 
        className="flex-1 overflow-hidden flex flex-col md:flex-row relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary flex items-center justify-center pointer-events-none">
            <div className="bg-background p-6 rounded-xl shadow-xl flex flex-col items-center gap-4 border">
              <div className="bg-primary/20 p-4 rounded-full">
                <Upload className="h-12 w-12 text-primary animate-bounce" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Перетащите сюда файл Excel</p>
                <p className="text-sm text-muted-foreground">.xls, .xlsx, .xlsm</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Левая часть: Редактор таблицы */}
        <div className="flex-1 flex flex-col border-r overflow-hidden">
          <div className="p-3 border-b bg-muted/50 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Поиск..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 max-w-[150px]"
                />
                <Replace className="h-4 w-4 text-muted-foreground ml-2" />
                <Input 
                  placeholder="Замена..." 
                  value={replaceQuery}
                  onChange={(e) => setReplaceQuery(e.target.value)}
                  className="h-8 max-w-[150px]"
                />
                <div className="flex items-center space-x-2 ml-2">
                  <Checkbox id="regex" checked={useRegex} onCheckedChange={setUseRegex} />
                  <Label htmlFor="regex" className="text-xs cursor-pointer">Regex</Label>
                </div>
                <Button variant="secondary" size="sm" className="h-8" onClick={handleReplace}>Заменить всё</Button>
              </div>
              
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={removeEmptyRows} title="Удалить пустые строки">
                  <Eraser className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={removeDuplicates} title="Удалить дубликаты">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={transposeTable} title="Транспонировать">
                  <ArrowLeftRight className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={addRow} title="Добавить строку">
                  <Plus className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={addColumn} title="Добавить колонку">
                  <Plus className="h-4 w-4 mr-0.5" /><FileSpreadsheet className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>

          {sheetNames.length > 1 && (
            <div className="px-3 pt-2">
              <Tabs value={activeSheet} onValueChange={handleSheetChange}>
                <TabsList className="h-8">
                  {sheetNames.map(name => (
                    <TabsTrigger key={name} value={name} className="text-xs">{name}</TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            </div>
          )}

          <div className="flex-1 overflow-auto p-3">
            {pasteMode && (
              <div className="mb-4 space-y-2 p-4 border rounded-lg bg-card shadow-sm">
                <div className="text-sm font-medium">Вставьте данные из Excel или Google Таблиц</div>
                <Textarea 
                  placeholder="Скопируйте ячейки в Excel и вставьте сюда..."
                  value={pasteValue}
                  onChange={(e) => setPasteValue(e.target.value)}
                  className="min-h-[150px] font-mono text-xs"
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setPasteMode(false)}>Отмена</Button>
                  <Button size="sm" onClick={handlePasteData}>Импортировать</Button>
                </div>
              </div>
            )}
            {tableData.length > 0 ? (
              <div className="border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10 text-center">#</TableHead>
                      {tableData[0]?.map((_, colIdx) => (
                        <TableHead key={colIdx} className="min-w-[120px] group relative">
                          <div className="flex items-center justify-between">
                            <span className="truncate">Колонка {colIdx + 1}</span>
                            <div className="flex opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => sortTable(colIdx)}>
                                <SortAsc className="h-3 w-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteColumn(colIdx)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredData.map((row, rowIdx) => (
                      <TableRow key={rowIdx}>
                        <TableCell className="text-center text-xs text-muted-foreground font-mono">
                          {rowIdx + 1}
                        </TableCell>
                        {Array.from({ length: tableData[0]?.length || 0 }).map((_, colIdx) => (
                          <TableCell key={colIdx} className="p-1">
                            <input 
                              value={row[colIdx] || ''} 
                              onChange={(e) => updateCell(rowIdx, colIdx, e.target.value)}
                              className="w-full bg-transparent border-0 focus:ring-1 focus:ring-primary rounded px-2 py-1 text-sm"
                            />
                          </TableCell>
                        ))}
                        <TableCell className="w-10">
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-0 hover:opacity-100" onClick={() => deleteRow(rowIdx)}>
                            <Minus className="h-3 w-3" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <div className="h-full flex flex-center items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileSpreadsheet className="h-12 w-12 mx-auto mb-4 opacity-20" />
                  <p>Загрузите Excel файл для начала работы</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Правая часть: Настройки и Результат */}
        <div className="w-full md:w-[400px] flex flex-col bg-muted/30">
          <div className="p-3 border-b font-medium text-sm flex items-center justify-between">
            Настройки
            <Select value={outputFormat} onValueChange={setOutputFormat}>
              <SelectTrigger className="h-8 w-[120px]">
                <SelectValue placeholder="Формат" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="json">JSON</SelectItem>
                <SelectItem value="html">HTML</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="p-4 space-y-4 overflow-auto flex-shrink-0 max-h-[50%]">
            {outputFormat === 'markdown' && (
              <>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground uppercase">Выравнивание</label>
                  <div className="flex gap-2">
                    <Button 
                      variant={alignment === 'left' ? 'default' : 'outline'} 
                      size="sm" className="flex-1 h-8"
                      onClick={() => setAlignment('left')}
                    >
                      <AlignLeft className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={alignment === 'center' ? 'default' : 'outline'} 
                      size="sm" className="flex-1 h-8"
                      onClick={() => setAlignment('center')}
                    >
                      <AlignCenter className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant={alignment === 'right' ? 'default' : 'outline'} 
                      size="sm" className="flex-1 h-8"
                      onClick={() => setAlignment('right')}
                    >
                      <AlignRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2 p-2 rounded-lg border bg-card">
                    <Checkbox id="boldH" checked={boldHeader} onCheckedChange={setBoldHeader} />
                    <Label htmlFor="boldH" className="text-xs cursor-pointer">Жирный заголовок</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded-lg border bg-card">
                    <Checkbox id="boldC" checked={boldColumns} onCheckedChange={setBoldColumns} />
                    <Label htmlFor="boldC" className="text-xs cursor-pointer">Жирная 1-я кол.</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded-lg border bg-card">
                    <Checkbox id="rowN" checked={showRowNumbers} onCheckedChange={setShowRowNumbers} />
                    <Label htmlFor="rowN" className="text-xs cursor-pointer">Номера строк</Label>
                  </div>
                  <div className="flex items-center space-x-2 p-2 rounded-lg border bg-card">
                    <Checkbox id="pretty" checked={prettyPrint} onCheckedChange={setPrettyPrint} />
                    <Label htmlFor="pretty" className="text-xs cursor-pointer">Pretty MD</Label>
                  </div>
                </div>
              </>
            )}
            {outputFormat !== 'markdown' && (
              <div className="text-xs text-muted-foreground text-center py-4">
                Настройки форматирования специфичны для Markdown
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col overflow-hidden border-t">
            <div className="p-3 border-b bg-muted/50 text-sm font-medium flex items-center justify-between">
              Результат ({outputFormat.toUpperCase()})
              <Button variant="ghost" size="sm" onClick={handleCopy} title="Копировать">
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-3 bg-card">
               <Textarea 
                value={resultOutput}
                readOnly
                className="h-full resize-none font-mono text-[10px] bg-transparent border-0 focus:ring-0 p-0"
                placeholder="Результат появится здесь..."
              />
            </div>
          </div>

          {outputFormat === 'markdown' && (
            <div className="h-[180px] flex flex-col overflow-hidden border-t bg-card">
              <div className="p-2 border-b text-xs font-medium text-muted-foreground uppercase">Предпросмотр</div>
              <div className="flex-1 overflow-auto p-3 prose prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {resultOutput}
                </ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
