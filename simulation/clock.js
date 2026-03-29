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
  { label: 'Deep night', startHour: 1, isDangerous: false },
  { label: 'Before dawn', startHour: 3, isDangerous: true },
  { label: 'Dawn', startHour: 5, isDangerous: true },
  { label: 'Morning', startHour: 6, isDangerous: false },
  { label: 'Noon', startHour: 11, isDangerous: false },
  { label: 'Afternoon', startHour: 14, isDangerous: false },
  { label: 'Dusk', startHour: 18, isDangerous: false },
  { label: 'Night', startHour: 20, isDangerous: false },
  { label: 'Midnight', startHour: 23, isDangerous: false },
];

const MONTHS = [
  { name: 'January', days: 31 },
  { name: 'February', days: 28 },
  { name: 'March', days: 31 },
  { name: 'April', days: 30 },
  { name: 'May', days: 31 },
  { name: 'June', days: 30 },
  { name: 'July', days: 31 },
  { name: 'August', days: 31 },
  { name: 'September', days: 30 },
  { name: 'October', days: 31 },
  { name: 'November', days: 30 },
  { name: 'December', days: 31 },
];

const DAYS_OF_WEEK = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
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
