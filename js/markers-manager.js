/**
 * GeoTrilateration - Markers & Data Management
 * Handles origin points, solved targets, persistence and GeoJSON/KML exports
 */

class MarkersManager {
  constructor() {
    this.STORAGE_KEY_ORIGINS = 'geotrilat_origins_v1';
    this.STORAGE_KEY_TARGETS = 'geotrilat_targets_v1';
    this.STORAGE_KEY_SETTINGS = 'geotrilat_settings_v1';

    this.origins = [];
    this.savedTargets = [];
    this.activeColorFilter = null; // null means 'All'
    this.settings = {
      earthModel: 'wgs84',
      solverTolerance: 0.05,
      showIntersections: true,
      showCircleFill: true,
      showCircles: true,
      showOrigins: true,
      showSavedTargets: true,
      theme: 'dark'
    };

    // 6 Specific Colors requested by user: 2 Blues, 2 Pinks, 1 Yellow, 1 Grey
    this.presetColors = [
      { hex: '#0284c7', name: 'Azul Océano', category: 'blue' },
      { hex: '#38bdf8', name: 'Azul Cyan Neón', category: 'blue' },
      { hex: '#ec4899', name: 'Rosa Fucsia', category: 'pink' },
      { hex: '#f43f5e', name: 'Rosa Frambuesa', category: 'pink' },
      { hex: '#eab308', name: 'Amarillo Sol', category: 'yellow' },
      { hex: '#64748b', name: 'Gris Pizarra', category: 'grey' }
    ];

    this.colorPalette = this.presetColors.map(c => c.hex);

    this.loadFromStorage();
  }

  /**
   * Unit conversion to standard meters
   */
  convertToMeters(value, unit) {
    const val = parseFloat(value);
    if (isNaN(val)) return 0;
    switch (unit) {
      case 'km': return val * 1000;
      case 'mi': return val * 1609.344;
      case 'ft': return val * 0.3048;
      case 'm':
      default:
        return val;
    }
  }

  /**
   * Convert meters to readable string in chosen unit
   */
  formatDistance(meters, unit = 'm') {
    if (meters === undefined || meters === null) return '--';
    if (unit === 'km' || (meters >= 1000 && unit !== 'm' && unit !== 'ft')) {
      return `${(meters / 1000).toFixed(2)} km`;
    }
    if (unit === 'mi') {
      return `${(meters / 1609.344).toFixed(2)} mi`;
    }
    if (unit === 'ft') {
      return `${(meters / 0.3048).toFixed(1)} ft`;
    }
    return `${meters.toFixed(1)} m`;
  }

  /**
   * Get Next Color for Origin
   */
  getNextColor() {
    const index = this.origins.length % this.colorPalette.length;
    return this.colorPalette[index];
  }

  /**
   * Load data from localStorage
   */
  loadFromStorage() {
    try {
      const savedOrigins = localStorage.getItem(this.STORAGE_KEY_ORIGINS);
      if (savedOrigins) this.origins = JSON.parse(savedOrigins);

      const savedTargets = localStorage.getItem(this.STORAGE_KEY_TARGETS);
      if (savedTargets) this.savedTargets = JSON.parse(savedTargets);

      const savedSettings = localStorage.getItem(this.STORAGE_KEY_SETTINGS);
      if (savedSettings) this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
    }
  }

