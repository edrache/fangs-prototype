const CONTROL_CONFIG = [
  {
    key: 'seed',
    label: 'Seed',
    min: 0,
    max: 99999,
    step: 1,
  },
  {
    key: 'districts',
    label: 'Districts',
    min: 2,
    max: 12,
    step: 1,
  },
  {
    key: 'streetDensity',
    label: 'Street Density',
    min: 1,
    max: 10,
    step: 1,
  },
  {
    key: 'buildingDensity',
    label: 'Building Density',
    min: 1,
    max: 10,
    step: 1,
  },
  {
    key: 'characters',
    label: 'Characters',
    min: 1,
    max: 50,
    step: 1,
  },
];

function createControlRow(control, value, onInput) {
  const row = document.createElement('label');
  row.className = 'control-row';
  row.setAttribute('for', `control-${control.key}`);

  const title = document.createElement('span');
  title.className = 'control-label';
  title.textContent = control.label;

  const valuePill = document.createElement('span');
  valuePill.className = 'control-value';
  valuePill.textContent = String(value);

  const slider = document.createElement('input');
  slider.className = 'control-slider';
  slider.id = `control-${control.key}`;
  slider.type = 'range';
  slider.min = String(control.min);
  slider.max = String(control.max);
  slider.step = String(control.step);
  slider.value = String(value);
  slider.addEventListener('input', () => {
    const nextValue = Number(slider.value);
    valuePill.textContent = String(nextValue);
    onInput(control.key, nextValue);
  });

  row.append(title, valuePill, slider);

  return {
    row,
    valuePill,
    slider,
  };
}

export function createControls({
  mount,
  button,
  initialValues,
  onApply,
}) {
  const draft = { ...initialValues };
  const applied = { ...initialValues };
  const controlViews = new Map();

  function hasPendingChanges() {
    return CONTROL_CONFIG.some((control) => draft[control.key] !== applied[control.key]);
  }

  function syncButtonState() {
    const dirty = hasPendingChanges();
    button.disabled = !dirty;
    button.textContent = dirty ? 'Regenerate' : 'In Sync';
    button.dataset.dirty = dirty ? 'true' : 'false';
  }

  function setValue(key, value) {
    draft[key] = value;
    syncButtonState();
  }

  mount.innerHTML = '';

  for (const control of CONTROL_CONFIG) {
    const view = createControlRow(control, initialValues[control.key], setValue);
    mount.append(view.row);
    controlViews.set(control.key, view);
  }

  button.addEventListener('click', () => {
    if (!hasPendingChanges()) {
      return;
    }

    Object.assign(applied, draft);
    onApply({ ...applied });
    syncButtonState();
  });

  syncButtonState();

  return {
    setAppliedValues(nextValues) {
      for (const control of CONTROL_CONFIG) {
        const nextValue = nextValues[control.key];
        applied[control.key] = nextValue;
        draft[control.key] = nextValue;

        const view = controlViews.get(control.key);
        view.slider.value = String(nextValue);
        view.valuePill.textContent = String(nextValue);
      }

      syncButtonState();
    },
  };
}
