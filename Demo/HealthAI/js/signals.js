function movementLabel(value) {
  return value <= .2 ? '靜止' : value < .65 ? '走路' : '跑動';
}

function toggleSignalLayout() {
  const scene = document.querySelector('#scene');
  const icons = [...scene.querySelectorAll('.signal')];
  const positions = icons.map(icon => icon.getBoundingClientRect());
  icons.forEach(icon => {
    Motion.cancel(icon);
    icon.style.transition = 'none';
    icon.style.removeProperty('transform');
  });
  const compact = scene.dataset.layout !== 'compact';
  scene.dataset.layout = compact ? 'compact' : 'expanded';
  const toggle = document.querySelector('#signalLayoutToggle');
  toggle.textContent = compact ? '展開' : '收合';
  toggle.setAttribute('aria-expanded', String(!compact));
  toggle.setAttribute('aria-label', compact ? '展開訊號到角色周圍' : '收合訊號到頂部橫列');
  // Complete all layout reads before writing any animated transforms.
  const destinations = icons.map(icon => icon.getBoundingClientRect());
  icons.forEach((icon, index) => {
    const end = destinations[index], start = positions[index];
    const dx = start.x - end.x, dy = start.y - end.y;
    const scale = start.width / end.width;
    icon.style.transition = 'none';
    icon.style.transformOrigin = 'top left';
    const render = progress => {
      icon.style.transform = `translate(${dx * progress}px, ${dy * progress}px) scale(${1 + (scale - 1) * progress})`;
    };
    render(1);
    Motion.spring(icon, { from: 1, to: 0, update: render, complete: () => {
      icon.style.removeProperty('transform'); icon.style.removeProperty('transition'); icon.style.removeProperty('transform-origin');
    }});
  });
}

function updateHeart() {
  const rate = Number(document.querySelector('#heartRate').value);
  root.style.setProperty('--bpm', rate);
  const number = document.querySelector('#heartNumber');
  number.textContent = rate;
  number.classList.toggle('three-digits', rate >= 100);
  document.querySelector('#heartRateOut').textContent = `${rate} bpm`;
  document.querySelector('.signal-heart').setAttribute('aria-label', `心率 ${rate}，點擊查看細節`);
  updateDetailValue();
  updateDirectorSummary();
}

function updateArousal() {
  const value = Number(document.querySelector('#arousal').value);
  root.style.setProperty('--arousal', value);
  document.querySelector('#arousalOut').textContent = value.toFixed(2);
  const amplitude = Math.round(7 + value * 17);
  // Absolute coordinates keep every cycle centered on y=32 without accumulated drift.
  // A complete 64-unit cycle matches the CSS animation's translation distance.
  const cycles = [-64, 0, 64, 128].map(x =>
    `M${x} 32H${x + 16}L${x + 22} 29L${x + 26} 32L${x + 30} ${32 - amplitude}L${x + 36} ${32 + amplitude}L${x + 42} 32H${x + 64}`
  );
  document.querySelector('#ecgPath').setAttribute('d', cycles.join(' '));
  const label = value < .34 ? '偏低' : value < .67 ? '中等' : '偏高';
  document.querySelector('.signal-ecg').setAttribute('aria-label', `生理喚起${label}，點擊查看說明`);
  const cx = 16 + Math.round(value * 32);
  const cy = 47 - Math.round(value * 29);
  document.querySelector('#vaCursor').setAttribute('cx', cx);
  document.querySelector('#vaCursor').setAttribute('cy', cy);
  document.querySelector('#vaTrail').setAttribute('cx', Math.max(12, cx - 5));
  document.querySelector('#vaTrail').setAttribute('cy', Math.min(52, cy + 4));
  updateDetailValue();
}

function updateMovement() {
  const value = Number(document.querySelector('#movement').value);
  root.style.setProperty('--movement', value);
  const pose = value <= .2 ? 'poseStand' : value < .65 ? 'poseWalk' : 'poseRun';
  document.querySelectorAll('.walker-pose').forEach(node => node.classList.toggle('active', node.id === pose));
  document.querySelector('.walker').classList.toggle('active', value > .2);
  const label = movementLabel(value);
  document.querySelector('#movementOut').textContent = `${label} · ${value.toFixed(2)}`;
  document.querySelector('.signal-walk').setAttribute('aria-label', `動作狀態${label}，點擊查看說明`);
  updateDetailValue();
}

function updateVeil() {
  const value = Number(document.querySelector('#veil').value);
  const mask = `linear-gradient(to top, black 0%, black ${Math.round((1 - value) * 100)}%, transparent 100%)`;
  messageStack.style.maskImage = mask;
  messageStack.style.webkitMaskImage = mask;
  document.querySelector('#veilOut').textContent = value.toFixed(2);
}

function updateWatchStatus() {
  const status = document.querySelector('#watchStatus').value;
  const unknown = status !== 'connected';
  app.classList.toggle('unknown', unknown);
  document.querySelector('#connectionText').textContent = status === 'connected' ? '手錶已連線 · 12 秒前' : status === 'offline' ? '手錶未連線 · 尚無資料' : '健康資料權限被拒';
  document.querySelector('.connection-dot').style.background = status === 'connected' ? 'var(--brandSecondary)' : status === 'offline' ? 'var(--textSecondary)' : 'var(--critical)';
  document.querySelector('#heartNumber').textContent = unknown ? '?' : document.querySelector('#heartRate').value;
  document.querySelector('.signal-heart').setAttribute('aria-label', unknown ? '心率未知，沒有量測資料' : `心率 ${document.querySelector('#heartRate').value}，點擊查看細節`);
  document.querySelector('.signal-ecg').setAttribute('aria-label', unknown ? '生理喚起未知，沒有量測資料' : '生理喚起，點擊查看說明');
  document.querySelector('.signal-walk').setAttribute('aria-label', unknown ? '動作狀態未知，沒有量測資料' : `動作狀態${movementLabel(Number(document.querySelector('#movement').value))}，點擊查看說明`);
}
