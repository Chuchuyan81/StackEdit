import React, { createContext, useContext, useState, useEffect } from 'react';

const FileContext = createContext();

const DEFAULT_CONTENT = `# Welcome to StackEdit Clone!

Hi! I'm your first Markdown file in **StackEdit Clone**. If you want to learn about StackEdit Clone, you can read me. If you want to play with Markdown, you can edit me. Once you have finished with me, you can create new files by opening the **file explorer** in the sidebar.

## Files

StackEdit Clone stores your files in your browser, which means all your files are automatically saved locally and are accessible **offline!**

## Create files and folders

You can create a new file by clicking the **New file** button in the sidebar.

## Switch to another file

All your files are presented in the sidebar. You can switch from one to another by clicking a file.

## Rename a file

You can rename the current file by clicking the **Rename** button in the toolbar or sidebar.

## Delete a file

You can delete the current file by clicking the **Delete** button in the toolbar or sidebar.

> **Note:** This is a simplified clone of StackEdit with local file management. Advanced features like cloud synchronization and publishing are not included in this version.
`;

export function FileProvider({ children }) {
  const [files, setFiles] = useState({});
  const [currentFile, setCurrentFile] = useState('Welcome.md');
  const [content, setContent] = useState(DEFAULT_CONTENT);

  // Загрузка файлов из localStorage при монтировании
  useEffect(() => {
    const savedFiles = localStorage.getItem('stackedit-files');
    if (savedFiles) {
      const parsedFiles = JSON.parse(savedFiles);
      setFiles(parsedFiles);
      
      if (parsedFiles['Welcome.md']) {
        setContent(parsedFiles['Welcome.md']);
      }
    } else {
      const initialFiles = { 'Welcome.md': DEFAULT_CONTENT };
      setFiles(initialFiles);
      localStorage.setItem('stackedit-files', JSON.stringify(initialFiles));
    }
  }, []);

  // Автосохранение текущего файла
  useEffect(() => {
    if (currentFile && content !== undefined) {
      setFiles(prev => {
        const next = { ...prev, [currentFile]: content };
        localStorage.setItem('stackedit-files', JSON.stringify(next));
        return next;
      });
    }
  }, [content, currentFile]);

  const createNewFile = () => {
    const fileName = `Untitled-${Date.now()}.md`;
    const newContent = '# New Document\n\nStart writing your content here...';
    setFiles(prev => {
      const next = { ...prev, [fileName]: newContent };
      localStorage.setItem('stackedit-files', JSON.stringify(next));
      return next;
    });
    setCurrentFile(fileName);
    setContent(newContent);
  };

  const deleteFile = (fileName) => {
    if (Object.keys(files).length <= 1) {
      return false;
    }
    
    setFiles(prev => {
      const next = { ...prev };
      delete next[fileName];
      localStorage.setItem('stackedit-files', JSON.stringify(next));
      
      if (fileName === currentFile) {
        const remainingFiles = Object.keys(next);
        const nextFile = remainingFiles[0];
        setCurrentFile(nextFile);
        setContent(next[nextFile]);
      }
      return next;
    });
    return true;
  };

  const renameFile = (oldName, newName) => {
    if (!newName.trim() || oldName === newName || files[newName]) {
      return false;
    }

    setFiles(prev => {
      const next = { ...prev };
      next[newName] = next[oldName];
      delete next[oldName];
      localStorage.setItem('stackedit-files', JSON.stringify(next));
      
      if (oldName === currentFile) {
        setCurrentFile(newName);
      }
      return next;
    });
    return true;
  };

  const switchToFile = (fileName) => {
    if (files[fileName] !== undefined) {
      setCurrentFile(fileName);
      setContent(files[fileName]);
    }
  };

  const deleteAllFiles = () => {
    const initialFiles = { 'Welcome.md': DEFAULT_CONTENT };
    setFiles(initialFiles);
    setCurrentFile('Welcome.md');
    setContent(DEFAULT_CONTENT);
    localStorage.setItem('stackedit-files', JSON.stringify(initialFiles));
  };

  return (
    <FileContext.Provider value={{
      files,
      currentFile,
      content,
      setContent,
      createNewFile,
      deleteFile,
      renameFile,
      switchToFile,
      deleteAllFiles,
      setFiles
    }}>
      {children}
    </FileContext.Provider>
  );
}

export function useFiles() {
  const context = useContext(FileContext);
  if (!context) {
    throw new Error('useFiles must be used within a FileProvider');
  }
  return context;
}
