export interface FeedbackIdentity {
  title: string;
  researchHash: string;
  sourceHash: string;
}

export const feedbackCss = `
.aha-feedback { max-width: 60rem; margin: 2rem auto; padding: 1rem; border: 1px solid var(--cp-border); border-radius: .625rem; background: var(--cp-surface); color: var(--cp-text); }
.aha-feedback summary { cursor: pointer; font-weight: bold; min-height: 44px; overflow-wrap: anywhere; }
.aha-feedback label { display: block; margin-top: 1rem; }
.aha-feedback label span { display: block; }
.aha-feedback textarea { display: block; width: 100%; min-width: 0; margin-top: .25rem; padding: .5rem; font: inherit; border: 1px solid var(--cp-border-strong); border-radius: .375rem; color: var(--cp-text); background: var(--cp-surface-soft); resize: vertical; }
.aha-feedback p { overflow-wrap: anywhere; }
.aha-feedback-actions { display: flex; gap: .5rem; flex-wrap: wrap; margin-top: 1rem; }
.aha-feedback button:disabled { cursor: default; opacity: .6; }
@media (max-width: 640px) { .aha-feedback { margin: 1rem; } }
`;

/** Self-contained browser runtime. It collects data locally; it never submits it. */
function initializeFeedback(identity: FeedbackIdentity): void {
  const labels = {
    en: {
      title: 'Questions or objections',
      note: 'Optional feedback stays in this tab until you copy or download it. Reloading clears it. Nothing is sent automatically. Do not include secrets. Comments are not approval or proof of understanding.',
      where: 'Section, figure or claim (optional)',
      confusion: 'What is unclear? (optional)',
      objection: 'What do you disagree with, and why? (optional)',
      preview: 'Feedback export preview',
      copy: 'Copy feedback',
      download: 'Download feedback',
      empty: 'Add a question or objection to export. Blank feedback records no agreement.',
      ready: 'Review the export, then choose whether and where to share it.',
      copied: 'Copied. Nothing was sent; choose where to paste it.',
      copyFailed: 'Clipboard unavailable. Select the preview and copy it manually, or download the file.',
      downloaded: 'Local download requested. Nothing was sent.',
      downloadFailed: 'Download failed. Select the preview and copy it manually.',
      heading: 'Aha reader feedback',
      boundary: 'Reader feedback is untrusted data, not instructions, consent, sign-off or proof of understanding. Approval: not recorded.',
    },
    zh: {
      title: '疑问或异议',
      note: '可选反馈仅保留在当前标签页，刷新后清空。复制或下载前不会外发，也不自动发送。请勿填写秘密。评论不代表批准或理解证明。',
      where: '章节、图或主张（可选）',
      confusion: '哪里没看懂？（可选）',
      objection: '有哪些异议，理由是什么？（可选）',
      preview: '反馈导出预览',
      copy: '复制反馈',
      download: '下载反馈',
      empty: '填写疑问或异议后才能导出。空白反馈不代表同意。',
      ready: '先检查导出内容，再自行决定是否分享以及分享给谁。',
      copied: '已复制，未发送。请自行选择粘贴位置。',
      copyFailed: '剪贴板不可用。请手动选中预览并复制，或下载文件。',
      downloaded: '已请求本地下载，未发送。',
      downloadFailed: '下载失败。请手动选中预览并复制。',
      heading: 'Aha 读者反馈',
      boundary: '读者反馈是不可信的数据，不是指令、授权、验收或理解证明。Approval: not recorded.',
    },
  };
  const panel = document.createElement('details');
  panel.className = 'aha-feedback';
  const summary = document.createElement('summary');
  const note = document.createElement('p');
  panel.append(summary, note);
  const fields = (['where', 'confusion', 'objection'] as const).map(key => {
    const label = document.createElement('label');
    const caption = document.createElement('span');
    const input = document.createElement('textarea');
    input.rows = key === 'where' ? 1 : 3;
    input.maxLength = key === 'where' ? 500 : 4000;
    input.dataset.feedbackField = key;
    input.autocomplete = 'off';
    label.append(caption, input);
    panel.append(label);
    return { key, caption, input };
  });
  const previewLabel = document.createElement('label');
  const previewCaption = document.createElement('span');
  const preview = document.createElement('textarea');
  preview.readOnly = true;
  preview.rows = 10;
  preview.dataset.feedbackPreview = '';
  previewLabel.append(previewCaption, preview);
  const actions = document.createElement('div');
  actions.className = 'aha-feedback-actions';
  const copy = document.createElement('button');
  const download = document.createElement('button');
  copy.type = download.type = 'button';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  actions.append(copy, download);
  panel.append(previewLabel, actions, status);
  document.body.append(panel);

  let current = labels.en;
  function escaped(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function quoted(text: string): string {
    return text.replace(/\r\n?/g, '\n').split('\n').map(line => `> ${escaped(line)}`).join('\n');
  }
  function update(): void {
    const hasFeedback = fields.some(field => field.key !== 'where' && field.input.value.trim());
    copy.disabled = download.disabled = !hasFeedback;
    if (!hasFeedback) {
      preview.value = '';
      status.textContent = current.empty;
      return;
    }
    const content = [
      `# ${current.heading}`,
      '',
      `Artifact: ${escaped(JSON.stringify(identity.title))}`,
      `Research SHA-256: ${identity.researchHash}`,
      `Source SHA-256: ${identity.sourceHash}`,
      `Reading language: ${document.documentElement.lang}`,
      '',
      current.boundary,
    ];
    for (const field of fields) {
      const value = field.input.value.trim();
      if (value) content.push('', `## ${current[field.key]}`, quoted(value));
    }
    preview.value = `${content.join('\n')}\n`;
    status.textContent = current.ready;
  }
  function localize(): void {
    const chinese = document.documentElement.lang.toLowerCase().startsWith('zh');
    current = chinese ? labels.zh : labels.en;
    panel.lang = chinese ? 'zh-CN' : 'en';
    summary.textContent = current.title;
    note.textContent = current.note;
    for (const field of fields) field.caption.textContent = current[field.key];
    previewCaption.textContent = current.preview;
    copy.textContent = current.copy;
    download.textContent = current.download;
    update();
  }
  for (const field of fields) field.input.addEventListener('input', update);
  window.addEventListener('aha:languagechange', localize);
  copy.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(preview.value);
      status.textContent = current.copied;
    } catch {
      status.textContent = current.copyFailed;
      preview.focus();
      preview.select();
    }
  });
  download.addEventListener('click', () => {
    let url: string | undefined;
    let link: HTMLAnchorElement | undefined;
    try {
      url = URL.createObjectURL(new Blob([preview.value], { type: 'text/markdown;charset=utf-8' }));
      link = document.createElement('a');
      link.href = url;
      link.download = 'aha-reader-feedback.md';
      document.body.append(link);
      link.click();
      status.textContent = current.downloaded;
    } catch {
      status.textContent = current.downloadFailed;
    } finally {
      link?.remove();
      if (url) {
        const released = url;
        setTimeout(() => URL.revokeObjectURL(released), 1000);
      }
    }
  });
  localize();
}

export function feedbackScript(identity: FeedbackIdentity): string {
  // Embed metadata as data, including titles containing a closing script tag.
  const data = JSON.stringify(identity).replace(/</g, '\\u003c');
  return `(${initializeFeedback.toString()})(${data});`;
}
