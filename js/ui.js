/**
 * GeoTrilateration - UI & Interaction Controller
 * Handles HUD telemetry, forms, modals, toasts, tabs, multimedia and DOM events
 */

class UIController {
  constructor(markersManager, solver, offlineManager, mapController) {
    this.markersManager = markersManager;
    this.solver = solver;
    this.offlineManager = offlineManager;
    this.mapController = mapController;

    this.currentCalculation = null;
    this.selectedCandidateTarget = null;
    this.selectedOriginId = null;
    this.selectedZonePreset = 'managua-core';
    this.customSelectedBounds = null;

    // Modal state for saving/editing
    this.editingTargetId = null;
    this.selectedTargetColor = this.markersManager.presetColors[0].hex;
    this.currentModalMediaList = []; // [{ id, name, type, size, dataUrl }]

    this.initDOMReferences();
    this.restoreSettingsToDOM();
    this.attachEventListeners();
    this.renderOriginsList();
    this.renderSavedTargetsList();
    this.updateStoredPacksList();
    this.updateOfflineEstimate();
  }

  initDOMReferences() {
    // Top Bar
    this.btnNewMeasurement = document.getElementById('btn-new-measurement');
    this.btnGPS = document.getElementById('btn-gps');
    this.btnPresets = document.getElementById('btn-presets');
    this.presetsMenu = document.getElementById('presets-menu');
    this.btnOpenOffline = document.getElementById('btn-open-offline');
    this.btnToggleTheme = document.getElementById('btn-toggle-theme');
    this.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    this.sidebar = document.getElementById('sidebar');

    // Telemetry HUD
    this.telemetryBanner = document.getElementById('telemetry-banner');
    this.statusDot = document.getElementById('status-dot');
    this.solverStatusTitle = document.getElementById('solver-status-title');
    this.solverMessage = document.getElementById('solver-message');
    this.targetCandidatesBox = document.getElementById('target-candidates-box');
    this.candidatesCountBadge = document.getElementById('candidates-count-badge');
    this.candidatesList = document.getElementById('candidates-list');
    this.targetCoordsBox = document.getElementById('target-coordinates-box');
    this.targetCoordsText = document.getElementById('target-coords-text');
    this.targetAccuracyBadge = document.getElementById('target-accuracy-badge');
    this.targetMethodBadge = document.getElementById('target-method-badge');
    this.btnSaveAsTarget = document.getElementById('btn-save-as-target');
    this.btnDismissTarget = document.getElementById('btn-dismiss-target');
    this.btnCopyCoords = document.getElementById('btn-copy-coords');
    this.btnCenterTarget = document.getElementById('btn-center-target');
    this.btnMinimizeHUD = document.getElementById('btn-minimize-hud');

    // Quick Action Bar & Layer Visibility Toggles
    this.btnAddOriginMode = document.getElementById('btn-add-origin-mode');
    this.btnQuickNew = document.getElementById('btn-quick-new');
    this.btnClearOrigins = document.getElementById('btn-clear-origins');
    this.btnToggleVisCircles = document.getElementById('btn-toggle-vis-circles');
    this.btnToggleVisOrigins = document.getElementById('btn-toggle-vis-origins');
    this.btnToggleVisTargets = document.getElementById('btn-toggle-vis-targets');
    this.btnFitBounds = document.getElementById('btn-fit-bounds');
    this.btnToggleLayers = document.getElementById('btn-toggle-layers');

    // Tabs
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.originCountEl = document.getElementById('origin-count');
    this.savedCountEl = document.getElementById('saved-count');

    // Add / Edit Origin Form
    this.originFormHeading = document.getElementById('origin-form-heading');
    this.originFormBadge = document.getElementById('origin-form-badge');
    this.btnCancelEditOrigin = document.getElementById('btn-cancel-edit-origin');
    this.inputEditingOriginId = document.getElementById('input-editing-origin-id');
    this.btnSubmitOriginText = document.getElementById('btn-submit-origin-text');
    this.inputOriginLabel = document.getElementById('input-origin-label');
    this.inputOriginDistance = document.getElementById('input-origin-distance');
    this.selectOriginUnit = document.getElementById('select-origin-unit');
    this.inputOriginLat = document.getElementById('input-origin-lat');
    this.inputOriginLng = document.getElementById('input-origin-lng');
    this.btnSubmitOrigin = document.getElementById('btn-submit-origin');
    this.btnUseMapCenter = document.getElementById('btn-use-map-center');
    this.originsList = document.getElementById('origins-list');
    this.originsHelperText = document.getElementById('origins-helper-text');

    // Saved Targets & Color Filter Bar
    this.inputSearchSaved = document.getElementById('input-search-saved');
    this.savedColorFilters = document.getElementById('saved-color-filters');
    this.savedMarkersList = document.getElementById('saved-markers-list');
    this.btnExportGeoJSON = document.getElementById('btn-export-geojson');

    // Settings
    this.selectEarthModel = document.getElementById('select-earth-model');
    this.inputSolverTolerance = document.getElementById('input-solver-tolerance');
    this.checkShowIntersections = document.getElementById('check-show-intersections');
    this.checkShowCircleFill = document.getElementById('check-show-circle-fill');
    this.btnExportJSON = document.getElementById('btn-export-json');
    this.btnImportJSONTrigger = document.getElementById('btn-import-json-trigger');
    this.inputImportFile = document.getElementById('input-import-file');
    this.btnResetAllData = document.getElementById('btn-reset-all-data');

    // Offline Modal
    this.modalOffline = document.getElementById('modal-offline');
    this.btnCloseOfflineModal = document.getElementById('btn-close-offline-modal');
    this.presetCards = document.querySelectorAll('.preset-card');
    this.selectZoomMin = document.getElementById('select-zoom-min');
    this.selectZoomMax = document.getElementById('select-zoom-max');
    this.estimateTileCount = document.getElementById('estimate-tile-count');
    this.estimateStorageSize = document.getElementById('estimate-storage-size');
    this.currentCachedCount = document.getElementById('current-cached-count');
    this.downloadProgressWrap = document.getElementById('download-progress-wrap');
    this.downloadProgressStatus = document.getElementById('download-progress-status');
    this.downloadProgressPercent = document.getElementById('download-progress-percent');
    this.downloadProgressFill = document.getElementById('download-progress-fill');
    this.btnStartDownload = document.getElementById('btn-start-download');
    this.btnCancelDownload = document.getElementById('btn-cancel-download');
    this.btnClearTileCache = document.getElementById('btn-clear-tile-cache');
    this.storedPacksList = document.getElementById('stored-packs-list');

    // Save / Edit Target Modal
    this.modalSaveTarget = document.getElementById('modal-save-target');
    this.modalTargetTitle = document.getElementById('modal-target-title');
    this.targetEditIdInput = document.getElementById('target-edit-id');
    this.btnCloseSaveTargetModal = document.getElementById('btn-close-save-target-modal');
    this.btnCancelSaveTarget = document.getElementById('btn-cancel-save-target');
    this.btnConfirmSaveTarget = document.getElementById('btn-confirm-save-target');
    this.btnDeleteFromModal = document.getElementById('btn-delete-from-modal');
    this.targetNameInput = document.getElementById('target-name-input');
    this.targetCategoryInput = document.getElementById('target-category-input');
    this.targetColorSwatches = document.querySelectorAll('.swatch-btn');
    this.btnToggleCustomColor = document.getElementById('btn-toggle-custom-color');
    this.customColorWrap = document.getElementById('custom-color-wrap');
    this.targetColorInput = document.getElementById('target-color-input');
    this.targetModalAccuracy = document.getElementById('target-modal-accuracy');
    this.targetModalLat = document.getElementById('target-modal-lat');
    this.targetModalLng = document.getElementById('target-modal-lng');
    this.targetDescInput = document.getElementById('target-desc-input');
    this.targetMediaInput = document.getElementById('target-media-input');
    this.targetMediaPreviewContainer = document.getElementById('target-media-preview-container');
    this.btnPasteMedia = document.getElementById('btn-paste-media');

    // Quick Origin Modal (Floating on Map Click)
    this.modalQuickOrigin = document.getElementById('modal-quick-origin');
    this.modalOriginTitle = document.getElementById('modal-origin-title');
    this.formQuickOrigin = document.getElementById('form-quick-origin');
    this.modalOriginLabel = document.getElementById('modal-origin-label');
    this.modalOriginDistance = document.getElementById('modal-origin-distance');
    this.modalOriginUnit = document.getElementById('modal-origin-unit');
    this.modalOriginLat = document.getElementById('modal-origin-lat');
    this.modalOriginLng = document.getElementById('modal-origin-lng');
    this.modalOriginNotes = document.getElementById('modal-origin-notes');
    this.btnConfirmModalOrigin = document.getElementById('btn-confirm-modal-origin');
    this.btnCancelModalOrigin = document.getElementById('btn-cancel-modal-origin');
    this.btnCloseOriginModal = document.getElementById('btn-close-origin-modal');

    // Sidebar Controls
    this.btnSidebarCollapse = document.getElementById('btn-sidebar-collapse');
    this.sidebarCollapseIcon = document.getElementById('sidebar-collapse-icon');
    this.btnCloseSidebar = document.getElementById('btn-close-sidebar');

    // Custom Coords Modal
    this.modalCustomCoords = document.getElementById('modal-custom-coords');
    this.btnCloseCoordsModal = document.getElementById('btn-close-coords-modal');
    this.btnCancelJump = document.getElementById('btn-cancel-jump');
    this.btnConfirmJump = document.getElementById('btn-confirm-jump');
    this.btnCustomCoords = document.getElementById('btn-custom-coords');
    this.inputJumpLat = document.getElementById('input-jump-lat');
    this.inputJumpLng = document.getElementById('input-jump-lng');

    // Toast Container
    this.toastContainer = document.getElementById('toast-container');
  }

