export const NIGHT_REAL_MS = 180_000;
export const DAY_PHASE_REAL_MS = 43_750;
export const CYCLE_REAL_MS = NIGHT_REAL_MS + DAY_PHASE_REAL_MS;

const GAME_DAY_MS = 24 * 60 * 60 * 1000;

const NIGHT1_REAL_MS = (NIGHT_REAL_MS * 6) / 10;
const NIGHT2_REAL_MS = (NIGHT_REAL_MS * 4) / 10;
const DAY_START_REAL_MS = NIGHT1_REAL_MS;
const NIGHT2_START_REAL_MS = NIGHT1_REAL_MS + DAY_PHASE_REAL_MS;

const NIGHT_RATE = (10 * 3_600_000) / NIGHT_REAL_MS;
const DAY_RATE = (14 * 3_600_000) / DAY_PHASE_REAL_MS;

function realToCycleGameMs(posInCycle) {
  if (posInCycle < DAY_START_REAL_MS) {
    return posInCycle * NIGHT_RATE;
  }

  if (posInCycle < NIGHT2_START_REAL_MS) {
    return (6 * 3_600_000) + ((posInCycle - DAY_START_REAL_MS) * DAY_RATE);
  }

  return (20 * 3_600_000) + ((posInCycle - NIGHT2_START_REAL_MS) * NIGHT_RATE);
}

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

export function gameHourToSliderPercent(hour) {
  let realFromNightStart;

  if (hour >= 20 || hour < 6) {
    const nightHoursFromOrigin = (hour - 20 + 24) % 24;
    realFromNightStart = nightHoursFromOrigin * (NIGHT_REAL_MS / 10);
  } else {
    realFromNightStart = NIGHT_REAL_MS + ((hour - 6) * (DAY_PHASE_REAL_MS / 14));
  }

  return (realFromNightStart / CYCLE_REAL_MS) * 100;
}

export function createClock(startDayOfYear) {
  return {
    getState(timeMs) {
      const cycleIndex = Math.floor(timeMs / CYCLE_REAL_MS);
      const posInCycle = timeMs % CYCLE_REAL_MS;
      const cycleGameMs = realToCycleGameMs(posInCycle);
      const totalGameMs = (cycleIndex * GAME_DAY_MS) + cycleGameMs;

      const hour = Math.floor(totalGameMs / 3_600_000) % 24;
      const minute = Math.floor(totalGameMs / 60_000) % 60;
      const dayNumber = cycleIndex + 1;
      const dayOfYear0 = (startDayOfYear - 1 + cycleIndex) % 365;
      const sliderFraction = (((posInCycle + NIGHT2_REAL_MS) % CYCLE_REAL_MS) / CYCLE_REAL_MS);

      return {
        hour,
        minute,
        phase: getPhase(hour),
        dayNumber,
        date: getCalendarDate(dayOfYear0),
        sliderFraction,
      };
    },

    getGameRate(realMs) {
      const posInCycle = realMs % CYCLE_REAL_MS;
      const isDaytime = posInCycle >= DAY_START_REAL_MS && posInCycle < NIGHT2_START_REAL_MS;
      return isDaytime ? DAY_RATE : NIGHT_RATE;
    },
  };
}
