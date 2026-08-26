/**
 * GeoTrilateración - UI & Interaction Controller
 * Streamlined controls, direct map interactions, dynamic telemetry HUD, target database & comparison
 */

class UIController {
  constructor(markersManager, solver, offlineManager, mapController) {
    this.markersManager = markersManager;
    this.solver = solver;
    this.offlineManager = offlineManager;
    this.mapController = mapController;

    this.currentCalculation = null;
    this.selectedCandidateTarget = null;
    this.selectedZonePreset = 'managua-core';
    this.customSelectedBounds = null;

    // Comparison Mode
    this.isCompareMode = false;

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
    this.appStatusBadge = document.getElementById('app-status-badge');
    this.btnGPS = document.getElementById('btn-gps');
    this.btnPresets = document.getElementById('btn-presets');
    this.presetsMenu = document.getElementById('presets-menu');
    this.btnOpenOffline = document.getElementById('btn-open-offline');
    this.btnToggleTheme = document.getElementById('btn-toggle-theme');
    this.btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    this.panelCounterBadge = document.getElementById('panel-counter-badge');
    this.sidebar = document.getElementById('sidebar');
    this.btnCloseSidebar = document.getElementById('btn-close-sidebar');

    // Floating Dynamic HUD
    this.unifiedHudCard = document.getElementById('unified-hud-card');
    this.btnAddOriginMode = document.getElementById('btn-add-origin-mode');
    this.btnAddOriginText = document.getElementById('btn-add-origin-text');
    this.statusDot = document.getElementById('status-dot');
    this.solverStatusTitle = document.getElementById('solver-status-title');
    this.btnQuickNew = document.getElementById('btn-quick-new');
    this.btnFitBounds = document.getElementById('btn-fit-bounds');
    this.btnMapLayersMenu = document.getElementById('btn-map-layers-menu');
    this.layersMenuPopup = document.getElementById('layers-menu-popup');
    this.checkVisCircles = document.getElementById('check-vis-circles');
    this.checkVisOrigins = document.getElementById('check-vis-origins');
    this.checkVisTargets = document.getElementById('check-vis-targets');
    this.btnMinimizeHUD = document.getElementById('btn-minimize-hud');
    this.telemetryBody = document.getElementById('telemetry-body');
    this.solverMessage = document.getElementById('solver-message');
    this.targetCandidatesBox = document.getElementById('target-candidates-box');
    this.candidatesList = document.getElementById('candidates-list');
    this.targetCoordsBox = document.getElementById('target-coordinates-box');
    this.targetCoordsText = document.getElementById('target-coords-text');
    this.targetAccuracyBadge = document.getElementById('target-accuracy-badge');
    this.targetMethodBadge = document.getElementById('target-method-badge');
    this.btnSaveAsTarget = document.getElementById('btn-save-as-target');
    this.btnCopyCoords = document.getElementById('btn-copy-coords');
    this.btnCenterTarget = document.getElementById('btn-center-target');

    // Sidebar Tabs
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.originCountEl = document.getElementById('origin-count');
    this.savedCountEl = document.getElementById('saved-count');

    // Origins Tab
    this.btnToggleManualForm = document.getElementById('btn-toggle-manual-form');
    this.btnClearAllOrigins = document.getElementById('btn-clear-all-origins');
    this.manualOriginCard = document.getElementById('manual-origin-card');
    this.btnCancelManualForm = document.getElementById('btn-cancel-manual-form');
    this.btnSubmitManualOrigin = document.getElementById('btn-submit-manual-origin');
    this.manualInputLabel = document.getElementById('manual-input-label');
    this.manualInputDist = document.getElementById('manual-input-dist');
    this.manualSelectUnit = document.getElementById('manual-select-unit');
    this.manualInputLat = document.getElementById('manual-input-lat');
    this.manualInputLng = document.getElementById('manual-input-lng');
    this.originsList = document.getElementById('origins-list');
    this.originsHelperText = document.getElementById('origins-helper-text');

    // Saved Targets Tab & Comparison
    this.btnToggleCompareMode = document.getElementById('btn-toggle-compare-mode');
    this.databaseCountHelper = document.getElementById('database-count-helper');
    this.comparisonCard = document.getElementById('comparison-card');
    this.comparisonBody = document.getElementById('comparison-body');
    this.btnCloseComparison = document.getElementById('btn-close-comparison');
    this.inputSearchSaved = document.getElementById('input-search-saved');
    this.savedColorFilters = document.getElementById('saved-color-filters');
    this.savedMarkersList = document.getElementById('saved-markers-list');
    this.btnExportGeoJSON = document.getElementById('btn-export-geojson');

    // Settings Tab
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

    if (this.checkVisCircles) this.checkVisCircles.checked = s.showCircles !== false;
    if (this.checkVisOrigins) this.checkVisOrigins.checked = s.showOrigins !== false;
    if (this.checkVisTargets) this.checkVisTargets.checked = s.showSavedTargets !== false;
  }

