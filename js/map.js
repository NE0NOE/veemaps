/**
 * GeoTrilateration - Map Controller
 * Leaflet map setup, rendering layers, circles, markers and interactive drawing
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
    this.tempLayer = L.layerGroup();
    this.selectionLayer = L.layerGroup();

    this.isAddingOriginMode = false;
    this.isDrawingBoxMode = false;
    this.boxStartPoint = null;
    this.selectionRectangle = null;

    // Callbacks
    this.onOriginPlaced = options.onOriginPlaced || null;
    this.onOriginMoved = options.onOriginMoved || null;
    this.onBoxSelected = options.onBoxSelected || null;
    this.onCandidateSelected = options.onCandidateSelected || null;
    this.onSaveCandidate = options.onSaveCandidate || null;
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
      zoomControl: true,
      preferCanvas: true
    });

    // Move zoom control to top-right
    this.map.zoomControl.setPosition('topright');

    // Base Tile Layers (Multi-layer support)
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
          attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
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
        name: '🏙️ CartoDB Positron / Claro',
        layer: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
          maxZoom: 19,
          attribution: '&copy; CARTO'
        })
      }
    };

    this.currentBaseLayerKey = 'osm';
    this.baseLayers.osm.layer.addTo(this.map);

    // Layer control
    const baseMapsObj = {};
    for (const [key, val] of Object.entries(this.baseLayers)) {
      baseMapsObj[val.name] = val.layer;
    }

    const overlaysObj = {
      '📍 Orígenes de Medición': this.originsLayer,
      '⭕ Círculos de Distancia': this.circlesLayer,
      '🔍 Puntos de Intersección': this.intersectionsLayer,
      '🎯 Objetivo Estimado': this.targetLayer,
      '📌 Marcadores Guardados': this.savedTargetsLayer
    };

    this.layerControl = L.control.layers(baseMapsObj, overlaysObj, { position: 'topright' }).addTo(this.map);

    // Add Layer Groups to Map
    this.circlesLayer.addTo(this.map);
    this.originsLayer.addTo(this.map);
    this.intersectionsLayer.addTo(this.map);
    this.targetLayer.addTo(this.map);
    this.savedTargetsLayer.addTo(this.map);
    this.tempLayer.addTo(this.map);
    this.selectionLayer.addTo(this.map);

    // Setup map events
    this.setupEvents();
  }

  cycleBaseLayer() {
    const keys = Object.keys(this.baseLayers);
    const currentIndex = keys.indexOf(this.currentBaseLayerKey);
    const nextIndex = (currentIndex + 1) % keys.length;
    const nextKey = keys[nextIndex];

    this.map.removeLayer(this.baseLayers[this.currentBaseLayerKey].layer);
    this.baseLayers[nextKey].layer.addTo(this.map);
    this.currentBaseLayerKey = nextKey;
    return this.baseLayers[nextKey].name;
  }

  /**
   * Event Listeners
   */
  setupEvents() {
    this.map.on('click', (e) => {
      if (this.isAddingOriginMode) {
        if (this.onOriginPlaced) {
          this.onOriginPlaced(e.latlng);
        }
        this.setAddOriginMode(false);
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

  /**
   * Fly to coordinates
   */
  setView(lat, lng, zoom = 14) {
    this.map.flyTo([lat, lng], zoom, { duration: 1.2 });
  }

  /**
   * Fit map bounds to encompass all active origins and target
   */
  fitBounds(bounds) {
    if (!bounds || !bounds.isValid || !bounds.isValid()) return;
    this.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }

  /**
   * Get Current Map Bounding Box
   */
  getBounds() {
    return this.map.getBounds();
  }

  getCenter() {
    return this.map.getCenter();
  }

  /**
   * Toggle visibility of specific layer group
   */
  setLayerVisibility(layerKey, visible) {
    const layerMap = {
      circles: this.circlesLayer,
      origins: this.originsLayer,
      savedTargets: this.savedTargetsLayer,
      intersections: this.intersectionsLayer
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
   * Render Origin Markers & Circles
   */
  renderOrigins(origins, showCircleFill = true) {
    this.originsLayer.clearLayers();
    this.circlesLayer.clearLayers();

    origins.forEach((origin, index) => {
      if (!origin.enabled) return;

      const pos = [origin.lat, origin.lng];
      const color = origin.color || '#38bdf8';

      // 1. Origin Marker Pin (Draggable)
      const icon = L.divIcon({
        className: 'custom-origin-marker',
        html: `
          <div class="origin-marker-pin" style="background: ${color};" title="${origin.label}">
            ${index + 1}
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
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

      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; font-size: 13px; color: #0f172a;">
          <strong>📍 ${origin.label}</strong><br>
          Distancia: <b>${(origin.distance / 1000).toFixed(2)} km</b> (${origin.distance.toFixed(0)} m)<br>
          <small style="color: #64748b;">${origin.lat.toFixed(5)}, ${origin.lng.toFixed(5)}</small>
        </div>
      `);

      this.originsLayer.addLayer(marker);

      // 2. Geodesic Distance Circle
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
      const label = isTang ? 'Punto Tangente' : (isApprox ? 'Punto Aproximado' : `Punto Candidato ${idx + 1}`);

      const icon = L.divIcon({
        className: 'custom-intersection-marker',
        html: `<div class="intersection-candidate-marker" title="${label}"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      });

      const marker = L.marker([pt.lat, pt.lng], { icon });

      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; font-size: 13px; color: #0f172a; min-width: 220px; padding: 2px;">
          <strong style="color: #0284c7; font-size: 14px; display: block; margin-bottom: 4px;">🎯 ${label}</strong>
          <b>Lat:</b> ${pt.lat.toFixed(6)}<br>
          <b>Lng:</b> ${pt.lng.toFixed(6)}<br>
          ${pt.gap !== undefined ? `<small style="color: #f59e0b; display: block; margin-top: 2px;">Aproximación (brecha: ${pt.gap.toFixed(1)}m)</small>` : ''}
          <div style="margin-top: 10px; display: flex; gap: 6px;">
            <button id="btn-save-cand-${idx}" style="flex: 1; padding: 6px 8px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
              💾 Guardar
            </button>
            <button id="btn-select-cand-${idx}" style="flex: 1; padding: 6px 8px; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
              🎯 Fijar
            </button>
          </div>
        </div>
      `);

      marker.on('popupopen', () => {
        const btnSave = document.getElementById(`btn-save-cand-${idx}`);
        if (btnSave && this.onSaveCandidate) {
          btnSave.onclick = () => {
            this.onSaveCandidate(pt, idx);
          };
        }
        const btnSelect = document.getElementById(`btn-select-cand-${idx}`);
        if (btnSelect && this.onCandidateSelected) {
          btnSelect.onclick = () => {
            this.onCandidateSelected(pt, idx);
          };
        }
      });

      this.intersectionsLayer.addLayer(marker);
    });
  }

  /**
   * Render Calculated Estimated Target
   */
  renderTarget(target) {
    this.targetLayer.clearLayers();
    if (!target) return;

    const pos = [target.lat, target.lng];

    // Pulsing Target Marker
    const icon = L.divIcon({
      className: 'custom-target-marker',
      html: `
        <div class="target-marker-pin" title="Punto Final Estimado">
          🎯
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17]
    });

    const marker = L.marker(pos, { icon });
    marker.bindPopup(`
      <div style="font-family: 'Inter', sans-serif; font-size: 13px; color: #0f172a; min-width: 210px;">
        <strong style="color: #10b981; font-size: 14px;">🎯 Punto Final Estimado</strong><br>
        <b>Lat:</b> ${target.lat.toFixed(6)}<br>
        <b>Lng:</b> ${target.lng.toFixed(6)}<br>
        <b>Precisión:</b> ±${target.accuracyMeters.toFixed(1)} m
        <div style="margin-top: 10px; display: flex; gap: 6px;">
          <button id="btn-popup-save-estimated" style="flex: 1; padding: 5px 8px; background: #10b981; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">
            💾 Guardar
          </button>
          <button id="btn-popup-dismiss-estimated" style="padding: 5px 8px; background: #ef444422; color: #ef4444; border: 1px solid #ef444466; border-radius: 6px; cursor: pointer; font-size: 12px;">
            ❌ Descartar
          </button>
        </div>
      </div>
    `);

    marker.on('popupopen', () => {
      const btnSave = document.getElementById('btn-popup-save-estimated');
      if (btnSave && this.options.onSaveEstimatedTarget) {
        btnSave.onclick = () => this.options.onSaveEstimatedTarget(target);
      }
      const btnDismiss = document.getElementById('btn-popup-dismiss-estimated');
      if (btnDismiss && this.options.onDismissEstimatedTarget) {
        btnDismiss.onclick = () => this.options.onDismissEstimatedTarget();
      }
    });

    this.targetLayer.addLayer(marker);

    // Confidence / Uncertainty circle
    if (target.confidenceRadius && target.confidenceRadius > 1) {
      const confidenceCircle = L.circle(pos, {
        radius: target.confidenceRadius,
        color: '#10b981',
        weight: 1.5,
        fillColor: '#10b981',
        fillOpacity: 0.15
      });
      this.targetLayer.addLayer(confidenceCircle);
    }
  }

  /**
   * Render Saved Target Markers with Multimedia Previews, Edit & Delete actions
   */
  renderSavedTargets(savedTargets, onEditTarget, onDeleteTarget) {
    this.savedTargetsLayer.clearLayers();

    savedTargets.forEach(t => {
      const color = t.color || '#0284c7';
      const icon = L.divIcon({
        className: 'custom-saved-marker',
        html: `
          <div style="
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background: ${color};
            border: 2px solid #ffffff;
            box-shadow: 0 0 12px ${color}88, 0 2px 8px rgba(0,0,0,0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 15px;
            cursor: pointer;
            transition: transform 0.2s ease;
          " title="${t.name}">
            📌
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      const marker = L.marker([t.lat, t.lng], { icon });

      // Generate media preview html if target has attached photos/videos
      let mediaPreviewHtml = '';
      if (t.mediaList && t.mediaList.length > 0) {
        mediaPreviewHtml = `
          <div style="margin-top: 8px; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            <div style="font-size: 11px; font-weight: 600; color: #64748b; margin-bottom: 4px;">
              📷 Archivos Adjuntos (${t.mediaList.length}):
            </div>
            <div style="display: flex; gap: 6px; overflow-x: auto; padding-bottom: 4px;">
              ${t.mediaList.map(m => {
                if (m.type && m.type.startsWith('video/')) {
                  return `
                    <div style="width: 54px; height: 54px; background: #0f172a; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: white; font-size: 18px; flex-shrink: 0; border: 1px solid #38bdf8;" title="${m.name}">
                      🎥
                    </div>
                  `;
                }
                return `
                  <img src="${m.dataUrl || m.thumbnail || ''}" style="width: 54px; height: 54px; object-fit: cover; border-radius: 6px; flex-shrink: 0; border: 1px solid #cbd5e1;" title="${m.name}" alt="${m.name}">
                `;
              }).join('')}
            </div>
          </div>
        `;
      }

      marker.bindPopup(`
        <div style="font-family: 'Inter', sans-serif; font-size: 13px; color: #0f172a; min-width: 220px;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="display: inline-block; width: 12px; height: 12px; border-radius: 50%; background: ${color}; box-shadow: 0 0 6px ${color}; flex-shrink: 0;"></span>
            <strong style="color: ${color}; font-size: 14px;">${t.name}</strong>
          </div>
          <p style="margin: 4px 0 6px 0; color: #475569; font-size: 12px;">${t.description || 'Sin descripción'}</p>
          <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; color: #64748b;">
            <span>📍 ${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</span>
            <span style="background: #10b98122; color: #059669; padding: 2px 6px; border-radius: 99px; font-weight: 600;">±${t.accuracy ? t.accuracy.toFixed(1) : 0}m</span>
          </div>
          ${mediaPreviewHtml}
          <div style="margin-top: 10px; display: flex; gap: 6px;">
            <button id="btn-popup-edit-${t.id}" style="flex: 1; padding: 6px 8px; background: #0284c7; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 4px;">
              ✏️ Editar
            </button>
            <button id="btn-popup-delete-${t.id}" style="padding: 6px 10px; background: #ef444422; color: #ef4444; border: 1px solid #ef444466; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 500; display: flex; align-items: center; justify-content: center;" title="Eliminar este marcador">
              🗑️
            </button>
          </div>
        </div>
      `);

      marker.on('popupopen', () => {
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
   * Calculate all-encompassing bounds for active elements
   */
  getAllBounds(origins, target) {
    const latLngs = [];
    origins.forEach(o => {
      if (o.enabled) {
        latLngs.push([o.lat, o.lng]);
        // Also add boundary extremes of circle
        const latDelta = (o.distance / 111320);
        const lngDelta = (o.distance / (111320 * Math.cos((o.lat * Math.PI) / 180)));
        latLngs.push([o.lat + latDelta, o.lng]);
        latLngs.push([o.lat - latDelta, o.lng]);
        latLngs.push([o.lat, o.lng + lngDelta]);
        latLngs.push([o.lat, o.lng - lngDelta]);
      }
    });

    if (target) {
      latLngs.push([target.lat, target.lng]);
    }

    if (latLngs.length === 0) return null;
    return L.latLngBounds(latLngs);
  }
}

// Attach to window
window.MapController = MapController;
