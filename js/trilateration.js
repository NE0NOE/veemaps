/**
 * GeoTrilateration Engine
 * Mathematical Geodesic Multilateration & Circle Intersection Solver
 */

class TrilaterationSolver {
  constructor(options = {}) {
    this.EARTH_RADIUS = options.earthRadius || 6371000; // meters (WGS-84 mean radius)
    this.tolerance = options.tolerance || 0.01;        // convergence tolerance in meters
    this.maxIterations = options.maxIterations || 100;
  }

  /**
   * Convert Degrees to Radians
   */
  toRadians(degrees) {
    return (degrees * Math.PI) / 180;
  }

  /**
   * Convert Radians to Degrees
   */
  toDegrees(radians) {
    return (radians * 180) / Math.PI;
  }

  /**
   * Great circle distance (Haversine formula) in meters
   */
  getDistance(lat1, lon1, lat2, lon2) {
    const phi1 = this.toRadians(lat1);
    const phi2 = this.toRadians(lat2);
    const deltaPhi = this.toRadians(lat2 - lat1);
    const deltaLambda = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return this.EARTH_RADIUS * c;
  }

  /**
   * Compute initial bearing from Point 1 to Point 2 in degrees (0-360)
   */
  getBearing(lat1, lon1, lat2, lon2) {
    const phi1 = this.toRadians(lat1);
    const phi2 = this.toRadians(lat2);
    const deltaLambda = this.toRadians(lon2 - lon1);

    const y = Math.sin(deltaLambda) * Math.cos(phi2);
    const x =
      Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

    const theta = Math.atan2(y, x);
    return (this.toDegrees(theta) + 360) % 360;
  }

  /**
   * Destination point given start, bearing and distance
   */
  getDestinationPoint(lat, lon, bearingDeg, distanceMeters) {
    const delta = distanceMeters / this.EARTH_RADIUS;
    const theta = this.toRadians(bearingDeg);
    const phi1 = this.toRadians(lat);
    const lambda1 = this.toRadians(lon);

    const phi2 = Math.asin(
      Math.sin(phi1) * Math.cos(delta) +
      Math.cos(phi1) * Math.sin(delta) * Math.cos(theta)
    );

    const lambda2 =
      lambda1 +
      Math.atan2(
        Math.sin(theta) * Math.sin(delta) * Math.cos(phi1),
        Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2)
      );

