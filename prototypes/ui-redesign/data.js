// The same made-up but realistic content for all three prototypes: the starter profiles, a running
// Deep Work session, satellites, and the report for Oct 19–25, 2026.
window.LockData = {
  today: { weekday: 'Wednesday', date: 'Oct 28' },
  stars: 41,
  stardust: 3920,
  profiles: [
    { id: 'deep-work', name: 'Deep Work', color: '#cfe0ff', length: '50 min', strictness: 'Medium' },
    { id: 'writing', name: 'Writing', color: '#f5c86b', length: '45 min', strictness: 'Gentle' },
    { id: 'wind-down', name: 'Wind Down', color: '#b9a7f5', length: 'No timer', strictness: '' },
  ],
  session: {
    profile: 'Deep Work',
    color: '#cfe0ff',
    clock: '31:12',
    minutes: 50,
    leftShare: 31.2 / 50,
    started: '9:40 am',
    inOrbit: 2,
  },
  back: ['Ask Sam whether the venue deposit is refundable', 'Look up why the build cache misses on CI'],
  tasks: ['Book the boiler service', 'Renew library books before Friday', 'Draft the November newsletter intro'],
  report: {
    title: 'Last week',
    range: 'Oct 19 – 25',
    compareRange: 'Oct 12 – 18',
    constellation: 'The Quiet Heron',
    focus: '14h 20m',
    focusTrend: '↑ 2h 05m',
    lastWeekFocus: '12h 15m',
    days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    // Minutes focused each day, this week and the week before.
    minutes: [170, 190, 100, 215, 125, 40, 20],
    lastMinutes: [140, 95, 160, 180, 90, 30, 40],
    peak: 'Thursday',
    streak: 'Longest streak: 7 days',
    sessions: '17 sessions · longest 1h 35m · 1h 10m past the timer',
    byProfile: [
      { name: 'Deep Work', color: '#cfe0ff', time: '8h 05m', minutes: 485, sessions: 8 },
      { name: 'Writing', color: '#f5c86b', time: '4h 50m', minutes: 290, sessions: 6 },
      { name: 'Wind Down', color: '#b9a7f5', time: '1h 25m', minutes: 85, sessions: 3 },
    ],
    trips: 23,
    tripsTrend: '6 fewer',
    turnedBack: 'You went back to focus 15 of 23 times.',
    // Trips by hour of the day, midnight first.
    hours: [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 2, 1, 2, 4, 5, 3, 1, 0, 1, 1, 1, 0, 0],
    sites: [
      { name: 'YouTube', line: '11 trips · went back 8 times' },
      { name: 'Reddit', line: '7 trips · went back 4 times' },
      { name: 'X', line: '5 trips · went back 3 times' },
    ],
    launched: 12,
    outcomes: '7 done · 3 on the task list · 1 still waiting · 1 deleted',
    sky: [
      { what: 'A shooting star', day: 'Tue' },
      { what: 'Personal best: your longest session', day: 'Thu' },
      { what: '3 comets for going back to focus', day: '' },
    ],
    suggestions: [
      '9 of your 10 longest sessions started before noon. Mornings seem to be your deep focus time.',
      'Most trips to YouTube came between 2 and 4pm.',
    ],
  },
};

// A dot chart like DotChart.vue: a column of dots per value, filled from the bottom.
window.dotChart = function (
  values,
  { rows = 6, color = '#f5c86b', peak = -1, dim = 'rgb(255 255 255 / 0.08)', size = 6, gap = 3 } = {},
) {
  const most = Math.max(...values, 1);
  const cols = values
    .map((value, i) => {
      const filled = value ? Math.max(1, Math.round((value / most) * rows)) : 0;
      const dots = Array.from({ length: rows }, (_, r) => {
        const on = rows - r <= filled;
        const style = on
          ? `background:${color};box-shadow:0 0 ${i === peak ? 8 : 4}px ${color}${i === peak ? '' : '66'}`
          : `background:${dim}`;
        return `<i style="width:${size}px;height:${size}px;border-radius:50%;${style}"></i>`;
      }).join('');
      return `<span style="display:grid;gap:${gap}px">${dots}</span>`;
    })
    .join('');
  return `<div style="display:flex;justify-content:space-between;gap:${gap}px">${cols}</div>`;
};
