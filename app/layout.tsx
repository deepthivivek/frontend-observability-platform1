import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Observability Dashboard Engine | API & Telemetry Monitoring',
  description: 'Enterprise-grade Frontend Observability & API Monitoring Dashboard for high-throughput telemetry datasets.',
  openGraph: {
    title: 'Observability Dashboard Engine | API & Telemetry Monitoring',
    description: 'Enterprise-grade Frontend Observability & API Monitoring Dashboard for high-throughput telemetry datasets.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Observability Dashboard Engine | API & Telemetry Monitoring',
    description: 'Enterprise-grade Frontend Observability & API Monitoring Dashboard for high-throughput telemetry datasets.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
