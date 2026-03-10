import { Injectable } from '@angular/core';
import { POI, Connection } from '../models/poi.model';

@Injectable({
  providedIn: 'root'
})
export class GisService {
  // Default frequency in MHz (2.4 GHz)
  private readonly DEFAULT_FREQUENCY = 2400;
  // Fallback fallback distance to avoid log(0)
  private readonly MIN_DISTANCE_KM = 0.001;

  constructor() { }

  /**
   * Calculate distance between two points using Haversine formula
   * @param lat1 Latitude of point 1
   * @param lon1 Longitude of point 1
   * @param lat2 Latitude of point 2
   * @param lon2 Longitude of point 2
   * @returns Distance in kilometers
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    
    return Math.round(distance * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate signal strength based on ITU-R P.525 Free-Space Path Loss (FSPL) model
   * Formula: FSPL(dB) = 20*log10(d) + 20*log10(f) + 32.44
   * @param distance Distance in kilometers
   * @param hasLineOfSight Whether line of sight is clear
   * @param clearance Minimum clearance in meters
   * @returns Signal strength Quality (0-100 percentage)
   */
  calculateSignalStrength(distance: number, hasLineOfSight: boolean = true, clearance: number = 0): number {
    const d = Math.max(this.MIN_DISTANCE_KM, distance);
    
    // Free-Space Path Loss (dB)
    const fspl = 20 * Math.log10(d) + 20 * Math.log10(this.DEFAULT_FREQUENCY) + 32.44;
    
    // Standard Access Point / Radio Link hardware assumptions
    const txPower = 20; // 20 dBm (100mW)
    const txGain = 15;  // 15 dBi directional antenna
    const rxGain = 15;  // 15 dBi directional antenna
    
    // Received Signal Power (dBm)
    let rxPower = txPower + txGain + rxGain - fspl;
    
    // Apply terrain diffraction/obstacle loss if Line of Sight is blocked
    if (!hasLineOfSight && clearance < 0) {
      // Knife-edge diffraction approximation: subtract dB based on blockage severity
      const blockageLoss = Math.abs(clearance) * 0.5; // 0.5 dB loss per meter of blockage
      rxPower -= Math.min(40, blockageLoss); // Cap maximum penalty at 40 dB
    } else if (hasLineOfSight && clearance > 0) {
      // Slight bonus for excellent Fresnel zone clearance
      rxPower += Math.min(3, clearance * 0.1); 
    }

    // Map Absolute Rx Power (dBm) to a reliable 0-100% Quality Metric
    // Assuming -50 dBm is Excellent (100%) and -90 dBm is No Signal (0%)
    const maxRx = -50;
    const minRx = -90;
    
    let strength = ((rxPower - minRx) / (maxRx - minRx)) * 100;
    
    return Math.max(0, Math.min(100, Math.round(strength)));
  }

  /**
   * Get color based on signal strength
   * Green = strong (>70), Yellow = medium (40-70), Red = weak (<40)
   * @param signalStrength Signal strength value
   * @returns Color string
   */
  getSignalColor(signalStrength: number): string {
    if (signalStrength > 70) return '#00ff00'; // Green
    if (signalStrength > 40) return '#ffff00'; // Yellow
    return '#ff0000'; // Red
  }

  /**
   * Get signal strength category
   * @param signalStrength Signal strength value
   * @returns Category string
   */
  getSignalCategory(signalStrength: number): string {
    if (signalStrength > 70) return 'Strong';
    if (signalStrength > 40) return 'Medium';
    return 'Weak';
  }

  /**
   * Create a connection between two POIs
   * @param fromPOI Starting point
   * @param toPOI Ending point
   * @returns Connection object
   */
  createConnection(fromPOI: POI, toPOI: POI): Connection {
    const distance = this.calculateDistance(
      fromPOI.latitude,
      fromPOI.longitude,
      toPOI.latitude,
      toPOI.longitude
    );
    
    const signalStrength = this.calculateSignalStrength(distance);
    
    return {
      id: `${fromPOI.id}-${toPOI.id}`,
      fromPOI,
      toPOI,
      distance,
      signalStrength
    };
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
