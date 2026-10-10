import { Component, Input, OnChanges, SimpleChanges, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Connection, ElevationPoint, DeviceRecommendation } from '../../models/poi.model';
import { ElevationService } from '../../services/elevation.service';
import { GisService } from '../../services/gis.service';
import { DeviceService } from '../../services/device.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-profile',
  imports: [CommonModule],
  templateUrl: './profile.html',
  styleUrl: './profile.css'
})
export class ProfileComponent implements OnChanges {
  @Input() selectedConnection: Connection | null = null;
  
  private elevationService = inject(ElevationService);
  private gisService = inject(GisService);
  private deviceService = inject(DeviceService);
  private pdfExportService = inject(PdfExportService);
  private notificationService = inject(NotificationService);
  
  chartWidth = 900;
  chartHeight = 450;
  padding = { top: 20, right: 20, bottom: 40, left: 60 };
  
  deviceRecommendations = signal<DeviceRecommendation[]>([]);
  showDeviceRecommendations = signal<boolean>(false);
  isExportingPdf = signal<boolean>(false);
  
  pathData = signal<string>('');
  points = signal<{ x: number; y: number; elevation: number; distance: number }[]>([]);
  xScale = signal<{ min: number; max: number }>({ min: 0, max: 0 });
  yScale = signal<{ min: number; max: number }>({ min: 0, max: 0 });
  xTicks = signal<{ value: number; position: number }[]>([]);
  yTicks = signal<{ value: number; position: number }[]>([]);
  
