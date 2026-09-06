// One controller owns open, close, drag, inertia and scrim timing for every bottom sheet.
const SheetLayer = (() => {
  const scrim = document.querySelector('#scrim');
  let active = null;
  const setScrimProgress = progress => { scrim.style.opacity = String(Math.max(0, Math.min(1, progress))); };
  const showScrim = () => { scrim.style.removeProperty('opacity'); phone.classList.add('sheet-visible'); };
  const hideScrim = () => { phone.classList.remove('sheet-visible'); scrim.style.removeProperty('opacity'); };
  function replace(controller) {
    if (active && active !== controller) active.finishImmediately();
    active = controller;
  }
  const clear = controller => { if (active === controller) active = null; };
  const closeActive = () => active?.close();
  return { clear, closeActive, hideScrim, replace, setScrimProgress, showScrim };
})();

class SheetController {
  constructor(sheet, { afterClose = () => {} } = {}) {
    this.sheet = sheet;
    this.afterClose = afterClose;
    this.drag = null;
    this.suppressClick = false;
    this.bindHandle();
  }

  get isActive() { return this.sheet.classList.contains('is-active'); }

  open() {
    SheetLayer.replace(this);
    Motion.cancel(this.sheet);
    this.sheet.classList.add('is-active');
    SheetLayer.showScrim();
    this.animate(false);
  }

  close(velocity = 0) {
    if (!this.isActive) return;
    SheetLayer.hideScrim();
    this.animate(true, velocity, () => this.finish());
  }

  finish() {
    this.sheet.classList.remove('is-active', 'dragging');
    this.sheet.style.removeProperty('transform');
    SheetLayer.clear(this);
    this.afterClose();
  }

  finishImmediately() {
    if (!this.isActive) return;
    Motion.cancel(this.sheet);
    SheetLayer.hideScrim();
    this.finish();
  }

  animate(closing, velocity = 0, complete = () => {}) {
    const computed = getComputedStyle(this.sheet).transform;
    const current = this.sheet.style.transform && computed !== 'none'
      ? new DOMMatrixReadOnly(computed).m42
      : closing ? 0 : this.sheet.offsetHeight + 12;
    const target = closing ? this.sheet.offsetHeight + 12 : 0;
    this.sheet.style.transform = `translateY(${current}px)`;
    Motion.spring(this.sheet, {
      from: current, to: target, velocity,
      update: y => { this.sheet.style.transform = `translateY(${y}px)`; },
      complete: () => {
        if (!closing) this.sheet.style.removeProperty('transform');
        complete();
      }
    });
  }

  bindHandle() {
    const handle = this.sheet.querySelector('.grabber');
    handle.addEventListener('pointerdown', event => {
      if (!event.isPrimary || event.button !== 0 || !this.isActive) return;
      this.suppressClick = false;
      Motion.cancel(this.sheet);
      const transform = getComputedStyle(this.sheet).transform;
      const offset = transform === 'none' ? 0 : new DOMMatrixReadOnly(transform).m42;
      this.drag = {
        id: event.pointerId, origin: event.clientY - offset, distance: offset, moved: false,
        lastY: event.clientY, time: performance.now(), velocity: 0,
        threshold: Math.min(100, this.sheet.getBoundingClientRect().height * .25)
      };
      handle.setPointerCapture(event.pointerId);
      this.sheet.classList.add('dragging');
    });

    handle.addEventListener('pointermove', event => {
      const drag = this.drag;
      if (!drag || event.pointerId !== drag.id) return;
      const now = performance.now();
      drag.velocity = (event.clientY - drag.lastY) / Math.max(.008, (now - drag.time) / 1000);
      drag.lastY = event.clientY;
      drag.time = now;
      drag.distance = Math.max(0, event.clientY - drag.origin);
      drag.moved ||= drag.distance > 5;
      this.sheet.style.transform = `translateY(${drag.distance}px)`;
      SheetLayer.setScrimProgress(1 - drag.distance / this.sheet.offsetHeight);
    });

    const finishDrag = event => {
      const drag = this.drag;
      if (!drag || event.pointerId !== drag.id) return;
      const velocity = performance.now() - drag.time < 100 ? drag.velocity : 0;
      const dismiss = event.type === 'pointerup' && drag.distance + velocity * .12 >= drag.threshold;
      this.suppressClick = drag.moved || event.type !== 'pointerup';
      this.drag = null;
      this.sheet.classList.remove('dragging');
      if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
      if (dismiss) this.close(velocity);
      else { SheetLayer.showScrim(); this.animate(false, velocity); }
    };

    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);
    handle.addEventListener('lostpointercapture', finishDrag);
    handle.addEventListener('click', event => {
      if (this.suppressClick && event.detail !== 0) { this.suppressClick = false; return; }
      this.close();
    });
  }
}

const transcriptController = new SheetController(document.querySelector('#transcriptSheet'));
const detailController = new SheetController(document.querySelector('#detailSheet'), {
  afterClose: () => {
    if (app.dataset.state === 'detail') setState(previousState === 'detail' ? 'home' : previousState);
  }
});

function openTranscript() {
  transcriptController.open();
  document.querySelector('#closeTranscript').focus({ preventScroll: true });
}
function closeTranscript() { transcriptController.close(); }

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
  detailController.open();
  document.querySelector('#closeDetail').focus({ preventScroll: true });
}
function closeDetail() { detailController.close(); }

function updateDetailValue() {
  const value = document.querySelector('#detailValue');
  if (activeDetail === 'heart') value.textContent = document.querySelector('#heartRate').value;
  if (activeDetail === 'arousal') value.textContent = Number(document.querySelector('#arousal').value).toFixed(2);
  if (activeDetail === 'movement') value.textContent = movementLabel(Number(document.querySelector('#movement').value));
  if (activeDetail === 'va') value.textContent = '移動中';
  if (['review', 'records', 'settings'].includes(activeDetail)) value.textContent = '入口';
}
