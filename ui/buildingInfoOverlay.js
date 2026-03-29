const OVERLAY_CLASSES = {
  visible: 'building-info-overlay--visible',
};

const ROOT_STYLES = `
  position: absolute;
  top: 18px;
  right: 18px;
  width: min(280px, calc(100% - 36px));
  padding: 14px 14px 13px;
  border: 1px solid rgba(184, 171, 255, 0.28);
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(12, 16, 28, 0.98), rgba(8, 11, 20, 0.98));
  box-shadow:
    0 18px 42px rgba(0, 0, 0, 0.38),
    inset 0 1px 0 rgba(255, 255, 255, 0.04);
  color: #ecf1ff;
  font-family: "IBM Plex Mono", "SFMono-Regular", Consolas, monospace;
  pointer-events: none;
  opacity: 0;
  transform: translateY(-6px) scale(0.985);
  transition:
    opacity 160ms ease,
    transform 160ms ease;
  z-index: 10;
`;

const HEADER_STYLES = `
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
`;

const TITLE_STYLES = `
  font-size: 10px;
  line-height: 1.4;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #bdaeff;
`;

const BODY_STYLES = `
  font-size: 11px;
  line-height: 1.7;
  color: rgba(224, 230, 255, 0.88);
  text-wrap: pretty;
`;

const META_STYLES = `
  margin-top: 11px;
  padding-top: 10px;
  border-top: 1px solid rgba(167, 177, 218, 0.14);
  font-size: 10px;
  line-height: 1.45;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #8d98be;
`;

const CLOSE_STYLES = `
  flex: 0 0 auto;
  min-width: 26px;
  height: 26px;
  border: 1px solid rgba(184, 171, 255, 0.18);
  border-radius: 999px;
  background: rgba(28, 35, 58, 0.82);
  color: rgba(237, 241, 255, 0.76);
  font: inherit;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  transition: border-color 120ms ease, background 120ms ease, color 120ms ease;
`;

function formatTitle(building) {
  if (!building?.special) {
    return 'Special building';
  }

  return building.special.charAt(0).toUpperCase() + building.special.slice(1);
}

function formatMeta(building) {
  const parts = [];

  if (building?.districtId != null) {
    parts.push(`District ${building.districtId}`);
  }

  if (Array.isArray(building?.rects)) {
    parts.push(`${building.rects.length} block${building.rects.length === 1 ? '' : 's'}`);
  }

  return parts.join(' · ');
}

export function createBuildingInfoOverlay({ mount }) {
  const overlay = document.createElement('section');
  overlay.setAttribute('aria-hidden', 'true');
  overlay.style.cssText = ROOT_STYLES;

  const header = document.createElement('div');
  header.style.cssText = HEADER_STYLES;

  const title = document.createElement('div');
  title.style.cssText = TITLE_STYLES;

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.textContent = '×';
  closeButton.setAttribute('aria-label', 'Close building info');
  closeButton.style.cssText = CLOSE_STYLES;

  const body = document.createElement('div');
  body.style.cssText = BODY_STYLES;

  const meta = document.createElement('div');
  meta.style.cssText = META_STYLES;

  header.append(title, closeButton);
  overlay.append(header, body, meta);
  mount.appendChild(overlay);

  let isVisible = false;

  function applyVisibility() {
    overlay.style.pointerEvents = isVisible ? 'auto' : 'none';
    overlay.classList.toggle(OVERLAY_CLASSES.visible, isVisible);
    overlay.style.opacity = isVisible ? '1' : '0';
    overlay.style.transform = isVisible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.985)';
    overlay.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
  }

  function show(building) {
    if (!building) {
      hide();
      return;
    }

    title.textContent = formatTitle(building);
    body.textContent = building.description ?? '';
    meta.textContent = formatMeta(building);
    isVisible = true;
    applyVisibility();
  }

  function hide() {
    isVisible = false;
    applyVisibility();
  }

  function update(buildingState) {
    void buildingState;
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape' && isVisible) {
      hide();
    }
  }

  closeButton.addEventListener('click', hide);
  window.addEventListener('keydown', handleKeyDown);
  applyVisibility();

  return {
    show,
    hide,
    update,
    destroy() {
      closeButton.removeEventListener('click', hide);
      window.removeEventListener('keydown', handleKeyDown);
      overlay.remove();
    },
  };
}
