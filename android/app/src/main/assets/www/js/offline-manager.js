/**
 * GeoTrilateración - Offline Map & Tile Manager & Local Database
 * IndexedDB storage for tiles, packs, media, and target database
 */

class OfflineMapManager {
  constructor(options = {}) {
    this.dbName = 'GeoTrilaterationOfflineDB';
    this.dbVersion = 3; // Upgraded version for targets DB store
    this.db = null;
    this.isDownloading = false;
    this.abortController = null;
    this.tileUrlTemplate = options.tileUrl || 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    this.subdomains = ['a', 'b', 'c'];
    this.isOnline = navigator.onLine;

    // Listen to network state
    window.addEventListener('online', () => {
      this.isOnline = true;
      document.dispatchEvent(new CustomEvent('network:status', { detail: { online: true } }));
    });
    window.addEventListener('offline', () => {
      this.isOnline = false;
      document.dispatchEvent(new CustomEvent('network:status', { detail: { online: false } }));
    });
  }

  /**
   * Initialize IndexedDB database (with tiles, packs, media, and targets stores)
   */
  async initDB() {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('tiles')) {
          db.createObjectStore('tiles'); // key: `${layer}/${z}/${x}/${y}`
        }
        if (!db.objectStoreNames.contains('packs')) {
          db.createObjectStore('packs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('media')) {
          db.createObjectStore('media', { keyPath: 'id' }); // { id, targetId, name, type, blob, dataUrl, createdAt }
        }
        if (!db.objectStoreNames.contains('targets')) {
          db.createObjectStore('targets', { keyPath: 'id' }); // { id, name, lat, lng, accuracy, ... }
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('IndexedDB error:', event.target.error);
        reject(event.target.error);
      };
    });
  }

  /**
   * Store target in IndexedDB
   */
  async saveTarget(target) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['targets'], 'readwrite');
      const store = tx.objectStore('targets');
      const req = store.put(target);
      req.onsuccess = () => resolve(target.id);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve all targets from IndexedDB
   */
  async getAllTargets() {
    await this.initDB();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['targets'], 'readonly');
      const store = tx.objectStore('targets');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Delete target from IndexedDB
   */
  async deleteTarget(targetId) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['targets'], 'readwrite');
      const store = tx.objectStore('targets');
      const req = store.delete(targetId);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Store media attachment (Photo or Video) in IndexedDB
   */
  async saveMedia(mediaItem) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['media'], 'readwrite');
      const store = tx.objectStore('media');
      const req = store.put(mediaItem);
      req.onsuccess = () => resolve(mediaItem.id);
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve media attachment by ID
   */
  async getMedia(mediaId) {
    await this.initDB();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['media'], 'readonly');
      const store = tx.objectStore('media');
      const req = store.get(mediaId);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  /**
   * Delete media attachment
   */
  async deleteMedia(mediaId) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['media'], 'readwrite');
      const store = tx.objectStore('media');
      const req = store.delete(mediaId);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Helper: Convert Lat/Lng to Tile Coordinates (x, y) at zoom z
   */
  latLngToTile(lat, lng, zoom) {
    const latRad = (lat * Math.PI) / 180;
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
    return { x, y, z: zoom };
  }

  /**
   * Get all tiles needed for a bounding box and zoom levels
   */
  getTilesForBounds(bounds, minZoom, maxZoom) {
    const tiles = [];
    const north = Math.min(85.0511, bounds.getNorth ? bounds.getNorth() : (bounds.maxLat || bounds.north));
    const south = Math.max(-85.0511, bounds.getSouth ? bounds.getSouth() : (bounds.minLat || bounds.south));
    const west = bounds.getWest ? bounds.getWest() : (bounds.minLng || bounds.west);
    const east = bounds.getEast ? bounds.getEast() : (bounds.maxLng || bounds.east);

    for (let z = minZoom; z <= maxZoom; z++) {
      const p1 = this.latLngToTile(north, west, z);
      const p2 = this.latLngToTile(south, east, z);

      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ x, y, z });
        }
      }
    }
    return tiles;
  }

  /**
   * Estimate download pack size and tile count
   */
  estimatePack(bounds, minZoom, maxZoom) {
    const tiles = this.getTilesForBounds(bounds, minZoom, maxZoom);
    const avgTileSizeBytes = 18 * 1024; // ~18 KB per tile average
    const totalBytes = tiles.length * avgTileSizeBytes;
    return {
      tileCount: tiles.length,
      estimatedSizeBytes: totalBytes,
      estimatedSizeMB: (totalBytes / (1024 * 1024)).toFixed(1)
    };
  }

  /**
   * Download and Cache an entire geographic zone for offline use
   */
  async downloadZone(options) {
    const { name, bounds, minZoom, maxZoom, onProgress } = options;
    const tiles = this.getTilesForBounds(bounds, minZoom, maxZoom);
    const total = tiles.length;

    await this.initDB();
    this.isDownloading = true;
    this.abortController = new AbortController();

    let downloaded = 0;
    let failed = 0;
    const concurrency = 6;

    const pack = {
      id: `pack_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      name: name || 'Zona Personalizada',
      bounds: {
        minLat: bounds.getSouth ? bounds.getSouth() : (bounds.minLat || bounds.south),
        maxLat: bounds.getNorth ? bounds.getNorth() : (bounds.maxLat || bounds.north),
        minLng: bounds.getWest ? bounds.getWest() : (bounds.minLng || bounds.west),
        maxLng: bounds.getEast ? bounds.getEast() : (bounds.maxLng || bounds.east)
      },
      minZoom,
      maxZoom,
      tileCount: total,
      createdAt: new Date().toISOString()
    };

    const downloadTile = async (t) => {
      if (!this.isDownloading) return;
      const sub = this.subdomains[(t.x + t.y) % this.subdomains.length];
      const url = this.tileUrlTemplate
        .replace('{s}', sub)
        .replace('{z}', t.z)
        .replace('{x}', t.x)
        .replace('{y}', t.y);

      const key = `osm/${t.z}/${t.x}/${t.y}`;

      try {
        const res = await fetch(url, { signal: this.abortController.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        await this.storeTile(key, blob);
        downloaded++;
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        failed++;
      }

      if (onProgress) {
        onProgress({
          downloaded,
          failed,
          total,
          percent: Math.round(((downloaded + failed) / total) * 100)
        });
      }
    };

    try {
      for (let i = 0; i < tiles.length; i += concurrency) {
        if (!this.isDownloading) break;
        const chunk = tiles.slice(i, i + concurrency);
        await Promise.all(chunk.map(t => downloadTile(t)));
      }

      // Save pack metadata in DB
      await this.savePack(pack);
      return pack;
    } finally {
      this.isDownloading = false;
      this.abortController = null;
    }
  }

  cancelDownload() {
    this.isDownloading = false;
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  async storeTile(key, blob) {
    const tx = this.db.transaction(['tiles'], 'readwrite');
    const store = tx.objectStore('tiles');
    store.put(blob, key);
  }

  async getTile(key) {
    await this.initDB();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['tiles'], 'readonly');
      const store = tx.objectStore('tiles');
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  }

  async savePack(pack) {
    const tx = this.db.transaction(['packs'], 'readwrite');
    const store = tx.objectStore('packs');
    store.put(pack);
  }

  async getStoredPacks() {
    await this.initDB();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['packs'], 'readonly');
      const store = tx.objectStore('packs');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  async deletePack(packId) {
    await this.initDB();
    const tx = this.db.transaction(['packs'], 'readwrite');
    const store = tx.objectStore('packs');
    store.delete(packId);
  }

  async clearAllTiles() {
    await this.initDB();
    const tx = this.db.transaction(['tiles', 'packs'], 'readwrite');
    tx.objectStore('tiles').clear();
    tx.objectStore('packs').clear();
  }

  async getCachedTileCount() {
    await this.initDB();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['tiles'], 'readonly');
      const store = tx.objectStore('tiles');
      const req = store.count();
      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => resolve(0);
    });
  }

  /**
   * Leaflet Offline TileLayer implementation
   */
  createOfflineTileLayer() {
    const manager = this;
    const OfflineTileLayer = L.TileLayer.extend({
      createTile(coords, done) {
        const tile = document.createElement('img');
        L.DomEvent.on(tile, 'load', L.Util.bind(this._tileOnLoad, this, done, tile));
        L.DomEvent.on(tile, 'error', L.Util.bind(this._tileOnError, this, done, tile));

        if (this.options.crossOrigin || this.options.crossOrigin === '') {
          tile.crossOrigin = this.options.crossOrigin === true ? '' : this.options.crossOrigin;
        }

        tile.alt = '';
        tile.setAttribute('role', 'presentation');

        const key = `osm/${coords.z}/${coords.x}/${coords.y}`;

        // 1. Try IndexedDB cache first
        manager.getTile(key).then(cachedBlob => {
          if (cachedBlob) {
            tile.src = URL.createObjectURL(cachedBlob);
          } else {
            // 2. Fetch from network if online
            const sub = manager.subdomains[(coords.x + coords.y) % manager.subdomains.length];
            const onlineUrl = manager.tileUrlTemplate
              .replace('{s}', sub)
              .replace('{z}', coords.z)
              .replace('{x}', coords.x)
              .replace('{y}', coords.y);

            tile.src = onlineUrl;

            // Cache in background for future offline use
            fetch(onlineUrl)
              .then(res => res.ok ? res.blob() : null)
              .then(blob => {
                if (blob) manager.storeTile(key, blob);
              })
              .catch(() => {});
          }
        }).catch(() => {
          tile.src = this.getTileUrl(coords);
        });

        return tile;
      }
    });

    return new OfflineTileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });
  }
}

// Attach to window
window.OfflineMapManager = OfflineMapManager;
