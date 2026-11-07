import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Observability Dashboard Engine | API & Telemetry Monitoring',
  description: 'Enterprise-grade Frontend Observability & API Monitoring Dashboard.',
  openGraph: {
    title: 'Observability Dashboard Engine | API & Telemetry Monitoring',
    description: 'Enterprise-grade Frontend Observability & API Monitoring Dashboard.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Observability Dashboard Engine | API & Telemetry Monitoring',
    description: 'Enterprise-grade Frontend Observability & API Monitoring Dashboard.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const storedTheme = localStorage.getItem('theme');
                if (storedTheme === 'light') {
                  document.documentElement.classList.remove('dark');
                } else {
                  document.documentElement.classList.add('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="bg-canvas text-customText font-sans antialiased selection:bg-indigo-500/30 selection:text-indigo-200 min-h-screen">
        {children}
      </body>
    </html>
  );
}
