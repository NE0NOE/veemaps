/**
 * VeeMaps - Floating Overlay Manager (Modo Superposición Flotante)
 * Handles native Android FloatingOverlayService bridge communications,
 * origin synchronization, and an in-app web floating simulator for desktop/browser testing.
 */
class OverlayManager {
  constructor() {
    this.isAndroid = typeof window.AndroidBridge !== 'undefined' && typeof window.AndroidBridge.startFloatingOverlay === 'function';
    this.simulatorActive = false;
    this.simulatorEl = null;

    this.init();
  }

  init() {
    // Setup global listeners for Android native events
    window.onOverlayEventReceived = (eventType, data) => {
      this.handleNativeOverlayEvent(eventType, data);
    };

    window.onOverlayPendingEventsSync = (events) => {
      this.handlePendingEventsSync(events);
    };

    // Check pending events on load if on Android
    if (this.isAndroid && window.AndroidBridge.getPendingOverlayEvents) {
      try {
        const raw = window.AndroidBridge.getPendingOverlayEvents();
        if (raw && raw !== '[]') {
          const events = JSON.parse(raw);
          this.handlePendingEventsSync(events);
        }
      } catch (e) {
        console.error('Error syncing initial overlay events:', e);
      }
    }

    // Attach UI trigger buttons
    this.setupUIBindings();
  }

  setupUIBindings() {
    const btnTop = document.getElementById('btn-floating-overlay');
    if (btnTop) {
      btnTop.addEventListener('click', () => this.toggleOverlay());
    }

    const btnSettings = document.getElementById('btn-start-overlay-service');
    if (btnSettings) {
      btnSettings.addEventListener('click', () => this.toggleOverlay());
    }
  }

  /**
   * Toggle overlay mode:
   * On Android, checks permission and launches Foreground Service.
   * In browser, toggles the interactive DOM floating bubble.
   */
  toggleOverlay() {
    if (this.isAndroid) {
      this.launchAndroidOverlay();
    } else {
      this.toggleWebSimulator();
    }
  }

  launchAndroidOverlay() {
    if (!window.AndroidBridge.hasOverlayPermission()) {
      if (typeof window.uiManager !== 'undefined') {
        window.uiManager.showToast('ℹ️ Concede el permiso de "Mostrar sobre otras aplicaciones" para activar la burbuja flotante.');
      }
      window.AndroidBridge.requestOverlayPermission();
      return;
    }

    const currentOriginsJson = JSON.stringify(window.markersManager ? window.markersManager.origins : []);
    const success = window.AndroidBridge.startFloatingOverlay(currentOriginsJson);

    if (success) {
      if (typeof window.uiManager !== 'undefined') {
        window.uiManager.showToast('🚀 Superposición iniciada. La app se minimizará.');
      }
    }
  }

  handleNativeOverlayEvent(eventType, data) {
    if (!window.markersManager) return;

    if (eventType === 'ADD_ORIGIN' && data) {
      const originData = typeof data === 'string' ? JSON.parse(data) : data;
      window.markersManager.addOrigin({
        label: originData.label || `Origen ${window.markersManager.origins.length + 1}`,
        lat: originData.lat,
        lng: originData.lng,
        radius: Number(originData.radius) || 500,
        color: '#00e5ff'
      });
      this.refreshMapAndUI(`✓ Origen añadido (${Number(originData.radius) || 500}m)`);
    } else if (eventType === 'DELETE_LAST_ORIGIN') {
      if (window.markersManager.origins.length > 0) {
        const removed = window.markersManager.origins.pop();
        window.markersManager.saveOrigins();
        this.refreshMapAndUI(`🗑️ Origen "${removed.label || ''}" eliminado`);
      }
    } else if (eventType === 'MODIFY_LAST_ORIGIN' && data) {
      const info = typeof data === 'string' ? JSON.parse(data) : data;
      if (window.markersManager.origins.length > 0) {
        const lastIdx = window.markersManager.origins.length - 1;
        window.markersManager.origins[lastIdx].radius = Number(info.radius) || 500;
        window.markersManager.saveOrigins();
        this.refreshMapAndUI(`✏️ Radio actualizado a ${info.radius}m`);
      }
    }
  }

  handlePendingEventsSync(events) {
    if (!Array.isArray(events) || events.length === 0 || !window.markersManager) return;

    let changes = 0;
    events.forEach(evt => {
      if (evt.type === 'ADD_ORIGIN' && evt.origin) {
        window.markersManager.addOrigin({
          label: evt.origin.label || `Origen ${window.markersManager.origins.length + 1}`,
          lat: evt.origin.lat,
          lng: evt.origin.lng,
          radius: Number(evt.origin.radius) || 500,
          color: '#00e5ff'
        });
        changes++;
      } else if (evt.type === 'DELETE_LAST_ORIGIN') {
        if (window.markersManager.origins.length > 0) {
          window.markersManager.origins.pop();
          changes++;
        }
      } else if (evt.type === 'MODIFY_LAST_ORIGIN') {
        if (window.markersManager.origins.length > 0) {
          window.markersManager.origins[window.markersManager.origins.length - 1].radius = Number(evt.radius) || 500;
          changes++;
        }
      }
    });

    if (changes > 0) {
      window.markersManager.saveOrigins();
      this.refreshMapAndUI(`🔄 Sincronizados ${changes} cambios de la superposición`);
    }
  }

