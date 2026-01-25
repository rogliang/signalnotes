import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Signal Notes',
  description: 'CEO-driven decision extraction and prioritization system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
