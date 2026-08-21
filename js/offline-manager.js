/**
 * GeoTrilateration - Offline Map & Tile Manager
 * IndexedDB storage, tile caching and zone batch downloader
 */

class OfflineMapManager {
  constructor(options = {}) {
    this.dbName = 'GeoTrilaterationOfflineDB';
    this.dbVersion = 2; // Upgraded version for media store
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
   * Initialize IndexedDB database (with tiles, packs, and media stores)
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
    const north = Math.min(85.0511, bounds.getNorth ? bounds.getNorth() : bounds.north);
    const south = Math.max(-85.0511, bounds.getSouth ? bounds.getSouth() : bounds.south);
    const east = bounds.getEast ? bounds.getEast() : bounds.east;
    const west = bounds.getWest ? bounds.getWest() : bounds.west;

    for (let z = minZoom; z <= maxZoom; z++) {
      const northWest = this.latLngToTile(north, west, z);
      const southEast = this.latLngToTile(south, east, z);

      const minX = Math.min(northWest.x, southEast.x);
      const maxX = Math.max(northWest.x, southEast.x);
      const minY = Math.min(northWest.y, southEast.y);
      const maxY = Math.max(northWest.y, southEast.y);

      for (let x = minX; x <= maxX; x++) {
        for (let y = minY; y <= maxY; y++) {
          tiles.push({ x, y, z });
        }
      }
    }
    return tiles;
  }

