import type { Metadata } from 'next'
import { ReactNode } from 'react'
import { ThemeProvider } from '@/components/theme-provider'
import { Toaster } from '@/components/ui/sonner'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Factory Board - TV Display',
  description: 'Manufacturing planning board TV display mode',
}

export default function TVLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          {children as any}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  )
}