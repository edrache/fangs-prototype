const DAY_REAL_MS = 5 * 60 * 1000;
const GAME_DAY_MS = 24 * 60 * 60 * 1000;
const RATIO = GAME_DAY_MS / DAY_REAL_MS;

const PHASES = [
  { label: 'Głęboka noc', startHour: 1, isDangerous: false },
  { label: 'Przed świtem', startHour: 3, isDangerous: true },
  { label: 'Świt', startHour: 5, isDangerous: true },
  { label: 'Rano', startHour: 6, isDangerous: false },
  { label: 'Południe', startHour: 11, isDangerous: false },
  { label: 'Popołudnie', startHour: 14, isDangerous: false },
  { label: 'Zmierzch', startHour: 18, isDangerous: false },
  { label: 'Noc', startHour: 20, isDangerous: false },
  { label: 'Północ', startHour: 23, isDangerous: false },
];

const MONTHS = [
  { name: 'stycznia', days: 31 },
  { name: 'lutego', days: 28 },
  { name: 'marca', days: 31 },
  { name: 'kwietnia', days: 30 },
  { name: 'maja', days: 31 },
  { name: 'czerwca', days: 30 },
  { name: 'lipca', days: 31 },
  { name: 'sierpnia', days: 31 },
  { name: 'września', days: 30 },
  { name: 'października', days: 31 },
  { name: 'listopada', days: 30 },
  { name: 'grudnia', days: 31 },
];

const DAYS_OF_WEEK = [
  'Poniedziałek',
  'Wtorek',
  'Środa',
  'Czwartek',
  'Piątek',
  'Sobota',
  'Niedziela',
];

const JAN1_2026_DOW = 3;

function getPhase(hour) {
  let result = PHASES[PHASES.length - 1];
  for (const phase of PHASES) {
    if (phase.startHour <= hour) {
      result = phase;
    }
  }
  return result;
}

function getCalendarDate(dayOfYear0) {
  const dow = (JAN1_2026_DOW + dayOfYear0) % 7;
  let remaining = dayOfYear0;

  for (let monthIndex = 0; monthIndex < MONTHS.length; monthIndex += 1) {
    if (remaining < MONTHS[monthIndex].days) {
      return {
        day: remaining + 1,
        month: monthIndex + 1,
        monthName: MONTHS[monthIndex].name,
        dayOfWeek: dow,
        dayOfWeekName: DAYS_OF_WEEK[dow],
      };
    }
    remaining -= MONTHS[monthIndex].days;
  }

  return getCalendarDate(0);
}

export function createClock(startDayOfYear) {
  return {
    getState(timeMs) {
      const totalGameMs = timeMs * RATIO;
      const hour = Math.floor(totalGameMs / 3_600_000) % 24;
      const minute = Math.floor(totalGameMs / 60_000) % 60;
      const dayNumber = Math.floor(totalGameMs / GAME_DAY_MS) + 1;
      const dayOfYear0 = (startDayOfYear - 1 + dayNumber - 1) % 365;

      return {
        hour,
        minute,
        phase: getPhase(hour),
        dayNumber,
        date: getCalendarDate(dayOfYear0),
      };
    },
  };
}
