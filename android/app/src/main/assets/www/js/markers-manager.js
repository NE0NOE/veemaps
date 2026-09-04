/**
 * GeoTrilateration - Markers & Data Management
 * Handles origin points, database of solved targets, comparison engine & GeoJSON/KML exports
 */

class MarkersManager {
  constructor() {
    this.STORAGE_KEY_ORIGINS = 'geotrilat_origins_v1';
    this.STORAGE_KEY_TARGETS = 'geotrilat_targets_v1';
    this.STORAGE_KEY_SETTINGS = 'geotrilat_settings_v1';
    this.STORAGE_KEY_PRESET_ORIGINS = 'geotrilat_preset_origins_v1';

    this.origins = [];
    this.savedTargets = [];
    this.presetOrigins = [];
    this.activeColorFilter = null; // null means 'All'
    this.selectedForComparison = []; // array of target IDs

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

  getNextColor() {
    const index = this.origins.length % this.colorPalette.length;
    return this.colorPalette[index];
  }

  loadFromStorage() {
    try {
      const savedOrigins = localStorage.getItem(this.STORAGE_KEY_ORIGINS);
      if (savedOrigins) this.origins = JSON.parse(savedOrigins);

      const savedTargets = localStorage.getItem(this.STORAGE_KEY_TARGETS);
      if (savedTargets) this.savedTargets = JSON.parse(savedTargets);

      const savedSettings = localStorage.getItem(this.STORAGE_KEY_SETTINGS);
      if (savedSettings) this.settings = { ...this.settings, ...JSON.parse(savedSettings) };

      const savedPresets = localStorage.getItem(this.STORAGE_KEY_PRESET_ORIGINS);
      if (savedPresets) {
        this.presetOrigins = JSON.parse(savedPresets);
      } else {
        this.presetOrigins = [
          { id: 'preset_mga_centro', name: '🇳🇮 Managua Centro', lat: 12.1364, lng: -86.2514, defaultDistance: 2, defaultUnit: 'km' },
          { id: 'preset_mga_metrocentro', name: '🏢 Metrocentro / Galerías', lat: 12.1150, lng: -86.2360, defaultDistance: 1.5, defaultUnit: 'km' },
          { id: 'preset_granada', name: '🏛️ Granada Centro', lat: 11.9344, lng: -85.9560, defaultDistance: 2.5, defaultUnit: 'km' }
        ];
      }
    } catch (e) {
      console.warn('Error reading from localStorage:', e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY_ORIGINS, JSON.stringify(this.origins));
      localStorage.setItem(this.STORAGE_KEY_TARGETS, JSON.stringify(this.savedTargets));
      localStorage.setItem(this.STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
      localStorage.setItem(this.STORAGE_KEY_PRESET_ORIGINS, JSON.stringify(this.presetOrigins));
    } catch (e) {
      console.error('Error saving to localStorage:', e);
    }
  }

  /* --------------------------------------------------------------------------
     Preset Origins (Orígenes Predeterminados / Favoritos)
     -------------------------------------------------------------------------- */
  getPresetOrigins() {
    return this.presetOrigins;
  }

  addPresetOrigin(data) {
    const preset = {
      id: data.id || `preset_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: data.name || `Punto Frecuente ${this.presetOrigins.length + 1}`,
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      defaultDistance: data.defaultDistance ? parseFloat(data.defaultDistance) : 1.5,
      defaultUnit: data.defaultUnit || 'km',
      createdAt: new Date().toISOString()
    };
    this.presetOrigins.push(preset);
    this.saveToStorage();
    return preset;
  }

  removePresetOrigin(id) {
    this.presetOrigins = this.presetOrigins.filter(p => p.id !== id);
    this.saveToStorage();
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

    const currentOrigin = this.origins[idx];
    const unit = updates.unit !== undefined ? updates.unit : (currentOrigin.unit || 'km');
    
    if (updates.distance !== undefined) {
      const rawVal = parseFloat(updates.distance);
      updates.rawDistance = rawVal;
      updates.distance = this.convertToMeters(rawVal, unit);
      updates.unit = unit;
    } else if (updates.unit !== undefined && updates.unit !== currentOrigin.unit) {
      // If only unit changed, recalculate meters from rawDistance
      const rawVal = currentOrigin.rawDistance !== undefined ? currentOrigin.rawDistance : currentOrigin.distance;
      updates.rawDistance = rawVal;
      updates.distance = this.convertToMeters(rawVal, unit);
      updates.unit = unit;
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

  moveOrigin(id, direction) {
    const index = this.origins.findIndex(o => String(o.id) === String(id));
    if (index === -1) return false;

    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= this.origins.length) return false;

    const item = this.origins.splice(index, 1)[0];
    this.origins.splice(newIndex, 0, item);

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
     Database of Solved Final Targets (Puntos Finales)
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
      originsCount: data.originsCount || (this.origins ? this.origins.length : 0),
      mediaList: data.mediaList || [],
      originsSnapshot: data.originsSnapshot || JSON.parse(JSON.stringify(this.origins)),
      visible: data.visible !== undefined ? data.visible : true,
      createdAt: data.createdAt || new Date().toISOString()
    };

    this.savedTargets.unshift(target);
    this.saveToStorage();
    return target;
  }

  updateTarget(id, updates) {
    const idx = this.savedTargets.findIndex(t => String(t.id) === String(id));
    if (idx === -1) return null;

    this.savedTargets[idx] = {
      ...this.savedTargets[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };

    this.saveToStorage();
    return this.savedTargets[idx];
  }

  toggleTargetVisibility(id) {
    const target = this.getTargetById(id);
    if (!target) return false;
    target.visible = target.visible === false ? true : false;
    this.saveToStorage();
    return target.visible;
  }

  setAllTargetsVisibility(visible) {
    this.savedTargets.forEach(t => {
      t.visible = !!visible;
    });
    this.saveToStorage();
  }

  removeTarget(id) {
    this.savedTargets = this.savedTargets.filter(t => String(t.id) !== String(id));
    this.selectedForComparison = this.selectedForComparison.filter(tid => tid !== id);
    this.saveToStorage();
  }

  getTargetById(id) {
    return this.savedTargets.find(t => String(t.id) === String(id)) || null;
  }

  getFilteredTargets(searchQuery = '') {
    const query = (searchQuery || '').toLowerCase().trim();
    return this.savedTargets.filter(t => {
      const matchColor = !this.activeColorFilter || this.activeColorFilter === 'all' || (t.color || '').toLowerCase() === this.activeColorFilter.toLowerCase();
      const matchQuery = !query || (t.name && t.name.toLowerCase().includes(query)) || (t.description && t.description.toLowerCase().includes(query)) || (t.category && t.category.toLowerCase().includes(query));
      return matchColor && matchQuery;
    });
  }

  /**
   * Restore measurement session from a target's saved origins snapshot
   */
  loadOriginsFromTarget(targetId) {
    const target = this.getTargetById(targetId);
    if (!target || !target.originsSnapshot || target.originsSnapshot.length === 0) {
      return false;
    }

    this.origins = JSON.parse(JSON.stringify(target.originsSnapshot));
    this.saveToStorage();
    return true;
  }

  /* --------------------------------------------------------------------------
     Comparison Engine (Comparación Geodésica entre Puntos Finales)
     -------------------------------------------------------------------------- */
  toggleTargetComparisonSelection(targetId) {
    const idx = this.selectedForComparison.indexOf(targetId);
    if (idx >= 0) {
      this.selectedForComparison.splice(idx, 1);
    } else {
      if (this.selectedForComparison.length >= 2) {
        this.selectedForComparison.shift(); // keep at most 2 for pairwise comparison
      }
      this.selectedForComparison.push(targetId);
    }
    return this.selectedForComparison;
  }

  clearComparisonSelection() {
    this.selectedForComparison = [];
  }

  /**
   * Compare two saved targets
   */
  compareTargets(idA, idB) {
    const tA = this.getTargetById(idA);
    const tB = this.getTargetById(idB);
    if (!tA || !tB) return null;

    const toRad = d => (d * Math.PI) / 180;
    const toDeg = r => (r * 180) / Math.PI;
    const R = 6371000;

    const lat1 = toRad(tA.lat);
    const lat2 = toRad(tB.lat);
    const dLat = toRad(tB.lat - tA.lat);
    const dLng = toRad(tB.lng - tA.lng);

    // Haversine distance
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceMeters = R * c;

    // Bearing
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const bearingDeg = (toDeg(Math.atan2(y, x)) + 360) % 360;

    return {
      targetA: tA,
      targetB: tB,
      distanceMeters,
      distanceKm: distanceMeters / 1000,
      bearingDeg,
      bearingText: this.bearingToCompass(bearingDeg),
      accuracyDelta: Math.abs((tA.accuracy || 0) - (tB.accuracy || 0)),
      timeDeltaDays: Math.abs(new Date(tB.createdAt || 0) - new Date(tA.createdAt || 0)) / (1000 * 60 * 60 * 24)
    };
  }

  bearingToCompass(bearing) {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(bearing / 22.5) % 16;
    return directions[index];
  }

  /* --------------------------------------------------------------------------
     Export / Import / Backup
     -------------------------------------------------------------------------- */
  exportToGeoJSON() {
    const features = [];

    // 1. Origins Features
    this.origins.forEach((o, i) => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [o.lng, o.lat]
        },
        properties: {
          featureType: 'origin',
          id: o.id,
          order: i + 1,
          label: o.label,
          distanceMeters: o.distance,
          unit: o.unit,
          color: o.color,
          notes: o.notes
        }
      });
    });

    // 2. Saved Targets Features
    this.savedTargets.forEach(t => {
      features.push({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [t.lng, t.lat]
        },
        properties: {
          featureType: 'saved_target',
          id: t.id,
          name: t.name,
          description: t.description,
          category: t.category,
          color: t.color,
          accuracy: t.accuracy,
          mediaCount: t.mediaList ? t.mediaList.length : 0,
          createdAt: t.createdAt
        }
      });
    });

    return {
      type: 'FeatureCollection',
      features
    };
  }

  exportAllData() {
    return {
      app: 'GeoTrilateracion',
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      origins: this.origins,
      savedTargets: this.savedTargets,
      settings: this.settings
    };
  }

  importAllData(data) {
    if (!data || typeof data !== 'object') return false;
    if (data.origins && Array.isArray(data.origins)) {
      this.origins = data.origins;
    }
    if (data.savedTargets && Array.isArray(data.savedTargets)) {
      this.savedTargets = data.savedTargets;
    }
    if (data.settings && typeof data.settings === 'object') {
      this.settings = { ...this.settings, ...data.settings };
    }
    this.saveToStorage();
    return true;
  }

  resetAllData() {
    this.origins = [];
    this.savedTargets = [];
    this.selectedForComparison = [];
    this.saveToStorage();
  }
}

// Attach to window
window.MarkersManager = MarkersManager;
