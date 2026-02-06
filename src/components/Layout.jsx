import React, { useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar.jsx';
import { AppSidebar } from './AppSidebar.jsx';
import { useFiles } from '@/contexts/FileContext.jsx';
import { importFileToMarkdown, isSupportedImportFile } from '@/lib/importers/index.js';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
import { Separator } from '@/components/ui/separator.jsx';

export function Layout({ children }) {
  const { setFiles, setCurrentFile, setContent } = useFiles();
  const [isDragging, setIsDragging] = useState(false);

  // Глобальный сброс состояния перетаскивания
  React.useEffect(() => {
    const handleGlobalDragReset = () => {
      setIsDragging(false);
    };

    window.addEventListener('drop', handleGlobalDragReset);
    window.addEventListener('dragend', handleGlobalDragReset);

    return () => {
      window.removeEventListener('drop', handleGlobalDragReset);
      window.removeEventListener('dragend', handleGlobalDragReset);
    };
  }, []);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Check if it's a markdown or text file
      if (/\.(md|markdown|txt)$/i.test(file.name)) {
        const text = await file.text();
        const fileName = file.name;
        setFiles(prev => ({ ...prev, [fileName]: text }));
        setCurrentFile(fileName);
        setContent(text);
        toast.success(`Файл ${fileName} открыт`);
        return;
      }

      // Check if it's a supported document for import
      if (isSupportedImportFile(file.name)) {
        const importPromise = importFileToMarkdown(file);
        toast.promise(importPromise, {
          loading: `Импорт ${file.name}...`,
          success: (result) => {
            const fileName = `${file.name.replace(/\.[^.]+$/, '')}.md`;
            setFiles(prev => ({ ...prev, [fileName]: result.markdown }));
            setCurrentFile(fileName);
            setContent(result.markdown);
            return `Файл ${file.name} импортирован как ${fileName}`;
          },
          error: (err) => {
            console.error('Ошибка в Layout handleDrop:', err);
            return `Ошибка импорта: ${err.message || String(err)}`;
          }
        });
        return;
      }

      toast.error('Формат файла не поддерживается');
    }
  };

  return (
    <SidebarProvider>
      <div
        className="flex min-h-screen w-full relative"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 z-50 bg-primary/10 backdrop-blur-sm border-2 border-dashed border-primary flex items-center justify-center pointer-events-none">
            <div className="bg-background p-6 rounded-xl shadow-xl flex flex-col items-center gap-4 border animate-in zoom-in-95 duration-200">
              <div className="bg-primary/20 p-4 rounded-full">
                <Upload className="h-12 w-12 text-primary animate-bounce" />
              </div>
              <div className="text-center">
                <p className="text-lg font-semibold">Отпустите, чтобы открыть файл</p>
                <p className="text-sm text-muted-foreground">Markdown, Word, PDF или Excel</p>
              </div>
            </div>
          </div>
        )}
        <AppSidebar />
        <SidebarInset className="flex flex-col h-screen overflow-hidden">
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 bg-background/50 backdrop-blur-md sticky top-0 z-30 justify-between">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1 h-8 w-8" />
              <Separator orientation="vertical" className="h-4" />
              <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest px-2">
                Workspace
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Could add user profile or settings here later */}
            </div>
          </header>
          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
