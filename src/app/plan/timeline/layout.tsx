import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Celebration Timeline & Calendar | Utsav Planner',
  description:
    'Milestone planning timeline with RFC 5545 .ics calendar export and Google Calendar links.',
};

export default function TimelineLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