  refreshMapAndUI(message) {
    if (window.mapManager) {
      window.mapManager.renderAll();
    }
    if (window.uiManager) {
      window.uiManager.renderOriginsList();
      if (message) window.uiManager.showToast(message);
    }
  }

  // ==========================================
  // IN-APP BROWSER / DESKTOP SIMULATOR WIDGET
  // ==========================================

  toggleWebSimulator() {
    if (this.simulatorActive) {
      this.destroyWebSimulator();
    } else {
      this.createWebSimulator();
    }
  }

  createWebSimulator() {
    if (this.simulatorEl) return;
    this.simulatorActive = true;

    const wrapper = document.createElement('div');
    wrapper.id = 'web-overlay-bubble-container';
    wrapper.className = 'web-overlay-bubble-container';
    wrapper.innerHTML = `
      <div id="web-overlay-speed-dial" class="web-overlay-speed-dial" style="display: none;">
        <button id="web-overlay-btn-close" class="overlay-dial-btn dial-close" title="Cerrar Superposición">
          <span>Cerrar</span> <span class="dial-icon">✕</span>
        </button>
        <button id="web-overlay-btn-delete" class="overlay-dial-btn dial-delete" title="Eliminar Último Origen">
          <span>Eliminar Origen</span> <span class="dial-icon">🗑️</span>
        </button>
        <button id="web-overlay-btn-modify" class="overlay-dial-btn dial-modify" title="Modificar Origen">
          <span>Modificar Origen</span> <span class="dial-icon">✏️</span>
        </button>
      </div>

      <div id="web-overlay-quick-add" class="web-overlay-card" style="display: none;">
        <div class="overlay-card-title">📍 Añadir Origen Actual</div>
        <div class="overlay-card-subtitle">Radio de cobertura:</div>
        <div class="overlay-input-row">
          <input type="number" id="web-overlay-radius" value="500" min="1" step="10" />
          <span class="unit">m</span>
        </div>
        <div class="overlay-chips-row">
          <button type="button" class="overlay-chip" data-val="100">100m</button>
          <button type="button" class="overlay-chip" data-val="500">500m</button>
          <button type="button" class="overlay-chip" data-val="1000">1km</button>
          <button type="button" class="overlay-chip" data-val="3000">3km</button>
        </div>
        <div class="overlay-actions-row">
          <button type="button" id="web-overlay-add-cancel" class="btn-text-ghost">Cancelar</button>
          <button type="button" id="web-overlay-add-save" class="btn-overlay-save">✓ Guardar</button>
        </div>
      </div>

      <div id="web-overlay-modify-card" class="web-overlay-card" style="display: none;">
        <div class="overlay-card-title" style="color: #f59e0b;">✏️ Modificar Origen</div>
        <div class="overlay-card-subtitle">Nuevo radio:</div>
        <div class="overlay-input-row">
          <input type="number" id="web-overlay-modify-radius" value="500" min="1" step="10" />
          <span class="unit">m</span>
        </div>
        <div class="overlay-actions-row">
          <button type="button" id="web-overlay-modify-cancel" class="btn-text-ghost">Cancelar</button>
          <button type="button" id="web-overlay-modify-save" class="btn-overlay-save" style="background: #f59e0b;">Actualizar</button>
        </div>
      </div>

      <div id="web-overlay-bubble" class="web-overlay-bubble" title="Burbuja flotante (Arrastra / Clic / Mantén presionado)">
        <span class="bubble-icon">📍</span>
      </div>
    `;

    document.body.appendChild(wrapper);
    this.simulatorEl = wrapper;

    this.setupSimulatorInteractions(wrapper);
    if (window.uiManager) {
      window.uiManager.showToast('🪟 Burbuja flotante activada. Arrástrala, tócala o mantenla presionada.');
    }
  }