  /**
   * Persist state to localStorage
   */
  saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY_ORIGINS, JSON.stringify(this.origins));
      localStorage.setItem(this.STORAGE_KEY_TARGETS, JSON.stringify(this.savedTargets));
      localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }

  /* --------------------------------------------------------------------------
     Origin Points CRUD
     -------------------------------------------------------------------------- */
  addOrigin(data) {
    const distanceMeters = this.convertToMeters(data.distance, data.unit || 'm');
    const origin = {
      id: data.id || `origin_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      label: data.label || `Origen ${this.origins.length + 1}`,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      distance: distanceMeters,
      rawDistance: parseFloat(data.distance),
      unit: data.unit || 'm',
      color: data.color || this.getNextColor(),
      enabled: data.enabled !== undefined ? data.enabled : true,
      notes: data.notes || '',
      createdAt: data.createdAt || new Date().toISOString()
    };

    this.origins.push(origin);
    this.saveToStorage();
    return origin;
  }

  updateOrigin(id, updates) {
    const idx = this.origins.findIndex(o => o.id === id);
    if (idx === -1) return null;

    if (updates.distance !== undefined && updates.unit !== undefined) {
      updates.distance = this.convertToMeters(updates.distance, updates.unit);
    } else if (updates.distance !== undefined) {
      updates.distance = this.convertToMeters(updates.distance, this.origins[idx].unit);
    }

    this.origins[idx] = { ...this.origins[idx], ...updates };
    this.saveToStorage();
    return this.origins[idx];
  }

  removeOrigin(id) {
    this.origins = this.origins.filter(o => o.id !== id);
    this.saveToStorage();
  }

  clearOrigins() {
    this.origins = [];
    this.saveToStorage();
  }

  toggleOrigin(id) {
    const origin = this.origins.find(o => o.id === id);
    if (origin) {
      origin.enabled = !origin.enabled;
      this.saveToStorage();
      return origin.enabled;
    }
    return false;
  }

  /**
   * Reorder Origin Point up or down in the list
   * @param {string} id - Origin point id
   * @param {number} direction - -1 for Up, +1 for Down
   */
  moveOrigin(id, direction) {
    const index = this.origins.findIndex(o => String(o.id) === String(id));
    if (index === -1) return false;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.origins.length) return false;

    // Swap / Move element
    const item = this.origins.splice(index, 1)[0];
    this.origins.splice(newIndex, 0, item);

    // Re-align default color order and labels if standard
    this.origins.forEach((o, idx) => {
      o.color = this.colorPalette[idx % this.colorPalette.length];
      if (/^Origen\s*\d+$/i.test(o.label) || /^Punto\s*\d+$/i.test(o.label)) {
        o.label = `Origen ${idx + 1}`;
      }
    });

    this.saveToStorage();
    return true;
  }

  /* --------------------------------------------------------------------------
     Saved Final Targets CRUD
     -------------------------------------------------------------------------- */
  addTarget(data) {
    const target = {
      id: data.id || `target_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: data.name || `Punto Final ${this.savedTargets.length + 1}`,
      description: data.description || '',
      category: data.category || 'target',
      color: data.color || this.presetColors[0].hex,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      accuracy: data.accuracy || 0,
      mediaList: data.mediaList || [], // [{ id, name, type, size, thumbnail }]
      originsSnapshot: data.originsSnapshot || JSON.parse(JSON.stringify(this.origins)),
      createdAt: data.createdAt || new Date().toISOString()
    };

    this.savedTargets.unshift(target); // prepend to list
    this.saveToStorage();
    return target;
  }

  updateTarget(id, updates) {
    const idx = this.savedTargets.findIndex(t => String(t.id) === String(id));
    if (idx === -1) {
      console.warn(`Target with id ${id} not found.`);
      return null;
    }

    this.savedTargets[idx] = {
      ...this.savedTargets[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveToStorage();
    return this.savedTargets[idx];
  }

  getTargetById(id) {
    return this.savedTargets.find(t => String(t.id) === String(id)) || null;
  }

  getFilteredTargets() {
    if (!this.activeColorFilter) {
      return this.savedTargets;
    }
    return this.savedTargets.filter(t => (t.color || '').toLowerCase() === this.activeColorFilter.toLowerCase());
  }

  setColorFilter(colorHex) {
    this.activeColorFilter = colorHex; // null or '#0284c7' etc.
    return this.getFilteredTargets();
  }

  removeTarget(id) {
    this.savedTargets = this.savedTargets.filter(t => String(t.id) !== String(id));
    this.saveToStorage();
  }

  clearAllData() {
    this.origins = [];
    this.savedTargets = [];
    this.settings = {
      earthModel: 'wgs84',
      solverTolerance: 0.05,
      showIntersections: true,
      showCircleFill: true,
      theme: 'dark'
    };
    localStorage.removeItem(this.STORAGE_KEY_ORIGINS);
    localStorage.removeItem(this.STORAGE_KEY_TARGETS);
    localStorage.removeItem(this.STORAGE_KEY_SETTINGS);
  }

  /* --------------------------------------------------------------------------
     Export and Import Functions
     -------------------------------------------------------------------------- */
  exportJSON() {
    const payload = {
      app: 'GeoTrilateration',
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      origins: this.origins,
      savedTargets: this.savedTargets,
      settings: this.settings
    };
    return JSON.stringify(payload, null, 2);
  }

  exportGeoJSON() {
    const features = [];

    // Add Saved Targets as Points
    this.savedTargets.forEach(t => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [t.lng, t.lat]
        },
        properties: {
          type: 'Target',
          name: t.name,
          description: t.description,
          category: t.category,
          color: t.color,
          accuracyMeters: t.accuracy,
          originsUsedCount: t.originsSnapshot ? t.originsSnapshot.length : 0,
          createdAt: t.createdAt
        }
      });
    });

    // Add Origins as Points
    this.origins.forEach(o => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [o.lng, o.lat]
        },
        properties: {
          type: 'Origin',
          name: o.label,
          distanceMeters: o.distance,
          unit: o.unit,
          color: o.color,
          createdAt: o.createdAt
        }
      });
    });

    return JSON.stringify({
      type: 'FeatureCollection',
      name: 'GeoTrilateration_Export',
      features
    }, null, 2);
  }

  exportKML() {
    let kml = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>GeoTrilateración Export</name>
    <description>Puntos de trilateración y objetivos guardados</description>
`;

    // Folder for Targets
    kml += `    <Folder><name>Puntos Finales Encontrados</name>\n`;
    this.savedTargets.forEach(t => {
      kml += `      <Placemark>
        <name>${this.escapeXML(t.name)}</name>
        <description>${this.escapeXML(t.description)} (Precisión: ±${t.accuracy ? t.accuracy.toFixed(1) : 0}m)</description>
        <Point>
          <coordinates>${t.lng},${t.lat},0</coordinates>
        </Point>
      </Placemark>\n`;
    });
    kml += `    </Folder>\n`;

    // Folder for Origins
    kml += `    <Folder><name>Puntos de Origen de Medición</name>\n`;
    this.origins.forEach(o => {
      kml += `      <Placemark>
        <name>${this.escapeXML(o.label)}</name>
        <description>Distancia medida: ${this.formatDistance(o.distance)}</description>
        <Point>
          <coordinates>${o.lng},${o.lat},0</coordinates>
        </Point>
      </Placemark>\n`;
    });
    kml += `    </Folder>\n`;

    kml += `  </Document>\n</kml>`;
    return kml;
  }

  escapeXML(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  importJSON(jsonString) {
    try {
      const data = JSON.parse(jsonString);

      if (data.type === 'FeatureCollection' && Array.isArray(data.features)) {
        // Import GeoJSON
        let addedTargets = 0;
        data.features.forEach(f => {
          if (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates) {
            const [lng, lat] = f.geometry.coordinates;
            const props = f.properties || {};
            if (props.type === 'Origin') {
              this.addOrigin({
                label: props.name || 'Origen Importado',
                lat,
                lng,
                distance: props.distanceMeters || 1000,
                unit: props.unit || 'm',
                color: props.color
              });
            } else {
              this.addTarget({
                name: props.name || 'Punto Importado',
                description: props.description || '',
                category: props.category || 'target',
                color: props.color || '#10b981',
                lat,
                lng,
                accuracy: props.accuracyMeters || 0
              });
              addedTargets++;
            }
          }
        });
        return { success: true, count: data.features.length };
      }

      // App JSON backup
      if (Array.isArray(data.origins)) {
        this.origins = data.origins;
      }
      if (Array.isArray(data.savedTargets)) {
        this.savedTargets = data.savedTargets;
      }
      if (data.settings) {
        this.settings = { ...this.settings, ...data.settings };
      }

      this.saveToStorage();
      return { success: true, count: this.origins.length + this.savedTargets.length };
    } catch (e) {
      console.error('Import error:', e);
      return { success: false, error: e.message };
    }
  }
}

// Attach to window
window.MarkersManager = MarkersManager;
