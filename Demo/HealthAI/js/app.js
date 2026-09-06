document.querySelector('#signalLayoutToggle').addEventListener('click', toggleSignalLayout);
document.querySelector('#motionMode').addEventListener('change', event => {
  document.documentElement.dataset.motion = event.target.value;
});
document.querySelector('#composer').addEventListener('submit', event => {
  event.preventDefault();
  sendMessage(input.value);
});
document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => sendMessage(button.dataset.prompt)));
document.querySelectorAll('[data-detail]').forEach(button => button.addEventListener('click', () => openDetail(button.dataset.detail)));
document.querySelector('#entryMenuToggle').addEventListener('click', () => {
  const menu = document.querySelector('#entryMenu');
  const open = menu.classList.toggle('open');
  document.querySelector('#entryMenuToggle').setAttribute('aria-expanded', String(open));
});
document.querySelector('#entryMenu').addEventListener('click', () => {
  document.querySelector('#entryMenu').classList.remove('open');
  document.querySelector('#entryMenuToggle').setAttribute('aria-expanded', 'false');
});
document.querySelector('#closeDetail').addEventListener('click', closeDetail);
document.querySelector('#scrim').addEventListener('click', () => { closeDetail(); closeTranscript(); });
document.querySelector('#openTranscriptTop').addEventListener('click', openTranscript);
document.querySelector('#closeTranscript').addEventListener('click', closeTranscript);
document.querySelector('#talkFromDetail').addEventListener('click', () => { closeDetail(); input.focus(); });

document.querySelector('#directorToggle').addEventListener('click', () => {
  const open = director.classList.toggle('open');
  document.querySelector('#directorToggle').setAttribute('aria-expanded', String(open));
});
document.querySelectorAll('[data-policy]').forEach(button => button.addEventListener('click', () => setState(button.dataset.policy)));
document.querySelectorAll('[data-resume]').forEach(button => button.addEventListener('click', () => {
  setState('conversing');
  showToast(button.dataset.resume === 'ok' ? '回到示範對話' : '已放慢節奏；你仍可隨時停下');
}));
document.querySelector('#fakeCall').addEventListener('click', () => showToast('介面示範：不會撥號。若有立即危險，請聯絡當地緊急服務。'));
document.querySelector('#markSafe').addEventListener('click', () => { setState('conversing'); showToast('已回到示範對話'); });

document.querySelector('#heartRate').addEventListener('input', updateHeart);
document.querySelector('#arousal').addEventListener('input', updateArousal);
document.querySelector('#movement').addEventListener('input', updateMovement);
document.querySelector('#veil').addEventListener('input', updateVeil);
document.querySelector('#watchStatus').addEventListener('change', updateWatchStatus);

document.querySelector('#scene').addEventListener('touchstart', event => { touchStartY = event.touches[0].clientY; }, { passive: true });
document.querySelector('#scene').addEventListener('touchend', event => {
  if (touchStartY !== null && touchStartY - event.changedTouches[0].clientY > 48) openTranscript();
  touchStartY = null;
}, { passive: true });

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') { closeDetail(); closeTranscript(); }
});

updateHeart();
updateArousal();
updateMovement();
updateVeil();
updateWatchStatus();
