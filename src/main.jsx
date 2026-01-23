import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Toaster } from '@/components/ui/sonner.jsx'
import { HashRouter, Routes, Route } from 'react-router-dom'
import DocToMd from '@/pages/DocToMd.jsx'
import ExcelToMd from '@/pages/ExcelToMd.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/doc-to-md" element={<DocToMd />} />
        <Route path="/excel-to-md" element={<ExcelToMd />} />
      </Routes>
      <Toaster richColors closeButton={false} />
    </HashRouter>
  </StrictMode>,
)
