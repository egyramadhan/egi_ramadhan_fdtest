import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from '@/lib/auth-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: {
    default: 'Egi Ramadhan FD Test',
    template: '%s | Egi Ramadhan FD Test'
  },
  description: 'A full-stack application for book management with authentication',
  keywords: ['books', 'authentication', 'full-stack', 'next.js', 'express'],
  authors: [{ name: 'Egi Ramadhan' }],
  creator: 'Egi Ramadhan',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'http://localhost:3000',
    title: 'Egi Ramadhan FD Test',
    description: 'A full-stack application for book management with authentication',
    siteName: 'Egi Ramadhan FD Test',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Egi Ramadhan FD Test',
    description: 'A full-stack application for book management with authentication',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#10b981',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 4000,
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  )
}