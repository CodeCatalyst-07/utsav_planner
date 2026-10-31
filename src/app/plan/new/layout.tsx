import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Event Blueprint Wizard | Utsav Planner',
  description:
    'Step-by-step event wizard calculating instant, deterministic wedding and festival plans.',
};

export default function NewPlanLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