  setupSimulatorInteractions(wrapper) {
    const bubble = wrapper.querySelector('#web-overlay-bubble');
    const speedDial = wrapper.querySelector('#web-overlay-speed-dial');
    const quickAdd = wrapper.querySelector('#web-overlay-quick-add');
    const modifyCard = wrapper.querySelector('#web-overlay-modify-card');
    const inputRadius = wrapper.querySelector('#web-overlay-radius');
    const inputModifyRadius = wrapper.querySelector('#web-overlay-modify-radius');

    // Dragging logic
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 20, initialTop = 150;
    let pressTimer = null;
    let isLongPress = false;

    wrapper.style.left = `${initialLeft}px`;
    wrapper.style.top = `${initialTop}px`;

    const onPointerDown = (e) => {
      if (e.target.closest('.web-overlay-card') || e.target.closest('.web-overlay-speed-dial')) return;

      isDragging = false;
      isLongPress = false;
      startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;

      const rect = wrapper.getBoundingClientRect();
      initialLeft = rect.left;
      initialTop = rect.top;

      pressTimer = setTimeout(() => {
        isLongPress = true;
        speedDial.style.display = speedDial.style.display === 'none' ? 'flex' : 'none';
        quickAdd.style.display = 'none';
        modifyCard.style.display = 'none';
        if (navigator.vibrate) navigator.vibrate(50);
      }, 450);

      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    };

    const onPointerMove = (e) => {
      const clientX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
      const clientY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
      const dx = clientX - startX;
      const dy = clientY - startY;

      if (Math.hypot(dx, dy) > 8) {
        isDragging = true;
        clearTimeout(pressTimer);
        wrapper.style.left = `${Math.max(10, Math.min(window.innerWidth - 70, initialLeft + dx))}px`;
        wrapper.style.top = `${Math.max(10, Math.min(window.innerHeight - 70, initialTop + dy))}px`;
      }
    };

    const onPointerUp = () => {
      clearTimeout(pressTimer);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (!isDragging && !isLongPress) {
        // Short Tap!
        if (speedDial.style.display === 'flex') {
          speedDial.style.display = 'none';
        } else if (modifyCard.style.display === 'flex') {
          modifyCard.style.display = 'none';
        } else {
          quickAdd.style.display = quickAdd.style.display === 'none' ? 'block' : 'none';
        }
      }
    };

    bubble.addEventListener('pointerdown', onPointerDown);

    // Preset chips
    wrapper.querySelectorAll('.overlay-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        inputRadius.value = chip.dataset.val;
      });
    });

    // Save New Origin
    wrapper.querySelector('#web-overlay-add-save').addEventListener('click', () => {
      const radius = parseFloat(inputRadius.value) || 500;
      let lat = 19.432608, lng = -99.133209; // Default fallback

      if (window.mapManager && window.mapManager.userLocation) {
        lat = window.mapManager.userLocation.lat;
        lng = window.mapManager.userLocation.lng;
      } else if (window.mapManager && window.mapManager.map) {
        const center = window.mapManager.map.getCenter();
        lat = center.lat;
        lng = center.lng;
      }

      if (window.markersManager) {
        window.markersManager.addOrigin({
          label: `Origen ${window.markersManager.origins.length + 1}`,
          lat,
          lng,
          radius,
          color: '#00e5ff'
        });
        this.refreshMapAndUI(`✓ Origen añadido con radio ${radius}m`);
      }

      quickAdd.style.display = 'none';
    });

    wrapper.querySelector('#web-overlay-add-cancel').addEventListener('click', () => {
      quickAdd.style.display = 'none';
    });

    // Speed Dial Action: Close
    wrapper.querySelector('#web-overlay-btn-close').addEventListener('click', () => {
      this.destroyWebSimulator();
    });

    // Speed Dial Action: Delete Last Origin
    wrapper.querySelector('#web-overlay-btn-delete').addEventListener('click', () => {
      speedDial.style.display = 'none';
      if (window.markersManager && window.markersManager.origins.length > 0) {
        const removed = window.markersManager.origins.pop();
        window.markersManager.saveOrigins();
        this.refreshMapAndUI(`🗑️ Origen "${removed.label}" eliminado`);
      } else if (window.uiManager) {
        window.uiManager.showToast('⚠️ No hay orígenes para eliminar');
      }
    });

    // Speed Dial Action: Modify Origin
    wrapper.querySelector('#web-overlay-btn-modify').addEventListener('click', () => {
      speedDial.style.display = 'none';
      if (!window.markersManager || window.markersManager.origins.length === 0) {
        if (window.uiManager) window.uiManager.showToast('⚠️ No hay orígenes para modificar');
        return;
      }
      const last = window.markersManager.origins[window.markersManager.origins.length - 1];
      inputModifyRadius.value = last.radius || 500;
      modifyCard.style.display = 'block';
    });

    wrapper.querySelector('#web-overlay-modify-save').addEventListener('click', () => {
      const newRadius = parseFloat(inputModifyRadius.value) || 500;
      if (window.markersManager && window.markersManager.origins.length > 0) {
        const lastIdx = window.markersManager.origins.length - 1;
        window.markersManager.origins[lastIdx].radius = newRadius;
        window.markersManager.saveOrigins();
        this.refreshMapAndUI(`✏️ Radio actualizado a ${newRadius}m`);
      }
      modifyCard.style.display = 'none';
    });

    wrapper.querySelector('#web-overlay-modify-cancel').addEventListener('click', () => {
      modifyCard.style.display = 'none';
    });
  }

  destroyWebSimulator() {
    if (this.simulatorEl && this.simulatorEl.parentNode) {
      this.simulatorEl.parentNode.removeChild(this.simulatorEl);
    }
    this.simulatorEl = null;
    this.simulatorActive = false;
    if (window.uiManager) {
      window.uiManager.showToast('Superposición cerrada.');
    }
  }
}

// Instantiate on document load
document.addEventListener('DOMContentLoaded', () => {
  window.overlayManager = new OverlayManager();
});
