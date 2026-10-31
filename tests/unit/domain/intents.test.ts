import { describe, it, expect } from 'vitest';
import { parseIntent } from '@/domain/intents/parseIntent';
import { parseInrAmount } from '@/domain/money/inr';
import { weddingPuneFixture } from '@/domain/fixtures/profiles';

describe('Deterministic Intent Parser (src/domain/intents/parseIntent.ts)', () => {
  const TODAY = '2026-10-30';
  const profile = {
    ...weddingPuneFixture,
    guestCount: 200,
    totalBudgetInr: 4_000_000,
  };

  describe('parseInrAmount (domain/money/inr.ts)', () => {
    it('parses lakhs in multiple variations', () => {
      expect(parseInrAmount('5 lakh')).toBe(500_000);
      expect(parseInrAmount('5.5 lakhs')).toBe(550_000);
      expect(parseInrAmount('10 lac')).toBe(1_000_000);
      expect(parseInrAmount('12 lacs')).toBe(1_200_000);
      expect(parseInrAmount('30L')).toBe(3_000_000);
    });

    it('parses crores in multiple variations', () => {
      expect(parseInrAmount('2 crore')).toBe(20_000_000);
      expect(parseInrAmount('1.5 crores')).toBe(15_000_000);
      expect(parseInrAmount('3 cr')).toBe(30_000_000);
      expect(parseInrAmount('0.5 crore')).toBe(5_000_000);
    });

    it('parses thousands and k abbreviations', () => {
      expect(parseInrAmount('50k')).toBe(50_000);
      expect(parseInrAmount('75 k')).toBe(75_000);
      expect(parseInrAmount('80 thousand')).toBe(80_000);
    });

    it('parses Indian grouping with currency prefixes', () => {
      expect(parseInrAmount('Rs 5,00,000')).toBe(500_000);
      expect(parseInrAmount('₹25,00,000')).toBe(2_500_000);
      expect(parseInrAmount('Rs. 1000000')).toBe(1_000_000);
      expect(parseInrAmount('4000000')).toBe(4_000_000);
    });

    it('returns null on invalid or zero amounts', () => {
      expect(parseInrAmount('')).toBeNull();
      expect(parseInrAmount('zero')).toBeNull();
      expect(parseInrAmount('abc')).toBeNull();
      expect(parseInrAmount('0')).toBeNull();
    });
  });

  describe('parseIntent: >= 25 Phrasings & Edge Cases', () => {
    // 1. Guest count variations
    it('1. "What if we cut the guest list to 150?"', () => {
      const res = parseIntent('What if we cut the guest list to 150?', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ guestCount: 150 });
    });

    it('2. "cut guests to 150"', () => {
      const res = parseIntent('cut guests to 150', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ guestCount: 150 });
    });

    it('3. "reduce guest count to 120"', () => {
      const res = parseIntent('reduce guest count to 120', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ guestCount: 120 });
    });

    it('4. "add 50 guests"', () => {
      const res = parseIntent('add 50 guests', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ guestCount: 250 });
    });

    it('5. "increase guest count by 40"', () => {
      const res = parseIntent('increase guest count by 40', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ guestCount: 240 });
    });

    it('6. "reduce guests by 30"', () => {
      const res = parseIntent('reduce guests by 30', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ guestCount: 170 });
    });

    it('7. "guest count 200"', () => {
      const res = parseIntent('guest count 200', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ guestCount: 200 });
    });

    it('8. "set guest list to 300"', () => {
      const res = parseIntent('set guest list to 300', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ guestCount: 300 });
    });

    // 2. Budget variations
    it('9. "budget to 30 lakh"', () => {
      const res = parseIntent('budget to 30 lakh', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ totalBudgetInr: 3_000_000 });
    });

    it('10. "increase budget by 5 lakh"', () => {
      const res = parseIntent('increase budget by 5 lakh', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ totalBudgetInr: 4_500_000 });
    });

    it('11. "reduce budget by 2 lakh"', () => {
      const res = parseIntent('reduce budget by 2 lakh', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ totalBudgetInr: 3_800_000 });
    });

    it('12. "Rs 5,00,000"', () => {
      const res = parseIntent('Rs 5,00,000', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ totalBudgetInr: 500_000 });
    });

    it('13. "2 crore"', () => {
      const res = parseIntent('2 crore', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ totalBudgetInr: 20_000_000 });
    });

    it('14. "set total budget to 50 lakh"', () => {
      const res = parseIntent('set total budget to 50 lakh', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ totalBudgetInr: 5_000_000 });
    });

    // 3. Date variations
    it('15. "move date to 2027-03-12"', () => {
      const res = parseIntent('move date to 2027-03-12', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ eventDate: '2027-03-12' });
    });

    it('16. "move date to 12 Mar 2027"', () => {
      const res = parseIntent('move date to 12 Mar 2027', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ eventDate: '2027-03-12' });
    });

    it('17. "change date to 12 March 2027"', () => {
      const res = parseIntent('change date to 12 March 2027', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ eventDate: '2027-03-12' });
    });

    it('18. "postpone event date to March 12 2027"', () => {
      const res = parseIntent('postpone event date to March 12 2027', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ eventDate: '2027-03-12' });
    });

    it('19. rejects dates in the past as unsupported', () => {
      const res = parseIntent('move date to 2020-01-01', profile, TODAY);
      expect(res.intent).toBe('unsupported');
    });

    // 4. Venue variations
    it('20. "change venue to banquet"', () => {
      const res = parseIntent('change venue to banquet', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ venueType: 'banquet' });
    });

    it('21. "switch venue to resort"', () => {
      const res = parseIntent('switch venue to resort', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ venueType: 'resort' });
    });

    it('22. "venue community hall"', () => {
      const res = parseIntent('venue community hall', profile, TODAY);
      expect(res.intent).toBe('update_plan');
      if (res.intent === 'update_plan') expect(res.patch).toEqual({ venueType: 'community_hall' });
    });

    // 5. Celebration questions
    it('23. "What should I book first?"', () => {
      const res = parseIntent('What should I book first?', profile, TODAY);
      expect(res.intent).toBe('question');
      expect(res.reply).toContain('venue and lead caterer');
    });

    it('24. "How is catering calculated?"', () => {
      const res = parseIntent('How is catering calculated?', profile, TODAY);
      expect(res.intent).toBe('question');
      expect(res.reply).toContain('Catering represents approximately 25%');
    });

    it('25. "Tell me about contingency reserve"', () => {
      const res = parseIntent('Tell me about contingency reserve', profile, TODAY);
      expect(res.intent).toBe('question');
      expect(res.reply).toContain('5% safety floor');
    });

    // 6. Hindi-English mixed phrases (Strict requirement: yield unsupported, not wrong guess)
    it('26. Hindi mix: "guests 150 kar do" yields unsupported', () => {
      const res = parseIntent('guests 150 kar do', profile, TODAY);
      expect(res.intent).toBe('unsupported');
      expect(res.reply).toContain('standard English');
    });

    it('27. Hindi mix: "budget badha do" yields unsupported', () => {
      const res = parseIntent('budget badha do', profile, TODAY);
      expect(res.intent).toBe('unsupported');
    });

    it('28. Hindi mix: "kitna kharcha hoga?" yields unsupported', () => {
      const res = parseIntent('kitna kharcha hoga?', profile, TODAY);
      expect(res.intent).toBe('unsupported');
    });

    it('29. Hindi mix: "shadi ki date change karo" yields unsupported', () => {
      const res = parseIntent('shadi ki date change karo', profile, TODAY);
      expect(res.intent).toBe('unsupported');
    });

    // 7. Unrecognized gibberish
    it('30. gibberish yields unsupported with helpful examples', () => {
      const res = parseIntent('xyz 123 random words here', profile, TODAY);
      expect(res.intent).toBe('unsupported');
      if (res.intent === 'unsupported') {
        expect(res.examples.length).toBeGreaterThan(0);
      }
    });
  });
});