    return {
      lat: this.toDegrees(phi2),
      lng: ((this.toDegrees(lambda2) + 540) % 360) - 180
    };
  }

  /**
   * Project geographic coordinates (lat, lon) to local Cartesian plane (x, y in meters)
   * centered around (refLat, refLon)
   */
  projectToLocalPlane(lat, lon, refLat, refLon) {
    const phi = this.toRadians(lat);
    const refPhi = this.toRadians(refLat);
    const deltaLambda = this.toRadians(lon - refLon);
    const deltaPhi = this.toRadians(lat - refLat);

    const x = this.EARTH_RADIUS * deltaLambda * Math.cos(refPhi);
    const y = this.EARTH_RADIUS * deltaPhi;
    return { x, y };
  }

  /**
   * Unproject local Cartesian plane (x, y in meters) back to geographic (lat, lon)
   */
  unprojectFromLocalPlane(x, y, refLat, refLon) {
    const refPhi = this.toRadians(refLat);
    const lat = refLat + this.toDegrees(y / this.EARTH_RADIUS);
    const lon = refLon + this.toDegrees(x / (this.EARTH_RADIUS * Math.cos(refPhi)));
    return { lat, lng: lon };
  }

  /**
   * Calculate exact 2-circle intersections on local plane
   * Returns array of 0, 1 or 2 intersection points { lat, lng, isTangent }
   */
  getCircleIntersections(o1, o2, refLat, refLon) {
    const p1 = this.projectToLocalPlane(o1.lat, o1.lng, refLat, refLon);
    const p2 = this.projectToLocalPlane(o2.lat, o2.lng, refLat, refLon);
    const r1 = o1.distance;
    const r2 = o2.distance;

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const d = Math.hypot(dx, dy);

    if (d === 0) return []; // Concentric circles

    // Circles do not intersect (too far apart or one inside another)
    if (d > r1 + r2) {
      // Return midpoint between closest boundaries as approximation
      const factor = r1 + (d - (r1 + r2)) / 2;
      const x = p1.x + (dx * factor) / d;
      const y = p1.y + (dy * factor) / d;
      const geo = this.unprojectFromLocalPlane(x, y, refLat, refLon);
      return [{ ...geo, isApproximate: true, gap: d - (r1 + r2) }];
    }

    if (d < Math.abs(r1 - r2)) {
      // One circle inside another with no touch
      return [];
    }

    // Radical distance from p1 along the center line
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const hSquare = r1 * r1 - a * a;
    const h = Math.sqrt(Math.max(0, hSquare));

    // Intermediate point on center line
    const p2x = p1.x + (dx * a) / d;
    const p2y = p1.y + (dy * a) / d;

    // Tangent condition
    if (h < 1e-4) {
      const geo = this.unprojectFromLocalPlane(p2x, p2y, refLat, refLon);
      return [{ ...geo, isTangent: true }];
    }

    // Two distinct intersection points
    const rx = -dy * (h / d);
    const ry = dx * (h / d);

    const i1 = this.unprojectFromLocalPlane(p2x + rx, p2y + ry, refLat, refLon);
    const i2 = this.unprojectFromLocalPlane(p2x - rx, p2y - ry, refLat, refLon);

    return [i1, i2];
  }

  /**
   * Main Trilateration / Multilateration Solver
   * Supports:
   *  - 1 Origin: returns infinite candidate circle description
   *  - 2 Origins: returns 2 candidate coordinates with ambiguity
   *  - 3+ Origins: Non-linear least squares optimization (Levenberg-Marquardt)
   */
  solve(origins) {
    const activeOrigins = origins.filter(o => o.enabled !== false && o.distance > 0);

    if (activeOrigins.length === 0) {
      return { status: 'no_data', message: 'No hay orígenes activos para calcular.' };
    }

    if (activeOrigins.length === 1) {
      const o = activeOrigins[0];
      return {
        status: 'single_origin',
        originCount: 1,
        message: '1 origen registrado: El objetivo se encuentra en cualquier punto sobre la circunferencia trazada.',
        origin: o,
        candidateCircle: { lat: o.lat, lng: o.lng, radius: o.distance }
      };
    }

    // Centroid of all origins to use as local projection reference
    const refLat = activeOrigins.reduce((sum, o) => sum + o.lat, 0) / activeOrigins.length;
    const refLon = activeOrigins.reduce((sum, o) => sum + o.lng, 0) / activeOrigins.length;

    // Collect all pairwise intersections
    const allIntersections = [];
    for (let i = 0; i < activeOrigins.length; i++) {
      for (let j = i + 1; j < activeOrigins.length; j++) {
        const pts = this.getCircleIntersections(activeOrigins[i], activeOrigins[j], refLat, refLon);
        pts.forEach(pt => {
          allIntersections.push({
            ...pt,
            pair: [activeOrigins[i].id || i, activeOrigins[j].id || j]
          });
        });
      }
    }

    if (activeOrigins.length === 2) {
      const intersections = this.getCircleIntersections(activeOrigins[0], activeOrigins[1], refLat, refLon);
      return {
        status: 'two_origins',
        originCount: 2,
        intersections,
        allIntersections,
        message: intersections.length === 2
          ? '2 intersecciones encontradas. Agrega un 3er origen para descartar el punto ambiguo.'
          : 'Círculos tangentes o aproximados.',
        recommendation: this.getRecommendedNextOrigin(activeOrigins, intersections)
      };
    }

    // 3 or more points: Non-linear Least Squares optimization (Gauss-Newton / Levenberg-Marquardt)
    // Project all active points to local plane
    const localPoints = activeOrigins.map(o => {
      const p = this.projectToLocalPlane(o.lat, o.lng, refLat, refLon);
      return { x: p.x, y: p.y, r: o.distance };
    });

    // Seed estimate: Average of pairwise intersections or centroid of origins
    let currX = 0;
    let currY = 0;

    if (allIntersections.length > 0) {
      // Compute centroid of intersections
      const validPts = allIntersections.map(p => this.projectToLocalPlane(p.lat, p.lng, refLat, refLon));
      currX = validPts.reduce((acc, p) => acc + p.x, 0) / validPts.length;
      currY = validPts.reduce((acc, p) => acc + p.y, 0) / validPts.length;
    } else {
      currX = localPoints.reduce((acc, p) => acc + p.x, 0) / localPoints.length;
      currY = localPoints.reduce((acc, p) => acc + p.y, 0) / localPoints.length;
    }

    // Levenberg-Marquardt Loop
    let lambda = 0.001;
    let converged = false;
    let iteration = 0;

    for (iteration = 0; iteration < this.maxIterations; iteration++) {
      let JtJ_00 = 0, JtJ_01 = 0, JtJ_11 = 0;
      let Jte_0 = 0, Jte_1 = 0;
      let totalResidual = 0;

      for (let i = 0; i < localPoints.length; i++) {
        const p = localPoints[i];
        const dx = currX - p.x;
        const dy = currY - p.y;
        const d = Math.hypot(dx, dy) || 1e-6;
        const err = d - p.r; // residual

        totalResidual += err * err;

        // Jacobian row: [ dx/d, dy/d ]
        const jx = dx / d;
        const jy = dy / d;

        JtJ_00 += jx * jx;
        JtJ_01 += jx * jy;
        JtJ_11 += jy * jy;

        Jte_0 += jx * err;
        Jte_1 += jy * err;
      }

      // Damped Normal equations (J^T J + lambda * I) * delta = - J^T e
      const a = JtJ_00 + lambda;
      const b = JtJ_01;
      const c = JtJ_11 + lambda;
      const det = a * c - b * b;

      if (Math.abs(det) < 1e-12) {
        lambda *= 10;
        continue;
      }

      const deltaX = -(c * Jte_0 - b * Jte_1) / det;
      const deltaY = -(a * Jte_1 - b * Jte_0) / det;

      const stepSize = Math.hypot(deltaX, deltaY);

      if (stepSize < this.tolerance) {
        converged = true;
        currX += deltaX;
        currY += deltaY;
        break;
      }

      // Check if candidate step improves residual
      const nextX = currX + deltaX;
      const nextY = currY + deltaY;
      let nextResidual = 0;
      for (let i = 0; i < localPoints.length; i++) {
        const p = localPoints[i];
        const d = Math.hypot(nextX - p.x, nextY - p.y);
        const err = d - p.r;
        nextResidual += err * err;
      }

      if (nextResidual < totalResidual) {
        lambda = Math.max(1e-7, lambda / 10);
        currX = nextX;
        currY = nextY;
      } else {
        lambda *= 10;
      }
    }

    // Compute final residuals and RMS error
    let sumSquaredErr = 0;
    const originsWithResiduals = activeOrigins.map((o, idx) => {
      const p = localPoints[idx];
      const calcDist = Math.hypot(currX - p.x, currY - p.y);
      const residual = calcDist - o.distance;
      sumSquaredErr += residual * residual;
      return {
        ...o,
        calculatedDistance: calcDist,
        residualMeters: residual
      };
    });

    const rmse = Math.sqrt(sumSquaredErr / activeOrigins.length);
    const estimatedGeo = this.unprojectFromLocalPlane(currX, currY, refLat, refLon);

    return {
      status: 'solved',
      originCount: activeOrigins.length,
      target: {
        lat: estimatedGeo.lat,
        lng: estimatedGeo.lng,
        accuracyMeters: rmse,
        confidenceRadius: Math.max(1.0, rmse * 1.96) // 95% confidence interval
      },
      allIntersections,
      originsWithResiduals,
      iterations: iteration,
      converged,
      message: `Punto final localizado con precisión ±${rmse.toFixed(1)} m.`
    };
  }

  /**
   * Helper: Suggest a recommended angular bearing to place a next origin
   * for optimal geometric dilution of precision (GDOP)
   */
  getRecommendedNextOrigin(activeOrigins, candidatePoints) {
    if (activeOrigins.length < 2 || candidatePoints.length < 2) return null;
    const p1 = candidatePoints[0];
    const p2 = candidatePoints[1];
    const bearing = this.getBearing(p1.lat, p1.lng, p2.lat, p2.lng);
    const midLat = (p1.lat + p2.lat) / 2;
    const midLng = (p1.lng + p2.lng) / 2;

    // Perpendicular angle to the line between candidates
    const perpBearing = (bearing + 90) % 360;
    return {
      midLat,
      midLng,
      suggestedBearing: perpBearing,
      hint: `Coloca tu siguiente medición en un ángulo perpendicular (~${Math.round(perpBearing)}°) para resolver la ambigüedad con máxima certeza.`
    };
  }
}

// Attach to window
window.TrilaterationSolver = TrilaterationSolver;
