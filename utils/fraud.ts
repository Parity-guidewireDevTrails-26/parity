/**
 * Fraud Detector for Parametric Triggers.
 * Validates whether the Rider's current GPS location successfully matches
 * the geofenced polygon of the reported systemic disruption.
 *
 * @param {Object} riderGPS - { lat: number, lng: number, device_mocked: boolean, vpn_active: boolean }
 * @param {Object} disruptionZone - { centerLat: number, centerLng: number, radiusKm: number }
 * @returns {Object} { isApproved: boolean, fraudFlag: string | null }
 */
export function detectFraud(
    riderGPS: { lat: number; lng: number; device_mocked: boolean; vpn_active: boolean },
    disruptionZone: { centerLat: number; centerLng: number; radiusKm: number }
  ) {
    // 1. Hardware Integrity Check
    if (riderGPS.device_mocked) {
      return { isApproved: false, fraudFlag: 'LOCATION_SPOOFING_DETECTED' };
    }
    if (riderGPS.vpn_active) {
      return { isApproved: false, fraudFlag: 'VPN_GEOFENCE_BYPASS_ATTEMPT' };
    }
  
    // 2. Haversine Distance Calculation
    const R = 6371; // Earth's radius in km
    const dLat = (disruptionZone.centerLat - riderGPS.lat) * (Math.PI / 180);
    const dLng = (disruptionZone.centerLng - riderGPS.lng) * (Math.PI / 180);
  
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(riderGPS.lat * (Math.PI / 180)) * Math.cos(disruptionZone.centerLat * (Math.PI / 180)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distanceKm = R * c;
  
    // 3. Evaluate Proximity
    if (distanceKm <= disruptionZone.radiusKm) {
        return { isApproved: true, fraudFlag: null, distanceOffCenter: distanceKm.toFixed(2) };
    }
  
    return { isApproved: false, fraudFlag: 'GPS_OUT_OF_BOUNDS_MISMATCH', distanceOffCenter: distanceKm.toFixed(2) };
  }
  
