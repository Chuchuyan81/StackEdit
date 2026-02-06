import React, { createContext, useContext, useState, useEffect } from 'react';

const FileContext = createContext();

const DEFAULT_CONTENT = `# Добро пожаловать в StackEdit Clone!

Привет! Это ваш первый Markdown-файл в **StackEdit Clone**. Если вы хотите узнать больше о приложении, прочитайте меня. Если хотите попрактиковаться в Markdown — можете смело редактировать этот текст. Как только закончите, вы сможете создавать новые файлы через **проводник** в боковой панели.

## Файлы

StackEdit Clone хранит ваши файлы прямо в браузере. Это значит, что все данные автоматически сохраняются локально и доступны в **офлайн-режиме!**

## Создание файлов и папок

Вы можете создать новый файл, нажав кнопку **"Создать файл"** в боковой панели.

## Переключение между файлами

Все ваши файлы отображаются в боковой панели. Вы можете переключаться между ними, просто нажимая на название файла.

## Переименование файла

Вы можете переименовать текущий файл, нажав кнопку **"Переименовать"** в панели инструментов или в боковой панели.

## Удаление файла

Вы можете удалить текущий файл, нажав кнопку **"Удалить"** в панели инструментов или в боковой панели.

> **Примечание:** Это упрощенный клон StackEdit для локального управления файлами. Продвинутые функции, такие как облачная синхронизация и публикация, не включены в эту версию.
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
    const newContent = '# Новый документ\n\nНачните писать здесь...';
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
