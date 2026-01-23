import React, { useState } from 'react';
import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar.jsx';
import { AppSidebar } from './AppSidebar.jsx';
import { useFiles } from '@/contexts/FileContext.jsx';
import { importFileToMarkdown, isSupportedImportFile } from '@/lib/importers/index.js';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';

export function Layout({ children }) {
  const { setFiles, setCurrentFile, setContent } = useFiles();
  const [isDragging, setIsDragging] = useState(false);

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
        toast.promise(importFileToMarkdown(file), {
          loading: `Импорт ${file.name}...`,
          success: (result) => {
            const fileName = `${file.name.replace(/\.[^.]+$/, '')}.md`;
            setFiles(prev => ({ ...prev, [fileName]: result.markdown }));
            setCurrentFile(fileName);
            setContent(result.markdown);
            return `Файл ${file.name} импортирован как ${fileName}`;
          },
          error: (err) => `Ошибка импорта: ${err.message}`
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
          <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 bg-card">
            <SidebarTrigger className="-ml-1" />
          </header>
          <main className="flex-1 overflow-hidden">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
