import type { Metadata } from 'next';
import ThemeRegistry from '@/theme/ThemeRegistry';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'SCRAM - Sistema de Gestión Logística',
  description: 'Sistema de Despacho y Última Milla',
  icons: {
    icon: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head>
        {/* SCRAM Brand Fonts: Cabin (Headers) + Asap (Body) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Asap:wght@400;500;700&family=Cabin:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeRegistry>
          <Providers>{children}</Providers>
        </ThemeRegistry>
      </body>
    </html>
  );
}