  restoreSettingsToDOM() {
    const s = this.markersManager.settings;
    if (!s) return;
    if (this.selectEarthModel && s.earthModel) {
      this.selectEarthModel.value = s.earthModel;
    }
    if (this.inputSolverTolerance && s.solverTolerance !== undefined) {
      this.inputSolverTolerance.value = s.solverTolerance;
    }
    if (this.checkShowIntersections && s.showIntersections !== undefined) {
      this.checkShowIntersections.checked = s.showIntersections;
    }
    if (this.checkShowCircleFill && s.showCircleFill !== undefined) {
      this.checkShowCircleFill.checked = s.showCircleFill;
    }

    // Set initial visibility button state
    if (this.btnToggleVisCircles && s.showCircles === false) {
      this.btnToggleVisCircles.classList.add('disabled-toggle');
      this.mapController.setLayerVisibility('circles', false);
    }
    if (this.btnToggleVisOrigins && s.showOrigins === false) {
      this.btnToggleVisOrigins.classList.add('disabled-toggle');
      this.mapController.setLayerVisibility('origins', false);
    }
    if (this.btnToggleVisTargets && s.showSavedTargets === false) {
      this.btnToggleVisTargets.classList.add('disabled-toggle');
      this.mapController.setLayerVisibility('savedTargets', false);
    }
  }

