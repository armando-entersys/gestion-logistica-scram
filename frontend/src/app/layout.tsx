import type { Metadata } from 'next';
import ThemeRegistry from '@/theme/ThemeRegistry';
import { Providers } from './providers';

export const metadata: Metadata = {
  title: 'SCRAM - Sistema de Gestión Logística',
  description: 'Sistema de Despacho y Última Milla',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <ThemeRegistry>
          <Providers>{children}</Providers>
        </ThemeRegistry>
      </body>
    </html>
  );
}
