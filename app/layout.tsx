import type { Metadata } from 'next';
import './globals.css';
import MetaPixel from '@/components/MetaPixel';
import { Toasts } from '@/components/ui';

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NOME || 'Prospecta SC',
  description: 'Prospecção B2B em Santa Catarina — base CNPJ, Google Maps e CRM',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Toasts />
        <MetaPixel />
      </body>
    </html>
  );
}