  fromTowerHeight = signal<number>(0);
  toTowerHeight = signal<number>(0);
  losLineData = signal<string>('');
  losAnalysis = signal<{
    isClear: boolean;
    minClearance: number;
    signalStrength: number;
    recommendation: string;
    status: 'excellent' | 'good' | 'fair' | 'poor' | 'blocked';
  } | null>(null);

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['selectedConnection'] && this.selectedConnection?.elevationProfile) {
      // Initialize tower heights from POI data
      this.fromTowerHeight.set(this.selectedConnection.fromPOI.towerHeight || 0);
      this.toTowerHeight.set(this.selectedConnection.toPOI.towerHeight || 0);
      this.generateChart();
    }
  }

  updateTowerHeight(position: 'from' | 'to', height: number): void {
    if (position === 'from') {
      this.fromTowerHeight.set(height);
      if (this.selectedConnection) {
        this.selectedConnection.fromPOI.towerHeight = height;
      }
    } else {
      this.toTowerHeight.set(height);
      if (this.selectedConnection) {
        this.selectedConnection.toPOI.towerHeight = height;
      }
    }
    this.generateChart();
    this.updateLOSAnalysis();
  }

  private updateLOSAnalysis(): void {
    if (!this.selectedConnection?.elevationProfile) return;

    const losResult = this.elevationService.checkLineOfSight(
      this.selectedConnection.elevationProfile,
      this.fromTowerHeight(),
      this.toTowerHeight()
    );

    const distance = this.selectedConnection.distance;
    const signalStrength = this.gisService.calculateSignalStrength(
      distance,
      losResult.isClear,
      losResult.minClearance
    );

    let status: 'excellent' | 'good' | 'fair' | 'poor' | 'blocked';
    let recommendation: string;

    // Build comprehensive recommendations considering BOTH elevation/LOS AND distance/signal
    const recommendations: string[] = [];
    
    // 1. Line of Sight Status
    if (!losResult.isClear) {
      status = 'blocked';
      const requiredHeight = Math.abs(losResult.minClearance) + 5;
      recommendations.push(`⚠️ CRITICAL: Line of sight is BLOCKED! Increase tower height by at least ${requiredHeight.toFixed(0)}m to clear obstruction.`);
    } else if (losResult.minClearance < 5) {
      status = 'poor';
      recommendations.push(`⚡ WARNING: Marginal clearance (${losResult.minClearance.toFixed(1)}m). Increase tower height by 5-10m for better reliability.`);
    } else if (losResult.minClearance < 10) {
      status = 'fair';
      recommendations.push(`✓ Line of sight clear but tight (${losResult.minClearance.toFixed(1)}m clearance). Consider 5m increase for optimal performance.`);
    } else if (losResult.minClearance < 20) {
      status = 'good';
      recommendations.push(`✓ Good line of sight with ${losResult.minClearance.toFixed(1)}m clearance. Adequate for reliable communication.`);
    } else {
      status = 'excellent';
      recommendations.push(`✓ Excellent line of sight with ${losResult.minClearance.toFixed(1)}m clearance! Optimal configuration achieved.`);
    }

    // 2. Distance & Signal Strength Analysis
    if (distance > 20) {
      recommendations.push(`📏 DISTANCE: ${distance.toFixed(2)}km is very long. Expect significant signal attenuation. Consider adding repeater station at midpoint.`);
      if (signalStrength < 40) {
        recommendations.push(`📡 SIGNAL: ${signalStrength}% is critically weak at this distance. Use high-gain directional antennas or signal amplifiers.`);
      }
    } else if (distance > 10) {
      recommendations.push(`📏 DISTANCE: ${distance.toFixed(2)}km is moderate. Signal attenuation of ~${(distance * 5).toFixed(0)}% expected.`);
      if (signalStrength < 50) {
        recommendations.push(`📡 SIGNAL: ${signalStrength}% is weak. Consider using directional antennas to boost signal quality.`);
      } else {
        recommendations.push(`📡 SIGNAL: ${signalStrength}% is acceptable for this distance. Standard omnidirectional antennas should work.`);
      }
    } else if (distance > 5) {
      recommendations.push(`📏 DISTANCE: ${distance.toFixed(2)}km is ideal for wireless links. Minimal attenuation expected (~${(distance * 5).toFixed(0)}%).`);
      if (signalStrength >= 70) {
        recommendations.push(`📡 SIGNAL: ${signalStrength}% is strong! Excellent link quality expected. Standard equipment sufficient.`);
      } else {
        recommendations.push(`📡 SIGNAL: ${signalStrength}% is good. Link should be reliable with basic equipment.`);
      }
    } else {
      recommendations.push(`📏 DISTANCE: ${distance.toFixed(2)}km is very short. Excellent for high-bandwidth applications.`);
      recommendations.push(`📡 SIGNAL: ${signalStrength}% is excellent at this range. Maximum throughput achievable.`);
    }

    // 3. Combined Recommendation
    if (losResult.isClear && signalStrength >= 70) {
      recommendations.push(`✅ OVERALL: This is an excellent link! Both LoS and signal strength are optimal. Proceed with confidence.`);
    } else if (losResult.isClear && signalStrength >= 50) {
      recommendations.push(`👍 OVERALL: This is a good workable link. Should provide reliable connectivity with standard equipment.`);
    } else if (!losResult.isClear || signalStrength < 40) {
      recommendations.push(`❌ OVERALL: This link needs improvements. Address LoS blockage first, then consider signal boosting equipment.`);
    } else {
      recommendations.push(`⚠️ OVERALL: This link is marginal. Consider equipment upgrades or site repositioning for better reliability.`);
    }

    recommendation = recommendations.join('\n\n');

    this.losAnalysis.set({
      isClear: losResult.isClear,
      minClearance: losResult.minClearance,
      signalStrength,
      recommendation,
      status
    });

    // Generate device recommendations
    if (this.selectedConnection) {
      const recommendations = this.deviceService.getTopRecommendations(this.selectedConnection, 10);
      this.deviceRecommendations.set(recommendations);
    }

    // Update the connection object
    if (this.selectedConnection) {
      this.selectedConnection.lineOfSight = losResult.isClear;
      this.selectedConnection.signalStrength = signalStrength;
      this.selectedConnection.minClearance = losResult.minClearance;
    }
  }

  private generateChart(): void {
    if (!this.selectedConnection?.elevationProfile?.length) return;

    const profile = this.selectedConnection.elevationProfile;
    const width = this.chartWidth - this.padding.left - this.padding.right;
    const height = this.chartHeight - this.padding.top - this.padding.bottom;

    // Find min/max for scaling
    const distances = profile.map(p => p.distance);
    const elevations = profile.map(p => p.elevation);
    
    const minDistance = Math.min(...distances);
    const maxDistance = Math.max(...distances);
    const minElevation = Math.min(...elevations);
    const maxElevation = Math.max(...elevations);

    // Calculate tower top elevations to ensure they're visible
    const fromTowerTop = profile[0].elevation + this.fromTowerHeight();
    const toTowerTop = profile[profile.length - 1].elevation + this.toTowerHeight();
    
    // Include tower heights in the elevation range
    const allElevations = [...elevations, fromTowerTop, toTowerTop];
    const minElevationWithTowers = Math.min(...allElevations);
    const maxElevationWithTowers = Math.max(...allElevations);

    // Add padding to elevation range
    const elevationPadding = (maxElevationWithTowers - minElevationWithTowers) * 0.1 || 10;
    const yMin = minElevationWithTowers - elevationPadding;
    const yMax = maxElevationWithTowers + elevationPadding;

    this.xScale.set({ min: minDistance, max: maxDistance });
    this.yScale.set({ min: yMin, max: yMax });

    // Scale functions
    const scaleX = (d: number) => ((d - minDistance) / (maxDistance - minDistance)) * width;
    const scaleY = (e: number) => height - ((e - yMin) / (yMax - yMin)) * height;

    // Generate path
    const pathPoints = profile.map((p, i) => {
      const x = scaleX(p.distance);
      const y = scaleY(p.elevation);
      return i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    });
    
    // Close path to create filled area
    pathPoints.push(`L ${scaleX(maxDistance)} ${height}`);
    pathPoints.push(`L ${scaleX(minDistance)} ${height}`);
    pathPoints.push('Z');

    this.pathData.set(pathPoints.join(' '));

    // Store points for tooltips
    this.points.set(
      profile.map(p => ({
        x: scaleX(p.distance),
        y: scaleY(p.elevation),
        elevation: p.elevation,
        distance: p.distance
      }))
    );

    // Generate ticks
    this.generateTicks(minDistance, maxDistance, yMin, yMax, width, height);
    
    // Generate line of sight with tower heights
    this.generateLosLine(profile, width, height, minDistance, maxDistance, yMin, yMax);
    
    // Update LOS analysis
    this.updateLOSAnalysis();
  }

  private generateLosLine(
    profile: ElevationPoint[],
    width: number,
    height: number,
    minDist: number,
    maxDist: number,
    yMin: number,
    yMax: number
  ): void {
    if (!profile.length) return;

    const scaleX = (d: number) => ((d - minDist) / (maxDist - minDist)) * width;
    const scaleY = (e: number) => height - ((e - yMin) / (yMax - yMin)) * height;

    const startElevation = profile[0].elevation + this.fromTowerHeight();
    const endElevation = profile[profile.length - 1].elevation + this.toTowerHeight();

    const startX = scaleX(profile[0].distance);
    const startY = scaleY(startElevation);
    const endX = scaleX(profile[profile.length - 1].distance);
    const endY = scaleY(endElevation);

    this.losLineData.set(`M ${startX} ${startY} L ${endX} ${endY}`);
  }

  private generateTicks(
    minDist: number,
    maxDist: number,
    minElev: number,
    maxElev: number,
    width: number,
    height: number
  ): void {
    // X-axis ticks (distance)
    const xTickCount = 5;
    const xTicks = [];
    for (let i = 0; i <= xTickCount; i++) {
      const value = minDist + (maxDist - minDist) * (i / xTickCount);
      const position = (i / xTickCount) * width;
      xTicks.push({ value, position });
    }
    this.xTicks.set(xTicks);

    // Y-axis ticks (elevation)
    const yTickCount = 5;
    const yTicks = [];
    for (let i = 0; i <= yTickCount; i++) {
      const value = minElev + (maxElev - minElev) * (i / yTickCount);
      const position = height - (i / yTickCount) * height;
      yTicks.push({ value, position });
    }
    this.yTicks.set(yTicks);
  }

  toggleDeviceRecommendations(): void {
    this.showDeviceRecommendations.update(v => !v);
  }

  getSuitabilityClass(suitability: string): string {
    return `suitability-${suitability}`;
  }

  getSuitabilityIcon(suitability: string): string {
    const icons = {
      excellent: '⭐',
      good: '✅',
      marginal: '⚠️',
      unsuitable: '❌'
    };
    return icons[suitability as keyof typeof icons] || '❓';
  }

  async exportToPdf(): Promise<void> {
    if (!this.selectedConnection) return;
    
    this.isExportingPdf.set(true);
    
    try {
      // For profile view, we'll export just this connection with device recommendations
      await this.pdfExportService.exportAnalysis(
        [this.selectedConnection.fromPOI, this.selectedConnection.toPOI],
        [this.selectedConnection],
        {
          totalPoints: 2,
          totalConnections: 1,
          maxDistance: this.selectedConnection.distance,
          averageDistance: this.selectedConnection.distance,
          strongestConnection: this.selectedConnection
        },
        this.selectedConnection,
        this.deviceRecommendations()
      );
      this.notificationService.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      this.notificationService.error('Failed to export PDF. Please try again.');
    } finally {
      this.isExportingPdf.set(false);
    }
  }
}
