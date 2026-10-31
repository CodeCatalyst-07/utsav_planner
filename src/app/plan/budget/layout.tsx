import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Budget & What-If Sandbox | Utsav Planner',
  description:
    'Interactive integer-rupee budget breakdown and zero-network what-if slider simulation for Indian celebrations.',
};

export default function BudgetLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
