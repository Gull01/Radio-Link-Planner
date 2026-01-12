import { Injectable } from '@angular/core';
import { POI, Connection } from '../models/poi.model';

@Injectable({
  providedIn: 'root'
})
export class GisService {
  // Maximum signal strength
  private readonly MAX_SIGNAL_STRENGTH = 100;
  // Signal attenuation factor (signal loss per km)
  private readonly ATTENUATION_FACTOR = 5;

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
   * Calculate signal strength based on distance and line of sight
   * Formula: Strength = MAX_SIGNAL_STRENGTH - (Distance * ATTENUATION_FACTOR)
   * Bonus for clear line of sight
   * @param distance Distance in kilometers
   * @param hasLineOfSight Whether line of sight is clear
   * @param clearance Minimum clearance in meters
   * @returns Signal strength (0-100)
   */
  calculateSignalStrength(distance: number, hasLineOfSight: boolean = true, clearance: number = 0): number {
    let strength = this.MAX_SIGNAL_STRENGTH - (distance * this.ATTENUATION_FACTOR);
    
    // Apply line of sight bonus/penalty
    if (hasLineOfSight) {
      // Bonus for clear line of sight (up to +15%)
      const losBonus = Math.min(15, clearance);
      strength += losBonus;
    } else {
      // Penalty for blocked line of sight
      const losPenalty = Math.abs(clearance) * 2;
      strength -= Math.min(30, losPenalty);
    }
    
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
