/**
 * [INPUT]: assembly.json网格、index.json件号索引与routes.json实际孔路线。
 * [OUTPUT]: 同件号的装配查看、分离、定位、孔与工程图跳转。
 * [POS]: R04三维装配入口；不生成或改写制造尺寸。
 * [PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/OrbitControls.js';

const $ = (id) => document.getElementById(id);
const state = { selected: null, preset: 'all', isolated: false, explode: 0, selectedHole: null, routeFilter: [] };
const viewport = $('viewport');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1, 1, 30000);
camera.up.set(0, 0, 1);
camera.position.set(3400, -3400, 2600);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0xffffff, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.prepend(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.target.set(1000, 600, 500);
controls.minDistance = 35;
controls.maxDistance = 12000;
scene.add(new THREE.HemisphereLight(0xffffff, 0x9aaca2, 2.5));
const light = new THREE.DirectionalLight(0xffffff, 2.4);
light.position.set(1500, -1000, 4000);
scene.add(light);
const meshes = [], pins = [], holeMarkers = new THREE.Group(), routeGroup = new THREE.Group();
scene.add(holeMarkers, routeGroup);
const raycaster = new THREE.Raycaster();
let index, model, routes, rows;

function triangulate(vertices, face) {
  if (face.length === 3) return [face];
  const a = new THREE.Vector3(...vertices[face[0]]);
  let normal = new THREE.Vector3();
  for (let i = 1; i < face.length - 1 && normal.lengthSq() < 1e-12; i++) {
    normal.crossVectors(new THREE.Vector3(...vertices[face[i]]).sub(a), new THREE.Vector3(...vertices[face[i + 1]]).sub(a));
  }
  const abs = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  const skip = abs.indexOf(Math.max(...abs));
  const contour = face.map((n) => new THREE.Vector2(...vertices[n].filter((_, axis) => axis !== skip)));
  return THREE.ShapeUtils.triangulateShape(contour, []).map((tri) => tri.map((n) => face[n]));
}

function createMesh(part) {
  if (!part.vertices?.length || !part.faces?.length) return;
  const positions = [];
  for (const face of part.faces) for (const tri of triangulate(part.vertices, face)) for (const n of tri) positions.push(...part.vertices[n]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const material = new THREE.MeshStandardMaterial({ color: part.color || '#a9b8af', roughness: .8, metalness: .08, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData = { part, baseColor: new THREE.Color(part.color || '#a9b8af') };
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 25), new THREE.LineBasicMaterial({ color: 0x52665b, transparent: true, opacity: .55 }));
  mesh.add(edges);
  meshes.push(mesh);
  scene.add(mesh);
}

function linePoints(route) {
  return route.points || route.polyline || route.path || [];
}

function addRoutes() {
  const palette = ['#cd7b32', '#3676a6', '#38916a', '#9366a5', '#cb5753', '#76863b'];
  (routes.routes || []).forEach((route, n) => {
    const points = linePoints(route);
    if (points.length < 2) return;
    const geometry = new THREE.BufferGeometry().setFromPoints(points.map((p) => new THREE.Vector3(...p)));
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: palette[n % palette.length], linewidth: 2, depthTest: false }));
    line.renderOrder = 4;
    line.userData.route = route;
    routeGroup.add(line);
  });
  (routes.holes || []).forEach((hole) => {
    if (!Array.isArray(hole.center)) return;
    const radius = Math.max(Number(hole.diameter || 0) / 2, 2);
    const [width, height] = hole.size || [0, 0];
    const rectangle = new THREE.BufferGeometry().setFromPoints([[-width / 2, -height / 2], [width / 2, -height / 2], [width / 2, height / 2], [-width / 2, height / 2]].map(([x, y]) => new THREE.Vector3(x, y, 0)));
    const ring = width && height ? new THREE.LineLoop(rectangle, new THREE.LineBasicMaterial({ color: 0xc1742b, depthTest: false })) : new THREE.Mesh(new THREE.TorusGeometry(radius, 1.2, 8, 32), new THREE.MeshBasicMaterial({ color: 0xc1742b, depthTest: false }));
    ring.position.set(...hole.center);
    const normal = new THREE.Vector3(...(hole.normal || [0, 0, 1])).normalize();
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    ring.userData.hole = hole;
    ring.renderOrder = 5;
    holeMarkers.add(ring);
  });
}

function presetIncludes(id) {
  const family = {
    wood: /^(W|H0[679]|H1[019]|H2[0156]|B)/,
    frame: /^(S0[1235689]|H0[12]|H1[56]|H22)/,
    service: /^(S07|S10|H0[345]|H1[23478]|H2[34]|E02|E07|E2[1234])/,
    electric: /^E/,
  };
  return !family[state.preset] || family[state.preset].test(id);
}

function selectedIds() {
  if (!state.selected) return new Set();
  const item = rows.get(state.selected);
  return new Set([state.selected, ...(item?.childPartIds || [])]);
}

function refresh() {
  const ids = selectedIds();
  for (const mesh of meshes) {
    const part = mesh.userData.part;
    const selected = ids.has(part.id);
    mesh.visible = state.isolated ? selected : (presetIncludes(part.id) || selected);
    mesh.position.set(...(part.explode || [0, 0, 0])).multiplyScalar(state.explode);
    mesh.material.color.copy(selected ? new THREE.Color('#e1aa4e') : mesh.userData.baseColor);
    const opacity = part.renderAsEnvelope ? (part.opacity || .12) : 1;
    mesh.material.opacity = state.selected && !selected ? .08 : opacity;
    mesh.material.transparent = mesh.material.opacity < 1;
    mesh.material.depthWrite = !mesh.material.transparent;
    mesh.children[0].visible = !state.selected || selected;
  }
  routeGroup.visible = $('show-routes').checked && state.explode === 0;
  const selectedRoutes = state.routeFilter.length ? state.routeFilter : (rows?.get(state.selected)?.routeIds || []);
  for (const line of routeGroup.children) {
    line.visible = selectedRoutes.length ? selectedRoutes.includes(line.userData.route.id) : !String(line.userData.route.status).includes('用户线路未分配');
  }
  holeMarkers.visible = ($('show-holes').checked || !!state.selectedHole) && state.explode === 0;
  for (const marker of holeMarkers.children) marker.visible = $('show-holes').checked || marker.userData.hole.id === state.selectedHole;
  $('show-holes').disabled = state.explode > 0;
  $('show-routes').disabled = state.explode > 0;
  $('isolate').disabled = !state.selected;
  $('isolate').textContent = state.isolated ? '显示装配环境' : '只看选中';
  document.querySelectorAll('.part-row').forEach((el) => el.classList.toggle('selected', el.dataset.id === state.selected));
  rebuildPins();
  render();
}

function fitVisible(onlySelected = false) {
  const box = new THREE.Box3();
  const ids = selectedIds();
  for (const mesh of meshes) if (mesh.visible && (!onlySelected || ids.has(mesh.userData.part.id))) box.expandByObject(mesh);
  if (box.isEmpty()) return;
  const center = box.getCenter(new THREE.Vector3());
  const direction = camera.position.clone().sub(controls.target).normalize();
  const right = new THREE.Vector3().crossVectors(camera.up, direction).normalize();
  const up = new THREE.Vector3().crossVectors(direction, right).normalize();
  const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const tanH = tanV * camera.aspect;
  let distance = 180;
  // 按八个包围角点同时满足水平、垂直视野；竖屏不能复用固定距离倍数。
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const delta = new THREE.Vector3(x, y, z).sub(center);
    distance = Math.max(distance, delta.dot(direction) + Math.abs(delta.dot(right)) / tanH,
      delta.dot(direction) + Math.abs(delta.dot(up)) / tanV);
  }
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, distance * 1.12);
  camera.near = 1;
  camera.updateProjectionMatrix();
  controls.update();
  render();
}

function textNode(tag, text, className = '') {
  const node = document.createElement(tag);
  node.textContent = text;
  if (className) node.className = className;
  return node;
}

function drawingLink(drawing, label) {
  const node = textNode('a', label || `图 ${drawing.id} · P${String(drawing.page).padStart(2, '0')} ↗`);
  node.href = `${index.pdfUrl}#page=${drawing.page}`;
  node.target = '_blank';
  node.rel = 'noopener';
  return node;
}

function drawingLinks(ids, fallback = []) {
  const codes = new Set([...(ids || []), ...fallback.map((d) => d.id)]);
  const links = textNode('div', '', 'links');
  for (const d of index.drawings.filter((d) => codes.has(d.id))) links.append(drawingLink(d));
  return links;
}

function selectPart(id) {
  state.selected = id;
  state.selectedHole = null;
  state.routeFilter = [];
  state.isolated = false;
  const row = rows.get(id);
  $('show-routes').checked = Boolean(row?.routeIds?.length);
  const detail = $('detail');
  detail.replaceChildren(textNode('strong', `${id} · ${row?.name || id}`));
  if (row) {
    detail.append(textNode('p', `每桌 ${row.quantity ?? '待核'} ${row.unit || ''}　所属总成 ${row.assembly || '整桌'}`));
    const links = textNode('div', '', 'links');
    for (const d of row.drawings || []) links.append(drawingLink(d));
    detail.append(links);
    const grade = row.geometryLevel || '';
    if (grade) detail.append(textNode('p', grade, 'muted'));
  }
  refresh();
  fitVisible(true);
}

function selectHole(hole) {
  if (hole.partId && rows.has(hole.partId)) selectPart(hole.partId);
  state.selectedHole = hole.id;
  state.explode = 0; $('explode').value = 0; $('explode-value').textContent = '0%';
  state.routeFilter = hole.routeIds || [];
  $('show-holes').checked = false;
  $('show-routes').checked = true;
  const size = hole.diameter ? `φ${hole.diameter}` : ((hole.size || []).join('×') || '孔径待核');
  const detail = $('detail');
  detail.replaceChildren(textNode('strong', `${hole.id} · ${hole.name || '穿线口'} ${size}${hole.tolerance ? ` (${hole.tolerance})` : ''}`));
  detail.append(textNode('p', `所在件 ${hole.partId || '待核'}　穿过路线 ${(hole.routeIds || []).join('、') || '见孔表'}`));
  if (hole.status) detail.append(textNode('p', hole.status === 'design_defined' ? '设计孔位已确定' : hole.status, 'muted'));
  detail.append(drawingLinks(hole.drawingIds, rows.get(hole.partId)?.drawings || []));
  if (hole.localCenter) detail.append(textNode('p', `板件局部孔心 ${hole.localCenter.join(' / ')} mm`, 'muted'));
  refresh();
  if (Array.isArray(hole.center)) {
    const direction = new THREE.Vector3(...(hole.normal || [0, 0, 1])).multiplyScalar(1.5).add(new THREE.Vector3(.3, -.4, .6)).normalize();
    controls.target.set(...hole.center);
    camera.position.copy(controls.target).addScaledVector(direction, Math.max(260, Number(hole.diameter || 30) * 9) / Math.min(1, camera.aspect));
    controls.update(); render();
  }
}

function partList() {
  const q = $('search').value.toLowerCase().trim();
  const matching = [...rows.values()].filter((p) => `${p.id} ${p.name}`.toLowerCase().includes(q));
  $('part-count').textContent = `${matching.length} / ${rows.size} 项 · 件号与图册相同`;
  $('part-list').replaceChildren(...matching.map((p) => {
    const button = textNode('button', '', 'part-row');
    button.dataset.id = p.id;
    button.append(textNode('strong', p.id), textNode('span', p.name));
    button.append(textNode('small', `${p.quantity ?? '待核'} ${p.unit || ''} · ${(p.drawings || []).map((d) => `图${d.id}/P${d.page}`).join('　')}`));
    button.addEventListener('click', () => selectPart(p.id));
    return button;
  }));
}

function electricalList() {
  $('hole-list').replaceChildren(...(routes.holes || []).map((hole) => {
    const button = textNode('button', '', 'hole-row');
    button.append(textNode('strong', hole.id), textNode('span', `${hole.partId || ''} · ${hole.diameter ? 'φ' + hole.diameter : ((hole.size || []).join('×') || '孔径待核')}`));
    button.addEventListener('click', () => selectHole(hole));
    return button;
  }));
  $('route-list').replaceChildren(...(routes.routes || []).map((route) => {
    const button = textNode('button', '', 'route-row');
    button.append(textNode('strong', route.id), textNode('span', route.name || `${route.from} → ${route.to}`));
    button.addEventListener('click', () => {
      $('preset').value = state.preset = 'electric';
      state.selected = null; state.selectedHole = null; state.isolated = false;
      state.routeFilter = [route.id]; state.explode = 0; $('explode').value = 0; $('explode-value').textContent = '0%';
      $('show-routes').checked = true;
      $('detail').replaceChildren(textNode('strong', `${route.id} · ${route.name || '线束路线'}`), textNode('p', `${route.from || ''} → ${route.to || ''}　经过 ${(route.holeIds || []).join('、') || '无新增板孔'}`), textNode('p', route.note || route.status || '', 'muted'));
      $('detail').append(drawingLinks(route.drawingIds));
      refresh(); fitVisible();
    });
    return button;
  }));
}

function clearPins() {
  for (const pin of pins) pin.el.remove();
  pins.length = 0;
}

function addPin(text, point, mesh = null) {
  const el = textNode('div', text, 'pin');
  $('labels').append(el);
  pins.push({ el, point: new THREE.Vector3(...point), mesh });
}

function rebuildPins() {
  clearPins();
  const ids = selectedIds();
  const active = meshes.filter((m) => m.visible && ids.has(m.userData.part.id));
  if (rows?.get(state.selected)?.childPartIds?.length && active.length) {
    const box = new THREE.Box3(); active.forEach((mesh) => box.expandByObject(mesh));
    addPin(state.selected, box.getCenter(new THREE.Vector3()).toArray());
  } else {
    const shown = active.length > 12 ? active.slice(0, 1) : active;
    shown.forEach((mesh) => {
      const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
      const text = active.length > 12 ? `${state.selected} · ${active.length}处` : (mesh.userData.part.instance || mesh.userData.part.id);
      addPin(text, center.toArray(), mesh);
    });
  }
  if (holeMarkers.visible) for (const marker of holeMarkers.children) if (marker.visible) addPin(marker.userData.hole.id, marker.position.toArray());
}

function render() {
  renderer.render(scene, camera);
  for (const pin of pins) {
    const p = pin.point.clone();
    if (pin.mesh) p.add(pin.mesh.position);
    p.project(camera);
    pin.el.style.display = p.z > 1 || p.z < -1 ? 'none' : '';
    pin.el.style.left = `${(p.x * .5 + .5) * viewport.clientWidth}px`;
    pin.el.style.top = `${(-p.y * .5 + .5) * viewport.clientHeight}px`;
  }
}

function reset() {
  Object.assign(state, { selected: null, selectedHole: null, preset: 'all', isolated: false, explode: 0, routeFilter: [] });
  $('preset').value = 'all'; $('explode').value = 0; $('explode-value').textContent = '0%';
  $('show-routes').checked = false; $('show-holes').checked = false;
  $('detail').replaceChildren(textNode('strong', '整桌装配'), textNode('p', '拖动旋转查看；选择部件可定位并打开对应加工图。'));
  camera.position.set(3400, -3400, 2600); controls.target.set(1000, 600, 500);
  refresh(); fitVisible();
}

function bindEvents() {
  $('search').addEventListener('input', partList);
  $('reset').addEventListener('click', reset);
  $('fit').addEventListener('click', () => fitVisible(!!state.selected));
  $('isolate').addEventListener('click', () => { state.isolated = !state.isolated; refresh(); fitVisible(); });
  $('preset').addEventListener('change', () => { state.preset = $('preset').value; state.selected = null; state.selectedHole = null; state.isolated = false; state.routeFilter = []; refresh(); fitVisible(); });
  $('explode').addEventListener('input', () => { state.explode = Number($('explode').value) / 100; $('explode-value').textContent = `${$('explode').value}%`; refresh(); });
  $('explode').addEventListener('change', () => fitVisible());
  for (const id of ['show-routes', 'show-holes']) $(id).addEventListener('change', refresh);
  document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => {
    document.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('active', b === button));
    $('parts-panel').hidden = button.dataset.tab !== 'parts';
    $('holes-panel').hidden = button.dataset.tab !== 'holes';
  }));
  let start;
  renderer.domElement.addEventListener('pointerdown', (event) => { start = [event.clientX, event.clientY]; });
  renderer.domElement.addEventListener('pointerup', (event) => {
    if (!start || Math.hypot(event.clientX - start[0], event.clientY - start[1]) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
    const hits = raycaster.intersectObjects(meshes.filter((m) => m.visible), false);
    if (hits.length) selectPart(hits[0].object.userData.part.id);
  });
  controls.addEventListener('change', render);
  new ResizeObserver(() => {
    const { clientWidth: w, clientHeight: h } = viewport;
    if (!w || !h) return;
    camera.aspect = w / h; camera.updateProjectionMatrix(); renderer.setSize(w, h);
    if (rows && !state.selectedHole) fitVisible(!!state.selected);
    else render();
  }).observe(viewport);
}

try {
  [model, index, routes] = await Promise.all(['assembly.json', 'index.json', 'routes.json'].map(async (url) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`无法读取${url}`);
    return response.json();
  }));
  rows = new Map(index.parts.map((p) => [p.id, p]));
  model.parts.forEach(createMesh);
  addRoutes(); partList(); electricalList(); bindEvents();
  $('pdf-link').href = index.pdfUrl;
  $('home-link').href = index.homeUrl || '../../../';
  $('loading').remove();
  reset();
  window.viewerState = { ready: true, partCount: rows.size, meshCount: meshes.length, holeCount: (routes.holes || []).length };
} catch (error) {
  $('loading').textContent = `三维暂未载入：${error.message}。可先打开图册。`;
  console.error(error);
}
