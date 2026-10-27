import { describe, expect, it } from 'vitest';
import type { Satellite } from './generated/Satellite';
import {
  cleanedSatelliteText,
  doneTasksShownMs,
  maxSatelliteLength,
  withSatelliteAction,
  withSatelliteLaunched,
  withSatellitesBack,
} from './satellites';

const states = (list: Satellite[]) => list.map((s) => [s.text, s.state]);

describe('cleanedSatelliteText', () => {
  it('trims, and skips empty thoughts', () => {
    expect(cleanedSatelliteText('  call mum \n')).toBe('call mum');
    expect(cleanedSatelliteText(' \n\t ')).toBeUndefined();
  });

  it('cuts long thoughts down by character, as the app does', () => {
    const long = '🛰'.repeat(maxSatelliteLength + 10);
    expect(Array.from(cleanedSatelliteText(long)!)).toHaveLength(maxSatelliteLength);
  });
});

describe('satellites', () => {
  it('come back when the session ends', () => {
    let list = withSatelliteLaunched([], 'a', '  reply to Sam ', 1);
    list = withSatelliteLaunched(list, 'b', ' ', 2);
    expect(list).toEqual([{ id: 'a', text: 'reply to Sam', launchedAt: 1, state: 'orbiting', stateAt: 1 }]);

    list = withSatellitesBack(list, 10);
    expect(list[0]).toMatchObject({ state: 'back', stateAt: 10 });
  });

  it('can be ticked off, snoozed, kept as tasks or deleted', () => {
    let list = ['done', 'snooze', 'task', 'delete'].reduce(
      (l, text) => withSatelliteLaunched(l, text, text, 1),
      [] as Satellite[],
    );
    list = withSatellitesBack(list, 2);
    for (const s of list) list = withSatelliteAction(list, s.id, s.text as never, 3);
    // Ticked off from the return checklist, it was never a task, so it's gone.
    expect(states(list)).toEqual([
      ['snooze', 'orbiting'],
      ['task', 'task'],
    ]);
  });

  it('keeps ticked-off tasks for a day, so they can be unticked', () => {
    let list = withSatelliteAction(withSatelliteLaunched([], 'a', 'book dentist', 1), 'a', 'task', 2);
    list = withSatelliteAction(list, 'a', 'done', 3);
    expect(states(list)).toEqual([['book dentist', 'done']]);
    list = withSatelliteAction(list, 'a', 'task', 4);
    expect(states(list)).toEqual([['book dentist', 'task']]);

    list = withSatelliteAction(list, 'a', 'done', 5);
    list = withSatelliteLaunched(list, 'b', 'later', 6);
    // Any change after a day lets it go.
    list = withSatelliteAction(list, 'b', 'task', 5 + doneTasksShownMs + 1);
    expect(states(list)).toEqual([['later', 'task']]);
  });
});
