/* ABHED Control Suite — dashboard client. No front-end build step is required. */
(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const state = { snapshot: null, view: 'overview', incidentFilter: 'all', selectedNode: 'ABH-N03', search: '', poller: null, loading: false };

  const iconPaths = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
    activity: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
    alert: '<path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20h15.6a2 2 0 0 0 1.7-2.6L13.7 3.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2.9-1.2 2.1-1.5-.5a8 8 0 0 1-1.5.9l-.3 1.6h-2.4l-.3-1.6a8 8 0 0 1-1.5-.9l-1.5.5-1.2-2.1 1.2-.9a7 7 0 0 1 0-1.8l-1.2-.9 1.2-2.1 1.5.5a8 8 0 0 1 1.5-.9l.3-1.6h2.4l.3 1.6a8 8 0 0 1 1.5.9l1.5-.5 1.2 2.1-1.2.9a7 7 0 0 1 0 1.7Z" transform="translate(-1 -1) scale(1.08)"/>',
    search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
    shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/>',
    camera: '<path d="M14 5h-4l-2 3H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-4z"/><circle cx="12" cy="13" r="3.3"/>',
    thermal: '<path d="M14 14.8V5a3 3 0 0 0-6 0v9.8a5 5 0 1 0 6 0Z"/><path d="M11 11v6"/>',
    radar: '<circle cx="12" cy="12" r="9"/><path d="M12 12 18.5 5.5M12 3v2M21 12h-2M12 21v-2M3 12h2"/><circle cx="12" cy="12" r="2"/>',
    mic: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8"/>',
    activity2: '<path d="M2 12h4l3-8 4 16 3-8h6"/>',
    cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><path d="M9 9h6v6H9zM9 1v4M15 1v4M9 19v4M15 19v4M1 9h4M1 15h4M19 9h4M19 15h4"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.5-3"/>',
    layers: '<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
    signal: '<path d="M2 8.8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h.01"/>',
    battery: '<rect x="3" y="7" width="16" height="10" rx="2"/><path d="M23 10v4M7 10h7"/>',
    pin: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    clockSmall: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    chevron: '<path d="m7 10 5 5 5-5"/>',
    eye: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    close: '<path d="m18 6-12 12M6 6l12 12"/>',
  };
  function svgIcon(name, cls = '') { return `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${iconPaths[name] || iconPaths.activity}</svg>`; }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function titleCase(s) { return String(s || '').replaceAll('_', ' ').replace(/\b\w/g, c => c.toUpperCase()); }
  function timeSince(iso) {
    if (!iso) return '—';
    const seconds = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
    if (!Number.isFinite(seconds)) return '—';
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  }
  function clockTime(iso) { return iso ? new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '—'; }
  function nodePoint(node) { return { x: 42 + Number(node.position.x) * 7.05, y: 18 + Number(node.position.y) * 2.45 }; }
  function statusLabel(status) { return `<span class="mini-status ${escapeHtml(status)}">${escapeHtml(status)}</span>`; }
  function statusPill(status) { return `<span class="status-pill ${escapeHtml(status)}">${escapeHtml(status)}</span>`; }
  function toast(message, error = false) {
    const el = document.createElement('div'); el.className = `toast${error ? ' error' : ''}`; el.textContent = message;
    $('#toastRegion').appendChild(el); setTimeout(() => el.remove(), 3600);
  }
  async function api(url, options = {}) {
    const opts = { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) } };
    const response = await fetch(url, opts);
    let body; try { body = await response.json(); } catch { body = {}; }
    if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
    return body;
  }

  async function loadSnapshot(silent = false) {
    if (state.loading) return;
    state.loading = true;
    try {
      const snapshot = await api('/api/snapshot');
      state.snapshot = snapshot;
      $('#connectionLabel').textContent = 'LOCAL SERVICE CONNECTED';
      $('#connectionLabel').style.color = '#82d9b4';
      $('#footerServiceStatus').textContent = 'CONNECTED';
      $('#footerServiceStatus').style.color = '#82d9b4';
      $('#lastUpdated').textContent = `Updated ${clockTime(snapshot.meta.timestamp)}`;
      $('#footerUpdated').textContent = clockTime(snapshot.meta.timestamp);
      $('#sideHealthText').textContent = snapshot.overview.system_status === 'nominal' ? 'Nominal operation' : 'Attention required';
      $('#navIncidentCount').textContent = String(snapshot.overview.active_incidents).padStart(2, '0');
      $('#demoNotice').style.display = 'flex';
      const demoHeading = $('#demoNotice strong');
      const demoMessage = $('#demoNotice > div > span');
      if (snapshot.meta.simulation_enabled) {
        demoHeading.textContent = 'DEMO SIMULATION ACTIVE';
        demoMessage.textContent = 'All readings and incidents currently shown are generated sample data, not live field detections.';
      } else {
        demoHeading.textContent = 'SIMULATION PAUSED · SEED DATA RETAINED';
        demoMessage.textContent = 'Disabling simulation does not remove seeded sample nodes or incidents. Validate the node registry and incoming sensor feed before treating any records as live.';
      }
      if (!silent || state.view !== 'settings') renderView();
      schedulePolling();
    } catch (error) {
      $('#connectionLabel').textContent = 'SERVICE UNAVAILABLE';
      $('#connectionLabel').style.color = '#ff7f83';
      $('#footerServiceStatus').textContent = 'OFFLINE'; $('#footerServiceStatus').style.color = '#ff7f83';
      if (!state.snapshot) $('#viewRoot').innerHTML = `<div class="loading-card">${svgIcon('alert')}<span>Could not reach the ABHED service. Start it with <code>python run.py</code>, then refresh.</span></div>`;
      state.poller = setTimeout(() => loadSnapshot(true), 4000);
      if (!silent) toast(error.message, true);
    } finally { state.loading = false; }
  }
  function schedulePolling() {
    clearTimeout(state.poller);
    const seconds = Number(state.snapshot?.config?.refresh_seconds || 3);
    state.poller = setTimeout(() => loadSnapshot(true), Math.max(2, seconds) * 1000);
  }

  const viewDetails = {
    overview: ['Field overview', 'One operational picture across distributed sensing nodes.', 'MISSION CONTROL'],
    map: ['Field map', 'Schematic placement of registered nodes and current incident candidates.', 'DEPLOYMENT VIEW'],
    sensors: ['Sensor network', 'Node health, sensor channels, and latest edge readings.', 'EDGE TELEMETRY'],
    incidents: ['Incident management', 'Review, acknowledge, and close event candidates with an auditable trail.', 'REVIEW QUEUE'],
    events: ['Event timeline', 'A chronological view of sensor ingress and operator actions.', 'SYSTEM ACTIVITY'],
    settings: ['Configuration', 'Configure demo behaviour and the normalised sensor-ingestion interface.', 'SYSTEM SETTINGS'],
  };
  function renderView() {
    if (!state.snapshot) return;
    const [title, subtitle, eyebrow] = viewDetails[state.view] || viewDetails.overview;
    $('#pageTitle').textContent = title; $('#pageSubtitle').textContent = subtitle;
    $('#breadcrumbCurrent').textContent = title; $('#pageEyebrow').innerHTML = `${eyebrow} <span class="eyebrow-line"></span> <span id="liveClock">${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>`;
    $$('.nav-item[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.view));
    const renderers = { overview: renderOverview, map: renderMapView, sensors: renderSensors, incidents: renderIncidents, events: renderEvents, settings: renderSettings };
    $('#viewRoot').innerHTML = (renderers[state.view] || renderOverview)();
    if (state.view === 'overview' || state.view === 'map') attachMapClicks();
  }

  function renderKpi(label, value, unit, foot, icon, extraClass = '') {
    return `<article class="kpi-card ${extraClass}"><div class="kpi-head"><span>${label}</span><span class="kpi-icon">${svgIcon(icon)}</span></div><div class="kpi-main"><span class="kpi-value">${value}</span><span class="kpi-unit">${unit || ''}</span></div><div class="kpi-foot">${foot}</div></article>`;
  }
  function renderMapSvg(compact = false) {
    const snap = state.snapshot, nodes = snap.nodes, incidents = snap.incidents.filter(i => i.status !== 'resolved');
    const width = 800, height = 300;
    const poly = nodes.map(n => { const p = nodePoint(n); return `${p.x},${p.y}`; }).join(' ');
    let svg = `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Schematic field map of registered ABHED nodes">`;
    svg += `<defs><pattern id="terrain" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M0 22 Q11 17 22 22 T44 22 M22 0 Q17 11 22 22 T22 44" fill="none" stroke="#203542" stroke-width=".65" opacity=".55"/></pattern><linearGradient id="mapWash" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14272d" stop-opacity=".48"/><stop offset="1" stop-color="#0d1b25" stop-opacity=".18"/></linearGradient></defs>`;
    svg += `<rect x="0" y="0" width="800" height="300" rx="6" fill="url(#terrain)"/><path d="M15 195 C115 150 135 230 230 164 S360 170 425 116 S574 146 650 92 S735 104 792 35 L800 300H0Z" fill="url(#mapWash)"/><path d="M10 247 C102 201 155 269 255 214 S391 214 469 161 S621 201 790 103" fill="none" stroke="#29424d" stroke-width="1.2" stroke-dasharray="3 8"/>`;
    svg += `<text x="18" y="20" class="map-grid-text">SECTOR 04 / LOCAL SCHEMATIC</text><text x="780" y="20" text-anchor="end" class="map-grid-text">N ↑</text>`;
    const route = nodes.map(n => { const p = nodePoint(n); return `${p.x},${p.y}`; }).join(' ');
    svg += `<polyline points="${route}" fill="none" stroke="#6fc9ad" stroke-width="1.3" stroke-opacity=".68" stroke-dasharray="5 6"/>`;
    // Relay hub line provides visual orientation only; not a surveyed map or geographic route.
    const hub = {x: 410, y: 270};
    nodes.filter(n => n.id === 'ABH-N06').forEach(n => { const p = nodePoint(n); svg += `<path d="M${p.x} ${p.y} L${hub.x} ${hub.y}" stroke="#4f7c7a" stroke-width="1" stroke-dasharray="3 5" opacity=".65"/>`; });
    svg += `<g><circle cx="${hub.x}" cy="${hub.y}" r="15" fill="#18332e" stroke="#4d8977" stroke-width="1"/><circle cx="${hub.x}" cy="${hub.y}" r="7" fill="#70dfbd" fill-opacity=".18" stroke="#70dfbd"/><path d="M${hub.x-4} ${hub.y}h8M${hub.x} ${hub.y-4}v8" stroke="#a7f2d9" stroke-width="1.4"/><text x="${hub.x+21}" y="${hub.y+4}" class="node-id-label">EDGE RELAY</text></g>`;
    incidents.forEach(inc => {
      const n = nodes.find(n => n.id === inc.node_id); if (!n) return;
      const p = nodePoint(n), cx = p.x + 12, cy = p.y - 12;
      const col = inc.severity === 'high' ? '#ff7f83' : '#f0bd70';
      svg += `<g><circle class="map-incident-pulse" cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${col}" stroke-width="1.2"/><circle cx="${cx}" cy="${cy}" r="4.2" fill="${col}" stroke="#0c141b" stroke-width="1.5"/><text x="${cx+8}" y="${cy-8}" font-size="8" font-family="DM Mono,monospace" fill="${col}">${escapeHtml(inc.id)}</text></g>`;
    });
    nodes.forEach(node => {
      const p = nodePoint(node), color = node.status === 'online' ? '#70dfbd' : node.status === 'degraded' ? '#f0bd70' : '#ff7f83';
      const label = node.name.length > 15 ? node.name.slice(0, 14) + '…' : node.name;
      svg += `<g class="map-node" data-node="${escapeHtml(node.id)}" tabindex="0" role="button" aria-label="Select ${escapeHtml(node.id)}">`;
      svg += `<circle class="node-halo" cx="${p.x}" cy="${p.y}" r="12" fill="${color}" fill-opacity=".04" stroke="${color}" stroke-opacity=".25" stroke-width="1"/>`;
      svg += `<circle cx="${p.x}" cy="${p.y}" r="5.2" fill="#101b23" stroke="${color}" stroke-width="1.8"/><circle cx="${p.x}" cy="${p.y}" r="2" fill="${color}"/>`;
      svg += `<text x="${p.x}" y="${p.y+23}" text-anchor="middle" class="node-label">${escapeHtml(label)}</text><text x="${p.x}" y="${p.y+34}" text-anchor="middle" class="node-id-label">${escapeHtml(node.id)}</text></g>`;
    });
    svg += `<text x="18" y="285" class="map-grid-text">SCHEMATIC ONLY · COORDINATES ARE DEMO PLACEMENTS</text></svg>`;
    return svg;
  }
  function renderMapPanel(compact = false) {
    return `<section class="panel ${compact ? '' : 'large-map'}"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">FIELD TOPOLOGY</span><h2>Distributed sensing line</h2><p>Node health, relay links and open incident candidates.</p></div><button class="panel-action" data-action="view-map">Open map <span class="arrow">↗</span></button></div><div class="field-map">${renderMapSvg(compact)}</div><div class="map-footer"><div class="map-legend"><span class="legend-item"><i class="legend-dot"></i>Online node</span><span class="legend-item"><i class="legend-dot warn"></i>Degraded</span><span class="legend-item"><i class="legend-dot danger"></i>Incident candidate</span><span class="legend-item"><i class="legend-line"></i>Logical link</span></div><span class="map-extent">${state.snapshot.nodes.length} REGISTERED NODES</span></div></section>`;
  }
  function renderSignalSummary() {
    const snap = state.snapshot;
    const total = snap.overview.total_nodes || 1;
    return `<section class="panel"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">NETWORK HEALTH</span><h2>Sensor network status</h2><p>Latest heartbeat from each registered edge node.</p></div><button class="text-button" data-action="view-sensors">Details ↗</button></div><div class="signal-summary">${snap.nodes.slice(0, 5).map(node => `<div class="signal-row"><span class="signal-icon">${svgIcon(node.sensors.some(s => /camera/i.test(s)) ? 'camera' : node.sensors.some(s => /mmwave/i.test(s)) ? 'radar' : 'cpu')}</span><div class="signal-copy"><strong>${escapeHtml(node.name)}</strong><small>${escapeHtml(node.id)} · ${node.sensors.length} channels</small><div class="health-bar"><span class="${node.battery_pct < 70 ? 'warning' : ''}" style="width:${node.battery_pct}%"></span></div></div><div class="signal-value">${node.battery_pct}%<small>${statusLabel(node.status)}</small></div></div>`).join('')}</div><div class="panel-foot"><span>${snap.overview.online_nodes} of ${total} nodes online</span><span>${snap.overview.coverage_pct}% availability</span></div></section>`;
  }
  function renderIncidentItem(incident, compact = true) {
    const severity = ['high', 'medium', 'low'].includes(incident.severity) ? incident.severity : 'medium';
    return `<div class="incident-item"><span class="severity-bar ${severity}"></span><div class="incident-copy"><div class="incident-line1"><strong>${escapeHtml(incident.id)}</strong><span class="severity-tag ${severity}">${escapeHtml(severity)} priority</span></div><h3>${escapeHtml(titleCase(incident.classification))}</h3><p>${escapeHtml(incident.location)} · ${escapeHtml(incident.source)}</p><div class="incident-meta"><span>${timeSince(incident.created_at)}</span><span>·</span><span class="confidence">${Math.round(incident.confidence * 100)}% confidence</span><span>·</span>${statusPill(incident.status)}</div></div></div>`;
  }
  function renderTimeline(rows, max = 5) {
    if (!rows.length) return '<div class="empty-state"><strong>No events yet</strong>Sensor readings and operator actions will appear here.</div>';
    return `<div class="timeline">${rows.slice(0,max).map(event => `<div class="timeline-row"><span class="timeline-marker ${event.severity === 'warning' ? 'warning' : event.severity === 'success' ? 'success' : event.severity === 'danger' ? 'danger' : ''}"></span><div class="timeline-content"><strong>${escapeHtml(event.title)}</strong><p>${escapeHtml(event.message)}</p></div><span class="timeline-time">${clockTime(event.timestamp)}</span></div>`).join('')}</div>`;
  }
  function renderOverview() {
    const s = state.snapshot.overview;
    const incidents = state.snapshot.incidents.filter(i => i.status !== 'resolved').slice(0, 3);
    const events = state.snapshot.events.slice(0, 5);
    const kpis = `<div class="kpi-grid">${renderKpi('Registered nodes', s.total_nodes, 'nodes', `<span class="trend-up">${s.online_nodes} online</span> · ${s.degraded_nodes} need attention`, 'layers')}${renderKpi('Open incidents', String(s.active_incidents + s.acknowledged_incidents).padStart(2,'0'), 'cases', `<span class="trend-up">${s.active_incidents} new</span> · ${s.acknowledged_incidents} acknowledged`, 'alert', s.active_incidents ? 'alert-kpi' : '')}${renderKpi('Network availability', `${s.coverage_pct}`, '%', `${s.online_nodes} of ${s.total_nodes} nodes reporting`, 'signal')}${renderKpi('Detection candidates', s.detections_today, 'today', 'Across the registered demo network', 'activity2')}</div>`;
    return `${kpis}<div class="dashboard-grid"><div>${renderMapPanel(true)}<section class="panel" style="margin-top:15px"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">AUDIT TRAIL</span><h2>Latest system activity</h2><p>Sensor heartbeats, incident changes and service events.</p></div><button class="panel-action" data-action="view-events">Full timeline <span class="arrow">↗</span></button></div>${renderTimeline(events, 5)}</section></div><div class="right-stack">${renderSignalSummary()}<section class="panel"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">REQUIRES REVIEW</span><h2>Recent incident candidates</h2><p>Correlated detections awaiting operator review.</p></div><button class="text-button" data-action="view-incidents">All incidents ↗</button></div><div class="incident-list">${incidents.length ? incidents.map(i => renderIncidentItem(i)).join('') : '<div class="empty-state"><strong>Queue clear</strong>No open incident candidates.</div>'}</div><div class="panel-foot"><span>${state.snapshot.incidents.length} total records</span><button class="text-button" data-action="view-incidents">Review queue →</button></div></section></div></div>`;
  }
  function nodeMatchesSearch(node) { return !state.search || JSON.stringify(node).toLowerCase().includes(state.search); }
  function renderNodeTable(nodes, showAction = true) {
    const filtered = nodes.filter(nodeMatchesSearch);
    if (!filtered.length) return '<div class="empty-state"><strong>No nodes found</strong>Try a different search term.</div>';
    return `<div class="node-table-wrap"><table class="data-table"><thead><tr><th>NODE / LOCATION</th><th>STATUS</th><th>SENSORS</th><th>BATTERY</th><th>LAST SEEN</th>${showAction ? '<th>ACTION</th>' : ''}</tr></thead><tbody>${filtered.map(node => `<tr><td><div class="node-cell"><span class="node-mini">${svgIcon(node.sensors.some(s => /camera/i.test(s)) ? 'camera' : 'cpu')}</span><div><strong>${escapeHtml(node.id)}</strong><small>${escapeHtml(node.location)}</small></div></div></td><td>${statusLabel(node.status)}</td><td><div class="sensor-pills">${node.sensors.map(sensor => `<span class="sensor-pill">${escapeHtml(sensor)}</span>`).join('')}</div></td><td><span class="confidence-label" style="color:${node.battery_pct < 70 ? 'var(--amber)' : '#c4d2d9'}">${node.battery_pct}%</span><span class="health-bar" style="display:block;width:58px"><span class="${node.battery_pct < 70 ? 'warning' : ''}" style="width:${node.battery_pct}%"></span></span></td><td>${timeSince(node.last_seen)}</td>${showAction ? `<td><button class="action-button" data-action="self-test" data-id="${escapeHtml(node.id)}">Run self-test</button></td>` : ''}</tr>`).join('')}</tbody></table></div>`;
  }
  function renderMapView() {
    const node = state.snapshot.nodes.find(n => n.id === state.selectedNode) || state.snapshot.nodes[0];
    const incidents = state.snapshot.incidents.filter(i => i.node_id === node.id).slice(0, 3);
    const readings = node.readings || [];
    return `<div class="map-view-layout"><div>${renderMapPanel(false)}<section class="panel" style="margin-top:15px"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">NODE REGISTRY</span><h2>Registered deployment nodes</h2><p>Select a node on the schematic or run a software-level health check.</p></div></div>${renderNodeTable(state.snapshot.nodes, true)}</section></div><aside class="panel"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">NODE INSPECTOR</span><h2>${escapeHtml(node.id)}</h2><p>${escapeHtml(node.location)} · ${statusLabel(node.status)}</p></div><span class="signal-icon">${svgIcon('cpu')}</span></div><div class="map-detail"><h3>Device health</h3><div class="detail-row"><span>Battery level</span><span>${node.battery_pct}%</span></div><div class="detail-row"><span>Device temperature</span><span>${node.temperature_c} °C</span></div><div class="detail-row"><span>Uptime target</span><span>${node.uptime_pct}%</span></div><div class="detail-row"><span>Firmware</span><span>${escapeHtml(node.firmware)}</span></div><div class="detail-row"><span>Last heartbeat</span><span>${timeSince(node.last_seen)}</span></div><div class="detail-row"><span>Last self-test</span><span>${escapeHtml(node.last_self_test)}</span></div><h3 style="margin-top:24px">Latest sensor channels</h3>${readings.map(r => `<div class="detail-row"><span>${escapeHtml(r.sensor)}</span><span>${escapeHtml(r.value)} ${escapeHtml(r.unit)}</span></div>`).join('')}<h3 style="margin-top:24px">Associated incident records</h3>${incidents.length ? incidents.map(i => `<div class="detail-row"><span>${escapeHtml(i.id)} · ${escapeHtml(i.status)}</span><span>${Math.round(i.confidence*100)}%</span></div>`).join('') : '<p style="color:var(--muted);font-size:10px">No incident records linked to this node.</p>'}<button class="action-button primary" style="width:100%;margin-top:18px" data-action="self-test" data-id="${escapeHtml(node.id)}">${svgIcon('check')} Run software self-test</button></div></aside></div>`;
  }
  function renderSensors() {
    const nodes = state.snapshot.nodes.filter(nodeMatchesSearch);
    const cards = nodes.flatMap(node => (node.readings || []).map(r => ({node, reading:r}))).filter(({node,reading}) => !state.search || `${node.id} ${node.location} ${reading.sensor} ${reading.metric}`.toLowerCase().includes(state.search));
    const sensorIcon = sensor => /camera/i.test(sensor) ? 'camera' : /thermal/i.test(sensor) ? 'thermal' : /mmwave|radar/i.test(sensor) ? 'radar' : /acoustic|microphone/i.test(sensor) ? 'mic' : /geophone|vibration/i.test(sensor) ? 'activity2' : 'cpu';
    return `<div class="kpi-grid">${renderKpi('Sensor channels', state.snapshot.nodes.reduce((n,node)=>n+node.sensors.length,0), 'channels', 'Configured across all registered nodes', 'layers')}${renderKpi('Nodes reporting', state.snapshot.overview.online_nodes, 'nodes', 'Current service-level heartbeat status', 'signal')}${renderKpi('Attention required', state.snapshot.overview.degraded_nodes + state.snapshot.overview.offline_nodes, 'nodes', 'Degraded or offline status flags', 'alert', state.snapshot.overview.degraded_nodes + state.snapshot.overview.offline_nodes ? 'alert-kpi' : '')}${renderKpi('Update cadence', state.snapshot.config.refresh_seconds, 'seconds', 'Dashboard refresh interval', 'clock')}</div><div class="sensor-grid">${cards.map(({node,reading}) => `<article class="sensor-card"><div class="sensor-card-head"><span class="signal-icon">${svgIcon(sensorIcon(reading.sensor))}</span><div><strong>${escapeHtml(reading.sensor)}</strong><small>${escapeHtml(node.id)} · ${escapeHtml(node.location)}</small></div></div><div class="sensor-reading"><strong>${escapeHtml(reading.value)}</strong><span>${escapeHtml(reading.unit)}</span></div><p>${escapeHtml(titleCase(reading.metric))} · latest normalised reading from this node. Device-specific calibration and units must be validated before field use.</p><div class="sensor-card-foot"><span>${statusLabel(node.status)}</span><span>Updated ${timeSince(reading.updated_at)}</span></div></article>`).join('')}</div>${cards.length ? `<section class="panel" style="margin-top:16px"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">NODE INVENTORY</span><h2>Hardware channels by node</h2></div></div>${renderNodeTable(state.snapshot.nodes, true)}</section>` : '<div class="panel empty-state"><strong>No sensor channels found</strong>Try a different search term.</div>'}`;
  }
  function renderIncidents() {
    const incidents = state.snapshot.incidents.filter(i => state.incidentFilter === 'all' || i.status === state.incidentFilter).filter(i => !state.search || JSON.stringify(i).toLowerCase().includes(state.search));
    const filters = [['all','All records'],['active','Active'],['acknowledged','Acknowledged'],['resolved','Resolved']];
    return `<section class="panel"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">INCIDENT WORKFLOW</span><h2>Candidate review queue</h2><p>Events are candidates for human review, not autonomous determinations.</p></div><button class="panel-action" id="exportIncidents" data-action="export-events">Export log <span class="arrow">↗</span></button></div><div class="table-toolbar"><div class="filter-bar">${filters.map(([key,label]) => `<button class="filter-button ${state.incidentFilter===key?'active':''}" data-action="filter-incidents" data-filter="${key}">${label}${key==='all'?' ('+state.snapshot.incidents.length+')':` (${state.snapshot.incidents.filter(i=>i.status===key).length})`}</button>`).join('')}</div><span>${incidents.length} records displayed</span></div>${incidents.length ? `<div class="node-table-wrap"><table class="data-table"><thead><tr><th>INCIDENT</th><th>CLASSIFICATION</th><th>SEVERITY</th><th>CONFIDENCE</th><th>NODE / LOCATION</th><th>AGE</th><th>STATUS</th><th>WORKFLOW</th></tr></thead><tbody>${incidents.map(i => `<tr><td><strong style="font:10px var(--mono);color:#d4e0e6">${escapeHtml(i.id)}</strong><div style="color:#6f8492;font-size:8px;margin-top:4px">${escapeHtml(i.source)}</div></td><td>${escapeHtml(titleCase(i.classification))}</td><td><span class="severity-tag ${escapeHtml(i.severity)}">${escapeHtml(i.severity)}</span></td><td><span class="confidence-track"><span style="width:${Math.round(i.confidence*100)}%"></span></span><span class="confidence-label">${Math.round(i.confidence*100)}%</span></td><td><strong style="display:block;font:9px var(--mono)">${escapeHtml(i.node_id)}</strong><span style="font-size:9px;color:#738895">${escapeHtml(i.location)}</span></td><td>${timeSince(i.created_at)}</td><td>${statusPill(i.status)}</td><td>${i.status === 'active' ? `<button class="action-button primary" data-action="acknowledge" data-id="${escapeHtml(i.id)}">Acknowledge</button>` : i.status === 'acknowledged' ? `<button class="action-button" data-action="resolve" data-id="${escapeHtml(i.id)}">Resolve</button>` : '<span style="color:#6d857f;font-size:9px">Closed</span>'}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><strong>No incident records in this view</strong>Try another status filter or change the search query.</div>'}<div class="panel-foot"><span>Every action is recorded in the local event timeline.</span><span>Human review required</span></div></section>`;
  }
  function renderEvents() {
    const events = state.snapshot.events.filter(event => !state.search || JSON.stringify(event).toLowerCase().includes(state.search));
    return `<section class="panel"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">AUDIT TRAIL</span><h2>System event stream</h2><p>Chronological record of node status, telemetry intake, and operator actions.</p></div><button class="panel-action" data-action="export-events">${svgIcon('download')} Download CSV</button></div><div class="table-toolbar"><span>${events.length} most recent events · in-memory retention up to 300 records</span><span>${state.snapshot.meta.simulation_enabled ? 'SIMULATION SOURCE ENABLED' : 'SIMULATION SOURCE DISABLED'}</span></div>${events.length ? `<div class="node-table-wrap"><table class="data-table"><thead><tr><th>TIMESTAMP</th><th>EVENT</th><th>DETAIL</th><th>SEVERITY</th><th>SOURCE</th></tr></thead><tbody>${events.map(event => `<tr><td style="font:9px var(--mono)">${escapeHtml(new Date(event.timestamp).toLocaleString())}</td><td><strong style="color:#d0dce2">${escapeHtml(event.title)}</strong><div style="font:8px var(--mono);color:#6f8492;margin-top:4px">${escapeHtml(event.id)}</div></td><td style="white-space:normal;min-width:200px;max-width:460px;line-height:1.5">${escapeHtml(event.message)}</td><td><span class="severity-tag ${event.severity==='warning'?'medium':event.severity==='danger'?'high':event.severity==='success'?'low':''}">${escapeHtml(event.severity)}</span></td><td style="font:9px var(--mono)">${escapeHtml(event.source)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty-state"><strong>No matching events</strong>Try a different search term.</div>'}<div class="panel-foot"><span>Export preserves timestamps and source IDs.</span><button class="text-button" data-action="export-events">Export current log →</button></div></section>`;
  }
  function renderSettings() {
    const c = state.snapshot.config;
    return `<div class="settings-layout"><section class="panel"><div class="panel-head"><div class="panel-title"><span class="panel-kicker">PREFERENCES</span><h2>Dashboard configuration</h2><p>These settings apply to the current local process and are not persisted across restarts.</p></div></div><form class="settings-form" id="settingsForm"><h3 class="form-section-title">Workspace</h3><p class="form-description">Set the operator-facing site name and basic refresh behaviour.</p><div class="form-field"><label for="siteName">Operations workspace name</label><input id="siteName" name="site_name" maxlength="100" required value="${escapeHtml(c.site_name)}"><span class="help">Shown in the API metadata. Use a non-sensitive site label in demos.</span></div><div class="form-field"><label for="refreshSeconds">Dashboard refresh interval</label><select id="refreshSeconds" name="refresh_seconds"><option value="2" ${c.refresh_seconds===2?'selected':''}>2 seconds · near-live</option><option value="3" ${c.refresh_seconds===3?'selected':''}>3 seconds · recommended</option><option value="5" ${c.refresh_seconds===5?'selected':''}>5 seconds · balanced</option><option value="10" ${c.refresh_seconds===10?'selected':''}>10 seconds · low traffic</option><option value="15" ${c.refresh_seconds===15?'selected':''}>15 seconds · minimal traffic</option></select></div><div class="form-field"><label for="threshold">Detection candidate confidence threshold</label><div class="range-line"><input type="range" id="threshold" name="detection_threshold" min="0.1" max="0.99" step="0.01" value="${c.detection_threshold}"><span class="range-badge" id="thresholdValue">${Math.round(c.detection_threshold*100)}%</span></div><span class="help">Only affects whether ingested detection candidates create a new incident record. It is not a validated model threshold.</span></div><div class="toggle-row"><div><strong>Enable simulated telemetry</strong><small>Generate sample readings and occasional demo incident candidates. Disable this when testing a real sensor bridge.</small></div><label class="switch"><input type="checkbox" id="simulationEnabled" name="simulation_enabled" ${c.simulation_enabled?'checked':''}><span class="switch-track"></span></label></div><div class="form-actions"><button class="action-button primary" type="submit">Save configuration</button><button class="action-button" type="button" data-action="reset-config">Reset form</button><span class="form-status" id="settingsStatus" role="status"></span></div></form></section><div><section class="panel info-card"><span class="panel-kicker">INTEGRATION CONTRACT</span><h3>Normalised sensor ingest API</h3><p>Sensor firmware or an edge gateway can publish a JSON reading to the local API. Use the key from your private <code>.env</code> file.</p><div class="api-example">POST /api/ingest/sensor
Content-Type: application/json
X-API-Key: $ABHED_INGEST_API_KEY

{
  "node_id": "ABH-N01",
  "sensor_type": "mmWave",
  "metric": "range",
  "value": 5.4,
  "unit": "m",
  "event_type": "telemetry",
  "detection": false,
  "confidence": 0.0
}</div><div class="security-note">${svgIcon('shield')}<span>Set a strong <code>ABHED_INGEST_API_KEY</code> before enabling ingestion. The development server and in-memory store are not production hardened.</span></div></section><section class="panel info-card" style="margin-top:15px"><span class="panel-kicker">NODE REGISTRY</span><h3>Register a sensor node</h3><p>Add a node before it sends its first reading. New nodes start offline and switch to online after an authenticated ingest.</p><form id="addNodeForm"><div class="form-field"><label for="newNodeId">Node ID</label><input id="newNodeId" name="id" placeholder="ABH-N07" required minlength="2" maxlength="40" pattern="[A-Za-z0-9][A-Za-z0-9_-]{1,39}"></div><div class="form-field"><label for="newNodeName">Location / label</label><input id="newNodeName" name="name" placeholder="Western Ridge" required maxlength="80"></div><div class="form-field"><label for="newNodeSensors">Sensor channels</label><input id="newNodeSensors" name="sensors" placeholder="mmWave, Thermal" value="mmWave" required><span class="help">Enter comma-separated labels, e.g. RGB camera, Thermal, mmWave.</span></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><div class="form-field"><label for="newNodeX">Map X (0–100)</label><input id="newNodeX" name="x" type="number" min="0" max="100" value="50"></div><div class="form-field"><label for="newNodeY">Map Y (0–100)</label><input id="newNodeY" name="y" type="number" min="0" max="100" value="50"></div></div><div class="form-actions"><button class="action-button primary" type="submit">Register node</button><span class="form-status" id="nodeFormStatus" role="status"></span></div></form></section><section class="panel info-card" style="margin-top:15px"><span class="panel-kicker">CURRENT RUNTIME</span><h3>Service diagnostics</h3><div class="detail-row"><span>Service health</span><span style="color:var(--green)">HTTP service connected</span></div><div class="detail-row"><span>API version</span><span>1.0.0</span></div><div class="detail-row"><span>Storage</span><span>In-memory demo store</span></div><div class="detail-row"><span>Registered nodes</span><span>${c.persistence ? state.snapshot.nodes.length : state.snapshot.nodes.length}</span></div><div class="detail-row"><span>Demo source</span><span>${c.simulation_enabled ? 'Enabled' : 'Disabled'}</span></div><div class="detail-row"><span>Current event records</span><span>${state.snapshot.events.length} shown</span></div><p style="margin-top:14px">Hardware adapter notes, API examples, and deployment limitations are documented in the repository's <code>docs/</code> directory.</p><button class="action-button" style="width:100%" data-action="test-service">Run service health check</button></section></div></div>`;
  }
  function attachMapClicks() {
    $$('.map-node').forEach(el => {
      const choose = () => {
        state.selectedNode = el.dataset.node;
        if (state.view === 'overview') { setView('map'); }
        else renderView();
      };
      el.addEventListener('click', choose);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } });
    });
  }
  function setView(view) {
    state.view = view;
    if (view === 'incidents') state.incidentFilter = 'all';
    renderView();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function performAction(action, id) {
    try {
      if (action === 'acknowledge') {
        await api(`/api/incidents/${encodeURIComponent(id)}/acknowledge`, { method:'POST', body: JSON.stringify({ operator:'Field operator' }) });
        toast(`${id} acknowledged and added to the audit trail.`);
      } else if (action === 'resolve') {
        const note = window.prompt('Resolution note (optional):', 'Reviewed by operator');
        if (note === null) return;
        await api(`/api/incidents/${encodeURIComponent(id)}/resolve`, { method:'POST', body: JSON.stringify({ operator:'Field operator', note }) });
        toast(`${id} marked resolved.`);
      } else if (action === 'self-test') {
        const result = await api(`/api/nodes/${encodeURIComponent(id)}/self-test`, { method:'POST' });
        toast(`${id} software-level self-test passed. This does not validate physical sensor calibration.`);
      } else if (action === 'test-service') {
        const result = await api('/api/health');
        toast(`Service is healthy · ${result.version}`);
      }
      await loadSnapshot(true);
    } catch (error) { toast(error.message, true); }
  }
  async function saveNode(event) {
    event.preventDefault();
    const status = $('#nodeFormStatus');
    const payload = {
      id: $('#newNodeId').value.trim(),
      name: $('#newNodeName').value.trim(),
      sensors: $('#newNodeSensors').value.split(',').map(value => value.trim()).filter(Boolean),
      x: Number($('#newNodeX').value), y: Number($('#newNodeY').value),
    };
    status.textContent = 'Registering…';
    try {
      const result = await api('/api/nodes', { method:'POST', body: JSON.stringify(payload) });
      toast(`${result.node.id} registered. It will show online after the first sensor ingest.`);
      await loadSnapshot(true); renderView();
    } catch (error) { status.textContent = error.message; toast(error.message, true); }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const threshold = Number($('#threshold').value);
    const payload = {
      site_name: $('#siteName').value.trim(),
      refresh_seconds: Number($('#refreshSeconds').value),
      detection_threshold: threshold,
      simulation_enabled: $('#simulationEnabled').checked,
    };
    const status = $('#settingsStatus'); status.textContent = 'Saving…';
    try {
      await api('/api/config', { method:'PUT', body: JSON.stringify(payload) });
      status.textContent = 'Saved successfully'; toast('Configuration updated.');
      await loadSnapshot(true); renderView();
    } catch (error) { status.textContent = error.message; toast(error.message, true); }
  }

  document.addEventListener('click', event => {
    const nav = event.target.closest('[data-view]');
    if (nav) { event.preventDefault(); setView(nav.dataset.view); return; }
    const button = event.target.closest('[data-action]'); if (!button) return;
    const action = button.dataset.action;
    if (action === 'open-settings') setView('settings');
    else if (action === 'view-map') setView('map');
    else if (action === 'view-sensors') setView('sensors');
    else if (action === 'view-incidents') setView('incidents');
    else if (action === 'view-events') setView('events');
    else if (action === 'filter-incidents') { state.incidentFilter = button.dataset.filter; renderView(); }
    else if (action === 'export-events') { window.location.href = '/api/export/events.csv'; toast('Preparing event CSV export.'); }
    else if (action === 'reset-config') { renderView(); }
    else if (['acknowledge','resolve','self-test','test-service'].includes(action)) performAction(action, button.dataset.id);
  });
  document.addEventListener('submit', event => {
    if (event.target.id === 'settingsForm') saveSettings(event);
    else if (event.target.id === 'addNodeForm') saveNode(event);
  });
  document.addEventListener('input', event => {
    if (event.target.id === 'globalSearch') { state.search = event.target.value.trim().toLowerCase(); if (state.view !== 'settings') renderView(); }
    if (event.target.id === 'threshold') $('#thresholdValue').textContent = `${Math.round(Number(event.target.value)*100)}%`;
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); $('#globalSearch').focus(); }
    if (event.key === 'Escape' && document.activeElement === $('#globalSearch')) { $('#globalSearch').value = ''; state.search = ''; renderView(); $('#globalSearch').blur(); }
  });
  $('#exportBtn').addEventListener('click', () => { window.location.href = '/api/export/events.csv'; toast('Preparing event CSV export.'); });
  function updateClock() { const el = $('#liveClock'); if (el) el.textContent = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  setInterval(updateClock, 15000);
  // Decorate all static icon placeholders once, then fetch initial state.
  $$('[data-icon]').forEach(el => { const key = el.dataset.icon; el.innerHTML = svgIcon(key); });
  loadSnapshot(false);
})();
