export const CHAT_STORAGE_KEY = 'utsav_ask_chat_history';
export const MAX_HISTORY = 20;

export const SUGGESTIONS = [
  'What if we cut the guest list to 150?',
  'Move the date to 2027-03-12',
  'Increase the budget by 5 lakh',
  'What should I book first?',
];

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  patch?: Record<string, unknown>;
  diff?: {
    summaryFacts: string[];
    totalDelta?: number;
    cateringEstimateDelta?: number;
    flagsAdded?: string[];
    flagsRemoved?: string[];
    milestonesShifted?: Array<{
      id: string;
      beforeDate: string;
      afterDate: string;
      daysDelta: number;
    }>;
  };
  proposalStatus?: 'pending' | 'applied' | 'dismissed';
}
