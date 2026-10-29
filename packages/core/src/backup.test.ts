import { describe, expect, it } from 'vitest';
import { backupDay, importSummary } from './backup';

const nothing = { newProfiles: 0, updatedProfiles: 0, sessions: 0, gateVisits: 0, satellites: 0, quotes: 0 };

describe('importSummary', () => {
  it('lists only what came in', () => {
    expect(importSummary({ ...nothing, sessions: 412 })).toBe('Brought in 412 sessions.');
    expect(importSummary({ ...nothing, newProfiles: 1, sessions: 1, gateVisits: 2 })).toBe(
      'Brought in 1 new profile, 1 session and 2 trips to sites.',
    );
    expect(importSummary({ ...nothing, updatedProfiles: 2, satellites: 1, quotes: 3 })).toBe(
      'Brought in 2 updated profiles, 1 satellite and 3 quotes.',
    );
  });

  it('says so when everything was already here', () => {
    expect(importSummary(nothing)).toBe('Nothing new: everything in that backup is already here.');
  });
});

it('dates a backup by the local day', () => {
  expect(backupDay(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  expect(backupDay(new Date(2026, 9, 29, 0, 1))).toBe('2026-10-29');
});
