import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  FileText,
  FilePlus,
  Trash2,
  Edit3,
  Download,
  Upload,
  FileDown,
  FileSpreadsheet,
  Home,
  Search,
  Settings,
  MoreVertical,
  ChevronRight,
  Plus
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarInput,
  useSidebar
} from '@/components/ui/sidebar.jsx';
import { useFiles } from '@/contexts/FileContext.jsx';
import { Button } from '@/components/ui/button.jsx';
import { Separator } from '@/components/ui/separator.jsx';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.jsx";
import { ConfirmDialog } from './ConfirmDialog.jsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog.jsx";
import { Input } from "@/components/ui/input.jsx";
import { Label } from "@/components/ui/label.jsx";

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { files, currentFile, createNewFile, deleteFile, deleteAllFiles, renameFile, switchToFile } = useFiles();
  const [searchQuery, setSearchQuery] = useState('');
  const { setOpenMobile } = useSidebar();

  const [confirmDelete, setConfirmDelete] = useState({ open: false, fileName: '' });
  const [confirmDeleteAll, setConfirmDeleteAll] = useState(false);
  const [renameDialog, setRenameDialog] = useState({ open: false, oldName: '', newName: '' });

  const filteredFiles = Object.keys(files).filter(name =>
    name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleNavigation = (path) => {
    navigate(path);
    setOpenMobile(false);
  };

  const handleBackup = () => {
    const data = JSON.stringify(files, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.body.appendChild(document.createElement('a'));
    link.href = url;
    link.download = `stackedit-workspace-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Бэкап воркспейса сохранен');
  };

  return (
    <Sidebar variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2 font-bold text-xl text-primary">
          <FileText className="h-6 w-6" />
          <span>StackEdit Clone</span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/'}
                  onClick={() => handleNavigation('/')}
                  tooltip="Редактор Markdown"
                >
                  <Home className="h-4 w-4 text-blue-500" />
                  <span>Редактор</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/doc-to-md'}
                  onClick={() => handleNavigation('/doc-to-md')}
                  tooltip="Импорт документов"
                >
                  <FileDown className="h-4 w-4 text-emerald-500" />
                  <span>Документ → MD</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={location.pathname === '/excel-to-md'}
                  onClick={() => handleNavigation('/excel-to-md')}
                  tooltip="Импорт таблиц"
                >
                  <FileSpreadsheet className="h-4 w-4 text-amber-500" />
                  <span>Excel → MD</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator />

        <SidebarGroup>
          <SidebarGroupLabel className="flex items-center justify-between">
            <span>Мои файлы</span>
            <div className="flex gap-1">
              {Object.keys(files).length > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 text-destructive hover:bg-destructive/10"
                  onClick={() => setConfirmDeleteAll(true)}
                  title="Удалить все файлы"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
              <Button variant="ghost" size="icon" className="h-4 w-4" onClick={createNewFile}>
                <FilePlus className="h-3 w-3" />
              </Button>
            </div>
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-2 py-2">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-2.5 h-3 w-3 text-muted-foreground" />
              <SidebarInput
                placeholder="Поиск файлов..."
                className="pl-7 text-xs h-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <SidebarMenu>
              {filteredFiles.length > 0 ? (
                filteredFiles.map((fileName) => (
                  <SidebarMenuItem key={fileName}>
                    <SidebarMenuButton
                      isActive={currentFile === fileName && location.pathname === '/'}
                      onClick={() => {
                        if (location.pathname !== '/') navigate('/');
                        switchToFile(fileName);
                        setOpenMobile(false);
                      }}
                      className="group"
                    >
                      <FileText className="h-4 w-4" />
                      <span className="truncate">{fileName}</span>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="ml-auto h-6 w-6 opacity-0 group-hover:opacity-100"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreVertical className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => {
                            e.stopPropagation();
                            setRenameDialog({ open: true, oldName: fileName, newName: fileName });
                          }}>
                            <Edit3 className="mr-2 h-4 w-4" />
                            <span>Переименовать</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDelete({ open: true, fileName });
                            }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            <span>Удалить</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center p-4 py-8 text-center text-muted-foreground border-2 border-dashed rounded-lg mx-2 my-4">
                  <FilePlus className="h-8 w-8 mb-2 opacity-20" />
                  <p className="text-xs mb-4">У вас пока нет файлов</p>
                  <Button size="sm" variant="outline" onClick={createNewFile}>
                    <Plus className="h-3 w-3 mr-1" /> Создать файл
                  </Button>
                </div>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={handleBackup}>
              <Download className="h-4 w-4" />
              <span>Экспорт Workspace</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <ConfirmDialog
        open={confirmDelete.open}
        onOpenChange={(open) => setConfirmDelete({ ...confirmDelete, open })}
        title="Удалить файл?"
        description={`Вы уверены, что хотите удалить файл "${confirmDelete.fileName}"? Это действие нельзя отменить.`}
        onConfirm={() => deleteFile(confirmDelete.fileName)}
        confirmText="Удалить"
        variant="destructive"
      />

      <ConfirmDialog
        open={confirmDeleteAll}
        onOpenChange={setConfirmDeleteAll}
        title="Удалить все файлы?"
        description="Вы уверены, что хотите удалить ВСЕ файлы? Это действие нельзя отменить."
        onConfirm={() => {
          deleteAllFiles();
          setConfirmDeleteAll(false);
        }}
        confirmText="Удалить всё"
        variant="destructive"
      />

      <Dialog open={renameDialog.open} onOpenChange={(open) => setRenameDialog({ ...renameDialog, open })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Переименовать файл</DialogTitle>
            <DialogDescription>Введите новое имя для файла.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="newName" className="mb-2 block text-sm">Новое имя</Label>
            <Input
              id="newName"
              value={renameDialog.newName}
              onChange={(e) => setRenameDialog({ ...renameDialog, newName: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  renameFile(renameDialog.oldName, renameDialog.newName);
                  setRenameDialog({ ...renameDialog, open: false });
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRenameDialog({ ...renameDialog, open: false })}>Отмена</Button>
            <Button onClick={() => {
              renameFile(renameDialog.oldName, renameDialog.newName);
              setRenameDialog({ ...renameDialog, open: false });
            }}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Sidebar>
  );
}