  attachEventListeners() {
    // Top Bar - GPS Geolocation
    if (this.btnGPS) {
      this.btnGPS.addEventListener('click', () => {
        if (!navigator.geolocation) {
          this.showToast('Geolocalización no disponible en este dispositivo.', 'error');
          return;
        }
        this.showToast('Obteniendo coordenadas GPS...', 'info');
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const { latitude, longitude } = pos.coords;
            this.mapController.setView(latitude, longitude, 15);
            this.showToast(`Ubicación GPS: [${latitude.toFixed(4)}, ${longitude.toFixed(4)}]`, 'success');
          },
          (err) => {
            this.showToast(`Error GPS: ${err.message}`, 'error');
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    }

    // Top Bar - Presets Dropdown
    if (this.btnPresets) {
      this.btnPresets.addEventListener('click', (e) => {
        e.stopPropagation();
        this.btnPresets.parentElement.classList.toggle('open');
      });
    }

    document.addEventListener('click', (e) => {
      if (this.btnPresets && !this.btnPresets.contains(e.target)) {
        this.btnPresets.parentElement.classList.remove('open');
      }
      if (this.btnMapLayersMenu && !this.btnMapLayersMenu.contains(e.target) && this.layersMenuPopup && !this.layersMenuPopup.contains(e.target)) {
        if (this.btnMapLayersMenu.parentElement) {
          this.btnMapLayersMenu.parentElement.classList.remove('open');
        }
      }
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
    if (this.btnCustomCoords) {
      this.btnCustomCoords.addEventListener('click', () => {
        if (this.modalCustomCoords) this.modalCustomCoords.classList.remove('hidden');
      });
    }
    if (this.btnCloseCoordsModal) this.btnCloseCoordsModal.addEventListener('click', () => this.modalCustomCoords.classList.add('hidden'));
    if (this.btnCancelJump) this.btnCancelJump.addEventListener('click', () => this.modalCustomCoords.classList.add('hidden'));
    if (this.btnConfirmJump) {
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
    }

    // Top Bar - Offline Map Manager Modal
    if (this.btnOpenOffline) {
      this.btnOpenOffline.addEventListener('click', () => {
        if (this.modalOffline) this.modalOffline.classList.remove('hidden');
      });
    }
    if (this.btnCloseOfflineModal) {
      this.btnCloseOfflineModal.addEventListener('click', () => {
        if (this.modalOffline) this.modalOffline.classList.add('hidden');
      });
    }

    // Top Bar - Theme Switcher
    if (this.btnToggleTheme) {
      this.btnToggleTheme.addEventListener('click', () => {
        const html = document.documentElement;
        const newTheme = html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        html.setAttribute('data-theme', newTheme);
        this.markersManager.settings.theme = newTheme;
        this.markersManager.saveToStorage();
      });
    }

    // Top Bar - Sidebar Toggle
    if (this.btnToggleSidebar) {
      this.btnToggleSidebar.addEventListener('click', () => this.toggleSidebar());
    }
    if (this.btnCloseSidebar) {
      this.btnCloseSidebar.addEventListener('click', () => this.toggleSidebar(true));
    }

    // HUD - Add Origin Button
    if (this.btnAddOriginMode) {
      this.btnAddOriginMode.addEventListener('click', () => {
        const center = this.mapController.getCenter();
        this.handleMapClick(center);
      });
    }

    // HUD - Quick New / Clear Session
    if (this.btnQuickNew) {
      this.btnQuickNew.addEventListener('click', () => {
        if (this.markersManager.origins.length === 0) {
          this.showToast('No hay orígenes activos para limpiar.', 'info');
          return;
        }
        if (confirm('¿Deseas limpiar todos los orígenes de la medición actual? (Tus puntos guardados en la base de datos se conservarán intactos)')) {
          this.markersManager.clearOrigins();
          this.refreshCalculations();
          this.showToast('Sesión de medición limpiada.', 'success');
        }
      });
    }

    // HUD - Fit Bounds
    if (this.btnFitBounds) {
      this.btnFitBounds.addEventListener('click', () => {
        const target = this.currentCalculation && this.currentCalculation.target
          ? this.currentCalculation.target
          : null;
        const bounds = this.mapController.getAllBounds(this.markersManager.origins, target);
        if (bounds) {
          this.mapController.fitBounds(bounds);
        } else {
          this.showToast('Agrega orígenes para ajustar la vista.', 'info');
        }
      });
    }

    // HUD - Map Layers Dropdown
    if (this.btnMapLayersMenu) {
      this.btnMapLayersMenu.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.btnMapLayersMenu.parentElement) {
          this.btnMapLayersMenu.parentElement.classList.toggle('open');
        }
      });
    }

    // Base Layer Choice Selection
    document.querySelectorAll('.layer-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        const layerKey = btn.getAttribute('data-layer-key');
        const name = this.mapController.setBaseLayer(layerKey);
        document.querySelectorAll('.layer-choice').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.showToast(`Capa de mapa: ${name}`, 'info');
      });
    });

    // Layer Visibility Checkboxes
    if (this.checkVisCircles) {
      this.checkVisCircles.addEventListener('change', (e) => {
        const show = e.target.checked;
        this.markersManager.settings.showCircles = show;
        this.markersManager.saveToStorage();
        this.mapController.setLayerVisibility('circles', show);
      });
    }
    if (this.checkVisOrigins) {
      this.checkVisOrigins.addEventListener('change', (e) => {
        const show = e.target.checked;
        this.markersManager.settings.showOrigins = show;
        this.markersManager.saveToStorage();
        this.mapController.setLayerVisibility('origins', show);
      });
    }
    if (this.checkVisTargets) {
      this.checkVisTargets.addEventListener('change', (e) => {
        const show = e.target.checked;
        this.markersManager.settings.showSavedTargets = show;
        this.markersManager.saveToStorage();
        this.mapController.setLayerVisibility('savedTargets', show);
      });
    }

    // HUD - Minimize Toggle
    if (this.btnMinimizeHUD) {
      this.btnMinimizeHUD.addEventListener('click', () => {
        if (this.telemetryBody) {
          this.telemetryBody.classList.toggle('collapsed');
          this.btnMinimizeHUD.innerText = this.telemetryBody.classList.contains('collapsed') ? '▲' : '▼';
        }
      });
    }

    // HUD - Target Actions
    if (this.btnSaveAsTarget) {
      this.btnSaveAsTarget.addEventListener('click', () => {
        if (this.currentCalculation && this.currentCalculation.target) {
          this.openCreateTargetModal(this.currentCalculation.target);
        }
      });
    }

    if (this.btnCopyCoords) {
      this.btnCopyCoords.addEventListener('click', () => {
        if (this.currentCalculation && this.currentCalculation.target) {
          const t = this.currentCalculation.target;
          const text = `${t.lat.toFixed(6)}, ${t.lng.toFixed(6)}`;
          navigator.clipboard.writeText(text);
          this.showToast(`Coordenadas copiadas: ${text}`, 'success');
        }
      });
    }

    if (this.btnCenterTarget) {
      this.btnCenterTarget.addEventListener('click', () => {
        if (this.currentCalculation && this.currentCalculation.target) {
          const t = this.currentCalculation.target;
          this.mapController.setView(t.lat, t.lng, 15);
        }
      });
    }

    // Sidebar - Tab Switching
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Sidebar Tab 1 - Manual Form Toggle
    if (this.btnToggleManualForm) {
      this.btnToggleManualForm.addEventListener('click', () => {
        if (this.manualOriginCard) {
          const isHidden = this.manualOriginCard.classList.toggle('hidden');
          if (!isHidden) {
            const center = this.mapController.getCenter();
            if (this.manualInputLat) this.manualInputLat.value = center.lat.toFixed(6);
            if (this.manualInputLng) this.manualInputLng.value = center.lng.toFixed(6);
            if (this.manualInputLabel) this.manualInputLabel.value = `Origen ${this.markersManager.origins.length + 1}`;
            if (this.manualInputDist) {
              this.manualInputDist.focus();
              this.manualInputDist.select();
            }
          }
        }
      });
    }

    if (this.btnCancelManualForm) {
      this.btnCancelManualForm.addEventListener('click', () => {
        if (this.manualOriginCard) this.manualOriginCard.classList.add('hidden');
      });
    }

    if (this.btnSubmitManualOrigin) {
      this.btnSubmitManualOrigin.addEventListener('click', () => {
        const dist = parseFloat(this.manualInputDist.value);
        const lat = parseFloat(this.manualInputLat.value);
        const lng = parseFloat(this.manualInputLng.value);
        const unit = this.manualSelectUnit.value || 'km';
        const label = this.manualInputLabel.value.trim() || `Origen ${this.markersManager.origins.length + 1}`;

        if (isNaN(dist) || dist <= 0 || isNaN(lat) || isNaN(lng)) {
          this.showToast('Por favor completa los campos de distancia y coordenadas válidas.', 'error');
          return;
        }

        this.markersManager.addOrigin({ lat, lng, distance: dist, unit, label });
        this.refreshCalculations();
        this.manualOriginCard.classList.add('hidden');
        this.showToast(`Origen "${label}" agregado.`, 'success');
      });
    }

    if (this.btnClearAllOrigins) {
      this.btnClearAllOrigins.addEventListener('click', () => {
        if (this.markersManager.origins.length === 0) return;
        if (confirm('¿Deseas limpiar todos los orígenes activos?')) {
          this.markersManager.clearOrigins();
          this.refreshCalculations();
          this.showToast('Orígenes limpiados.', 'info');
        }
      });
    }

    // Sidebar Tab 2 - Comparison Mode Toggle
    if (this.btnToggleCompareMode) {
      this.btnToggleCompareMode.addEventListener('click', () => {
        this.isCompareMode = !this.isCompareMode;
        this.btnToggleCompareMode.classList.toggle('btn-primary', this.isCompareMode);
        this.btnToggleCompareMode.classList.toggle('btn-outline', !this.isCompareMode);
        this.btnToggleCompareMode.innerText = this.isCompareMode ? '✓ Modo Comparación Activo' : '⚖️ Comparar Puntos';

        if (!this.isCompareMode) {
          this.markersManager.clearComparisonSelection();
          this.mapController.clearComparison();
          if (this.comparisonCard) this.comparisonCard.classList.add('hidden');
        }
        this.renderSavedTargetsList();
      });
    }

    if (this.btnCloseComparison) {
      this.btnCloseComparison.addEventListener('click', () => {
        this.markersManager.clearComparisonSelection();
        this.mapController.clearComparison();
        if (this.comparisonCard) this.comparisonCard.classList.add('hidden');
        this.renderSavedTargetsList();
      });
    }

    if (this.inputSearchSaved) {
      this.inputSearchSaved.addEventListener('input', () => this.filterSavedTargetsList());
    }

    if (this.savedColorFilters) {
      this.savedColorFilters.querySelectorAll('button').forEach(btn => {
        btn.addEventListener('click', () => {
          this.savedColorFilters.querySelectorAll('button').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          const color = btn.getAttribute('data-color');
          this.markersManager.activeColorFilter = color === 'all' ? null : color;
          this.filterSavedTargetsList();
        });
      });
    }

    if (this.btnExportGeoJSON) {
      this.btnExportGeoJSON.addEventListener('click', () => {
        const geojson = this.markersManager.exportToGeoJSON();
        this.downloadFile(JSON.stringify(geojson, null, 2), `geotrilat_export_${Date.now()}.geojson`, 'application/json');
        this.showToast('Datos exportados en formato GeoJSON.', 'success');
      });
    }

    // Sidebar Tab 3 - Settings
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
          this.showToast(`Tolerancia: ±${val} m`, 'info');
        }
      });
    }

    if (this.checkShowIntersections) {
      this.checkShowIntersections.addEventListener('change', (e) => {
        this.markersManager.settings.showIntersections = e.target.checked;
        this.markersManager.saveToStorage();
        this.refreshCalculations();
      });
    }

    if (this.checkShowCircleFill) {
      this.checkShowCircleFill.addEventListener('change', (e) => {
        this.markersManager.settings.showCircleFill = e.target.checked;
        this.markersManager.saveToStorage();
        this.mapController.renderOrigins(this.markersManager.origins, e.target.checked);
      });
    }

    if (this.btnExportJSON) {
      this.btnExportJSON.addEventListener('click', () => {
        const backup = this.markersManager.exportAllData();
        this.downloadFile(JSON.stringify(backup, null, 2), `geotrilat_backup_${Date.now()}.json`, 'application/json');
        this.showToast('Copia de seguridad descargada.', 'success');
      });
    }

    if (this.btnImportJSONTrigger && this.inputImportFile) {
      this.btnImportJSONTrigger.addEventListener('click', () => this.inputImportFile.click());
      this.inputImportFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const parsed = JSON.parse(evt.target.result);
            if (this.markersManager.importAllData(parsed)) {
              this.refreshCalculations();
              this.renderSavedTargetsList();
              this.mapController.renderSavedTargets(
                this.markersManager.getFilteredTargets(),
                (id) => this.openEditTargetModal(id),
                (id, name) => this.handleDeleteTarget(id, name),
                (id) => this.handleReviewTarget(id)
              );
              this.showToast('Datos importados exitosamente.', 'success');
            } else {
              this.showToast('Estructura de archivo JSON inválida.', 'error');
            }
          } catch (err) {
            this.showToast('Error al leer el archivo JSON.', 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    if (this.btnResetAllData) {
      this.btnResetAllData.addEventListener('click', () => {
        if (confirm('⚠️ ¿Estás seguro de que deseas borrar TODOS los orígenes y marcadores guardados? Esta acción es irreversible.')) {
          this.markersManager.resetAllData();
          this.refreshCalculations();
          this.renderSavedTargetsList();
          this.mapController.renderSavedTargets([], null, null, null);
          this.showToast('Todos los datos locales han sido eliminados.', 'info');
        }
      });
    }

    // Modal: Save / Edit Target Modal Event Handlers
    if (this.btnCloseSaveTargetModal) this.btnCloseSaveTargetModal.addEventListener('click', () => this.modalSaveTarget.classList.add('hidden'));
    if (this.btnCancelSaveTarget) this.btnCancelSaveTarget.addEventListener('click', () => this.modalSaveTarget.classList.add('hidden'));
    if (this.btnConfirmSaveTarget) this.btnConfirmSaveTarget.addEventListener('click', () => this.handleConfirmSaveOrEditTarget());

    // Color Swatches
    this.targetColorSwatches.forEach(btn => {
      btn.addEventListener('click', () => {
        const color = btn.getAttribute('data-color');
        this.selectColorInModal(color);
      });
    });

    if (this.btnToggleCustomColor && this.customColorWrap) {
      this.btnToggleCustomColor.addEventListener('click', () => {
        this.customColorWrap.classList.toggle('hidden');
      });
    }

    if (this.targetColorInput) {
      this.targetColorInput.addEventListener('input', (e) => {
        this.selectColorInModal(e.target.value);
      });
    }

    // Multimedia in Target Modal (Upload, Paste, Drag&Drop)
    if (this.targetMediaInput) {
      this.targetMediaInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        for (const file of files) {
          const dataUrl = await this.fileToDataUrl(file);
          this.currentModalMediaList.push({
            id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: file.name,
            type: file.type,
            size: file.size,
            dataUrl
          });
        }
        this.renderModalMediaPreviews();
        this.targetMediaInput.value = '';
      });
    }

    if (this.btnPasteMedia) {
      this.btnPasteMedia.addEventListener('click', async () => {
        try {
          const clipboardItems = await navigator.clipboard.read();
          let added = false;
          for (const item of clipboardItems) {
            for (const type of item.types) {
              if (type.startsWith('image/') || type.startsWith('video/')) {
                const blob = await item.getType(type);
                const dataUrl = await this.fileToDataUrl(blob);
                this.currentModalMediaList.push({
                  id: `media_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
                  name: `Portapapeles_${Date.now()}.${type.split('/')[1] || 'png'}`,
                  type: type,
                  size: blob.size,
                  dataUrl
                });
                added = true;
              }
            }
          }
          if (added) {
            this.renderModalMediaPreviews();
            this.showToast('Archivo pegado desde portapapeles.', 'success');
          } else {
            this.showToast('No se encontraron imágenes en el portapapeles.', 'info');
          }
        } catch (e) {
          this.showToast('Usa Ctrl + V directamente para pegar.', 'info');
        }
      });
    }

    // Modal: Offline Downloader events
    this.presetCards.forEach(card => {
      card.addEventListener('click', () => {
        this.presetCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.selectedZonePreset = card.getAttribute('data-zone');
        if (this.selectedZonePreset === 'custom-box') {
          this.modalOffline.classList.add('hidden');
          this.mapController.startBoxSelection();
          this.showToast('Arrastra sobre el mapa para seleccionar el rectángulo.', 'info');
        }
        this.updateOfflineEstimate();
      });
    });

    if (this.selectZoomMin) this.selectZoomMin.addEventListener('change', () => this.updateOfflineEstimate());
    if (this.selectZoomMax) this.selectZoomMax.addEventListener('change', () => this.updateOfflineEstimate());

    if (this.btnStartDownload) {
      this.btnStartDownload.addEventListener('click', () => this.handleStartOfflineDownload());
    }
    if (this.btnCancelDownload) {
      this.btnCancelDownload.addEventListener('click', () => {
        this.offlineManager.cancelDownload();
        this.downloadProgressWrap.classList.add('hidden');
        this.btnStartDownload.classList.remove('hidden');
        this.btnCancelDownload.classList.add('hidden');
        this.showToast('Descarga cancelada.', 'info');
      });
    }
    if (this.btnClearTileCache) {
      this.btnClearTileCache.addEventListener('click', async () => {
        if (confirm('¿Deseas limpiar toda la memoria caché de mapas guardada en este dispositivo?')) {
          await this.offlineManager.clearAllTiles();
          this.updateOfflineEstimate();
          this.updateStoredPacksList();
          this.showToast('Caché de mapas eliminada.', 'info');
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
     Core Interaction Handlers
     -------------------------------------------------------------------------- */

  handleMapClick(latlng) {
    const nextNumber = this.markersManager.origins.length + 1;
    const suggestedLabel = `Origen ${nextNumber}`;

    this.mapController.showQuickOriginPopup(latlng, suggestedLabel, (data) => {
      this.markersManager.addOrigin(data);
      this.refreshCalculations();
      this.showToast(`Punto "${data.label}" agregado (${data.distance} ${data.unit}).`, 'success');
    });
  }

  toggleSidebar(forceClose = false) {
    if (!this.sidebar) return;
    if (forceClose) {
      this.sidebar.classList.remove('open');
    } else {
      this.sidebar.classList.toggle('open');
    }
  }

  switchTab(tabId) {
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });
    this.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });
  }

  fileToDataUrl(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.readAsDataURL(file);
    });
  }

  dismissEstimatedTarget() {
    this.currentCalculation = null;
    this.mapController.renderTarget(null);
    this.updateTelemetryHUD({ originsCount: this.markersManager.origins.length, solved: false, message: 'Objetivo descartado.' });
    this.showToast('Objetivo estimado descartado.', 'info');
  }

  selectCandidateTarget(candidatePoint, idx) {
    this.selectedCandidateTarget = candidatePoint;
    const estimatedTarget = {
      lat: candidatePoint.lat,
      lng: candidatePoint.lng,
      accuracyMeters: candidatePoint.gap || 0,
      confidenceRadius: Math.max(candidatePoint.gap || 5, 10),
      isCandidate: true,
      candidateIndex: idx
    };
    this.currentCalculation = {
      status: 'solved',
      target: estimatedTarget,
      intersections: this.currentCalculation ? this.currentCalculation.intersections : []
    };
    this.mapController.renderTarget(estimatedTarget);
    this.mapController.setView(candidatePoint.lat, candidatePoint.lng, 15);
    this.updateTelemetryHUD(this.currentCalculation);
    this.showToast(`Candidato ${idx !== undefined ? idx + 1 : ''} fijado como objetivo.`, 'success');
  }

  handleDeleteTarget(id, name = '') {
    if (confirm(`¿Eliminar el punto guardado "${name || id}" de la base de datos?`)) {
      this.markersManager.removeTarget(id);
      this.offlineManager.deleteTarget(id);
      this.renderSavedTargetsList();
      this.mapController.renderSavedTargets(
        this.markersManager.getFilteredTargets(),
        (tid) => this.openEditTargetModal(tid),
        (tid, tname) => this.handleDeleteTarget(tid, tname),
        (tid) => this.handleReviewTarget(tid)
      );
      this.showToast('Punto eliminado de la base de datos.', 'info');
    }
  }

  handleReviewTarget(id) {
    const target = this.markersManager.getTargetById(id);
    if (!target) return;

    if (confirm(`¿Deseas cargar la medición guardada de "${target.name}" para revisión y análisis en el mapa?`)) {
      if (this.markersManager.loadOriginsFromTarget(id)) {
        this.refreshCalculations();
        this.mapController.setView(target.lat, target.lng, 15);
        this.switchTab('tab-origins');
        this.showToast(`Medición de "${target.name}" cargada para revisión.`, 'success');
      } else {
        this.showToast('Este objetivo no tiene registro de orígenes guardado.', 'info');
      }
    }
  }

  /* --------------------------------------------------------------------------
     Calculation & Dynamic HUD
     -------------------------------------------------------------------------- */

  refreshCalculations() {
    const activeOrigins = this.markersManager.origins.filter(o => o.enabled !== false);
    const originCount = this.markersManager.origins.length;

    // Update counter badges
    if (this.originCountEl) this.originCountEl.innerText = originCount;
    if (this.savedCountEl) this.savedCountEl.innerText = this.markersManager.savedTargets.length;
    if (this.panelCounterBadge) this.panelCounterBadge.innerText = originCount;
    if (this.databaseCountHelper) this.databaseCountHelper.innerText = `${this.markersManager.savedTargets.length} en base de datos`;

    // Render origins on map
    this.mapController.renderOrigins(
      this.markersManager.origins,
      this.markersManager.settings.showCircleFill !== false
    );

    // Calculate trilateration
    const result = this.solver.solve(activeOrigins);
    this.currentCalculation = result;

    // Render intersections
    if (this.markersManager.settings.showIntersections !== false && result.intersections) {
      this.mapController.renderIntersections(result.intersections);
    } else {
      this.mapController.renderIntersections([]);
    }

    // Render solved target if exists
    if (result.target && result.target.lat && result.target.lng) {
      this.mapController.renderTarget(result.target);
    } else {
      this.mapController.renderTarget(null);
    }

    // Update Telemetry HUD
    this.updateTelemetryHUD(result);
    this.renderOriginsList();
  }

  updateTelemetryHUD(result) {
    const activeOrigins = this.markersManager.origins.filter(o => o.enabled !== false);
    const count = activeOrigins.length;

    if (count === 0) {
      if (this.appStatusBadge) {
        this.appStatusBadge.innerText = 'Listo';
        this.appStatusBadge.className = 'badge badge-pulse';
      }
      if (this.statusDot) this.statusDot.className = 'pulse-dot';
      if (this.solverStatusTitle) this.solverStatusTitle.innerText = 'Sin orígenes';
      if (this.solverMessage) {
        this.solverMessage.innerHTML = '💡 Haz clic en cualquier lugar del mapa para agregar tu punto de origen y distancia.';
        this.solverMessage.classList.remove('hidden');
      }
      if (this.targetCandidatesBox) this.targetCandidatesBox.classList.add('hidden');
      if (this.targetCoordsBox) this.targetCoordsBox.classList.add('hidden');
      return;
    }

    if (count === 1) {
      if (this.appStatusBadge) {
        this.appStatusBadge.innerText = '1 Origen';
        this.appStatusBadge.className = 'badge badge-info';
      }
      if (this.statusDot) this.statusDot.className = 'pulse-dot';
      if (this.solverStatusTitle) this.solverStatusTitle.innerText = '1 origen activo';
      if (this.solverMessage) {
        this.solverMessage.innerHTML = '📍 1 origen activo • Toca el mapa para situar tu <strong>2do origen</strong> y calcular intersecciones.';
        this.solverMessage.classList.remove('hidden');
      }
      if (this.targetCandidatesBox) this.targetCandidatesBox.classList.add('hidden');
      if (this.targetCoordsBox) this.targetCoordsBox.classList.add('hidden');
      return;
    }

    if (count === 2) {
      const candidates = result.intersections || [];
      if (this.appStatusBadge) {
        this.appStatusBadge.innerText = `${candidates.length} Candidatos`;
        this.appStatusBadge.className = 'badge badge-info';
      }
      if (this.statusDot) this.statusDot.className = 'pulse-dot active-candidate';
      if (this.solverStatusTitle) this.solverStatusTitle.innerText = `2 orígenes (${candidates.length} candidatos)`;

      if (candidates.length > 0) {
        if (this.solverMessage) this.solverMessage.classList.add('hidden');
        if (this.targetCandidatesBox) {
          this.targetCandidatesBox.classList.remove('hidden');
          this.candidatesList.innerHTML = candidates.map((c, i) => `
            <div class="candidate-row-item">
              <span class="cand-label font-mono">Candidato ${i + 1}: ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}</span>
              <div class="cand-btns">
                <button class="btn btn-xs btn-primary" onclick="window.GeoApp.ui.quickSaveCandidate(${i})">💾 Guardar</button>
                <button class="btn btn-xs btn-secondary" onclick="window.GeoApp.ui.quickCenterCandidate(${i})">🎯 Fijar</button>
              </div>
            </div>
          `).join('');
        }
        if (this.targetCoordsBox) this.targetCoordsBox.classList.add('hidden');
      } else {
        if (this.solverMessage) {
          this.solverMessage.innerHTML = '⚠️ Los círculos no se intersectan directamente. Prueba ajustando las distancias o agrega un 3er origen.';
          this.solverMessage.classList.remove('hidden');
        }
        if (this.targetCandidatesBox) this.targetCandidatesBox.classList.add('hidden');
        if (this.targetCoordsBox) this.targetCoordsBox.classList.add('hidden');
      }
      return;
    }

    // 3 or more origins
    if (result.target && result.target.lat && result.target.lng) {
      const t = result.target;
      const acc = t.accuracyMeters !== undefined ? t.accuracyMeters : (t.accuracy || 0);

      if (this.appStatusBadge) {
        this.appStatusBadge.innerText = `±${acc.toFixed(1)}m`;
        this.appStatusBadge.className = 'badge badge-success';
      }
      if (this.statusDot) this.statusDot.className = 'pulse-dot active-solved';
      if (this.solverStatusTitle) this.solverStatusTitle.innerText = `🎯 Objetivo Encontrado (${count} orígenes)`;

      if (this.solverMessage) this.solverMessage.classList.add('hidden');
      if (this.targetCandidatesBox) this.targetCandidatesBox.classList.add('hidden');
      if (this.targetCoordsBox) {
        this.targetCoordsBox.classList.remove('hidden');
        if (this.targetCoordsText) this.targetCoordsText.innerText = `${t.lat.toFixed(6)}, ${t.lng.toFixed(6)}`;
        if (this.targetAccuracyBadge) this.targetAccuracyBadge.innerText = `Precisión: ±${acc.toFixed(1)} m`;
        if (this.targetMethodBadge) this.targetMethodBadge.innerText = `Método: ${result.status === 'solved' ? 'Mínimos Cuadrados (LM)' : 'Intersección Optima'}`;
      }
    } else {
      if (this.appStatusBadge) {
        this.appStatusBadge.innerText = `${count} Orígenes`;
        this.appStatusBadge.className = 'badge badge-secondary';
      }
      if (this.statusDot) this.statusDot.className = 'pulse-dot';
      if (this.solverStatusTitle) this.solverStatusTitle.innerText = `${count} orígenes activos`;
      if (this.solverMessage) {
        this.solverMessage.innerHTML = 'Calculando aproximación óptima...';
        this.solverMessage.classList.remove('hidden');
      }
      if (this.targetCandidatesBox) this.targetCandidatesBox.classList.add('hidden');
      if (this.targetCoordsBox) this.targetCoordsBox.classList.add('hidden');
    }
  }

  quickSaveCandidate(idx) {
    if (this.currentCalculation && this.currentCalculation.intersections && this.currentCalculation.intersections[idx]) {
      const pt = this.currentCalculation.intersections[idx];
      this.openCreateTargetModal({
        lat: pt.lat,
        lng: pt.lng,
        accuracyMeters: pt.gap || 0,
        notes: `Punto Candidato ${idx + 1} (2 orígenes)`
      });
    }
  }

  quickCenterCandidate(idx) {
    if (this.currentCalculation && this.currentCalculation.intersections && this.currentCalculation.intersections[idx]) {
      const pt = this.currentCalculation.intersections[idx];
      this.selectCandidateTarget(pt, idx);
    }
  }

  /* --------------------------------------------------------------------------
     Sidebar Origins List Rendering
     -------------------------------------------------------------------------- */

  renderOriginsList() {
    if (!this.originsList) return;
    const origins = this.markersManager.origins;

    if (this.originsHelperText) {
      this.originsHelperText.innerText = `${origins.length} registrado${origins.length === 1 ? '' : 's'}`;
    }

    if (origins.length === 0) {
      this.originsList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📍</div>
          <p>No has agregado puntos de origen todavía.</p>
          <small>Haz clic en cualquier lugar del mapa para agregar uno.</small>
        </div>
      `;
      return;
    }

    this.originsList.innerHTML = origins.map((o, idx) => {
      const displayDist = o.unit === 'km'
        ? (o.distance / 1000).toFixed(2)
        : (o.rawDistance || o.distance.toFixed(1));

      return `
        <div class="origin-card ${o.enabled === false ? 'disabled-origin-card' : ''}" data-id="${o.id}">
          <div class="origin-card-left">
            <span class="origin-card-badge" style="background: ${o.color || '#38bdf8'};">${idx + 1}</span>
          </div>
          <div class="origin-card-body" onclick="window.GeoApp.ui.panToOrigin('${o.id}')">
            <div class="origin-card-header">
              <strong class="origin-card-name">${o.label}</strong>
              <button class="origin-dist-chip" title="Haz clic para editar distancia" onclick="event.stopPropagation(); window.GeoApp.ui.promptEditDistance('${o.id}')">
                ${displayDist} ${o.unit || 'km'}
              </button>
            </div>
            <div class="origin-card-coords font-mono">
              ${o.lat.toFixed(5)}, ${o.lng.toFixed(5)}
            </div>
          </div>
          <div class="origin-card-actions">
            <button class="btn-icon-tiny" title="${o.enabled !== false ? 'Desactivar origen' : 'Activar origen'}" onclick="window.GeoApp.ui.toggleOriginState('${o.id}')">
              ${o.enabled !== false ? '👁️' : '🚫'}
            </button>
            <div class="reorder-btns">
              <button class="btn-icon-tiny" title="Mover arriba" ${idx === 0 ? 'disabled' : ''} onclick="window.GeoApp.ui.moveOriginItem('${o.id}', -1)">▲</button>
              <button class="btn-icon-tiny" title="Mover abajo" ${idx === origins.length - 1 ? 'disabled' : ''} onclick="window.GeoApp.ui.moveOriginItem('${o.id}', 1)">▼</button>
            </div>
            <button class="btn-icon-tiny btn-danger-tiny" title="Eliminar origen" onclick="window.GeoApp.ui.deleteOriginItem('${o.id}')">
              🗑️
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  panToOrigin(id) {
    const origin = this.markersManager.origins.find(o => o.id === id);
    if (origin) {
      this.mapController.setView(origin.lat, origin.lng, 15);
    }
  }

  promptEditDistance(id) {
    const origin = this.markersManager.origins.find(o => o.id === id);
    if (!origin) return;
    const currentVal = origin.unit === 'km' ? (origin.distance / 1000) : origin.distance;
    const input = prompt(`Nueva distancia para "${origin.label}" (en ${origin.unit || 'km'}):`, currentVal);
    if (input !== null) {
      const val = parseFloat(input);
      if (!isNaN(val) && val > 0) {
        this.markersManager.updateOrigin(id, { distance: val, unit: origin.unit || 'km' });
        this.refreshCalculations();
        this.showToast(`Distancia de "${origin.label}" actualizada.`, 'success');
      }
    }
  }

  toggleOriginState(id) {
    const state = this.markersManager.toggleOrigin(id);
    this.refreshCalculations();
    this.showToast(state ? 'Origen activado' : 'Origen desactivado', 'info');
  }

  moveOriginItem(id, direction) {
    if (this.markersManager.moveOrigin(id, direction)) {
      this.refreshCalculations();
    }
  }

  deleteOriginItem(id) {
    this.markersManager.removeOrigin(id);
    this.refreshCalculations();
    this.showToast('Origen eliminado.', 'info');
  }

  /* --------------------------------------------------------------------------
     Database of Saved Targets & Comparison Engine
     -------------------------------------------------------------------------- */

  openCreateTargetModal(target) {
    this.editingTargetId = null;
    this.currentModalMediaList = [];
    if (this.modalTargetTitle) this.modalTargetTitle.innerText = 'Guardar en Base de Datos';
    if (this.targetEditIdInput) this.targetEditIdInput.value = '';
    if (this.targetNameInput) this.targetNameInput.value = `Objetivo ${this.markersManager.savedTargets.length + 1}`;
    if (this.targetModalLat) this.targetModalLat.value = target.lat ? target.lat.toFixed(6) : '';
    if (this.targetModalLng) this.targetModalLng.value = target.lng ? target.lng.toFixed(6) : '';
    if (this.targetModalAccuracy) this.targetModalAccuracy.value = `±${target.accuracyMeters ? target.accuracyMeters.toFixed(1) : (target.accuracy ? target.accuracy.toFixed(1) : 0.0)} m`;
    if (this.targetDescInput) this.targetDescInput.value = target.notes || '';
    if (this.btnDeleteFromModal) this.btnDeleteFromModal.classList.add('hidden');

    this.selectColorInModal(this.markersManager.presetColors[0].hex);
    this.renderModalMediaPreviews();
    this.modalSaveTarget.classList.remove('hidden');
  }

  openEditTargetModal(targetId) {
    const target = this.markersManager.savedTargets.find(t => t.id === targetId);
    if (!target) return;

    this.editingTargetId = targetId;
    this.currentModalMediaList = target.mediaList ? [...target.mediaList] : [];
    if (this.modalTargetTitle) this.modalTargetTitle.innerText = 'Editar Punto en Base de Datos';
    if (this.targetEditIdInput) this.targetEditIdInput.value = targetId;
    if (this.targetNameInput) this.targetNameInput.value = target.name || '';
    if (this.targetCategoryInput) this.targetCategoryInput.value = target.category || 'target';
    if (this.targetModalLat) this.targetModalLat.value = target.lat.toFixed(6);
    if (this.targetModalLng) this.targetModalLng.value = target.lng.toFixed(6);
    if (this.targetModalAccuracy) this.targetModalAccuracy.value = `±${target.accuracy ? target.accuracy.toFixed(1) : 0.0} m`;
    if (this.targetDescInput) this.targetDescInput.value = target.description || '';
    if (this.btnDeleteFromModal) {
      this.btnDeleteFromModal.classList.remove('hidden');
      this.btnDeleteFromModal.onclick = () => {
        this.modalSaveTarget.classList.add('hidden');
        this.handleDeleteTarget(targetId, target.name);
      };
    }

    this.selectColorInModal(target.color || this.markersManager.presetColors[0].hex);
    this.renderModalMediaPreviews();
    this.modalSaveTarget.classList.remove('hidden');
  }

  selectColorInModal(colorHex) {
    this.selectedTargetColor = colorHex;
    if (this.targetColorInput) this.targetColorInput.value = colorHex;
    this.targetColorSwatches.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-color').toLowerCase() === colorHex.toLowerCase());
    });
  }

  renderModalMediaPreviews() {
    if (!this.targetMediaPreviewContainer) return;
    if (this.currentModalMediaList.length === 0) {
      this.targetMediaPreviewContainer.innerHTML = `
        <div class="empty-media-hint">
          Sin archivos adjuntos. Usa <strong>"Adjuntar"</strong> o presiona <strong>Ctrl + V</strong>.
        </div>
      `;
      return;
    }

    this.targetMediaPreviewContainer.innerHTML = this.currentModalMediaList.map((m, idx) => `
      <div class="media-thumb-item">
        ${m.type && m.type.startsWith('video/') ? `
          <div class="media-video-thumb">🎥</div>
        ` : `
          <img src="${m.dataUrl}" alt="${m.name}">
        `}
        <button type="button" class="btn-remove-media" onclick="window.GeoApp.ui.removeModalMedia(${idx})">✕</button>
      </div>
    `).join('');
  }

  removeModalMedia(idx) {
    this.currentModalMediaList.splice(idx, 1);
    this.renderModalMediaPreviews();
  }

  async handleConfirmSaveOrEditTarget() {
    const name = this.targetNameInput.value.trim();
    const lat = parseFloat(this.targetModalLat.value);
    const lng = parseFloat(this.targetModalLng.value);
    const category = this.targetCategoryInput.value;
    const description = this.targetDescInput.value.trim();
    const color = this.selectedTargetColor;

    if (!name || isNaN(lat) || isNaN(lng)) {
      this.showToast('Por favor completa el nombre y las coordenadas.', 'error');
      return;
    }

    // Save attached media into IndexedDB
    for (const item of this.currentModalMediaList) {
      await this.offlineManager.saveMedia(item);
    }

    if (this.editingTargetId) {
      const updated = this.markersManager.updateTarget(this.editingTargetId, {
        name,
        lat,
        lng,
        category,
        color,
        description,
        mediaList: this.currentModalMediaList
      });
      if (updated) {
        await this.offlineManager.saveTarget(updated);
      }
      this.showToast(`Punto "${name}" actualizado en la base de datos.`, 'success');
    } else {
      const accuracy = this.currentCalculation && this.currentCalculation.target
        ? (this.currentCalculation.target.accuracyMeters || this.currentCalculation.target.accuracy || 0)
        : 0;

      const created = this.markersManager.addTarget({
        name,
        lat,
        lng,
        accuracy,
        category,
        color,
        description,
        originsCount: this.markersManager.origins ? this.markersManager.origins.length : 0,
        originsSnapshot: JSON.parse(JSON.stringify(this.markersManager.origins)),
        mediaList: this.currentModalMediaList
      });
      await this.offlineManager.saveTarget(created);
      this.showToast(`Punto "${name}" guardado permanentemente en la base de datos.`, 'success');
    }

    this.modalSaveTarget.classList.add('hidden');
    this.renderSavedTargetsList();
    this.mapController.renderSavedTargets(
      this.markersManager.getFilteredTargets(),
      (id) => this.openEditTargetModal(id),
      (id, tname) => this.handleDeleteTarget(id, tname),
      (id) => this.handleReviewTarget(id)
    );
  }

  renderSavedTargetsList() {
    if (!this.savedMarkersList) return;
    const targets = this.markersManager.getFilteredTargets();

    if (this.savedCountEl) this.savedCountEl.innerText = this.markersManager.savedTargets.length;
    if (this.databaseCountHelper) this.databaseCountHelper.innerText = `${this.markersManager.savedTargets.length} en base de datos`;

    if (targets.length === 0) {
      this.savedMarkersList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📁</div>
          <p>No hay puntos guardados en la base de datos.</p>
          <small>Cuando calcules un objetivo, podrás guardarlo aquí para comparar o revisar.</small>
        </div>
      `;
      return;
    }

    this.savedMarkersList.innerHTML = targets.map(t => {
      const isSelectedForComp = this.markersManager.selectedForComparison.includes(t.id);
      const mediaBadge = t.mediaList && t.mediaList.length > 0
        ? `<span class="badge badge-info">📷 ${t.mediaList.length}</span>`
        : '';
      const originsBadge = t.originsCount
        ? `<span class="badge badge-secondary" title="${t.originsCount} orígenes usados">📍 ${t.originsCount} orig.</span>`
        : '';

      return `
        <div class="saved-target-card ${isSelectedForComp ? 'selected-for-comparison' : ''}" style="border-left-color: ${t.color || '#0284c7'};">
          <div class="saved-card-header">
            <div class="saved-card-title-group" onclick="window.GeoApp.ui.panToSavedTarget('${t.id}')">
              ${this.isCompareMode ? `
                <input type="checkbox" class="comp-checkbox" ${isSelectedForComp ? 'checked' : ''} onclick="event.stopPropagation(); window.GeoApp.ui.toggleTargetCompare('${t.id}')">
              ` : ''}
              <span class="dot-color-badge" style="background: ${t.color || '#0284c7'};"></span>
              <strong>${t.name}</strong>
            </div>
            <div class="saved-card-chips">
              <span class="badge badge-success">±${t.accuracy ? t.accuracy.toFixed(1) : 0}m</span>
              ${originsBadge}
              ${mediaBadge}
            </div>
          </div>
          <p class="saved-card-desc">${t.description || 'Sin notas de campo.'}</p>
          <div class="saved-card-footer">
            <span class="font-mono font-tiny">${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</span>
            <div class="saved-card-actions">
              <button class="btn btn-xs btn-outline" title="Cargar medición para revisión" onclick="window.GeoApp.ui.handleReviewTarget('${t.id}')">🔄 Revisar</button>
              <button class="btn btn-xs btn-secondary" onclick="window.GeoApp.ui.panToSavedTarget('${t.id}')">Ver</button>
              <button class="btn btn-xs btn-primary" onclick="window.GeoApp.ui.openEditTargetModal('${t.id}')">Editar</button>
              <button class="btn btn-xs btn-outline-danger" onclick="window.GeoApp.ui.handleDeleteTarget('${t.id}', '${t.name}')">🗑️</button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    this.updateComparisonCard();
  }

  toggleTargetCompare(targetId) {
    this.markersManager.toggleTargetComparisonSelection(targetId);
    this.renderSavedTargetsList();
  }

  updateComparisonCard() {
    if (!this.comparisonCard || !this.comparisonBody) return;
    const selected = this.markersManager.selectedForComparison;

    if (selected.length < 2) {
      this.mapController.clearComparison();
      if (this.isCompareMode) {
        this.comparisonCard.classList.remove('hidden');
        this.comparisonBody.innerHTML = `
          <p class="helper-text">Selecciona <strong>2 puntos</strong> de la lista para ver su distancia geodésica, azimut y comparativa.</p>
        `;
      } else {
        this.comparisonCard.classList.add('hidden');
      }
      return;
    }

    const comp = this.markersManager.compareTargets(selected[0], selected[1]);
    if (!comp) return;

    this.comparisonCard.classList.remove('hidden');
    this.comparisonBody.innerHTML = `
      <div class="comparison-grid">
        <div class="comp-pair-names">
          <strong>${comp.targetA.name}</strong> ↔ <strong>${comp.targetB.name}</strong>
        </div>
        <div class="comp-stat-row">
          <span>📏 Distancia Directa:</span>
          <strong class="font-mono" style="color: var(--accent-primary);">
            ${comp.distanceMeters >= 1000 ? `${comp.distanceKm.toFixed(2)} km` : `${comp.distanceMeters.toFixed(1)} m`}
          </strong>
        </div>
        <div class="comp-stat-row">
          <span>🧭 Rumbo / Azimut:</span>
          <strong class="font-mono">${comp.bearingDeg.toFixed(1)}° (${comp.bearingText})</strong>
        </div>
        <div class="comp-stat-row">
          <span>🎯 Dif. de Precisión:</span>
          <span class="font-mono">±${comp.accuracyDelta.toFixed(1)} m</span>
        </div>
      </div>
      <div style="margin-top: 8px; display: flex; gap: 6px;">
        <button class="btn btn-xs btn-primary btn-block" onclick="window.GeoApp.ui.highlightComparisonOnMap('${selected[0]}', '${selected[1]}')">
          ⛶ Ver Línea y Ajustar en Mapa
        </button>
      </div>
    `;

    // Render comparison polyline on map
    this.mapController.renderComparison(comp.targetA, comp.targetB, comp);
  }

  highlightComparisonOnMap(idA, idB) {
    const comp = this.markersManager.compareTargets(idA, idB);
    if (comp) {
      this.mapController.renderComparison(comp.targetA, comp.targetB, comp);
      this.showToast(`Distancia calculada: ${comp.distanceMeters >= 1000 ? `${comp.distanceKm.toFixed(2)} km` : `${comp.distanceMeters.toFixed(1)} m`}`, 'success');
    }
  }

  panToSavedTarget(id) {
    const t = this.markersManager.getTargetById(id);
    if (t) {
      this.mapController.setView(t.lat, t.lng, 16);
    }
  }

  filterSavedTargetsList() {
    const query = (this.inputSearchSaved ? this.inputSearchSaved.value.toLowerCase().trim() : '');
    const activeColor = this.markersManager.activeColorFilter;

    const filtered = this.markersManager.savedTargets.filter(t => {
      const matchQuery = !query || t.name.toLowerCase().includes(query) || (t.description && t.description.toLowerCase().includes(query)) || (t.category && t.category.toLowerCase().includes(query));
      const matchColor = !activeColor || t.color.toLowerCase() === activeColor.toLowerCase();
      return matchQuery && matchColor;
    });

    if (this.savedMarkersList) {
      if (filtered.length === 0) {
        this.savedMarkersList.innerHTML = `
          <div class="empty-state">
            <p>No se encontraron puntos con los filtros aplicados.</p>
          </div>
        `;
        return;
      }

      this.savedMarkersList.innerHTML = filtered.map(t => {
        const isSelectedForComp = this.markersManager.selectedForComparison.includes(t.id);
        return `
          <div class="saved-target-card ${isSelectedForComp ? 'selected-for-comparison' : ''}" style="border-left-color: ${t.color || '#0284c7'};">
            <div class="saved-card-header">
              <div class="saved-card-title-group" onclick="window.GeoApp.ui.panToSavedTarget('${t.id}')">
                ${this.isCompareMode ? `
                  <input type="checkbox" class="comp-checkbox" ${isSelectedForComp ? 'checked' : ''} onclick="event.stopPropagation(); window.GeoApp.ui.toggleTargetCompare('${t.id}')">
                ` : ''}
                <span class="dot-color-badge" style="background: ${t.color || '#0284c7'};"></span>
                <strong>${t.name}</strong>
              </div>
              <div class="saved-card-chips">
                <span class="badge badge-success">±${t.accuracy ? t.accuracy.toFixed(1) : 0}m</span>
              </div>
            </div>
            <p class="saved-card-desc">${t.description || 'Sin notas.'}</p>
            <div class="saved-card-footer">
              <span class="font-mono font-tiny">${t.lat.toFixed(5)}, ${t.lng.toFixed(5)}</span>
              <div class="saved-card-actions">
                <button class="btn btn-xs btn-outline" onclick="window.GeoApp.ui.handleReviewTarget('${t.id}')">🔄 Revisar</button>
                <button class="btn btn-xs btn-secondary" onclick="window.GeoApp.ui.panToSavedTarget('${t.id}')">Ver</button>
                <button class="btn btn-xs btn-primary" onclick="window.GeoApp.ui.openEditTargetModal('${t.id}')">Editar</button>
                <button class="btn btn-xs btn-outline-danger" onclick="window.GeoApp.ui.handleDeleteTarget('${t.id}', '${t.name}')">🗑️</button>
              </div>
            </div>
          </div>
        `;
      }).join('');
    }
  }

  /* --------------------------------------------------------------------------
     Offline Downloader Handlers
     -------------------------------------------------------------------------- */

  async updateOfflineEstimate() {
    let bounds;
    if (this.selectedZonePreset === 'managua-core') {
      bounds = {
        minLat: 12.0600,
        maxLat: 12.1800,
        minLng: -86.3400,
        maxLng: -86.1900
      };
    } else if (this.selectedZonePreset === 'current-view') {
      const mapBounds = this.mapController.getBounds();
      bounds = {
        minLat: mapBounds.getSouth(),
        maxLat: mapBounds.getNorth(),
        minLng: mapBounds.getWest(),
        maxLng: mapBounds.getEast()
      };
    } else if (this.selectedZonePreset === 'custom-box' && this.customSelectedBounds) {
      bounds = {
        minLat: this.customSelectedBounds.getSouth(),
        maxLat: this.customSelectedBounds.getNorth(),
        minLng: this.customSelectedBounds.getWest(),
        maxLng: this.customSelectedBounds.getEast()
      };
    } else {
      bounds = { minLat: 12.06, maxLat: 12.18, minLng: -86.34, maxLng: -86.19 };
    }

    const minZoom = parseInt(this.selectZoomMin.value, 10) || 12;
    const maxZoom = parseInt(this.selectZoomMax.value, 10) || 15;

    const estimate = this.offlineManager.estimatePack(bounds, minZoom, maxZoom);
    if (this.estimateTileCount) this.estimateTileCount.innerText = `~${estimate.tileCount.toLocaleString()}`;
    if (this.estimateStorageSize) this.estimateStorageSize.innerText = `~${estimate.estimatedSizeMB} MB`;

    const cached = await this.offlineManager.getCachedTileCount();
    if (this.currentCachedCount) this.currentCachedCount.innerText = cached.toLocaleString();
  }

  async handleStartOfflineDownload() {
    let bounds;
    let name = 'Zona Personalizada';

    if (this.selectedZonePreset === 'managua-core') {
      name = 'Managua Completa';
      bounds = { minLat: 12.0600, maxLat: 12.1800, minLng: -86.3400, maxLng: -86.1900 };
    } else if (this.selectedZonePreset === 'current-view') {
      name = 'Vista Actual del Mapa';
      const mapBounds = this.mapController.getBounds();
      bounds = {
        minLat: mapBounds.getSouth(),
        maxLat: mapBounds.getNorth(),
        minLng: mapBounds.getWest(),
        maxLng: mapBounds.getEast()
      };
    } else if (this.customSelectedBounds) {
      name = 'Área Dibujada';
      bounds = {
        minLat: this.customSelectedBounds.getSouth(),
        maxLat: this.customSelectedBounds.getNorth(),
        minLng: this.customSelectedBounds.getWest(),
        maxLng: this.customSelectedBounds.getEast()
      };
    } else {
      bounds = { minLat: 12.06, maxLat: 12.18, minLng: -86.34, maxLng: -86.19 };
    }

    const minZoom = parseInt(this.selectZoomMin.value, 10) || 12;
    const maxZoom = parseInt(this.selectZoomMax.value, 10) || 15;

    this.downloadProgressWrap.classList.remove('hidden');
    this.btnStartDownload.classList.add('hidden');
    this.btnCancelDownload.classList.remove('hidden');

    try {
      await this.offlineManager.downloadZone({
        name,
        bounds,
        minZoom,
        maxZoom,
        onProgress: (progress) => {
          this.downloadProgressStatus.innerText = `Descargando: ${progress.downloaded} / ${progress.total} teselas (${progress.failed} errores)`;
          this.downloadProgressPercent.innerText = `${progress.percent}%`;
          this.downloadProgressFill.style.width = `${progress.percent}%`;
        }
      });

      this.showToast('¡Descarga offline completada con éxito!', 'success');
      this.updateOfflineEstimate();
      this.updateStoredPacksList();
    } catch (e) {
      this.showToast(`Descarga interrumpida: ${e.message}`, 'error');
    } finally {
      this.btnStartDownload.classList.remove('hidden');
      this.btnCancelDownload.classList.add('hidden');
    }
  }

  async updateStoredPacksList() {
    if (!this.storedPacksList) return;
    const packs = await this.offlineManager.getStoredPacks();
    if (packs.length === 0) {
      this.storedPacksList.innerHTML = '<div class="pack-item empty-pack">No hay zonas descargadas aún.</div>';
      return;
    }

    this.storedPacksList.innerHTML = packs.map(p => `
      <div class="pack-item">
        <div>
          <strong>${p.name}</strong><br>
          <small>${p.tileCount} teselas • Zoom ${p.minZoom}-${p.maxZoom}</small>
        </div>
        <button class="btn btn-xs btn-outline-danger" onclick="window.GeoApp.ui.deleteOfflinePack('${p.id}')">Eliminar</button>
      </div>
    `).join('');
  }

  async deleteOfflinePack(id) {
    await this.offlineManager.deletePack(id);
    this.updateStoredPacksList();
    this.updateOfflineEstimate();
    this.showToast('Paquete offline eliminado.', 'info');
  }

  /* --------------------------------------------------------------------------
     Toast & Utility Helpers
     -------------------------------------------------------------------------- */

  showToast(message, type = 'info') {
    if (!this.toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-content">${message}</div>
      <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    this.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('toast-show');
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
