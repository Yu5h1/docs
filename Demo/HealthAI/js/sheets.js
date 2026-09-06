function openTranscript() {
  if (app.dataset.state === 'detail') closeDetail();
  phone.classList.add('transcript-open');
  animateSheet(document.querySelector('#transcriptSheet'), false);
  document.querySelector('#closeTranscript').focus({ preventScroll: true });
}

function closeTranscript() {
  if (!phone.classList.contains('transcript-open')) return;
  animateSheet(document.querySelector('#transcriptSheet'), true, () => phone.classList.remove('transcript-open'));
}

function openDetail(kind) {
  activeDetail = kind;
  previousState = app.dataset.state === 'detail' ? previousState : app.dataset.state;
  const data = details[kind];
  document.querySelector('#detailKicker').textContent = data.kicker;
  document.querySelector('#detailTitle').textContent = data.title;
  document.querySelector('#detailDescription').textContent = data.description;
  document.querySelector('#detailUnit').textContent = data.unit;
  document.querySelector('#sparkline').hidden = !data.sparkline;
  document.querySelector('#talkFromDetail').hidden = kind !== 'heart';
  document.querySelector('#detailGrid').innerHTML = data.grid.map(([label, value]) => `<div><p class="detail-label">${label}</p><p class="detail-data">${value}</p></div>`).join('');
  updateDetailValue();
  setState('detail');
  animateSheet(document.querySelector('#detailSheet'), false);
  document.querySelector('#closeDetail').focus({ preventScroll: true });
}

function closeDetail() {
  if (app.dataset.state !== 'detail') return;
  animateSheet(document.querySelector('#detailSheet'), true, () => {
    if (app.dataset.state === 'detail') setState(previousState === 'detail' ? 'home' : previousState);
  });
}

function animateSheet(sheet, closing, complete = () => {}, velocity = 0) {
  const current = sheet.style.transform
    ? new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42
    : closing ? 0 : sheet.offsetHeight + 12;
  sheet.style.transition = 'none';
  sheet.style.transform = `translateY(${current}px)`;
  Motion.spring(sheet, {
    from: current, to: closing ? sheet.offsetHeight + 12 : 0, velocity,
    update: y => { sheet.style.transform = `translateY(${y}px)`; },
    complete: () => { complete(); sheet.style.removeProperty('transform'); sheet.style.removeProperty('transition'); }
  });
}

// Shared handle interaction for the conversation sheet and every detail view.
function bindSheetHandle(sheet, close) {
  const handle = sheet.querySelector('.grabber');
  let drag = null;
  let suppressClick = false;
  handle.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    suppressClick = false;
    Motion.cancel(sheet);
    const offset = new DOMMatrixReadOnly(getComputedStyle(sheet).transform).m42;
    drag = { id: event.pointerId, y: event.clientY - offset, distance: offset, moved: false,
      lastY: event.clientY, time: performance.now(), velocity: 0,
      threshold: Math.min(100, sheet.getBoundingClientRect().height * .25) };
    handle.setPointerCapture(event.pointerId);
    sheet.classList.add('dragging');
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || event.pointerId !== drag.id) return;
    const delta = event.clientY - drag.y;
    const now = performance.now();
    drag.velocity = (event.clientY - drag.lastY) / Math.max(.008, (now - drag.time) / 1000);
    drag.lastY = event.clientY; drag.time = now;
    drag.moved ||= Math.abs(delta) > 5;
    drag.distance = Math.max(0, delta);
    sheet.style.transform = `translateY(${drag.distance}px)`;
  });
  function finish(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const velocity = performance.now() - drag.time < 100 ? drag.velocity : 0;
    const dismiss = event.type === 'pointerup' && drag.distance + velocity * .12 >= drag.threshold;
    suppressClick = drag.moved || event.type !== 'pointerup';
    drag = null;
    sheet.classList.remove('dragging');
    if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
    if (dismiss) {
      animateSheet(sheet, true, () => {
        if (sheet.id === 'detailSheet') {
          if (app.dataset.state === 'detail') setState(previousState);
        } else phone.classList.remove('transcript-open');
      }, velocity);
    } else animateSheet(sheet, false, () => {}, velocity);
  }
  handle.addEventListener('pointerup', finish);
  handle.addEventListener('pointercancel', finish);
  handle.addEventListener('lostpointercapture', finish);
  handle.addEventListener('click', event => {
    if (suppressClick && event.detail !== 0) { suppressClick = false; return; }
    close();
  });
}
bindSheetHandle(document.querySelector('#detailSheet'), closeDetail);
bindSheetHandle(document.querySelector('#transcriptSheet'), closeTranscript);

function updateDetailValue() {
  const value = document.querySelector('#detailValue');
  if (activeDetail === 'heart') value.textContent = document.querySelector('#heartRate').value;
  if (activeDetail === 'arousal') value.textContent = Number(document.querySelector('#arousal').value).toFixed(2);
  if (activeDetail === 'movement') value.textContent = movementLabel(Number(document.querySelector('#movement').value));
  if (activeDetail === 'va') value.textContent = '移動中';
  if (['review', 'records', 'settings'].includes(activeDetail)) value.textContent = '入口';
}
