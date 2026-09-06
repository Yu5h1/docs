const transcript = [];
function appendMessage(role, text) {
  transcript.push({ role, text });
  const message = document.createElement('button');
  message.type = 'button';
  message.className = `message ${role}`;
  message.setAttribute('aria-label', `${role === 'user' ? '你' : 'HealthAI，AI 生成'}：${text}。點擊展開完整訊息串`);
  message.innerHTML = `<span class="message-prefix">${role === 'user' ? '你' : 'HealthAI · AI 生成'}</span><span class="message-text"></span>`;
  message.querySelector('.message-text').textContent = text;
  message.addEventListener('click', openTranscript);
  messageStack.prepend(message);
  renderTranscript();
}

function renderTranscript() {
  transcriptList.replaceChildren();
  if (!transcript.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-transcript';
    empty.textContent = '送出一句話後，完整內容會保留在這裡。';
    transcriptList.append(empty);
    return;
  }
  transcript.forEach(item => {
    const row = document.createElement('div');
    row.className = `transcript-row ${item.role}`;
    const prefix = document.createElement('span');
    prefix.className = 'message-prefix';
    prefix.textContent = item.role === 'user' ? '你' : 'HealthAI · AI 生成';
    const text = document.createElement('span');
    text.className = 'message-text';
    text.textContent = item.text;
    row.append(prefix, text);
    transcriptList.append(row);
  });
}

function sendMessage(text) {
  const value = text.trim();
  if (!value || input.disabled) return;
  if (app.dataset.state === 'home') setState('conversing');
  appendMessage('user', value);
  input.value = '';
  const reply = scriptedReplies[scriptIndex % scriptedReplies.length];
  scriptIndex += 1;
  window.setTimeout(() => {
    appendMessage('ai', reply);
    app.dataset.expression = scriptIndex % 2 === 0 ? 'attentive' : 'soft';
    if (scriptIndex === 2) setState('paused');
    if (scriptIndex === 5) setState('crisis');
  }, 420);
}
