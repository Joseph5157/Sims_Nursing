import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const _require = createRequire(import.meta.url);

const passwordLib = _require('../lib/password');
const prisma       = _require('../lib/prisma');
const { nowInIST } = _require('../lib/time');
const bot          = _require('../lib/bot');

describe('password helper functions', () => {
  it('generateTempPassword returns 12-character alphanumeric string', () => {
    const password = passwordLib.generateTempPassword();
    expect(password).toMatch(/^[23456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ]{12}$/);
    expect(password.length).toBe(12);
  });

  it('generateTempPassword excludes ambiguous characters (0, O, 1, l, I)', () => {
    // Generate many passwords to statistically verify exclusion
    for (let i = 0; i < 100; i++) {
      const password = passwordLib.generateTempPassword();
      expect(password).not.toMatch(/[0O1lI]/);
    }
  });

  it('hashPassword returns bcrypt hash with correct format', async () => {
    const password = 'TestPassword123';
    const hash = await passwordLib.hashPassword(password);
    expect(hash).toMatch(/^\$2[aby]\$/);
    expect(hash.length).toBeGreaterThan(50);
  });

  it('different calls to generateTempPassword return different values', () => {
    const password1 = passwordLib.generateTempPassword();
    const password2 = passwordLib.generateTempPassword();
    expect(password1).not.toBe(password2);
  });
});

const ist = nowInIST();
const todayUTC = new Date(Date.UTC(ist.year, ist.month - 1, ist.day));
const tomorrowUTC = new Date(Date.UTC(ist.year, ist.month - 1, ist.day + 1));

describe('/menu quick-status reply builders', () => {
  afterEach(() => vi.restoreAllMocks());

  describe('buildMySlotsReply', () => {
    it('reports no slots when faculty has picked none this month', async () => {
      vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([]);
      const text = await bot.buildMySlotsReply('fac-1');
      expect(text).toContain('No duty slots picked yet this month.');
    });

    it('lists each picked slot with its session label', async () => {
      vi.spyOn(prisma.dutySlot, 'findMany').mockResolvedValue([
        { duty_date: todayUTC, session_type: 'morning' },
        { duty_date: tomorrowUTC, session_type: 'afternoon' },
      ]);
      const text = await bot.buildMySlotsReply('fac-1');
      expect(text).toContain('Morning');
      expect(text).toContain('Afternoon');
    });
  });

  describe('buildNextDutyReply', () => {
    it('reports no upcoming duty when none is scheduled', async () => {
      vi.spyOn(prisma.dutySlot, 'findFirst').mockResolvedValue(null);
      const text = await bot.buildNextDutyReply('fac-1');
      expect(text).toContain('You have no upcoming duty scheduled.');
    });

    it('shows the earliest upcoming scheduled slot', async () => {
      vi.spyOn(prisma.dutySlot, 'findFirst').mockResolvedValue({ duty_date: todayUTC, session_type: 'morning' });
      const text = await bot.buildNextDutyReply('fac-1');
      expect(text).toContain('Morning');
    });
  });

  describe('buildWindowStatusReply', () => {
    it('reports unconfigured when no CalendarConfig row exists for the current month', async () => {
      vi.spyOn(prisma.calendarConfig, 'findUnique').mockResolvedValue(null);
      const text = await bot.buildWindowStatusReply('fac-1');
      expect(text).toContain("hasn't been configured");
    });

    it('shows Open status, pick count, and deadline when the window is open', async () => {
      vi.spyOn(prisma.calendarConfig, 'findUnique').mockResolvedValue({
        is_window_open: true, sessions_per_faculty: 5, closes_at: todayUTC,
      });
      vi.spyOn(prisma.dutySlot, 'count').mockResolvedValue(2);
      const text = await bot.buildWindowStatusReply('fac-1');
      expect(text).toContain('Status: <b>Open</b>');
      expect(text).toContain('2 of 5');
      expect(text).toContain('Closes:');
    });

    it('shows Closed status without a deadline line when the window is closed', async () => {
      vi.spyOn(prisma.calendarConfig, 'findUnique').mockResolvedValue({
        is_window_open: false, sessions_per_faculty: 5, closes_at: null,
      });
      vi.spyOn(prisma.dutySlot, 'count').mockResolvedValue(5);
      const text = await bot.buildWindowStatusReply('fac-1');
      expect(text).toContain('Status: <b>Closed</b>');
      expect(text).not.toContain('Closes:');
    });
  });
});
