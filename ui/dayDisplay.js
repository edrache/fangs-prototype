function pad(value) {
  return String(value).padStart(2, '0');
}

const DAY_MINUTES = 24 * 60;
const NIGHT_START_HOUR = 20;
const NIGHT_START_MINUTES = NIGHT_START_HOUR * 60;
const DAY_START_HOUR = 6;
const DAY_START_OFFSET = ((DAY_START_HOUR * 60) - NIGHT_START_MINUTES + DAY_MINUTES) % DAY_MINUTES;
const DAY_START_PERCENT = (DAY_START_OFFSET / DAY_MINUTES) * 100;
const PHASE_DIVIDER_HOURS = [23, 1, 3, 5, 11, 14, 18];

function getTimelinePercentFromMinutes(totalMinutes) {
  const shiftedMinutes = (totalMinutes - NIGHT_START_MINUTES + DAY_MINUTES) % DAY_MINUTES;
  return (shiftedMinutes / DAY_MINUTES) * 100;
}

function getTimelinePercent(hour, minute) {
  return getTimelinePercentFromMinutes((hour * 60) + minute);
}

export function createDayDisplay({ mount }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'day-display';
  wrapper.style.setProperty('--day-start-percent', `${DAY_START_PERCENT}%`);

  const phaseEl = document.createElement('div');
  phaseEl.className = 'day-display__phase';

  const timelineEl = document.createElement('div');
  timelineEl.className = 'day-display__timeline';
  timelineEl.setAttribute('aria-hidden', 'true');

  const timelineTrackEl = document.createElement('div');
  timelineTrackEl.className = 'day-display__track';

  const timelineBoundaryEl = document.createElement('div');
  timelineBoundaryEl.className = 'day-display__boundary';

  const timelineThumbEl = document.createElement('div');
  timelineThumbEl.className = 'day-display__thumb';

  for (const dividerHour of PHASE_DIVIDER_HOURS) {
    const dividerEl = document.createElement('div');
    const dividerPercent = getTimelinePercentFromMinutes(dividerHour * 60);
    const isDayDivider = dividerHour > DAY_START_HOUR && dividerHour < NIGHT_START_HOUR;
    dividerEl.className = `day-display__divider${isDayDivider ? ' day-display__divider--day' : ''}`;
    dividerEl.style.setProperty('--divider-percent', `${dividerPercent}%`);
    timelineTrackEl.append(dividerEl);
  }

  timelineTrackEl.append(timelineBoundaryEl, timelineThumbEl);

  const timelineLabelsEl = document.createElement('div');
  timelineLabelsEl.className = 'day-display__labels';

  const nightLabelEl = document.createElement('span');
  nightLabelEl.textContent = 'Noc';

  const dayLabelEl = document.createElement('span');
  dayLabelEl.textContent = 'Dzień';

  timelineLabelsEl.append(nightLabelEl, dayLabelEl);
  timelineEl.append(timelineTrackEl, timelineLabelsEl);

  const dateEl = document.createElement('div');
  dateEl.className = 'day-display__date';

  wrapper.append(phaseEl, timelineEl, dateEl);
  mount.append(wrapper);

  return {
    update({ hour, minute, phase, dayNumber, date }) {
      const icon = phase.label === 'Świt' ? ' ☠' : phase.isDangerous ? ' ⚠' : '';
      const timelinePercent = getTimelinePercent(hour, minute);

      phaseEl.textContent = `${phase.label}${icon}  ${pad(hour)}:${pad(minute)}`;
      phaseEl.className = `day-display__phase${phase.isDangerous ? ' day-display__phase--dangerous' : ''}`;
      timelineEl.style.setProperty('--time-percent', `${timelinePercent}%`);
      timelineThumbEl.className = `day-display__thumb${phase.isDangerous ? ' day-display__thumb--dangerous' : ''}`;
      dateEl.textContent = `${date.day} ${date.monthName} · ${date.dayOfWeekName} · Dzień ${dayNumber}`;
    },
  };
}
