const SPEEDS = [
  { label: '■', scale: 0, key: '0' },
  { label: '1×', scale: 1, key: '1' },
  { label: '2×', scale: 2, key: '2' },
  { label: '4×', scale: 4, key: '3' },
  { label: '10×', scale: 10, key: '4' },
];

export function createTimeControls({ mount, onSpeedChange }) {
  let activeScale = 1;
  const buttons = new Map();

  function setScale(scale) {
    activeScale = scale;

    for (const [buttonScale, button] of buttons) {
      button.dataset.active = buttonScale === activeScale ? 'true' : 'false';
    }

    onSpeedChange(scale);
  }

  for (const speed of SPEEDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'time-btn';
    button.textContent = speed.label;
    button.dataset.active = speed.scale === activeScale ? 'true' : 'false';
    button.addEventListener('click', () => {
      setScale(speed.scale);
      button.blur();
    });
    buttons.set(speed.scale, button);
    mount.append(button);
  }

  document.addEventListener('keydown', (event) => {
    if (event.target !== document.body && event.target.tagName !== 'BODY') {
      return;
    }

    const speed = SPEEDS.find((entry) => entry.key === event.key);
    if (speed) {
      setScale(speed.scale);
    }
  });
}