  /**
   * Store single tile blob in IndexedDB
   */
  async saveTile(key, blob) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['tiles'], 'readwrite');
      const store = tx.objectStore('tiles');
      const req = store.put(blob, key);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Retrieve single tile blob from IndexedDB
   */
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

  /**
   * Count total stored tiles and estimate storage size
   */
  async getStorageStats() {
    await this.initDB();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['tiles'], 'readonly');
      const store = tx.objectStore('tiles');
      const countReq = store.count();

      countReq.onsuccess = () => {
        const count = countReq.result;
        const estimatedMB = (count * 16) / 1024; // avg ~16KB per tile
        resolve({
          count,
          sizeFormatted: estimatedMB > 1024
            ? `${(estimatedMB / 1024).toFixed(2)} GB`
            : `${estimatedMB.toFixed(1)} MB`
        });
      };

      countReq.onerror = () => resolve({ count: 0, sizeFormatted: '0 MB' });
    });
  }

  /**
   * Get list of saved offline packs
   */
  async getSavedPacks() {
    await this.initDB();
    return new Promise((resolve) => {
      const tx = this.db.transaction(['packs'], 'readonly');
      const store = tx.objectStore('packs');
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }

  /**
   * Save a pack metadata record
   */
  async savePackMetadata(pack) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['packs'], 'readwrite');
      const store = tx.objectStore('packs');
      const req = store.put(pack);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Clear all cached tiles
   */
  async clearAllTiles() {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['tiles', 'packs'], 'readwrite');
      tx.objectStore('tiles').clear();
      tx.objectStore('packs').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Delete a specific offline pack
   */
  async deletePack(packId) {
    await this.initDB();
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(['packs'], 'readwrite');
      const store = tx.objectStore('packs');
      const req = store.delete(packId);
      req.onsuccess = () => resolve();
      req.onerror = (e) => reject(e.target.error);
    });
  }

  /**
   * Download a batch of tiles for offline use with progress reporting
   */
  async downloadZone(packName, bounds, minZoom, maxZoom, onProgress) {
    if (this.isDownloading) throw new Error('Ya hay una descarga en curso.');

    this.isDownloading = true;
    this.abortController = new AbortController();
    const signal = this.abortController.signal;

    const tiles = this.getTilesForBounds(bounds, minZoom, maxZoom);
    const totalTiles = tiles.length;
    let downloadedCount = 0;
    let failedCount = 0;
    let totalBytes = 0;

    const concurrency = 6;
    let currentIndex = 0;

    const formatTileUrl = (x, y, z) => {
      const s = this.subdomains[Math.abs(x + y) % this.subdomains.length];
      return this.tileUrlTemplate
        .replace('{s}', s)
        .replace('{x}', x)
        .replace('{y}', y)
        .replace('{z}', z);
    };

    const worker = async () => {
      while (currentIndex < totalTiles && !signal.aborted) {
        const index = currentIndex++;
        const tile = tiles[index];
        const tileKey = `osm/${tile.z}/${tile.x}/${tile.y}`;

        // Check if already in cache
        const existing = await this.getTile(tileKey);
        if (existing) {
          downloadedCount++;
          if (onProgress) {
            onProgress({
              downloaded: downloadedCount,
              total: totalTiles,
              percent: Math.round((downloadedCount / totalTiles) * 100),
              bytes: totalBytes,
              failed: failedCount
            });
          }
          continue;
        }

        try {
          const url = formatTileUrl(tile.x, tile.y, tile.z);
          const response = await fetch(url, { signal, cache: 'no-cache' });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const blob = await response.blob();
          totalBytes += blob.size;
          await this.saveTile(tileKey, blob);
          downloadedCount++;
        } catch (err) {
          if (signal.aborted) break;
          failedCount++;
          // continue with remaining tiles
        }

        if (onProgress) {
          onProgress({
            downloaded: downloadedCount,
            total: totalTiles,
            percent: Math.round((downloadedCount / totalTiles) * 100),
            bytes: totalBytes,
            failed: failedCount
          });
        }
      }
    };

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }

    try {
      await Promise.all(workers);

      if (!signal.aborted) {
        // Save pack metadata
        const packRecord = {
          id: `pack_${Date.now()}`,
          name: packName,
          minZoom,
          maxZoom,
          tileCount: downloadedCount,
          sizeBytes: totalBytes,
          createdAt: new Date().toISOString()
        };
        await this.savePackMetadata(packRecord);
      }
    } finally {
      this.isDownloading = false;
      this.abortController = null;
    }

    return {
      success: !signal.aborted,
      downloaded: downloadedCount,
      total: totalTiles,
      failed: failedCount
    };
  }

  /**
   * Cancel ongoing download
   */
  cancelDownload() {
    if (this.abortController) {
      this.abortController.abort();
      this.isDownloading = false;
    }
  }

  /**
   * Create Custom Leaflet TileLayer with Offline First + Auto-Cache capabilities
   */
  createOfflineTileLayer() {
    const manager = this;

    const OfflineTileLayer = L.TileLayer.extend({
      createTile(coords, done) {
        const tile = document.createElement('img');
        tile.setAttribute('role', 'presentation');
        const tileKey = `osm/${coords.z}/${coords.x}/${coords.y}`;

        // 1. Try to load from local IndexedDB cache
        manager.getTile(tileKey).then(blob => {
          if (blob) {
            tile.src = URL.createObjectURL(blob);
            done(null, tile);
          } else {
            // 2. If not found in cache, fetch from internet
            const s = manager.subdomains[Math.abs(coords.x + coords.y) % manager.subdomains.length];
            const url = this.getTileUrl(coords);

            tile.onload = () => {
              done(null, tile);
              // Auto-cache for future offline use if online
              if (manager.isOnline) {
                fetch(url)
                  .then(r => r.ok ? r.blob() : null)
                  .then(b => {
                    if (b) manager.saveTile(tileKey, b);
                  })
                  .catch(() => {});
              }
            };

            tile.onerror = (e) => {
              // Tile unavailable offline
              tile.classList.add('tile-offline-missing');
              tile.style.backgroundColor = '#1e293b';
              done(e, tile);
            };

            tile.src = url;
          }
        }).catch(err => {
          tile.src = this.getTileUrl(coords);
          done(null, tile);
        });

        return tile;
      }
    });

    return new OfflineTileLayer(this.tileUrlTemplate, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    });
  }
}

// Attach to window
window.OfflineMapManager = OfflineMapManager;
