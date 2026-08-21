/**
 * GeoTrilateración - Main Application Bootstrap
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Instantiate Core Subsystems
  const markersManager = new MarkersManager();
  const solver = new TrilaterationSolver({
    tolerance: markersManager.settings.solverTolerance || 0.05
  });
  const offlineManager = new OfflineMapManager();

  // Apply saved theme
  if (markersManager.settings.theme) {
    document.documentElement.setAttribute('data-theme', markersManager.settings.theme);
  }

  // 2. Instantiate Map Controller
  const mapController = new MapController('map', {
    onOriginPlaced: (latlng) => {
      // User clicked on map to set a new origin point: open the quick origin floating dialog!
      ui.openAddOriginModal(latlng);
    },

    onOriginMoved: (id, newLat, newLng) => {
      markersManager.updateOrigin(id, { lat: newLat, lng: newLng });
      ui.refreshCalculations();
      ui.showToast('Origen reubicado y cálculo actualizado.', 'info');
    },

    onBoxSelected: (bounds) => {
      ui.customSelectedBounds = bounds;
      ui.modalOffline.classList.remove('hidden');
      ui.updateOfflineEstimate();
      ui.showToast('Área personalizada seleccionada.', 'success');
    },

    onCandidateSelected: (candidatePoint, idx) => {
      ui.selectCandidateTarget(candidatePoint, idx);
    },

    onSaveCandidate: (candidatePoint, idx) => {
      ui.openCreateTargetModal({
        lat: candidatePoint.lat,
        lng: candidatePoint.lng,
        accuracyMeters: candidatePoint.gap || 0,
        notes: `Punto encontrado con 2 orígenes (Candidato ${idx !== undefined ? idx + 1 : ''})`
      });
    },

    onSaveEstimatedTarget: (target) => {
      ui.openCreateTargetModal(target);
    },

    onDismissEstimatedTarget: () => {
      ui.dismissEstimatedTarget();
    }
  });

  // Initialize Map
  mapController.init(offlineManager);

  // 3. Instantiate UI Controller
  const ui = new UIController(markersManager, solver, offlineManager, mapController);

  // Render initial state
  ui.refreshCalculations();
  mapController.renderSavedTargets(
    markersManager.getFilteredTargets(),
    (id) => ui.openEditTargetModal(id),
    (id, name) => ui.handleDeleteTarget(id, name)
  );

  // If there are existing origins or targets, fit view to them
  const initialBounds = mapController.getAllBounds(
    markersManager.origins,
    ui.currentCalculation && ui.currentCalculation.target ? ui.currentCalculation.target : null
  );
  if (initialBounds) {
    mapController.fitBounds(initialBounds);
  }

  // 4. Register Service Worker for 100% Offline PWA Capability
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          console.log('Service Worker registered with scope:', reg.scope);
        })
        .catch((err) => {
          console.warn('Service Worker registration failed:', err);
        });
    });
  }

  // Expose global app instance for debugging/testing
  window.GeoApp = {
    markersManager,
    solver,
    offlineManager,
    mapController,
    ui
  };
});
