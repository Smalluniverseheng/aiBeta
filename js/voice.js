/* ==================== VOICE · 语音输入（ASR）与朗读（TTS）多引擎 ====================
 * ASR 引擎：浏览器内置 / 小米 MiMo（中英+方言）/ OpenAI Whisper / Groq Whisper
 * TTS 引擎：浏览器内置 / 小米 MiMo（精品音色）/ OpenAI TTS
 * 只填 API Key 即可使用，请求地址/格式/参数已全部按厂商官方文档适配：
 *  - MiMo  ASR: POST {base}/v1/chat/completions  model=mimo-v2.5-asr   input_audio(base64 wav)
 *  - MiMo  TTS: POST {base}/v1/chat/completions  model=mimo-v2.5-tts   audio={format,voice}
 *  - OpenAI ASR: POST {base}/v1/audio/transcriptions  form(file, model=whisper-1)
 *  - OpenAI TTS: POST {base}/v1/audio/speech          json(model=tts-1, input, voice)
 *  - Groq  ASR: POST {base}/v1/audio/transcriptions  form(file, model=whisper-large-v3-turbo)
 */
const Voice = (() => {

  const TTS_ENGINES = [
    { id: 'browser', provider: null, desc: '免费 · 离线可用' },
    { id: 'mimo', provider: '小米 MiMo', desc: '精品音色 · 中英 · 风格控制' },
    { id: 'openai', provider: 'OpenAI', desc: 'tts-1 · 6 种音色' }
  ];
  const ASR_ENGINES = [
    { id: 'browser', provider: null, desc: '免费 · 实时识别' },
    { id: 'mimo', provider: '小米 MiMo', desc: '中英 · 粤语/吴语/闽南语/四川话 · 抗噪' },
    { id: 'openai', provider: 'OpenAI', desc: 'Whisper · 多语言' },
    { id: 'groq', provider: 'Groq', desc: 'Whisper 极速 · 多语言' }
  ];
  const MIMO_VOICES = [
    { id: 'mimo_default', name: 'MiMo 默认' },
    { id: '冰糖', name: '冰糖 · 中文女声' }, { id: '茉莉', name: '茉莉 · 中文女声' },
    { id: '苏打', name: '苏打 · 中文男声' }, { id: '白桦', name: '白桦 · 中文男声' },
    { id: 'Mia', name: 'Mia · 英文女声' }, { id: 'Chloe', name: 'Chloe · 英文女声' },
    { id: 'Milo', name: 'Milo · 英文男声' }, { id: 'Dean', name: 'Dean · 英文男声' }
  ];
  const OPENAI_VOICES = ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'];

  function vs() { return Store.state.voiceSettings; }
  function ttsEngine() { return vs().ttsEngine || 'browser'; }
  function asrEngine() { return vs().asrEngine || 'browser'; }
  function engineKey(engine, list) {
    const e = list.find(x => x.id === engine);
    if (!e || !e.provider) return '__none__';
    return getKeyForModel({ provider: e.provider });
  }
  function ttsKey() { return engineKey(ttsEngine(), TTS_ENGINES); }
  function asrKey() { return engineKey(asrEngine(), ASR_ENGINES); }
  function providerBase(provider) { return PROVIDERS[provider].base(); }
  function providerHeaders(provider, key) { return PROVIDERS[provider].headers(key); }

  /* ==================== ASR（语音输入） ==================== */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recog = null, recognizing = false;
  let mediaRec = null, mediaChunks = [], mediaStream = null, vendorRecording = false;

  function inputSupported() {
    return !!SR || !!navigator.mediaDevices;
  }

  /* 统一入口：开始语音输入 */
  async function startInput(onResult, onEnd) {
    const eng = asrEngine();
    if (eng === 'browser') return startBrowserInput(onResult, onEnd);
    if (!asrKey()) {
      Toast.warning('请先在「我的 → API Key 管理」配置 ' + (ASR_ENGINES.find(e => e.id === eng) || {}).provider + ' 的 Key');
      return false;
    }
    return startVendorInput(onResult, onEnd);
  }

  /* 浏览器 SpeechRecognition */
  function startBrowserInput(onResult, onEnd) {
    if (!SR) { Toast.warning('当前浏览器不支持内置语音输入，可在「语音识别」设置改用小米/OpenAI/Groq 引擎'); return false; }
    stopInput();
    recog = new SR();
    recog.lang = I18n.speechLang();
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = e => {
      let final = '', interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t; else interim += t;
      }
      onResult(final, interim);
    };
    recog.onerror = e => {
      if (e.error === 'not-allowed') Toast.error('麦克风权限被拒绝，请在浏览器设置中允许');
      else if (e.error !== 'aborted') Toast.warning('语音识别中断：' + e.error);
      recognizing = false; onEnd && onEnd();
    };
    recog.onend = () => { recognizing = false; onEnd && onEnd(); };
    try { recog.start(); recognizing = true; return true; }
    catch (e) { recognizing = false; return false; }
  }

  /* 厂商 ASR：录音 → 转写 */
  async function startVendorInput(onResult, onEnd) {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      Toast.warning('当前浏览器不支持录音'); return false;
    }
    stopInput();
    try { mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch (e) { Toast.error('麦克风权限被拒绝，请在浏览器设置中允许'); return false; }
    mediaChunks = [];
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    try { mediaRec = new MediaRecorder(mediaStream, mime ? { mimeType: mime } : undefined); }
    catch (e) { mediaRec = new MediaRecorder(mediaStream); }
    mediaRec.ondataavailable = e => { if (e.data && e.data.size) mediaChunks.push(e.data); };
    mediaRec.onstop = async () => {
      const blob = new Blob(mediaChunks, { type: mediaRec.mimeType || 'audio/webm' });
      mediaStream.getTracks().forEach(t => t.stop());
      mediaStream = null; mediaRec = null; vendorRecording = false;
      onEnd && onEnd();
      if (blob.size < 800) return; // 录音太短
      const tid = Toast.info('正在识别语音…', 60000);
      try {
        const text = await transcribeBlob(blob);
        Toast.dismiss(tid);
        if (text) onResult(text, ''); else Toast.warning('没有识别到内容');
      } catch (e) {
        Toast.dismiss(tid);
        Toast.error('语音识别失败：' + e.message);
      }
    };
    mediaRec.start();
    vendorRecording = true;
    return true;
  }

  function stopInput() {
    if (recog) { try { recog.stop(); } catch (e) {} recog = null; }
    recognizing = false;
    if (mediaRec && mediaRec.state !== 'inactive') { try { mediaRec.stop(); } catch (e) {} }
    else if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
    vendorRecording = false;
  }

  function isRecognizing() { return recognizing || vendorRecording; }

  /* 录音 Blob → 文本（按引擎分发） */
  async function transcribeBlob(blob) {
    const eng = asrEngine();
    const key = asrKey();
    if (eng === 'mimo') {
      const wavB64 = await blobToWavBase64(blob);
      const res = await fetch(providerBase('小米 MiMo') + '/v1/chat/completions', {
        method: 'POST',
        headers: providerHeaders('小米 MiMo', key),
        body: JSON.stringify({
          model: 'mimo-v2.5-asr',
          messages: [{ role: 'user', content: [{ type: 'input_audio', input_audio: { data: 'data:audio/wav;base64,' + wavB64 } }] }],
          asr_options: { language: I18n.mimoAsrLang() }
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
      return ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '').trim();
    }
    /* OpenAI / Groq：multipart 表单 */
    const provider = eng === 'openai' ? 'OpenAI' : 'Groq';
    const model = eng === 'openai' ? 'whisper-1' : 'whisper-large-v3-turbo';
    const ext = (blob.type.includes('mp4') ? 'm4a' : 'webm');
    const fd = new FormData();
    fd.append('file', new File([blob], 'audio.' + ext, { type: blob.type }));
    fd.append('model', model);
    const res = await fetch(providerBase(provider) + '/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key },
      body: fd
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
    return (data.text || '').trim();
  }

  /* webm/mp4 Blob → WAV(PCM16 单声道) base64（MiMo 仅支持 wav/mp3） */
  async function blobToWavBase64(blob) {
    const ab = await blob.arrayBuffer();
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    let buf;
    try { buf = await ctx.decodeAudioData(ab); } finally { ctx.close(); }
    const sr = buf.sampleRate;
    const ch = buf.numberOfChannels;
    const len = buf.length;
    const pcm = new Int16Array(len);
    for (let c = 0; c < ch; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) pcm[i] += (d[i] * 32767 / ch) | 0;
    }
    /* WAV 头 */
    const header = new ArrayBuffer(44);
    const v = new DataView(header);
    const wstr = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    wstr(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); wstr(8, 'WAVE');
    wstr(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
    v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
    wstr(36, 'data'); v.setUint32(40, pcm.length * 2, true);
    const bytes = new Uint8Array(44 + pcm.length * 2);
    bytes.set(new Uint8Array(header), 0);
    bytes.set(new Uint8Array(pcm.buffer), 44);
    /* base64 分块编码 */
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  }

  /* ==================== TTS（朗读） ==================== */
  let currentUtter = null, speakingMsgId = null, audioEl = null;

  function ttsSupported() { return 'speechSynthesis' in window || !!Audio; }

  function getVoices() {
    if (!('speechSynthesis' in window)) return [];
    const bcp = I18n.speechLang();
    const prefix = bcp.split('-')[0];
    return speechSynthesis.getVoices().filter(v => (v.lang || '').startsWith(prefix));
  }

  function pickVoice() {
    const s = vs();
    const all = speechSynthesis.getVoices();
    if (s.voiceURI) {
      const found = all.find(v => v.voiceURI === s.voiceURI);
      if (found) return found;
    }
    return getVoices()[0] || all[0] || null;
  }

  function cleanText(text) {
    return String(text)
      .replace(/```[\s\S]*?```/g, '，代码段，')
      .replace(/[#*>`\-|[\](),.:;!?！？，。；：]/g, ' ')
      .replace(/\s+/g, ' ')
      .slice(0, 1500);
  }

  /* 统一入口：朗读 */
  async function speak(text, msgId) {
    stopSpeak();
    const clean = cleanText(text);
    if (!clean.trim()) return false;
    const eng = ttsEngine();
    if (eng === 'browser') return speakBrowser(clean, msgId);
    const key = ttsKey();
    if (!key) {
      Toast.warning('请先在「API Key 管理」配置 ' + (TTS_ENGINES.find(e => e.id === eng) || {}).provider + ' 的 Key');
      return false;
    }
    speakingMsgId = msgId || null;
    if (typeof UI !== "undefined") UI.updateSpeakButtons();
    try {
      const url = eng === 'mimo' ? await mimoTtsUrl(clean, key) : await openaiTtsUrl(clean, key);
      playUrl(url, msgId);
      return true;
    } catch (e) {
      speakingMsgId = null;
      if (typeof UI !== "undefined") UI.updateSpeakButtons();
      Toast.error('语音合成失败：' + e.message);
      return false;
    }
  }

  function speakBrowser(clean, msgId) {
    if (!('speechSynthesis' in window)) { Toast.warning('当前浏览器不支持语音朗读'); return false; }
    const u = new SpeechSynthesisUtterance(clean);
    const v = pickVoice();
    if (v) u.voice = v;
    u.lang = v ? v.lang : I18n.speechLang();
    u.rate = vs().rate || 1;
    currentUtter = u;
    speakingMsgId = msgId || null;
    u.onend = u.onerror = () => { currentUtter = null; speakingMsgId = null; if (typeof UI !== "undefined") UI.updateSpeakButtons(); };
    speechSynthesis.speak(u);
    if (typeof UI !== "undefined") UI.updateSpeakButtons();
    return true;
  }

  /* MiMo TTS：assistant 消息放目标文本，audio 指定格式与音色 */
  async function mimoTtsUrl(text, key, opts) {
    opts = opts || {};
    const body = {
      model: opts.model || 'mimo-v2.5-tts',
      messages: opts.messages || [{ role: 'assistant', content: text }],
      audio: opts.audio || { format: 'wav', voice: vs().ttsVoice || 'mimo_default' }
    };
    const res = await fetch(providerBase('小米 MiMo') + '/v1/chat/completions', {
      method: 'POST',
      headers: providerHeaders('小米 MiMo', key),
      body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
    const audio = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.audio;
    if (!audio || !audio.data) throw new Error('厂商未返回音频');
    return 'data:audio/wav;base64,' + audio.data;
  }

  /* 指定 MiMo 音色朗读（不走全局设置，翻译空间音色行用） */
  async function speakMimo(text, voiceId, msgId) {
    stopSpeak();
    const clean = cleanText(text);
    if (!clean.trim()) return false;
    const key = engineKey('mimo', TTS_ENGINES);
    if (!key) {
      Toast.warning('请先在「我的 → API Key 管理」配置 小米 MiMo 的 Key');
      return false;
    }
    speakingMsgId = msgId || null;
    if (typeof UI !== "undefined") UI.updateSpeakButtons();
    try {
      const url = await mimoTtsUrl(clean, key, { audio: { format: 'wav', voice: voiceId || 'mimo_default' } });
      playUrl(url, msgId);
      return true;
    } catch (e) {
      speakingMsgId = null;
      if (typeof UI !== "undefined") UI.updateSpeakButtons();
      Toast.error('语音合成失败：' + e.message);
      return false;
    }
  }

  /* 克隆声音朗读：assistant 消息放目标文本，audio.voice 传样本 dataURL（同语音工坊克隆模式） */
  async function speakClone(text, sampleDataUrl, msgId) {
    stopSpeak();
    const clean = cleanText(text);
    if (!clean.trim()) return false;
    if (!sampleDataUrl) { Toast.warning('请先上传声音样本'); return false; }
    const key = engineKey('mimo', TTS_ENGINES);
    if (!key) {
      Toast.warning('克隆声音使用小米 MiMo 语音模型，请先在「我的 → API Key 管理」配置小米 MiMo Key');
      return false;
    }
    speakingMsgId = msgId || null;
    if (typeof UI !== "undefined") UI.updateSpeakButtons();
    try {
      const url = await mimoTtsUrl(clean, key, {
        model: 'mimo-v2.5-tts-voiceclone',
        messages: [{ role: 'assistant', content: clean }],
        audio: { format: 'wav', voice: sampleDataUrl }
      });
      playUrl(url, msgId);
      return true;
    } catch (e) {
      speakingMsgId = null;
      if (typeof UI !== "undefined") UI.updateSpeakButtons();
      Toast.error('语音合成失败：' + e.message);
      return false;
    }
  }

  /* OpenAI TTS：/v1/audio/speech 返回二进制音频 */
  async function openaiTtsUrl(text, key) {
    const res = await fetch(providerBase('OpenAI') + '/v1/audio/speech', {
      method: 'POST',
      headers: providerHeaders('OpenAI', key),
      body: JSON.stringify({ model: 'tts-1', input: text, voice: vs().ttsVoice || 'alloy' })
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error((data.error && data.error.message) || ('HTTP ' + res.status));
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  function playUrl(url, msgId) {
    audioEl = new Audio(url);
    speakingMsgId = msgId || null;
    audioEl.onended = audioEl.onerror = () => {
      speakingMsgId = null; audioEl = null;
      if (typeof UI !== "undefined") UI.updateSpeakButtons();
    };
    audioEl.play().catch(() => {
      speakingMsgId = null;
      if (typeof UI !== "undefined") UI.updateSpeakButtons();
    });
    if (typeof UI !== "undefined") UI.updateSpeakButtons();
  }

  function stopSpeak() {
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    if (audioEl) { try { audioEl.pause(); } catch (e) {} audioEl = null; }
    currentUtter = null;
    speakingMsgId = null;
    if (typeof UI !== "undefined") UI.updateSpeakButtons();
  }

  function isSpeaking(msgId) {
    if (!currentUtter && !audioEl) return false;
    return msgId ? speakingMsgId === msgId : true;
  }

  // 预热浏览器语音列表（部分浏览器需要）
  if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => {}; }

  return {
    TTS_ENGINES, ASR_ENGINES, MIMO_VOICES, OPENAI_VOICES,
    inputSupported, startInput, stopInput, isRecognizing,
    ttsSupported, speak, speakMimo, speakClone, stopSpeak, isSpeaking, getVoices,
    mimoTtsUrl, engineKey
  };
})();
