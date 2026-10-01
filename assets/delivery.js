/**
 * [INPUT]: 当前项目 project.json 的版本、生产放行条件、数量、文件与验证结果。
 * [OUTPUT]: 交付页内容、可用文件下载、完整 PDF 入口、历史版下载及可追溯图页缩略图。
 * [POS]: 静态展示控制层，内容通过 textContent 安全写入。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
const select = (id) => document.getElementById(id);
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

function localFile(path) {
  if (typeof path !== 'string' || !path.startsWith('files/') || path.includes('..')) return null;
  return encodeURI(path);
}

function fileSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  return bytes < 1048576 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;
}

function downloadCard(file) {
  const card = element('article', `download-card${file.primary ? ' primary' : ''}`);
  const info = element('div', 'file-info');
  info.append(element('h3', '', file.label), element('p', '', file.description));
  if (file.bytes) info.append(element('span', 'file-size', fileSize(file.bytes)));
  const path = file.available && localFile(file.path);
  const action = element(path ? 'a' : 'span', `download-button${path ? '' : ' disabled'}`, path ? '下载 ↓' : '待交付');
  if (path) { action.href = path; action.download = ''; action.setAttribute('aria-label', `下载${file.label}`); }
  card.append(element('span', 'file-icon', file.format), info, action);
  return card;
}

function renderDimensions(data) {
  ['length', 'width', 'height'].forEach((key) => {
    const target = select(`dimension-${key}`);
    target.textContent = data[key] === null ? '待核实' : data[key];
    if (data[key] !== null) target.append(element('small', '', data.unit));
  });
  select('dimension-note').textContent = data.note || '';
}

function renderChecks(checks) {
  const labels = { pending: '待确认', verified: '已校核', limitation: '有说明' };
  checks.forEach((check) => {
    const row = element('li', 'check-item');
    const top = element('div', 'check-top');
    top.append(element('span', '', check.label), element('span', `check-status ${check.status}`, labels[check.status] || check.status));
    row.append(top, element('p', '', check.detail));
    select('check-list').append(row);
  });
}

function renderPreview(files) {
  const pdf = files.find((file) => file.preview && file.available && localFile(file.path));
  if (!pdf) return;
  const path = localFile(pdf.path);
  const info = element('div', '');
  info.append(element('h3', '', '完整图册'), element('p', 'muted', '在新窗口阅读全部图页，也可下载后查看或打印。'));
  const action = element('a', 'download-button', `打开完整${pdf.pages ? ` ${pdf.pages} 页` : ''} PDF ↗`);
  action.href = path;
  action.target = '_blank';
  action.rel = 'noopener';
  select('preview-panel').classList.add('pdf-callout');
  select('preview-panel').replaceChildren(info, action);
  select('pdf-open').href = path;
  select('pdf-open').hidden = false;
}

function renderPreviewImages(images = []) {
  images.forEach((preview) => {
    if (!preview.path?.startsWith('previews/') || preview.path.includes('..')) return;
    const card = element('a', 'preview-card');
    card.href = encodeURI(preview.path);
    card.target = '_blank';
    card.rel = 'noopener';
    const image = element('img', '');
    image.src = card.href;
    image.alt = preview.label;
    image.loading = 'lazy';
    card.append(image, element('span', '', preview.label));
    select('preview-gallery').append(card);
  });
  select('preview-gallery').hidden = select('preview-gallery').childElementCount === 0;
}

function renderHistory(history = []) {
  history.forEach((release) => {
    const panel = element('details', 'history-release');
    panel.append(element('summary', 'text-link', `${release.version} · ${release.date} · 展开历史下载`));
    panel.append(element('p', 'muted', release.description));
    const list = element('div', 'download-grid');
    release.files.forEach((file) => list.append(downloadCard({ ...file, primary: false, label: `${release.version} · ${file.label}` })));
    panel.append(list);
    select('history-list').append(panel);
  });
  select('history').hidden = history.length === 0;
}

function renderProject(data) {
  const model = element('span', 'model-name', data.id);
  const name = element('span', 'model-name', data.title.replace(data.id, '').trim());
  select('project-title').replaceChildren(model, document.createTextNode(' '), name);
  select('project-summary').textContent = data.summary;
  select('project-version').textContent = data.version;
  select('project-date').textContent = `版本日期 ${data.date}`;
  select('project-status').textContent = data.statusLabel;
  select('release-heading').textContent = data.statusLabel;
  select('project-status').classList.toggle('ready', data.productionReleased === true);
  if (data.releaseNote) select('release-note').textContent = data.releaseNote;
  (data.releaseConditions || []).forEach((condition) => select('release-conditions').append(element('li', '', condition)));
  renderDimensions(data.dimensions);
  const ready = data.files.filter((file) => file.available && localFile(file.path)).length;
  select('file-count').textContent = `${ready} / ${data.files.length} 份文件可下载`;
  data.files.forEach((file) => select('download-list').append(downloadCard(file)));
  data.quantities.forEach((item) => {
    const row = element('tr', '');
    row.append(element('td', '', item.label), element('td', '', `${item.quantity} ${item.unit}`));
    select('quantity-list').append(row);
  });
  renderChecks(data.checks);
  renderHistory(data.history);
  renderPreview(data.files);
  renderPreviewImages(data.previewImages);
  if (data.deliveryNote) select('delivery-note').textContent = data.deliveryNote;
}

fetch('project.json', { cache: 'no-cache' }).then((response) => {
  if (!response.ok) throw new Error('交付信息读取失败');
  return response.json();
}).then(renderProject).catch(() => {
  select('project-status').textContent = '交付信息暂不可用';
  select('project-summary').textContent = '请刷新页面重试，或通过页脚的仓库入口查看文件。';
});
