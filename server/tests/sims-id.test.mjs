import { createRequire } from 'module';
import { describe, it, expect, vi } from 'vitest';

const _require = createRequire(import.meta.url);
const { allocateSimsId, seriesForRole } = _require('../lib/simsId');

describe('SIMS ID allocation', () => {
  it('uses the admin series for admin and super_admin', () => {
    expect(seriesForRole('admin')).toBe('admin');
    expect(seriesForRole('super_admin')).toBe('admin');
  });

  it('uses the faculty series for faculty', () => {
    expect(seriesForRole('faculty')).toBe('faculty');
  });

  it('returns the atomically incremented counter value', async () => {
    const tx = {
      simsIdCounter: {
        upsert: vi.fn().mockResolvedValue({ series: 'faculty', last_value: 1100 }),
      },
    };

    await expect(allocateSimsId(tx, 'faculty')).resolves.toBe(1100);
    expect(tx.simsIdCounter.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { series: 'faculty' },
      update: { last_value: { increment: 1 } },
    }));
  });

  it('rejects allocation after the admin range is exhausted', async () => {
    const tx = {
      simsIdCounter: {
        upsert: vi.fn().mockResolvedValue({ series: 'admin', last_value: 1100 }),
      },
    };

    await expect(allocateSimsId(tx, 'admin')).rejects.toMatchObject({
      code: 'SIMS_ID_RANGE_EXHAUSTED',
    });
  });
});
