import { gameHourToSliderPercent } from '../simulation/clock.js';

function pad(value) {
  return String(value).padStart(2, '0');
}

const DAY_START_PERCENT = gameHourToSliderPercent(6);

const PHASE_DIVIDER_HOURS = [23, 1, 3, 5, 11, 14, 18];
const DAY_START_HOUR = 6;
const NIGHT_START_HOUR = 20;

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
    const dividerPercent = gameHourToSliderPercent(dividerHour);
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
    update({ hour, minute, phase, dayNumber, date, sliderFraction }) {
      const icon = phase.label === 'Świt' ? ' ☠' : phase.isDangerous ? ' ⚠' : '';

      phaseEl.textContent = `${phase.label}${icon}  ${pad(hour)}:${pad(minute)}`;
      phaseEl.className = `day-display__phase${phase.isDangerous ? ' day-display__phase--dangerous' : ''}`;
      timelineEl.style.setProperty('--time-percent', `${sliderFraction * 100}%`);
      timelineThumbEl.className = `day-display__thumb${phase.isDangerous ? ' day-display__thumb--dangerous' : ''}`;
      dateEl.textContent = `${date.day} ${date.monthName} · ${date.dayOfWeekName} · Dzień ${dayNumber}`;
    },
  };
}
