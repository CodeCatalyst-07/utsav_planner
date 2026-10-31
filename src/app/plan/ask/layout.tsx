import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Ask Event Assistant | Utsav Planner',
  description:
    'Conversational event planning assistant with structured plan update proposals and verified preview.',
};

export default function AskLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
