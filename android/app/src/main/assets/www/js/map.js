/**
 * GeoTrilateración - Map Controller
 * Leaflet map setup, rendering layers, circles, target markers, comparison lines and interactive drawing
 */

class MapController {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = options;
    this.map = null;
    this.tileLayer = null;

    // Layer Groups
    this.originsLayer = L.layerGroup();
    this.circlesLayer = L.layerGroup();
    this.intersectionsLayer = L.layerGroup();
    this.targetLayer = L.layerGroup();
    this.savedTargetsLayer = L.layerGroup();
    this.comparisonLayer = L.layerGroup();
    this.tempLayer = L.layerGroup();
    this.selectionLayer = L.layerGroup();

    this.isAddingOriginMode = false;
    this.isDrawingBoxMode = false;
    this.boxStartPoint = null;
    this.selectionRectangle = null;

    // Callbacks
    this.onOriginPlaced = options.onOriginPlaced || null;
    this.onOriginMoved = options.onOriginMoved || null;
    this.onOriginUpdated = options.onOriginUpdated || null;
    this.onOriginDeleted = options.onOriginDeleted || null;
    this.onOriginToggled = options.onOriginToggled || null;
    this.onBoxSelected = options.onBoxSelected || null;
    this.onCandidateSelected = options.onCandidateSelected || null;
    this.onCandidateAsOrigin = options.onCandidateAsOrigin || null;
    this.onSaveCandidate = options.onSaveCandidate || null;
    this.onSaveEstimatedTarget = options.onSaveEstimatedTarget || null;
    this.onTargetAsOrigin = options.onTargetAsOrigin || null;
    this.onDismissEstimatedTarget = options.onDismissEstimatedTarget || null;
    this.onReviewTarget = options.onReviewTarget || null;
  }

  /**
   * Initialize Leaflet map
   */
  init(offlineManager) {
    const defaultCenter = [12.1364, -86.2514]; // Managua, Nicaragua
    const defaultZoom = 13;

    this.map = L.map(this.containerId, {
      center: defaultCenter,
      zoom: defaultZoom,
      zoomControl: false,
      preferCanvas: true
    });

    // Add minimal zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(this.map);

    // Base Tile Layers
    this.baseLayers = {
      osm: {
        name: '🗺️ Calles (OpenStreetMap)',
        layer: offlineManager
          ? offlineManager.createOfflineTileLayer()
          : L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
              maxZoom: 19,
              attribution: '&copy; OpenStreetMap'
            })
      },
      satellite: {
        name: '🛰️ Satélite (ESRI World Imagery)',
        layer: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18,
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
        })
      },
      topo: {
        name: '🏔️ Topográfico (OpenTopoMap)',
        layer: L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
          maxZoom: 17,
          attribution: '&copy; OpenTopoMap (CC-BY-SA)'
        })
      },
      carto: {
        name: '🏙️ CartoDB Claro',
        layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; CARTO'
        })
      }
    };

    this.currentBaseLayerKey = 'osm';
    this.baseLayers.osm.layer.addTo(this.map);

    // Add Layer Groups to Map in strict Z-order
    this.circlesLayer.addTo(this.map);
    this.comparisonLayer.addTo(this.map);
    this.originsLayer.addTo(this.map);
    this.intersectionsLayer.addTo(this.map);
    this.savedTargetsLayer.addTo(this.map);
    this.targetLayer.addTo(this.map);
    this.tempLayer.addTo(this.map);
    this.selectionLayer.addTo(this.map);

    // Setup map events
    this.setupEvents();
  }

  setBaseLayer(layerKey) {
    if (!this.baseLayers[layerKey]) return;
    if (this.currentBaseLayerKey === layerKey) return;

    this.map.removeLayer(this.baseLayers[this.currentBaseLayerKey].layer);
    this.baseLayers[layerKey].layer.addTo(this.map);
    this.currentBaseLayerKey = layerKey;
    return this.baseLayers[layerKey].name;
  }

  cycleBaseLayer() {
    const keys = Object.keys(this.baseLayers);
    const currentIndex = keys.indexOf(this.currentBaseLayerKey);
    const nextIndex = (currentIndex + 1) % keys.length;
    const nextKey = keys[nextIndex];
    return this.setBaseLayer(nextKey);
  }

  setupEvents() {
    this.map.on('click', (e) => {
      if (this.onOriginPlaced) {
        this.onOriginPlaced(e.latlng);
      }
    });

    this.map.on('mousedown', (e) => {
      if (this.isDrawingBoxMode) {
        this.boxStartPoint = e.latlng;
        this.map.dragging.disable();
      }
    });

    this.map.on('mousemove', (e) => {
      if (this.isDrawingBoxMode && this.boxStartPoint) {
        const bounds = L.latLngBounds(this.boxStartPoint, e.latlng);
        if (!this.selectionRectangle) {
          this.selectionRectangle = L.rectangle(bounds, {
            color: '#38bdf8',
            weight: 2,
            dashArray: '4, 4',
            fillColor: '#38bdf8',
            fillOpacity: 0.15
          }).addTo(this.selectionLayer);
        } else {
          this.selectionRectangle.setBounds(bounds);
        }
      }
    });

    this.map.on('mouseup', (e) => {
      if (this.isDrawingBoxMode && this.boxStartPoint) {
        const bounds = L.latLngBounds(this.boxStartPoint, e.latlng);
        this.boxStartPoint = null;
        this.map.dragging.enable();
        this.isDrawingBoxMode = false;
        if (this.onBoxSelected) {
          this.onBoxSelected(bounds);
        }
      }
    });
  }

  setAddOriginMode(enabled) {
    this.isAddingOriginMode = enabled;
    const mapEl = document.getElementById(this.containerId);
    if (enabled) {
      mapEl.style.cursor = 'crosshair';
    } else {
      mapEl.style.cursor = '';
    }
  }

  startBoxSelection() {
    this.isDrawingBoxMode = true;
    this.selectionLayer.clearLayers();
    this.selectionRectangle = null;
    const mapEl = document.getElementById(this.containerId);
    mapEl.style.cursor = 'crosshair';
  }

  clearSelectionBox() {
    this.selectionLayer.clearLayers();
    this.selectionRectangle = null;
  }

  setView(lat, lng, zoom = 14) {
    this.map.flyTo([lat, lng], zoom, { duration: 1.0 });
  }

  fitBounds(bounds) {
    if (!bounds || !bounds.isValid || !bounds.isValid()) return;
    this.map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });
  }

  getBounds() {
    return this.map.getBounds();
  }

  getCenter() {
    return this.map.getCenter();
  }

  setLayerVisibility(layerKey, visible) {
    const layerMap = {
      circles: this.circlesLayer,
      origins: this.originsLayer,
      savedTargets: this.savedTargetsLayer,
      intersections: this.intersectionsLayer,
      target: this.targetLayer
    };

    const targetLayer = layerMap[layerKey];
    if (!targetLayer) return;

    if (visible) {
      if (!this.map.hasLayer(targetLayer)) {
        this.map.addLayer(targetLayer);
      }
    } else {
      if (this.map.hasLayer(targetLayer)) {
        this.map.removeLayer(targetLayer);
      }
    }
  }

  /**
   * Open Quick Interactive Placement Popup directly on Map
   */
  showQuickOriginPopup(latlng, suggestedLabel, onConfirm, defaultDist = 1.5, defaultUnit = 'km') {
    const popupContent = document.createElement('div');
    popupContent.className = 'map-quick-origin-popup';
    popupContent.innerHTML = `
      <div class="popup-title">📍 ${suggestedLabel || 'Nuevo Origen'}</div>
      <div class="popup-coords">${latlng.lat.toFixed(5)}, ${latlng.lng.toFixed(5)}</div>
      <div class="popup-input-row">
        <label>Distancia al objetivo:</label>
        <div class="popup-dist-group">
          <input type="number" id="quick-dist-input" class="popup-input-dist" value="${defaultDist}" step="any" min="0.01" autofocus>
          <select id="quick-unit-select" class="popup-select-unit">
            <option value="km" ${defaultUnit === 'km' ? 'selected' : ''}>km</option>
            <option value="m" ${defaultUnit === 'm' ? 'selected' : ''}>m</option>
            <option value="mi" ${defaultUnit === 'mi' ? 'selected' : ''}>mi</option>
            <option value="ft" ${defaultUnit === 'ft' ? 'selected' : ''}>ft</option>
          </select>
        </div>
      </div>
      <div class="popup-btn-row">
        <button id="btn-quick-confirm" class="btn btn-sm btn-primary" style="flex: 1;">
          ✓ Agregar
        </button>
        <button id="btn-quick-cancel" class="btn btn-sm btn-secondary">
          ✕
        </button>
      </div>
    `;

    const popup = L.popup({
      closeButton: false,
      autoClose: true,
      closeOnClick: true,
      className: 'custom-leaflet-popup'
    })
      .setLatLng(latlng)
      .setContent(popupContent)
      .openOn(this.map);

    setTimeout(() => {
      const distInput = popupContent.querySelector('#quick-dist-input');
      const unitSelect = popupContent.querySelector('#quick-unit-select');
      const btnConfirm = popupContent.querySelector('#btn-quick-confirm');
      const btnCancel = popupContent.querySelector('#btn-quick-cancel');

      if (distInput) {
        distInput.focus();
        distInput.select();
        distInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            btnConfirm.click();
          }
        });
      }

      btnConfirm.onclick = () => {
        const dist = parseFloat(distInput.value);
        if (isNaN(dist) || dist <= 0) {
          distInput.style.borderColor = '#ef4444';
          return;
        }
        this.map.closePopup(popup);
        onConfirm({
          lat: latlng.lat,
          lng: latlng.lng,
          distance: dist,
          unit: unitSelect ? unitSelect.value : 'km',
          label: suggestedLabel
        });
      };

      btnCancel.onclick = () => {
        this.map.closePopup(popup);
      };
    }, 50);
  }

  /**
   * Render Origin Markers & Circles
   */
  renderOrigins(origins, showCircleFill = true) {
    this.originsLayer.clearLayers();
    this.circlesLayer.clearLayers();

    origins.forEach((origin, index) => {
      const pos = [origin.lat, origin.lng];
      const color = origin.color || '#38bdf8';
      const isEnabled = origin.enabled !== false;
      const currentUnit = origin.unit || 'km';

      // Origin Marker Pin (Draggable)
      const icon = L.divIcon({
        className: 'custom-origin-marker',
        html: `
          <div class="origin-marker-pin ${isEnabled ? '' : 'disabled-origin-pin'}" style="background: ${color};" title="${origin.label}">
            ${index + 1}
          </div>
        `,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const marker = L.marker(pos, {
        icon,
        draggable: true
      });

      marker.on('dragend', (e) => {
        const newPos = e.target.getLatLng();
        if (this.onOriginMoved) {
          this.onOriginMoved(origin.id, newPos.lat, newPos.lng);
        }
      });

      const displayDist = origin.rawDistance !== undefined
        ? origin.rawDistance
        : (origin.unit === 'km' ? (origin.distance / 1000).toFixed(2) : origin.distance.toFixed(1));

      marker.bindPopup(`
        <div class="origin-marker-popup">
          <div class="popup-header-row">
            <span class="dot-color-badge" style="background: ${color};"></span>
            <strong>${origin.label}</strong>
          </div>
          <div class="popup-subtext font-mono">${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}</div>
          
          <div class="popup-dist-edit-box">
            <label>Distancia:</label>
            <div class="dist-edit-inline">
              <input type="number" id="popup-origin-dist-${origin.id}" value="${displayDist}" step="any" min="0.01" style="width: 75px;">
              <select id="popup-origin-unit-${origin.id}" class="popup-select-unit-inline">
                <option value="km" ${currentUnit === 'km' ? 'selected' : ''}>km</option>
                <option value="m" ${currentUnit === 'm' ? 'selected' : ''}>m</option>
                <option value="mi" ${currentUnit === 'mi' ? 'selected' : ''}>mi</option>
                <option value="ft" ${currentUnit === 'ft' ? 'selected' : ''}>ft</option>
              </select>
              <button id="btn-popup-update-${origin.id}" class="btn btn-xs btn-primary" title="Guardar distancia y unidad">✓</button>
            </div>
          </div>

          <div class="popup-action-row">
            <button id="btn-popup-toggle-${origin.id}" class="btn btn-xs btn-secondary" style="flex: 1;">
              ${isEnabled ? '👁️ Desactivar' : '👁️ Activar'}
            </button>
            <button id="btn-popup-del-${origin.id}" class="btn btn-xs btn-danger" title="Eliminar origen">
              🗑️
            </button>
          </div>
        </div>
      `, { className: 'custom-leaflet-popup' });

      marker.on('popupopen', () => {
        const distInput = document.getElementById(`popup-origin-dist-${origin.id}`);
        const unitSelect = document.getElementById(`popup-origin-unit-${origin.id}`);
        const btnUpdate = document.getElementById(`btn-popup-update-${origin.id}`);
        const btnToggle = document.getElementById(`btn-popup-toggle-${origin.id}`);
        const btnDel = document.getElementById(`btn-popup-del-${origin.id}`);

        if (btnUpdate && distInput && this.onOriginUpdated) {
          btnUpdate.onclick = () => {
            const val = parseFloat(distInput.value);
            const chosenUnit = unitSelect ? unitSelect.value : currentUnit;
            if (!isNaN(val) && val > 0) {
              this.onOriginUpdated(origin.id, { distance: val, unit: chosenUnit });
              marker.closePopup();
            }
          };
          distInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              btnUpdate.click();
            }
          });
        }

        if (btnToggle && this.onOriginToggled) {
          btnToggle.onclick = () => {
            this.onOriginToggled(origin.id);
            marker.closePopup();
          };
        }

        if (btnDel && this.onOriginDeleted) {
          btnDel.onclick = () => {
            this.onOriginDeleted(origin.id);
            marker.closePopup();
          };
        }
      });

      this.originsLayer.addLayer(marker);

      // Geodesic Distance Circle
      if (isEnabled) {
        const circle = L.circle(pos, {
          radius: origin.distance,
          color: color,
          weight: 2.5,
          opacity: 0.85,
          fillColor: color,
          fillOpacity: showCircleFill ? 0.08 : 0,
          dashArray: '3, 3'
        });

        this.circlesLayer.addLayer(circle);
      }
    });
  }

  /**
   * Render Pairwise Circle Intersections
   */
  renderIntersections(intersections) {
    this.intersectionsLayer.clearLayers();
    if (!intersections || intersections.length === 0) return;

    intersections.forEach((pt, idx) => {
      const isApprox = pt.isApproximate;
      const isTang = pt.isTangent;
      const label = isTang ? 'Punto Tangente' : (isApprox ? 'Punto Aproximado' : `Candidato ${idx + 1}`);

      const icon = L.divIcon({
        className: 'custom-intersection-marker',
        html: `<div class="intersection-candidate-marker" title="${label}">${idx + 1}</div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const marker = L.marker([pt.lat, pt.lng], { icon });

      marker.bindPopup(`
        <div class="candidate-popup-card">
          <strong class="candidate-popup-title">🎯 ${label}</strong>
          <div class="popup-subtext font-mono">${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}</div>
          ${pt.gap !== undefined ? `<small class="candidate-gap">Brecha: ${pt.gap.toFixed(1)}m</small>` : ''}
          <div class="candidate-popup-actions" style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px;">
            <button id="btn-orig-cand-${idx}" class="btn btn-xs btn-outline" style="flex: 1;" title="Crear un nuevo origen desde esta intersección">
              ➕ Como Origen
            </button>
            <button id="btn-save-cand-${idx}" class="btn btn-xs btn-primary" style="flex: 1;" title="Guardar en Base de Datos">
              💾 Guardar
            </button>
            <button id="btn-select-cand-${idx}" class="btn btn-xs btn-secondary" title="Fijar como objetivo actual">
              🎯 Fijar
            </button>
          </div>
        </div>
      `, { className: 'custom-leaflet-popup' });

      marker.on('popupopen', () => {
        const btnAsOrigin = document.getElementById(`btn-orig-cand-${idx}`);
        if (btnAsOrigin && this.onCandidateAsOrigin) {
          btnAsOrigin.onclick = () => {
            marker.closePopup();
            this.onCandidateAsOrigin(pt, idx);
          };
        }
        const btnSave = document.getElementById(`btn-save-cand-${idx}`);
        if (btnSave && this.onSaveCandidate) {
          btnSave.onclick = () => {
            marker.closePopup();
            this.onSaveCandidate(pt, idx);
          };
        }
        const btnSelect = document.getElementById(`btn-select-cand-${idx}`);
        if (btnSelect && this.onCandidateSelected) {
          btnSelect.onclick = () => {
            marker.closePopup();
            this.onCandidateSelected(pt, idx);
          };
        }
      });

      this.intersectionsLayer.addLayer(marker);
    });
  }

  /**
   * Render Calculated Estimated Target (Exact Solved Point)
   */
  renderTarget(target) {
    this.targetLayer.clearLayers();
    if (!target || !target.lat || !target.lng) return;

    const pos = [target.lat, target.lng];

    // Prominent High-Visibility Target Pin (Bullseye / Radar pulse)
    const icon = L.divIcon({
      className: 'custom-target-marker',
      html: `
        <div class="target-marker-wrapper">
          <div class="target-radar-ring"></div>
          <div class="target-marker-pin" title="🎯 Punto Final Localizado">
            🎯
          </div>
          <div class="target-label-badge">OBJETIVO</div>
        </div>
      `,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });

    const marker = L.marker(pos, { icon, zIndexOffset: 1000 });
    marker.bindPopup(`
      <div class="target-popup-card">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 18px;">🎯</span>
          <strong class="target-popup-title">Punto Final Localizado</strong>
        </div>
        <div class="popup-subtext font-mono" style="font-size: 13px; font-weight: 600;">
          ${target.lat.toFixed(6)}, ${target.lng.toFixed(6)}
        </div>
        <div class="target-accuracy-pill">
          Precisión: ±${target.accuracyMeters ? target.accuracyMeters.toFixed(1) : (target.accuracy ? target.accuracy.toFixed(1) : 0.0)} m
        </div>
        
        <div class="target-popup-actions" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 10px;">
          <button id="btn-popup-target-as-origin" class="btn btn-sm btn-outline" style="flex: 1;" title="Crear un nuevo origen en este punto">
            ➕ Como Origen
          </button>
          <button id="btn-popup-save-estimated" class="btn btn-sm btn-primary" style="flex: 1;">
            💾 Guardar en DB
          </button>
          <button id="btn-popup-dismiss-estimated" class="btn btn-sm btn-ghost" title="Descartar">
            ✕
          </button>
        </div>
      </div>
    `, { className: 'custom-leaflet-popup' });

    marker.on('popupopen', () => {
      const btnAsOrigin = document.getElementById('btn-popup-target-as-origin');
      if (btnAsOrigin && this.onTargetAsOrigin) {
        btnAsOrigin.onclick = () => {
          marker.closePopup();
          this.onTargetAsOrigin(target);
        };
      }
      const btnSave = document.getElementById('btn-popup-save-estimated');
      if (btnSave && this.onSaveEstimatedTarget) {
        btnSave.onclick = () => {
          marker.closePopup();
          this.onSaveEstimatedTarget(target);
        };
      }
      const btnDismiss = document.getElementById('btn-popup-dismiss-estimated');
      if (btnDismiss && this.onDismissEstimatedTarget) {
        btnDismiss.onclick = () => {
          marker.closePopup();
          this.onDismissEstimatedTarget();
        };
      }
    });

    this.targetLayer.addLayer(marker);

    // Confidence / Uncertainty circle
    const radius = target.confidenceRadius || (target.accuracyMeters ? Math.max(target.accuracyMeters * 1.96, 5) : 5);
    if (radius > 1) {
      const confidenceCircle = L.circle(pos, {
        radius: radius,
        color: '#10b981',
        weight: 2,
        fillColor: '#10b981',
        fillOpacity: 0.15,
        dashArray: '4, 4'
      });
      this.targetLayer.addLayer(confidenceCircle);
    }
  }

  /**
   * Render Saved Target Markers from Local Database
   */
  renderSavedTargets(savedTargets, onEditTarget, onDeleteTarget, onReviewTarget) {
    this.savedTargetsLayer.clearLayers();

    savedTargets.forEach(t => {
      if (t.visible === false) return;

      const color = t.color || '#0284c7';
      const icon = L.divIcon({
        className: 'custom-saved-marker',
        html: `
          <div class="saved-marker-wrapper">
            <div style="
              width: 32px;
              height: 32px;
              border-radius: 50%;
              background: ${color};
              border: 2px solid #ffffff;
              box-shadow: 0 0 14px ${color}aa, 0 2px 8px rgba(0,0,0,0.5);
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 15px;
              cursor: pointer;
            " title="${t.name}">
              📌
            </div>
            <span class="saved-marker-name-tag" style="background: ${color};">${t.name}</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([t.lat, t.lng], { icon, zIndexOffset: 500 });

      let mediaPreviewHtml = '';
      if (t.mediaList && t.mediaList.length > 0) {
        mediaPreviewHtml = `
          <div style="margin-top: 8px; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 6px;">
            <div style="font-size: 11px; font-weight: 600; color: var(--text-secondary); margin-bottom: 4px;">
              📷 Archivos Adjuntos (${t.mediaList.length}) • <span style="color: var(--accent-primary); font-size: 10px;">Toca para ampliar</span>:
            </div>
            <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
              ${t.mediaList.map((m, mIdx) => `
                <img src="${m.dataUrl || m.thumbnail || ''}"
                     style="width: 52px; height: 52px; object-fit: cover; border-radius: 6px; flex-shrink: 0; border: 1px solid var(--border-color); cursor: pointer; transition: transform 0.15s ease;"
                     title="${m.name || 'Ver imagen ampliada'} (Toca para agrandar)"
                     alt="${m.name || 'Imagen'}"
                     onmouseover="this.style.transform='scale(1.08)'"
                     onmouseout="this.style.transform='scale(1)'"
                     onclick="event.stopPropagation(); window.GeoApp.ui.openSavedTargetMediaViewer('${t.id}', ${mIdx})">
              `).join('')}
            </div>
          </div>
        `;
      }

      marker.bindPopup(`
        <div class="saved-marker-popup">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 6px ${color}; flex-shrink: 0;"></span>
            <strong style="color: ${color}; font-size: 14px;">${t.name}</strong>
          </div>
          <p style="margin: 4px 0 6px 0; color: var(--text-secondary); font-size: 12px;">${t.description || 'Sin notas de campo.'}</p>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: var(--text-muted);">
            <span class="font-mono">${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</span>
            <span class="badge badge-success">±${t.accuracy ? t.accuracy.toFixed(1) : 0}m</span>
          </div>
          ${mediaPreviewHtml}
          <div style="margin-top: 10px; display: flex; gap: 6px; flex-wrap: wrap;">
            <button id="btn-popup-review-${t.id}" class="btn btn-xs btn-outline" style="flex: 1;" title="Cargar medición para revisión">
              🔄 Revisar
            </button>
            <button id="btn-popup-edit-${t.id}" class="btn btn-xs btn-primary" style="flex: 1;">
              ✏️ Editar
            </button>
            <button id="btn-popup-delete-${t.id}" class="btn btn-xs btn-outline-danger" title="Eliminar este marcador">
              🗑️
            </button>
          </div>
        </div>
      `, { className: 'custom-leaflet-popup' });

      marker.on('popupopen', () => {
        const btnReview = document.getElementById(`btn-popup-review-${t.id}`);
        if (btnReview && onReviewTarget) {
          btnReview.onclick = () => {
            marker.closePopup();
            onReviewTarget(t.id);
          };
        }
        const btnEdit = document.getElementById(`btn-popup-edit-${t.id}`);
        if (btnEdit && onEditTarget) {
          btnEdit.onclick = () => {
            marker.closePopup();
            onEditTarget(t.id);
          };
        }
        const btnDelete = document.getElementById(`btn-popup-delete-${t.id}`);
        if (btnDelete && onDeleteTarget) {
          btnDelete.onclick = () => {
            marker.closePopup();
            onDeleteTarget(t.id, t.name);
          };
        }
      });

      this.savedTargetsLayer.addLayer(marker);
    });
  }

  /**
   * Render Comparison Line & Measurements between 2 Targets
   */
  renderComparison(targetA, targetB, comparisonData) {
    this.comparisonLayer.clearLayers();
    if (!targetA || !targetB) return;

    const latlngs = [
      [targetA.lat, targetA.lng],
      [targetB.lat, targetB.lng]
    ];

    // Glowing Geodesic Line
    const polyline = L.polyline(latlngs, {
      color: '#38bdf8',
      weight: 3.5,
      opacity: 0.9,
      dashArray: '6, 6'
    });
    this.comparisonLayer.addLayer(polyline);

    // Midpoint measurement badge
    const midLat = (targetA.lat + targetB.lat) / 2;
    const midLng = (targetA.lng + targetB.lng) / 2;

    const distText = comparisonData.distanceMeters >= 1000
      ? `${comparisonData.distanceKm.toFixed(2)} km`
      : `${comparisonData.distanceMeters.toFixed(1)} m`;

    const badgeIcon = L.divIcon({
      className: 'comparison-line-badge',
      html: `
        <div class="comparison-pill">
          📏 ${distText} • ${comparisonData.bearingDeg.toFixed(0)}° (${comparisonData.bearingText})
        </div>
      `,
      iconSize: [160, 24],
      iconAnchor: [80, 12]
    });

    const badgeMarker = L.marker([midLat, midLng], { icon: badgeIcon });
    this.comparisonLayer.addLayer(badgeMarker);

    // Fit view to encompass both targets
    const bounds = L.latLngBounds(latlngs);
    this.fitBounds(bounds);
  }

  clearComparison() {
    this.comparisonLayer.clearLayers();
  }

  /**
   * Calculate all-encompassing bounds for active elements
   */
  getAllBounds(origins, target) {
    const latLngs = [];
    origins.forEach(o => {
      if (o.enabled !== false) {
        latLngs.push([o.lat, o.lng]);
        const latDelta = (o.distance / 111320);
        const lngDelta = (o.distance / (111320 * Math.cos((o.lat * Math.PI) / 180)));
        latLngs.push([o.lat + latDelta, o.lng]);
        latLngs.push([o.lat - latDelta, o.lng]);
        latLngs.push([o.lat, o.lng + lngDelta]);
        latLngs.push([o.lat, o.lng - lngDelta]);
      }
    });

    if (target && target.lat && target.lng) {
      latLngs.push([target.lat, target.lng]);
    }

    if (latLngs.length === 0) return null;
    return L.latLngBounds(latLngs);
  }
}

// Attach to window
window.MapController = MapController;
