const app = document.querySelector('#app');
const phone = document.querySelector('#phone');
const root = document.documentElement;
const messageStack = document.querySelector('#messageStack');
const transcriptList = document.querySelector('#transcriptList');
const input = document.querySelector('#messageInput');
const sendButton = document.querySelector('#sendButton');
const toast = document.querySelector('#toast');
const director = document.querySelector('#director');
let previousState = 'home';
let activeDetail = 'heart';
let scriptIndex = 0;
let toastTimer;
let touchStartY = null;

function showToast(text) {
  window.clearTimeout(toastTimer);
  toast.textContent = text;
  toast.classList.add('show');
  toastTimer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function visiblePolicyLabel(state) {
  return state === 'paused' ? '暫停' : state === 'crisis' ? '危機' : '正常';
}

function setState(state) {
  if (state !== 'detail') previousState = state;
  app.dataset.state = state;
  const blocked = state === 'paused' || state === 'crisis';
  input.disabled = blocked;
  sendButton.disabled = blocked;
  input.placeholder = state === 'paused' ? '先確認現在的感受' : state === 'crisis' ? '安全提醒顯示中' : '想說點什麼';
  const policyState = (state === 'detail' ? previousState : state) === 'home' ? 'conversing' : (state === 'detail' ? previousState : state);
  document.querySelectorAll('[data-policy]').forEach(button => {
    button.setAttribute('aria-pressed', String(button.dataset.policy === policyState));
  });
  updateDirectorSummary();
}

function updateDirectorSummary() {
  const state = app.dataset.state === 'detail' ? previousState : app.dataset.state;
  document.querySelector('#directorSummary').textContent = `${visiblePolicyLabel(state)} · ${document.querySelector('#heartRate').value} bpm`;
}
