import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ElevationService {
  private readonly ELEVATION_API = 'https://api.open-elevation.com/api/v1/lookup';

  constructor() { }

  /**
   * Get elevation for a single point
   * @param latitude Latitude
   * @param longitude Longitude
   * @returns Promise with elevation in meters
   */
  async getElevation(latitude: number, longitude: number): Promise<number> {
    try {
      const response = await fetch(
        `${this.ELEVATION_API}?locations=${latitude},${longitude}`
      );
      const data = await response.json();
      return data.results[0]?.elevation || 0;
    } catch (error) {
      console.error('Error fetching elevation:', error);
      return 0;
    }
  }

  /**
   * Get elevation profile between two points
   * @param lat1 Start latitude
   * @param lon1 Start longitude
   * @param lat2 End latitude
   * @param lon2 End longitude
   * @param samples Number of points to sample
   * @returns Array of elevation points
   */
  async getElevationProfile(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
    samples: number = 20
  ): Promise<{ distance: number; elevation: number; lat: number; lon: number }[]> {
    const points: { distance: number; elevation: number; lat: number; lon: number }[] = [];
    const locations: string[] = [];

    // Generate intermediate points
    for (let i = 0; i <= samples; i++) {
      const ratio = i / samples;
      const lat = lat1 + (lat2 - lat1) * ratio;
      const lon = lon1 + (lon2 - lon1) * ratio;
      locations.push(`${lat},${lon}`);
    }

    try {
      // Fetch elevations in batches (API limit)
      const batchSize = 50;
      const elevations: number[] = [];

      for (let i = 0; i < locations.length; i += batchSize) {
        const batch = locations.slice(i, i + batchSize);
        const response = await fetch(
          `${this.ELEVATION_API}?locations=${batch.join('|')}`
        );
        const data = await response.json();
        elevations.push(...data.results.map((r: any) => r.elevation || 0));
      }

      // Calculate distances and build profile
      const totalDistance = this.haversineDistance(lat1, lon1, lat2, lon2);
      
      for (let i = 0; i <= samples; i++) {
        const ratio = i / samples;
        const lat = lat1 + (lat2 - lat1) * ratio;
        const lon = lon1 + (lon2 - lon1) * ratio;
        
        points.push({
          distance: totalDistance * ratio,
          elevation: elevations[i] || 0,
          lat,
          lon
        });
      }

      return points;
    } catch (error) {
      console.error('Error fetching elevation profile:', error);
      return [];
    }
  }

  /**
   * Check if line of sight is clear between two points considering elevation
   * @param profile Elevation profile
   * @param fromTowerHeight Height of starting tower in meters
   * @param toTowerHeight Height of ending tower in meters
   * @returns Object with clearance status and minimum clearance
   */
  checkLineOfSight(
    profile: { distance: number; elevation: number }[],
    fromTowerHeight: number = 0,
    toTowerHeight: number = 0
  ): { isClear: boolean; minClearance: number; blockagePoint?: number } {
    if (profile.length < 3) return { isClear: true, minClearance: 1000 };

    const start = profile[0];
    const end = profile[profile.length - 1];

    // Add tower heights to elevations
    const startElevation = start.elevation + fromTowerHeight;
    const endElevation = end.elevation + toTowerHeight;

    // Calculate line of sight slope
    const slopeElevation = (endElevation - startElevation) / (end.distance - start.distance);

    let minClearance = 1000;
    let blockagePoint: number | undefined;

    // Check if any intermediate point blocks the line of sight
    for (let i = 1; i < profile.length - 1; i++) {
      const point = profile[i];
      const expectedElevation = startElevation + slopeElevation * (point.distance - start.distance);
      
      // Calculate clearance (positive means clear, negative means blocked)
      const clearance = expectedElevation - point.elevation;
      
      if (clearance < minClearance) {
        minClearance = clearance;
      }

      // Fresnel zone clearance - need at least 60% of first Fresnel zone
      const fresnelRadius = this.calculateFresnelZone(
        start.distance,
        end.distance,
        point.distance
      );
      const requiredClearance = fresnelRadius * 0.6;

      if (clearance < requiredClearance) {
        blockagePoint = i;
      }
    }

    return {
      isClear: minClearance >= 2, // At least 2m clearance
      minClearance: Math.round(minClearance * 10) / 10,
      blockagePoint
    };
  }

  /**
   * Calculate first Fresnel zone radius at a point
   * @param totalDistance Total distance in km
   * @param pointDistance Distance to point in km
   * @returns Fresnel zone radius in meters
   */
  private calculateFresnelZone(startDist: number, endDist: number, pointDist: number): number {
    const frequency = 2.4; // 2.4 GHz (common for WiFi)
    const d1 = pointDist - startDist; // Distance from start
    const d2 = endDist - pointDist; // Distance to end
    const totalDist = endDist - startDist;
    
    // First Fresnel zone radius formula: r = sqrt((wavelength * d1 * d2) / total_distance)
    const wavelength = 300 / frequency; // wavelength in meters (c/f)
    const radius = Math.sqrt((wavelength * d1 * 1000 * d2 * 1000) / (totalDist * 1000));
    
    return radius;
  }

  private haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);
    
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }
}
