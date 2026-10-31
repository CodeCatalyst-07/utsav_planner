import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Vendor Directory & Checklist | Utsav Planner',
  description:
    'Vendor checklist with sample listings, honest disclaimers, and universal Google Maps search links.',
};

export default function VendorsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
