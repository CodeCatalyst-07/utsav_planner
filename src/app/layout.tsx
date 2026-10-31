import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import '@/lib/zod-config';
import './globals.css';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { AppNav } from '@/components/layout/nav';
import { SampleBanner } from '@/components/layout/sample-banner';
import { PlanProvider } from '@/context/plan-context';
import { BRAND_DISCLAIMER, BRAND_NAME, BRAND_TAGLINE } from '@/lib/brand';

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
  fallback: ['Georgia', 'serif'],
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  fallback: ['system-ui', '-apple-system', 'sans-serif'],
});

export const viewport: Viewport = {
  themeColor: '#7A1F3D',
};

export const metadata: Metadata = {
  title: `${BRAND_NAME} - ${BRAND_TAGLINE}`,
  description: `${BRAND_NAME}: GenAI celebration and event planner for India. Budgets, timelines, vendor checklists, and personalized ideas. ${BRAND_DISCLAIMER}`,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body className="flex min-h-screen flex-col bg-bg text-ink antialiased">
        {/* Accessible skip-to-content link */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        >
          Skip to main content
        </a>

        <PlanProvider>
          <Header />
          <SampleBanner />

          <div className="flex flex-1 flex-col">{children}</div>

          <Footer />

          {/* Global mobile bottom navigation for <1024px */}
          <AppNav variant="mobile-bottom" />
        </PlanProvider>
      </body>
    </html>
  );
}
