import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
import './index.css'
import App from './App.tsx'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        toastOptions={{
          classNames: {
            toast: '!rounded-lg !border !border-border !bg-surface !shadow-elevated !text-sm',
            title: '!text-ink-900 !font-medium',
            description: '!text-ink-500',
            success: '!border-success-600/30',
            error: '!border-danger-600/30',
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
)