  attachEventListeners() {
    // New Measurement Session
    const triggerNewMeasurement = () => {
      if (this.markersManager.origins.length > 0) {
        if (confirm('¿Deseas iniciar una nueva medición? Se limpiarán los puntos de origen actuales (tus puntos guardados se conservarán).')) {
          this.markersManager.clearOrigins();
          this.refreshCalculations();
          this.showToast('Nueva sesión de medición iniciada.', 'success');
        }
      } else {
        this.showToast('Sesión limpia. Agrega un punto para iniciar.', 'info');
      }
    };

    if (this.btnNewMeasurement) this.btnNewMeasurement.addEventListener('click', triggerNewMeasurement);
    if (this.btnQuickNew) this.btnQuickNew.addEventListener('click', triggerNewMeasurement);

    // Visibility Clean-up Toggles
    if (this.btnToggleVisCircles) {
      this.btnToggleVisCircles.addEventListener('click', () => {
        const isCurrentlyHidden = this.btnToggleVisCircles.classList.toggle('disabled-toggle');
        const show = !isCurrentlyHidden;
        this.markersManager.settings.showCircles = show;
        this.markersManager.saveToStorage();
        this.mapController.setLayerVisibility('circles', show);
        this.showToast(show ? 'Circunferencias visibles' : 'Circunferencias ocultas', 'info');
      });
    }

    if (this.btnToggleVisOrigins) {
      this.btnToggleVisOrigins.addEventListener('click', () => {
        const isCurrentlyHidden = this.btnToggleVisOrigins.classList.toggle('disabled-toggle');
        const show = !isCurrentlyHidden;
        this.markersManager.settings.showOrigins = show;
        this.markersManager.saveToStorage();
        this.mapController.setLayerVisibility('origins', show);
        this.showToast(show ? 'Orígenes de medición visibles' : 'Orígenes ocultos', 'info');
      });
    }

    if (this.btnToggleVisTargets) {
      this.btnToggleVisTargets.addEventListener('click', () => {
        const isCurrentlyHidden = this.btnToggleVisTargets.classList.toggle('disabled-toggle');
        const show = !isCurrentlyHidden;
        this.markersManager.settings.showSavedTargets = show;
        this.markersManager.saveToStorage();
        this.mapController.setLayerVisibility('savedTargets', show);
        this.showToast(show ? 'Puntos guardados visibles' : 'Puntos guardados ocultos', 'info');
      });
    }

    // Layer Switcher
    if (this.btnToggleLayers) {
      this.btnToggleLayers.addEventListener('click', () => {
        const layerName = this.mapController.cycleBaseLayer();
        this.showToast(`Capa de mapa: ${layerName}`, 'info');
      });
    }

    // Mathematical Settings changes
    if (this.selectEarthModel) {
      this.selectEarthModel.addEventListener('change', (e) => {
        this.markersManager.settings.earthModel = e.target.value;
        this.markersManager.saveToStorage();
        this.refreshCalculations();
        this.showToast('Modelo de Tierra actualizado.', 'info');
      });
    }

    if (this.inputSolverTolerance) {
      this.inputSolverTolerance.addEventListener('change', (e) => {
        const val = parseFloat(e.target.value);
        if (!isNaN(val) && val > 0) {
          this.markersManager.settings.solverTolerance = val;
          this.solver.tolerance = val;
          this.markersManager.saveToStorage();
          this.refreshCalculations();
          this.showToast(`Tolerancia de cálculo: ±${val} m`, 'info');
        }
      });
    }

    // Tab Navigation
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Theme Toggle
    this.btnToggleTheme.addEventListener('click', () => {
      const html = document.documentElement;
      const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      html.setAttribute('data-theme', newTheme);
      this.markersManager.settings.theme = newTheme;
      this.markersManager.saveToStorage();
    });

    // Sidebar Toggle & Collapse Drawer
    if (this.btnToggleSidebar) {
      this.btnToggleSidebar.addEventListener('click', () => this.toggleSidebar());
    }
    if (this.btnSidebarCollapse) {
      this.btnSidebarCollapse.addEventListener('click', () => this.toggleSidebar());
    }
    if (this.btnCloseSidebar) {
      this.btnCloseSidebar.addEventListener('click', () => this.toggleSidebar(true));
    }

    // Quick Origin Modal Events
    if (this.formQuickOrigin) {
      this.formQuickOrigin.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleConfirmQuickOrigin();
      });
    }
    if (this.btnConfirmModalOrigin) {
      this.btnConfirmModalOrigin.addEventListener('click', () => this.handleConfirmQuickOrigin());
    }
    if (this.btnCancelModalOrigin) {
      this.btnCancelModalOrigin.addEventListener('click', () => {
        if (this.modalQuickOrigin) this.modalQuickOrigin.classList.add('hidden');
      });
    }
    if (this.btnCloseOriginModal) {
      this.btnCloseOriginModal.addEventListener('click', () => {
        if (this.modalQuickOrigin) this.modalQuickOrigin.classList.add('hidden');
      });
    }

    // Presets Dropdown
    this.btnPresets.addEventListener('click', (e) => {
      e.stopPropagation();
      this.btnPresets.parentElement.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      this.btnPresets.parentElement.classList.remove('open');
    });

    document.querySelectorAll('.dropdown-item[data-lat]').forEach(item => {
      item.addEventListener('click', () => {
        const lat = parseFloat(item.getAttribute('data-lat'));
        const lng = parseFloat(item.getAttribute('data-lng'));
        const zoom = parseInt(item.getAttribute('data-zoom'), 10) || 14;
        this.mapController.setView(lat, lng, zoom);
        this.showToast(`Navegando a ${item.innerText.trim()}`, 'info');
      });
    });

    // Custom Coordinates Jump
    this.btnCustomCoords.addEventListener('click', () => {
      this.modalCustomCoords.classList.remove('hidden');
    });
    this.btnCloseCoordsModal.addEventListener('click', () => this.modalCustomCoords.classList.add('hidden'));
    this.btnCancelJump.addEventListener('click', () => this.modalCustomCoords.classList.add('hidden'));
    this.btnConfirmJump.addEventListener('click', () => {
      const lat = parseFloat(this.inputJumpLat.value);
      const lng = parseFloat(this.inputJumpLng.value);
      if (isNaN(lat) || isNaN(lng)) {
        this.showToast('Por favor introduce coordenadas válidas.', 'error');
        return;
      }
      this.mapController.setView(lat, lng, 14);
      this.modalCustomCoords.classList.add('hidden');
      this.showToast(`Centrado en [${lat.toFixed(4)}, ${lng.toFixed(4)}]`, 'info');
    });

    // GPS Geolocation
    this.btnGPS.addEventListener('click', () => {
      if (!navigator.geolocation) {
        this.showToast('Geolocalización no soportada en este navegador.', 'error');
        return;
      }
      this.showToast('Obteniendo ubicación GPS...', 'info');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          this.mapController.setView(latitude, longitude, 15);
          this.inputOriginLat.value = latitude.toFixed(6);
          this.inputOriginLng.value = longitude.toFixed(6);
          this.showToast('Ubicación GPS encontrada y cargada.', 'success');
        },
        (err) => {
          this.showToast(`Error GPS: ${err.message}`, 'error');
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

    // Add Origin Button & Mode
    this.btnAddOriginMode.addEventListener('click', () => {
      const isNow = !this.mapController.isAddingOriginMode;
      this.mapController.setAddOriginMode(isNow);
      if (isNow) {
        this.btnAddOriginMode.classList.add('btn-warning');
        this.showToast('Haz clic en el mapa donde quieras ubicar el origen.', 'info');
      } else {
        this.btnAddOriginMode.classList.remove('btn-warning');
      }
    });

    this.btnUseMapCenter.addEventListener('click', () => {
      const center = this.mapController.getCenter();
      this.inputOriginLat.value = center.lat.toFixed(6);
      this.inputOriginLng.value = center.lng.toFixed(6);
      this.showToast('Coordenadas del centro de mapa cargadas.', 'info');
    });

    // Clear All Origins
    this.btnClearOrigins.addEventListener('click', () => {
      if (this.markersManager.origins.length === 0) return;
      if (confirm('¿Deseas limpiar todos los puntos de origen actuales?')) {
        this.markersManager.clearOrigins();
        this.refreshCalculations();
        this.showToast('Orígenes limpiados.', 'info');
      }
    });

    // Fit Bounds
    this.btnFitBounds.addEventListener('click', () => {
      const target = this.currentCalculation && this.currentCalculation.target
        ? this.currentCalculation.target
        : null;
      const bounds = this.mapController.getAllBounds(this.markersManager.origins, target);
      if (bounds) {
        this.mapController.fitBounds(bounds);
      } else {
        this.showToast('No hay elementos suficientes para ajustar la vista.', 'info');
      }
    });

    // Cancel Edit Origin in Form
    if (this.btnCancelEditOrigin) {
      this.btnCancelEditOrigin.addEventListener('click', () => {
        this.resetOriginForm();
        this.showToast('Edición cancelada.', 'info');
      });
    }

    // Origin Form Submit
    if (this.btnSubmitOrigin) {
      this.btnSubmitOrigin.addEventListener('click', () => {
        this.handleOriginSubmit();
      });
    }

    // Minimize HUD
    this.btnMinimizeHUD.addEventListener('click', () => {
      this.telemetryBanner.classList.toggle('minimized');
    });

    // Copy Coords
    this.btnCopyCoords.addEventListener('click', () => {
      if (this.currentCalculation && this.currentCalculation.target) {
        const text = `${this.currentCalculation.target.lat.toFixed(6)}, ${this.currentCalculation.target.lng.toFixed(6)}`;
        navigator.clipboard.writeText(text);
        this.showToast('Coordenadas copiadas al portapapeles.', 'success');
      }
    });

    // Center Target
    this.btnCenterTarget.addEventListener('click', () => {
      if (this.currentCalculation && this.currentCalculation.target) {
        this.mapController.setView(
          this.currentCalculation.target.lat,
          this.currentCalculation.target.lng,
          15
        );
      }
    });

    // Save as Target Button (Opens Modal in Create Mode)
    this.btnSaveAsTarget.addEventListener('click', () => {
      if (!this.currentCalculation || !this.currentCalculation.target) return;
      this.openCreateTargetModal(this.currentCalculation.target);
    });

    // Dismiss Estimated Target Button
    if (this.btnDismissTarget) {
      this.btnDismissTarget.addEventListener('click', () => {
        this.dismissEstimatedTarget();
      });
    }

    // Delete from Modal Button
    if (this.btnDeleteFromModal) {
      this.btnDeleteFromModal.addEventListener('click', () => {
        if (this.editingTargetId) {
          const target = this.markersManager.getTargetById(this.editingTargetId);
          this.handleDeleteTarget(this.editingTargetId, target ? target.name : '');
          this.modalSaveTarget.classList.add('hidden');
        }
      });
    }

    // Form Save Target Submit
    const formSaveTarget = document.getElementById('form-save-target');
    if (formSaveTarget) {
      formSaveTarget.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleConfirmSaveOrEditTarget();
      });
    }

    // Modal Preset Swatches
    this.targetColorSwatches.forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        this.selectColorInModal(color);
      });
    });

    // Toggle Custom Color Picker
    this.btnToggleCustomColor.addEventListener('click', () => {
      this.customColorWrap.classList.toggle('hidden');
    });

    this.targetColorInput.addEventListener('input', (e) => {
      this.selectColorInModal(e.target.value);
    });

    // Media File Attachments Input
    this.targetMediaInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      if (files.length === 0) return;
      await this.processAndAttachMediaFiles(files, 'archivo');
      this.targetMediaInput.value = '';
    });

    // Paste from Clipboard Button
    if (this.btnPasteMedia) {
      this.btnPasteMedia.addEventListener('click', async () => {
        try {
          if (navigator.clipboard && navigator.clipboard.read) {
            const clipboardItems = await navigator.clipboard.read();
            const files = [];
            for (const item of clipboardItems) {
              for (const type of item.types) {
                if (type.startsWith('image/') || type.startsWith('video/')) {
                  const blob = await item.getType(type);
                  const ext = type.split('/')[1] || 'png';
                  const fileObj = new File([blob], `Captura_${new Date().toLocaleTimeString().replace(/:/g, '-')}.${ext}`, { type });
                  files.push(fileObj);
                }
              }
            }
            if (files.length > 0) {
              await this.processAndAttachMediaFiles(files, 'portapapeles');
              return;
            }
          }
          this.showToast('Presiona Ctrl + V para pegar la imagen o archivo copiado.', 'info');
        } catch (err) {
          this.showToast('Presiona Ctrl + V en tu teclado para pegar.', 'info');
        }
      });
    }

    // Window Paste Listener (Ctrl + V for photos/videos directly into Modal)
    window.addEventListener('paste', async (e) => {
      if (!this.modalSaveTarget || this.modalSaveTarget.classList.contains('hidden')) {
        return;
      }

      const items = (e.clipboardData || window.clipboardData)?.items;
      if (!items) return;

      const files = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' || item.type.startsWith('image/') || item.type.startsWith('video/')) {
          const file = item.getAsFile();
          if (file) {
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault();
        await this.processAndAttachMediaFiles(files, 'portapapeles (Ctrl+V)');
      }
    });

    // Drag & Drop onto Media Preview Container
    if (this.targetMediaPreviewContainer) {
      ['dragenter', 'dragover'].forEach(eventName => {
        this.targetMediaPreviewContainer.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.targetMediaPreviewContainer.classList.add('drag-active');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        this.targetMediaPreviewContainer.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.targetMediaPreviewContainer.classList.remove('drag-active');
        });
      });

      this.targetMediaPreviewContainer.addEventListener('drop', async (e) => {
        const dt = e.dataTransfer;
        const files = dt ? Array.from(dt.files) : [];
        if (files.length > 0) {
          await this.processAndAttachMediaFiles(files, 'arrastrar y soltar');
        }
      });
    }

    // Close / Cancel Target Modal
    this.btnCloseSaveTargetModal.addEventListener('click', () => {
      this.editingTargetId = null;
      if (this.targetEditIdInput) this.targetEditIdInput.value = '';
      this.modalSaveTarget.classList.add('hidden');
    });
    this.btnCancelSaveTarget.addEventListener('click', () => {
      this.editingTargetId = null;
      if (this.targetEditIdInput) this.targetEditIdInput.value = '';
      this.modalSaveTarget.classList.add('hidden');
    });

    // Confirm Save or Edit Target
    this.btnConfirmSaveTarget.addEventListener('click', () => {
      this.handleConfirmSaveOrEditTarget();
    });

    // Search Saved Targets
    this.inputSearchSaved.addEventListener('input', (e) => {
      this.filterSavedTargetsList();
    });

    // Global Keyboard Shortcuts (Ctrl + ArrowUp / ArrowDown to reorder origins)
    window.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') {
        return;
      }

      if ((e.ctrlKey || e.altKey) && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const origins = this.markersManager.origins;
        if (origins.length < 2) return;

        if (!this.selectedOriginId && origins.length > 0) {
          this.selectedOriginId = origins[0].id;
        }

        const direction = e.key === 'ArrowUp' ? -1 : 1;
        const currentOrigin = origins.find(o => String(o.id) === String(this.selectedOriginId));
        const moved = this.markersManager.moveOrigin(this.selectedOriginId, direction);

        if (moved) {
          e.preventDefault();
          this.refreshCalculations();
          const name = currentOrigin ? currentOrigin.label : 'Punto';
          this.showToast(`${direction === -1 ? '⬆️' : '⬇️'} ${name} reordenado ${direction === -1 ? 'arriba' : 'abajo'} (Ctrl+${direction === -1 ? '▲' : '▼'}).`, 'info');
        }
      }
    });

    // Color Filter Bar for Saved Targets
    if (this.savedColorFilters) {
      this.savedColorFilters.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          this.savedColorFilters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const colorAttr = btn.getAttribute('data-color');
          const colorFilter = colorAttr === 'all' ? null : colorAttr;
          this.markersManager.setColorFilter(colorFilter);

          this.renderSavedTargetsList();
          this.mapController.renderSavedTargets(
            this.markersManager.getFilteredTargets(),
            (id) => this.openEditTargetModal(id)
          );

          if (colorFilter) {
            this.showToast(`Filtrado por color seleccionado.`, 'info');
          } else {
            this.showToast(`Mostrando todos los marcadores.`, 'info');
          }
        });
      });
    }

    // Export GeoJSON / KML
    this.btnExportGeoJSON.addEventListener('click', () => {
      const geojson = this.markersManager.exportGeoJSON();
      this.downloadFile(geojson, 'geotrilateracion_puntos.geojson', 'application/geo+json');
      this.showToast('GeoJSON exportado con éxito.', 'success');
    });

    this.btnExportJSON.addEventListener('click', () => {
      const json = this.markersManager.exportJSON();
      this.downloadFile(json, 'geotrilateracion_backup.json', 'application/json');
      this.showToast('Copia de seguridad JSON descargada.', 'success');
    });

    this.btnImportJSONTrigger.addEventListener('click', () => {
      this.inputImportFile.click();
    });

    this.inputImportFile.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const res = this.markersManager.importJSON(ev.target.result);
        if (res.success) {
          this.refreshCalculations();
          this.renderSavedTargetsList();
          this.mapController.renderSavedTargets(
            this.markersManager.getFilteredTargets(),
            (id) => this.openEditTargetModal(id)
          );
          this.showToast(`Importación exitosa (${res.count} elementos).`, 'success');
        } else {
          this.showToast(`Error al importar: ${res.error}`, 'error');
        }
      };
      reader.readAsText(file);
    });

    this.btnResetAllData.addEventListener('click', () => {
      if (confirm('¿Estás seguro de que deseas borrar TODOS los orígenes y marcadores guardados? Esta acción es irreversible.')) {
        this.markersManager.clearAllData();
        this.refreshCalculations();
        this.renderSavedTargetsList();
        this.mapController.renderSavedTargets([]);
        this.showToast('Todos los datos locales han sido borrados.', 'info');
      }
    });

    // Checkbox toggles
    this.checkShowIntersections.addEventListener('change', (e) => {
      this.markersManager.settings.showIntersections = e.target.checked;
      this.markersManager.saveToStorage();
      this.refreshCalculations();
    });

    this.checkShowCircleFill.addEventListener('change', (e) => {
      this.markersManager.settings.showCircleFill = e.target.checked;
      this.markersManager.saveToStorage();
      this.mapController.renderOrigins(this.markersManager.origins, e.target.checked);
    });

    // Offline Modal Triggers
    this.btnOpenOffline.addEventListener('click', () => {
      this.modalOffline.classList.remove('hidden');
      this.updateOfflineEstimate();
      this.updateStoredPacksList();
    });

    this.btnCloseOfflineModal.addEventListener('click', () => {
      this.modalOffline.classList.add('hidden');
      this.mapController.clearSelectionBox();
    });

    this.presetCards.forEach(card => {
      card.addEventListener('click', () => {
        this.presetCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedZonePreset = card.getAttribute('data-zone');

        if (this.selectedZonePreset === 'custom-box') {
          this.modalOffline.classList.add('hidden');
          this.showToast('Haz clic y arrastra en el mapa para delimitar el área a descargar.', 'info');
          this.mapController.startBoxSelection();
        } else {
          this.mapController.clearSelectionBox();
          this.updateOfflineEstimate();
        }
      });
    });

    this.selectZoomMin.addEventListener('change', () => this.updateOfflineEstimate());
    this.selectZoomMax.addEventListener('change', () => this.updateOfflineEstimate());

    this.btnStartDownload.addEventListener('click', () => {
      this.handleStartOfflineDownload();
    });

    this.btnCancelDownload.addEventListener('click', () => {
      this.offlineManager.cancelDownload();
      this.showToast('Descarga cancelada.', 'info');
    });

    this.btnClearTileCache.addEventListener('click', async () => {
      if (confirm('¿Deseas vaciar todas las teselas de mapas almacenadas en la memoria local?')) {
        await this.offlineManager.clearAllTiles();
        this.updateStoredPacksList();
        this.updateOfflineEstimate();
        this.showToast('Caché de mapas vaciada.', 'info');
      }
    });
  }

  /**
   * Process and attach media files from file picker, clipboard paste, or drag-and-drop
   */
  async processAndAttachMediaFiles(files, sourceDesc = 'archivos') {
    if (!files || files.length === 0) return;
    this.showToast(`Procesando ${files.length} archivo(s)...`, 'info');

    let count = 0;
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isVideo = file.type.startsWith('video/');
      if (!isImage && !isVideo) continue;

      const mediaId = `media_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const fileName = file.name || (isImage ? `Captura_${new Date().toLocaleTimeString().replace(/:/g, '-')}.png` : `Video_${Date.now()}.mp4`);

      if (isVideo) {
        await this.offlineManager.saveMedia({
          id: mediaId,
          name: fileName,
          type: file.type || 'video/mp4',
          size: file.size,
          blob: file,
          createdAt: new Date().toISOString()
        });

        this.currentModalMediaList.push({
          id: mediaId,
          name: fileName,
          type: file.type || 'video/mp4',
          size: file.size,
          isVideo: true
        });
      } else {
        const dataUrl = await this.fileToDataUrl(file);
        await this.offlineManager.saveMedia({
          id: mediaId,
          name: fileName,
          type: file.type || 'image/png',
          size: file.size,
          dataUrl,
          createdAt: new Date().toISOString()
        });

        this.currentModalMediaList.push({
          id: mediaId,
          name: fileName,
          type: file.type || 'image/png',
          size: file.size,
          dataUrl
        });
      }
      count++;
    }

    if (count > 0) {
      this.renderModalMediaPreviews();
      this.showToast(`📎 ${count} ${count === 1 ? 'archivo adjuntado' : 'archivos adjuntados'} (${sourceDesc}).`, 'success');
    }
  }

  fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(e);
      reader.readAsDataURL(file);
    });
  }

  dismissEstimatedTarget() {
    this.selectedCandidateTarget = null;
    this.mapController.renderTarget(null);
    this.targetCoordsBox.classList.add('hidden');
    if (this.targetCandidatesBox) {
      this.targetCandidatesBox.classList.add('hidden');
    }
    this.currentCalculation = null;
    this.statusDot.className = 'pulse-dot';
    this.solverStatusTitle.innerText = 'Estimación Descartada';
    this.solverMessage.innerHTML = 'Has descartado la estimación actual. Modifica o agrega orígenes para recalcular.';
    this.showToast('Estimación del objetivo descartada del mapa.', 'info');
  }

  selectCandidateTarget(candidatePoint, idx) {
    const isTang = candidatePoint.isTangent;
    const isApprox = candidatePoint.isApproximate;
    const nameLabel = isTang ? 'Tangente' : (isApprox ? 'Aproximado' : `Candidato ${idx !== undefined ? idx + 1 : ''}`);

    const targetObj = {
      lat: candidatePoint.lat,
      lng: candidatePoint.lng,
      accuracyMeters: candidatePoint.gap || 0,
      isCandidate: true,
      notes: `Punto encontrado con 2 orígenes (${nameLabel})`
    };

    this.selectedCandidateTarget = targetObj;
    if (this.currentCalculation) {
      this.currentCalculation.target = targetObj;
    }

    this.mapController.renderTarget(targetObj);
    this.updateTelemetryHUD(this.currentCalculation);
    this.showToast(`🎯 ${nameLabel} fijado como objetivo. Ahora puedes guardarlo con el botón "Guardar".`, 'success');
  }

  handleDeleteTarget(id, name = '') {
    if (confirm(`¿Deseas eliminar ${name ? `"${name}"` : 'este marcador'}?`)) {
      this.markersManager.removeTarget(id);
      this.renderSavedTargetsList();
      this.mapController.renderSavedTargets(
        this.markersManager.getFilteredTargets(),
        (tid) => this.openEditTargetModal(tid),
        (tid, tname) => this.handleDeleteTarget(tid, tname)
      );
      this.showToast(`Marcador eliminado.`, 'info');
    }
  }

  /**
   * Toggle Sidebar drawer visibility and invalidate map size smoothly
   */
  toggleSidebar(forceState) {
    if (forceState !== undefined) {
      if (forceState) {
        this.sidebar.classList.add('closed');
      } else {
        this.sidebar.classList.remove('closed');
      }
    } else {
      this.sidebar.classList.toggle('closed');
    }

    const isClosed = this.sidebar.classList.contains('closed');
    if (this.sidebarCollapseIcon) {
      this.sidebarCollapseIcon.innerText = isClosed ? '◀' : '▶';
    }
    if (this.btnSidebarCollapse) {
      this.btnSidebarCollapse.title = isClosed ? 'Desplegar Panel Lateral' : 'Ocultar Panel Lateral';
    }

    setTimeout(() => {
      if (this.mapController && this.mapController.map) {
        this.mapController.map.invalidateSize();
      }
    }, 320);
  }

  /**
   * Open Quick Add Origin Modal when clicking on the map
   */
  openAddOriginModal(latlng) {
    if (!latlng) return;
    const defaultLabel = `Origen ${this.markersManager.origins.length + 1}`;
    if (this.modalOriginLabel) this.modalOriginLabel.value = defaultLabel;
    if (this.modalOriginLat) this.modalOriginLat.value = (typeof latlng.lat === 'number') ? latlng.lat.toFixed(6) : latlng.lat;
    if (this.modalOriginLng) this.modalOriginLng.value = (typeof latlng.lng === 'number') ? latlng.lng.toFixed(6) : latlng.lng;
    if (this.modalOriginDistance) this.modalOriginDistance.value = '';
    if (this.modalOriginNotes) this.modalOriginNotes.value = '';

    // Also sync sidebar input fields in case user opens sidebar
    if (this.inputOriginLat) this.inputOriginLat.value = (typeof latlng.lat === 'number') ? latlng.lat.toFixed(6) : latlng.lat;
    if (this.inputOriginLng) this.inputOriginLng.value = (typeof latlng.lng === 'number') ? latlng.lng.toFixed(6) : latlng.lng;
    if (this.inputOriginLabel) this.inputOriginLabel.value = defaultLabel;

    if (this.modalQuickOrigin) {
      this.modalQuickOrigin.classList.remove('hidden');
    }

    setTimeout(() => {
      if (this.modalOriginDistance) {
        this.modalOriginDistance.focus();
        this.modalOriginDistance.select();
      }
    }, 120);
  }

  /**
   * Confirm Quick Add Origin Modal Form
   */
  handleConfirmQuickOrigin() {
    const lat = parseFloat(this.modalOriginLat.value);
    const lng = parseFloat(this.modalOriginLng.value);
    const rawDistance = parseFloat(this.modalOriginDistance.value);
    const unit = this.modalOriginUnit ? this.modalOriginUnit.value : 'm';
    const label = this.modalOriginLabel.value.trim() || `Origen ${this.markersManager.origins.length + 1}`;
    const notes = this.modalOriginNotes ? this.modalOriginNotes.value.trim() : '';

    if (isNaN(lat) || isNaN(lng)) {
      this.showToast('Coordenadas de origen inválidas.', 'error');
      return;
    }

    if (isNaN(rawDistance) || rawDistance <= 0) {
      this.showToast('Introduce una distancia válida mayor a cero.', 'error');
      if (this.modalOriginDistance) this.modalOriginDistance.focus();
      return;
    }

    const origin = this.markersManager.addOrigin({
      label,
      lat,
      lng,
      distance: rawDistance,
      unit,
      notes
    });

    if (this.modalQuickOrigin) {
      this.modalQuickOrigin.classList.add('hidden');
    }

    this.refreshCalculations();
    this.showToast(`📍 "${origin.label}" agregado (${rawDistance} ${unit}).`, 'success');
  }

  /**
   * Handle Submission of Origin from the Top Form Card
   */
  handleOriginSubmit() {
    const lat = parseFloat(this.inputOriginLat.value);
    const lng = parseFloat(this.inputOriginLng.value);
    const rawDistance = parseFloat(this.inputOriginDistance.value);
    const unit = this.selectOriginUnit ? this.selectOriginUnit.value : 'm';
    const label = this.inputOriginLabel.value.trim() || `Origen ${this.markersManager.origins.length + 1}`;
    const editingId = this.inputEditingOriginId ? this.inputEditingOriginId.value : null;

    if (isNaN(lat) || isNaN(lng)) {
      this.showToast('Por favor introduce coordenadas válidas (Latitud y Longitud).', 'error');
      return;
    }

    if (isNaN(rawDistance) || rawDistance <= 0) {
      this.showToast('Por favor introduce una distancia válida mayor a 0.', 'error');
      if (this.inputOriginDistance) this.inputOriginDistance.focus();
      return;
    }

    if (editingId) {
      // Update existing origin
      const updated = this.markersManager.updateOrigin(editingId, {
        label,
        lat,
        lng,
        distance: rawDistance,
        rawDistance,
        unit
      });

      if (updated) {
        this.showToast(`✅ "${label}" actualizado con éxito.`, 'success');
      } else {
        this.showToast('No se encontró el origen para actualizar.', 'error');
      }
      this.resetOriginForm();
    } else {
      // Add new origin
      const origin = this.markersManager.addOrigin({
        label,
        lat,
        lng,
        distance: rawDistance,
        unit
      });
      this.showToast(`📍 "${origin.label}" agregado correctamente.`, 'success');
      this.resetOriginForm();
    }

    this.refreshCalculations();
  }

  /**
   * Load an origin's data into the top form for editing
   */
  loadOriginIntoForm(originId) {
    const origin = this.markersManager.origins.find(o => String(o.id) === String(originId));
    if (!origin) return;

    this.selectedOriginId = origin.id;
    if (this.inputOriginLabel) this.inputOriginLabel.value = origin.label || '';
    if (this.inputOriginDistance) this.inputOriginDistance.value = origin.rawDistance !== undefined ? origin.rawDistance : origin.distance;
    if (this.selectOriginUnit) this.selectOriginUnit.value = origin.unit || 'm';
    if (this.inputOriginLat) this.inputOriginLat.value = origin.lat.toFixed(6);
    if (this.inputOriginLng) this.inputOriginLng.value = origin.lng.toFixed(6);
    if (this.inputEditingOriginId) this.inputEditingOriginId.value = origin.id;

    if (this.originFormHeading) this.originFormHeading.innerText = `Editar: ${origin.label}`;
    if (this.originFormBadge) this.originFormBadge.innerText = '✏️';
    if (this.btnSubmitOriginText) this.btnSubmitOriginText.innerText = '💾 Guardar Cambios';
    if (this.btnCancelEditOrigin) this.btnCancelEditOrigin.classList.remove('hidden');

    this.renderOriginsList();

    if (this.inputOriginDistance) {
      this.inputOriginDistance.focus();
      this.inputOriginDistance.select();
    }

    this.showToast(`✏️ Cargado "${origin.label}" para editar en el panel superior.`, 'info');
  }

  /**
   * Reset top origin form back to Create Mode
   */
  resetOriginForm() {
    if (this.inputEditingOriginId) this.inputEditingOriginId.value = '';
    if (this.inputOriginLabel) this.inputOriginLabel.value = `Origen ${this.markersManager.origins.length + 1}`;
    if (this.inputOriginDistance) this.inputOriginDistance.value = '';
    if (this.originFormHeading) this.originFormHeading.innerText = 'Nuevo Punto de Origen';
    if (this.originFormBadge) this.originFormBadge.innerText = '1';
    if (this.btnSubmitOriginText) this.btnSubmitOriginText.innerText = 'Guardar y Calcular';
    if (this.btnCancelEditOrigin) this.btnCancelEditOrigin.classList.add('hidden');
    this.renderOriginsList();
  }

  openCreateTargetModal(target) {
    if (!target) return;
    this.editingTargetId = null;
    this.targetEditIdInput.value = '';
    this.modalTargetTitle.innerText = 'Guardar Punto Final Encontrado';
    if (this.btnConfirmSaveTarget) {
      this.btnConfirmSaveTarget.innerHTML = '💾 Guardar Etiqueta';
    }
    this.targetNameInput.value = `Objetivo Localizado ${this.markersManager.savedTargets.length + 1}`;
    this.targetModalLat.value = (typeof target.lat === 'number') ? target.lat.toFixed(6) : target.lat;
    this.targetModalLng.value = (typeof target.lng === 'number') ? target.lng.toFixed(6) : target.lng;
    const acc = target.accuracyMeters !== undefined ? target.accuracyMeters : (target.accuracy || 0);
    this.targetModalAccuracy.value = `±${acc.toFixed(1)} m`;
    this.targetDescInput.value = target.notes || target.description || '';
    this.currentModalMediaList = [];

    if (this.btnDeleteFromModal) {
      this.btnDeleteFromModal.classList.add('hidden');
    }

    // Set default preset color (first preset)
    this.selectColorInModal(this.markersManager.presetColors[0].hex);
    this.renderModalMediaPreviews();

    this.modalSaveTarget.classList.remove('hidden');
    setTimeout(() => {
      if (this.targetNameInput) this.targetNameInput.focus();
    }, 100);
  }

  openEditTargetModal(targetId) {
    const target = this.markersManager.getTargetById(targetId);
    if (!target) {
      this.showToast('No se encontró el punto para editar.', 'error');
      return;
    }

    this.editingTargetId = target.id;
    this.modalTargetTitle.innerText = `✏️ Editar: ${target.name}`;
    if (this.btnConfirmSaveTarget) {
      this.btnConfirmSaveTarget.innerHTML = '💾 Guardar Cambios';
    }
    this.targetEditIdInput.value = target.id;
    this.targetNameInput.value = target.name || '';
    this.targetCategoryInput.value = target.category || 'target';
    this.targetModalLat.value = target.lat.toFixed(6);
    this.targetModalLng.value = target.lng.toFixed(6);
    this.targetModalAccuracy.value = `±${target.accuracy ? target.accuracy.toFixed(1) : 0} m`;
    this.targetDescInput.value = target.description || '';
    this.currentModalMediaList = target.mediaList ? JSON.parse(JSON.stringify(target.mediaList)) : [];

    if (this.btnDeleteFromModal) {
      this.btnDeleteFromModal.classList.remove('hidden');
    }

    this.selectColorInModal(target.color || this.markersManager.presetColors[0].hex);
    this.renderModalMediaPreviews();

    this.modalSaveTarget.classList.remove('hidden');
    setTimeout(() => {
      if (this.targetNameInput) this.targetNameInput.focus();
    }, 100);
  }

  selectColorInModal(colorHex) {
    if (!colorHex) colorHex = this.markersManager.presetColors[0].hex;
    this.selectedTargetColor = colorHex;
    let matched = false;
    this.targetColorSwatches.forEach(btn => {
      const btnColor = btn.getAttribute('data-color');
      if (btnColor && btnColor.toLowerCase() === colorHex.toLowerCase()) {
        btn.classList.add('active');
        matched = true;
      } else {
        btn.classList.remove('active');
      }
    });

    this.targetColorInput.value = colorHex;
    if (!matched) {
      this.customColorWrap.classList.remove('hidden');
    } else {
      this.customColorWrap.classList.add('hidden');
    }

    const modalIcon = document.getElementById('modal-target-icon');
    if (modalIcon) {
      modalIcon.style.boxShadow = `0 0 14px ${colorHex}88`;
      modalIcon.style.borderColor = colorHex;
    }
  }

  renderModalMediaPreviews() {
    this.targetMediaPreviewContainer.innerHTML = '';

    if (this.currentModalMediaList.length === 0) {
      this.targetMediaPreviewContainer.innerHTML = `
        <div class="empty-media-hint" id="empty-media-hint">Sin archivos multimedia adjuntos.</div>
      `;
      return;
    }

    this.currentModalMediaList.forEach((media, idx) => {
      const item = document.createElement('div');
      item.className = 'media-thumb-item';

      if (media.isVideo || (media.type && media.type.startsWith('video/'))) {
        item.innerHTML = `
          <div class="media-video-icon">🎥</div>
          <span class="media-thumb-badge">Video</span>
          <button type="button" class="btn-remove-media" title="Eliminar archivo">✕</button>
        `;
      } else {
        item.innerHTML = `
          <img src="${media.dataUrl || ''}" class="media-thumb-img" alt="${media.name}">
          <span class="media-thumb-badge">Foto</span>
          <button type="button" class="btn-remove-media" title="Eliminar archivo">✕</button>
        `;
      }

      item.querySelector('.btn-remove-media').addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentModalMediaList.splice(idx, 1);
        this.renderModalMediaPreviews();
      });

      this.targetMediaPreviewContainer.appendChild(item);
    });
  }

  handleConfirmSaveOrEditTarget() {
    const name = this.targetNameInput.value.trim() || 'Punto Final';
    const category = this.targetCategoryInput.value || 'target';
    const color = this.selectedTargetColor || this.targetColorInput.value || this.markersManager.presetColors[0].hex;
    const description = this.targetDescInput.value.trim();
    const lat = parseFloat(this.targetModalLat.value);
    const lng = parseFloat(this.targetModalLng.value);

    if (isNaN(lat) || isNaN(lng)) {
      this.showToast('Coordenadas inválidas.', 'error');
      return;
    }

    const editId = this.editingTargetId || (this.targetEditIdInput && this.targetEditIdInput.value ? this.targetEditIdInput.value : null);

    if (editId) {
      // Edit existing target
      const updated = this.markersManager.updateTarget(editId, {
        name,
        category,
        color,
        description,
        lat,
        lng,
        mediaList: this.currentModalMediaList
      });

      if (updated) {
        this.showToast(`Etiqueta "${name}" actualizada con éxito.`, 'success');
      } else {
        this.markersManager.addTarget({
          name,
          category,
          color,
          description,
          lat,
          lng,
          accuracy: 0,
          mediaList: this.currentModalMediaList
        });
        this.showToast(`"${name}" guardado como nuevo punto.`, 'success');
      }
    } else {
      // Create new target
      let accuracy = 0;
      if (this.currentCalculation && this.currentCalculation.target) {
        accuracy = this.currentCalculation.target.accuracyMeters || 0;
      }

      this.markersManager.addTarget({
        name,
        category,
        color,
        description,
        lat,
        lng,
        accuracy,
        mediaList: this.currentModalMediaList
      });
      this.showToast(`"${name}" guardado exitosamente.`, 'success');
    }

    // Reset edit state and close modal
    this.editingTargetId = null;
    if (this.targetEditIdInput) this.targetEditIdInput.value = '';
    this.modalSaveTarget.classList.add('hidden');

    this.renderSavedTargetsList();
    this.mapController.renderSavedTargets(
      this.markersManager.getFilteredTargets(),
      (id) => this.openEditTargetModal(id),
      (id, name) => this.handleDeleteTarget(id, name)
    );
    this.switchTab('tab-saved-markers');
  }

  switchTab(tabId) {
    this.tabButtons.forEach(b => {
      if (b.getAttribute('data-tab') === tabId) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });

    this.tabContents.forEach(c => {
      if (c.id === tabId) {
        c.classList.add('active');
      } else {
        c.classList.remove('active');
      }
    });
  }

  handleOriginSubmit() {
    const lat = parseFloat(this.inputOriginLat.value);
    const lng = parseFloat(this.inputOriginLng.value);
    const dist = parseFloat(this.inputOriginDistance.value);
    const unit = this.selectOriginUnit.value;
    const label = this.inputOriginLabel.value.trim() || `Origen ${this.markersManager.origins.length + 1}`;

    if (isNaN(lat) || isNaN(lng)) {
      this.showToast('Por favor selecciona o introduce una coordenada de latitud y longitud válida.', 'error');
      return;
    }

    if (isNaN(dist) || dist <= 0) {
      this.showToast('Por favor introduce una distancia válida mayor a cero.', 'error');
      this.inputOriginDistance.focus();
      return;
    }

    this.markersManager.addOrigin({
      label,
      lat,
      lng,
      distance: dist,
      unit
    });

    // Reset inputs
    this.inputOriginDistance.value = '';
    this.inputOriginLabel.value = '';
    
    this.refreshCalculations();
    this.showToast(`Punto "${label}" agregado.`, 'success');
  }

  refreshCalculations() {
    const origins = this.markersManager.origins;
    this.originCountEl.innerText = origins.length;
    this.renderOriginsList();

    // Render origins and circles
    this.mapController.renderOrigins(origins, this.markersManager.settings.showCircleFill);

    // Run Trilateration Solver
    const result = this.solver.solve(origins);
    this.currentCalculation = result;

    this.updateTelemetryHUD(result);

    // Render intersections & target
    if (result.status === 'two_origins') {
      if (this.markersManager.settings.showIntersections) {
        this.mapController.renderIntersections(result.intersections);
      } else {
        this.mapController.renderIntersections([]);
      }
      
      // If a candidate point is selected as target, display it
      if (this.selectedCandidateTarget) {
        this.mapController.renderTarget(this.selectedCandidateTarget);
      } else {
        this.mapController.renderTarget(null);
      }
    } else if (result.status === 'solved') {
      this.selectedCandidateTarget = null;
      this.mapController.renderIntersections(
        this.markersManager.settings.showIntersections ? result.allIntersections : []
      );
      this.mapController.renderTarget(result.target);
    } else {
      this.selectedCandidateTarget = null;
      this.mapController.renderIntersections([]);
      this.mapController.renderTarget(null);
    }
  }

  updateTelemetryHUD(result) {
    this.statusDot.className = 'pulse-dot';

    if (result.status === 'no_data') {
      this.solverStatusTitle.innerText = 'Sin orígenes';
      this.solverMessage.innerHTML = 'Haz clic en el mapa o pulsa <strong>"+ Agregar Origen"</strong> para iniciar la búsqueda.';
      this.targetCoordsBox.classList.add('hidden');
      if (this.targetCandidatesBox) this.targetCandidatesBox.classList.add('hidden');
    } else if (result.status === 'single_origin') {
      this.statusDot.classList.add('ready');
      this.solverStatusTitle.innerText = '1 Origen (Circunferencia)';
      this.solverMessage.innerHTML = `Distancia registrada: <strong>${this.markersManager.formatDistance(result.origin.distance)}</strong>. El objetivo está en algún punto sobre el círculo trazado.`;
      this.targetCoordsBox.classList.add('hidden');
      if (this.targetCandidatesBox) this.targetCandidatesBox.classList.add('hidden');
    } else if (result.status === 'two_origins') {
      this.statusDot.classList.add('ready');
      const count = result.intersections ? result.intersections.length : 0;
      this.solverStatusTitle.innerText = `2 Orígenes (${count} Candidato${count > 1 ? 's' : ''})`;
      
      let hint = result.message;
      if (result.recommendation) {
        hint += `<br><small style="color: #38bdf8;">💡 ${result.recommendation.hint}</small>`;
      }
      this.solverMessage.innerHTML = hint;

      // Show candidates in HUD
      if (this.targetCandidatesBox && this.candidatesList) {
        this.targetCandidatesBox.classList.remove('hidden');
        if (this.candidatesCountBadge) {
          this.candidatesCountBadge.innerText = count;
        }

        this.candidatesList.innerHTML = '';
        if (result.intersections && result.intersections.length > 0) {
          result.intersections.forEach((pt, idx) => {
            const isTang = pt.isTangent;
            const isApprox = pt.isApproximate;
            const label = isTang ? 'Tangente' : (isApprox ? 'Aproximado' : `Candidato ${idx + 1}`);
            const isCurrentActive = this.selectedCandidateTarget &&
              Math.abs(this.selectedCandidateTarget.lat - pt.lat) < 1e-6 &&
              Math.abs(this.selectedCandidateTarget.lng - pt.lng) < 1e-6;

            const card = document.createElement('div');
            card.className = `candidate-card ${isCurrentActive ? 'active-target' : ''}`;
            card.innerHTML = `
              <div class="candidate-info">
                <span class="candidate-name-label">🎯 ${label}</span>
                <span class="candidate-coords-label font-mono">${pt.lat.toFixed(6)}, ${pt.lng.toFixed(6)}</span>
                ${pt.gap !== undefined ? `<small style="color: #f59e0b; font-size: 10px;">Brecha: ${pt.gap.toFixed(1)}m</small>` : ''}
              </div>
              <div class="candidate-actions">
                <button type="button" class="btn-cand-save" title="Guardar este punto directamente">
                  💾 Guardar
                </button>
                <button type="button" class="btn-cand-select" title="Fijar como objetivo en el mapa">
                  ${isCurrentActive ? '✓ Fijado' : '🎯 Fijar'}
                </button>
              </div>
            `;

            card.querySelector('.btn-cand-save').addEventListener('click', () => {
              this.openCreateTargetModal({
                lat: pt.lat,
                lng: pt.lng,
                accuracyMeters: pt.gap || 0,
                notes: `Punto encontrado con 2 orígenes (${label})`
              });
            });

            card.querySelector('.btn-cand-select').addEventListener('click', () => {
              this.selectCandidateTarget(pt, idx);
            });

            this.candidatesList.appendChild(card);
          });
        }
      }

      // If a candidate is selected, display coordinate box
      if (this.selectedCandidateTarget) {
        this.targetCoordsBox.classList.remove('hidden');
        this.targetCoordsText.innerText = `${this.selectedCandidateTarget.lat.toFixed(6)}, ${this.selectedCandidateTarget.lng.toFixed(6)}`;
        this.targetAccuracyBadge.innerText = this.selectedCandidateTarget.accuracyMeters ? `±${this.selectedCandidateTarget.accuracyMeters.toFixed(1)} m` : 'Intersección exacta';
        this.targetMethodBadge.innerText = 'Candidato Seleccionado';
      } else {
        this.targetCoordsBox.classList.add('hidden');
      }
    } else if (result.status === 'solved') {
      this.statusDot.classList.add('solved');
      this.solverStatusTitle.innerText = '🎯 Objetivo Convergido';
      this.solverMessage.innerHTML = `Calculado con <strong>${result.originCount} orígenes</strong> (${result.iterations} iteraciones LM).`;
      if (this.targetCandidatesBox) this.targetCandidatesBox.classList.add('hidden');
      this.targetCoordsBox.classList.remove('hidden');

      this.targetCoordsText.innerText = `${result.target.lat.toFixed(6)}, ${result.target.lng.toFixed(6)}`;
      this.targetAccuracyBadge.innerText = `Precisión: ±${result.target.accuracyMeters.toFixed(1)} m`;
      this.targetMethodBadge.innerText = `Mínimos Cuadrados`;
    }
  }

  renderOriginsList() {
    const origins = this.markersManager.origins;
    this.originCountEl.innerText = origins.length;

    if (origins.length === 0) {
      this.selectedOriginId = null;
      this.originsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📍</div>
          <p>No has agregado puntos de origen todavía.</p>
          <small>Haz clic en el mapa o usa el formulario superior.</small>
        </div>
      `;
      this.originsHelperText.innerText = '0 registradas';
      return;
    }

    if (!this.selectedOriginId && origins.length > 0) {
      this.selectedOriginId = origins[0].id;
    }

    this.originsHelperText.innerText = `${origins.length} registrada${origins.length > 1 ? 's' : ''}`;
    this.originsList.innerHTML = '';

    origins.forEach((o, index) => {
      const isSelected = String(o.id) === String(this.selectedOriginId);
      const isFirst = index === 0;
      const isLast = index === origins.length - 1;

      const card = document.createElement('div');
      card.className = `origin-item-card ${!o.enabled ? 'disabled' : ''} ${isSelected ? 'selected-origin' : ''}`;
      card.setAttribute('tabindex', '0');
      card.setAttribute('data-id', o.id);
      card.innerHTML = `
        <div class="origin-item-info">
          <div class="origin-color-dot" style="background: ${o.color}; color: ${o.color};"></div>
          <div class="origin-item-text">
            <div class="origin-name">${o.label}</div>
            <div class="origin-distance">${this.markersManager.formatDistance(o.distance, o.unit)}</div>
            <div class="origin-item-coords font-mono">${o.lat.toFixed(4)}, ${o.lng.toFixed(4)}</div>
          </div>
        </div>
        <div class="origin-actions">
          <button class="btn btn-icon btn-ghost btn-sm btn-edit-origin" title="Editar en el panel superior">
            ✏️
          </button>
          <button class="btn btn-icon btn-ghost btn-sm btn-move-origin btn-move-up-origin" title="Subir orden (Ctrl+▲)" ${isFirst ? 'disabled style="opacity:0.25;cursor:not-allowed;"' : ''}>
            ⬆️
          </button>
          <button class="btn btn-icon btn-ghost btn-sm btn-move-origin btn-move-down-origin" title="Bajar orden (Ctrl+▼)" ${isLast ? 'disabled style="opacity:0.25;cursor:not-allowed;"' : ''}>
            ⬇️
          </button>
          <button class="btn btn-icon btn-ghost btn-sm btn-toggle-origin" title="${o.enabled ? 'Desactivar de cálculo' : 'Activar en cálculo'}">
            ${o.enabled ? '👁️' : '🚫'}
          </button>
          <button class="btn btn-icon btn-ghost btn-sm btn-zoom-origin" title="Ver en mapa">
            🔍
          </button>
          <button class="btn btn-icon btn-ghost btn-sm btn-delete-origin" title="Eliminar">
            🗑️
          </button>
        </div>
      `;

      // Select & load into form on card click
      card.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.loadOriginIntoForm(o.id);
        }
      });

      // Edit Button
      const btnEdit = card.querySelector('.btn-edit-origin');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          this.loadOriginIntoForm(o.id);
        });
      }

      // Move Up
      const btnUp = card.querySelector('.btn-move-up-origin');
      if (btnUp && !isFirst) {
        btnUp.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedOriginId = o.id;
          this.markersManager.moveOrigin(o.id, -1);
          this.refreshCalculations();
          this.showToast(`⬆️ "${o.label}" subió en la lista.`, 'info');
        });
      }

      // Move Down
      const btnDown = card.querySelector('.btn-move-down-origin');
      if (btnDown && !isLast) {
        btnDown.addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedOriginId = o.id;
          this.markersManager.moveOrigin(o.id, 1);
          this.refreshCalculations();
          this.showToast(`⬇️ "${o.label}" bajó en la lista.`, 'info');
        });
      }

      // Toggle Origin
      card.querySelector('.btn-toggle-origin').addEventListener('click', (e) => {
        e.stopPropagation();
        this.markersManager.toggleOrigin(o.id);
        this.refreshCalculations();
      });

      // Zoom Origin
      card.querySelector('.btn-zoom-origin').addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedOriginId = o.id;
        this.mapController.setView(o.lat, o.lng, 15);
      });

      // Delete Origin
      card.querySelector('.btn-delete-origin').addEventListener('click', (e) => {
        e.stopPropagation();
        this.markersManager.removeOrigin(o.id);
        if (this.selectedOriginId === o.id) this.selectedOriginId = null;
        this.refreshCalculations();
        this.showToast(`Origen "${o.label}" eliminado.`, 'info');
      });

      this.originsList.appendChild(card);
    });
  }

  renderSavedTargetsList() {
    const filteredTargets = this.markersManager.getFilteredTargets();
    this.savedCountEl.innerText = this.markersManager.savedTargets.length;

    if (filteredTargets.length === 0) {
      const isFiltered = this.markersManager.activeColorFilter !== null;
      this.savedMarkersList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <p>${isFiltered ? 'No hay puntos guardados con el color seleccionado.' : 'No hay puntos finales guardados.'}</p>
          <small>${isFiltered ? 'Selecciona "Todos" para ver el resto.' : 'Cuando la trilateración estime tu objetivo, podrás guardarlo aquí.'}</small>
        </div>
      `;
      return;
    }

    this.savedMarkersList.innerHTML = '';
    filteredTargets.forEach(t => {
      const color = t.color || '#0284c7';
      const mediaCount = t.mediaList ? t.mediaList.length : 0;

      const item = document.createElement('div');
      item.className = 'saved-target-item';
      item.innerHTML = `
        <div class="saved-item-header">
          <div class="saved-item-title-wrap">
            <span class="target-color-dot" style="display: inline-block; width: 14px; height: 14px; border-radius: 50%; background: ${color}; box-shadow: 0 0 8px ${color}; margin-right: 8px; flex-shrink: 0; border: 2px solid #ffffffaa;"></span>
            <span class="saved-item-title" style="font-weight: 600;">${t.name}</span>
          </div>
          <div class="origin-actions">
            <button class="btn btn-icon btn-ghost btn-sm btn-edit-target" title="Editar etiqueta">✏️</button>
            <button class="btn btn-icon btn-ghost btn-sm btn-zoom-target" title="Centrar en mapa">🔍</button>
            <button class="btn btn-icon btn-ghost btn-sm btn-delete-target" title="Eliminar">🗑️</button>
          </div>
        </div>
        ${t.description ? `<div class="saved-item-desc">${t.description}</div>` : ''}
        <div class="saved-item-meta font-mono">
          <span>${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            ${mediaCount > 0 ? `<span class="badge badge-pulse" title="${mediaCount} archivo(s) adjunto(s)">📷 ${mediaCount}</span>` : ''}
            <span class="badge badge-success">±${t.accuracy ? t.accuracy.toFixed(1) : 0}m</span>
          </div>
        </div>
      `;

      item.querySelector('.btn-edit-target').addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditTargetModal(t.id);
      });

      item.querySelector('.btn-zoom-target').addEventListener('click', (e) => {
        e.stopPropagation();
        this.mapController.setView(t.lat, t.lng, 16);
      });

      item.querySelector('.btn-delete-target').addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleDeleteTarget(t.id, t.name);
      });

      this.savedMarkersList.appendChild(item);
    });
  }

  filterSavedTargetsList() {
    const query = this.inputSearchSaved.value.toLowerCase();
    const items = document.querySelectorAll('.saved-target-item');
    items.forEach(el => {
      const text = el.innerText.toLowerCase();
      el.style.display = text.includes(query) ? 'flex' : 'none';
    });
  }

  /* --------------------------------------------------------------------------
     Offline Downloader UI Helpers
     -------------------------------------------------------------------------- */
  async updateOfflineEstimate() {
    const minZ = parseInt(this.selectZoomMin.value, 10);
    const maxZ = parseInt(this.selectZoomMax.value, 10);

    let bounds = null;
    if (this.selectedZonePreset === 'managua-core') {
      bounds = { north: 12.18, south: 12.08, east: -86.18, west: -86.34 };
    } else if (this.selectedZonePreset === 'current-view') {
      bounds = this.mapController.getBounds();
    } else if (this.selectedZonePreset === 'custom-box' && this.customSelectedBounds) {
      bounds = this.customSelectedBounds;
    } else {
      bounds = { north: 12.18, south: 12.08, east: -86.18, west: -86.34 };
    }

    const tiles = this.offlineManager.getTilesForBounds(bounds, minZ, maxZ);
    const tileCount = tiles.length;
    const estMB = (tileCount * 16) / 1024;

    this.estimateTileCount.innerText = `~${tileCount.toLocaleString()}`;
    this.estimateStorageSize.innerText = estMB > 1024
      ? `~${(estMB / 1024).toFixed(1)} GB`
      : `~${estMB.toFixed(1)} MB`;

    const stats = await this.offlineManager.getStorageStats();
    this.currentCachedCount.innerText = stats.count.toLocaleString();
  }

  async updateStoredPacksList() {
    const packs = await this.offlineManager.getSavedPacks();
    if (packs.length === 0) {
      this.storedPacksList.innerHTML = '<div class="pack-item empty-pack">No hay zonas descargadas aún.</div>';
      return;
    }

    this.storedPacksList.innerHTML = '';
    packs.forEach(p => {
      const sizeMB = (p.sizeBytes / (1024 * 1024)).toFixed(1);
      const row = document.createElement('div');
      row.className = 'origin-item-card';
      row.innerHTML = `
        <div>
          <b>${p.name}</b><br>
          <small style="color: var(--text-muted);">${p.tileCount} teselas (~${sizeMB} MB) • Zoom ${p.minZoom}-${p.maxZoom}</small>
        </div>
        <button class="btn btn-icon btn-ghost btn-sm btn-delete-pack" title="Eliminar zona">🗑️</button>
      `;

      row.querySelector('.btn-delete-pack').addEventListener('click', async () => {
        await this.offlineManager.deletePack(p.id);
        this.updateStoredPacksList();
        this.updateOfflineEstimate();
        this.showToast(`Zona "${p.name}" eliminada.`, 'info');
      });

      this.storedPacksList.appendChild(row);
    });
  }

  async handleStartOfflineDownload() {
    const minZ = parseInt(this.selectZoomMin.value, 10);
    const maxZ = parseInt(this.selectZoomMax.value, 10);

    let packName = 'Zona Managua';
    let bounds = null;

    if (this.selectedZonePreset === 'managua-core') {
      packName = 'Managua Metropolitana';
      bounds = { north: 12.18, south: 12.08, east: -86.18, west: -86.34 };
    } else if (this.selectedZonePreset === 'current-view') {
      packName = 'Vista en Pantalla';
      bounds = this.mapController.getBounds();
    } else if (this.selectedZonePreset === 'custom-box' && this.customSelectedBounds) {
      packName = 'Zona Personalizada';
      bounds = this.customSelectedBounds;
    }

    this.downloadProgressWrap.classList.remove('hidden');
    this.btnStartDownload.classList.add('hidden');
    this.btnCancelDownload.classList.remove('hidden');

    try {
      const res = await this.offlineManager.downloadZone(
        packName,
        bounds,
        minZ,
        maxZ,
        (progress) => {
          this.downloadProgressStatus.innerText = `Descargando: ${progress.downloaded} / ${progress.total} teselas (${progress.failed} fallidas)`;
          this.downloadProgressPercent.innerText = `${progress.percent}%`;
          this.downloadProgressFill.style.width = `${progress.percent}%`;
        }
      );

      if (res.success) {
        this.showToast(`¡Descarga offline completada! (${res.downloaded} teselas listas)`, 'success');
        this.updateStoredPacksList();
        this.updateOfflineEstimate();
      }
    } catch (err) {
      this.showToast(`Descarga interrumpida: ${err.message}`, 'error');
    } finally {
      this.downloadProgressWrap.classList.add('hidden');
      this.btnStartDownload.classList.remove('hidden');
      this.btnCancelDownload.classList.add('hidden');
    }
  }

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;

    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  downloadFile(content, fileName, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}

// Attach to window
window.UIController = UIController;
