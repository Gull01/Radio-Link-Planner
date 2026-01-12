import { Injectable } from '@angular/core';
import { RadioDevice, DeviceRecommendation, Connection } from '../models/poi.model';

@Injectable({
  providedIn: 'root'
})
export class DeviceService {
  
  private devices: RadioDevice[] = [
    {
      id: 'ubnt-nanostation-loco-m2',
      name: 'Ubiquiti NanoStation Loco M2',
      type: 'wifi',
      frequency: '2.4 GHz',
      maxRange: 10,
      minSignalStrength: 40,
      optimalRange: 5,
      powerOutput: '23 dBm',
      sensitivity: '-96 dBm',
      description: 'Compact outdoor WiFi CPE for short to medium range point-to-point links'
    },
    {
      id: 'ubnt-nanostation-m5',
      name: 'Ubiquiti NanoStation M5',
      type: 'wifi',
      frequency: '5 GHz',
      maxRange: 15,
      minSignalStrength: 45,
      optimalRange: 8,
      powerOutput: '27 dBm',
      sensitivity: '-96 dBm',
      description: 'High-performance 5GHz outdoor WiFi radio for point-to-point and point-to-multipoint links'
    },
    {
      id: 'ubnt-powerbeam-m5',
      name: 'Ubiquiti PowerBeam M5',
      type: 'wifi',
      frequency: '5 GHz',
      maxRange: 30,
      minSignalStrength: 50,
      optimalRange: 20,
      powerOutput: '25 dBm',
      sensitivity: '-96 dBm',
      description: 'Long-range WiFi bridge with integrated directional antenna for distances up to 30km'
    },
    {
      id: 'cambium-epmp-force-190',
      name: 'Cambium ePMP Force 190',
      type: 'wifi',
      frequency: '5 GHz',
      maxRange: 20,
      minSignalStrength: 50,
      optimalRange: 10,
      powerOutput: '27 dBm',
      sensitivity: '-96 dBm',
      description: 'High-gain subscriber module for medium to long-range point-to-point links'
    },
    {
      id: 'mikrotik-lhg-5',
      name: 'MikroTik LHG 5',
      type: 'wifi',
      frequency: '5 GHz',
      maxRange: 15,
      minSignalStrength: 45,
      optimalRange: 10,
      powerOutput: '27 dBm',
      sensitivity: '-96 dBm',
      description: 'Lightweight dual-chain 5GHz device with integrated 24.5dBi antenna'
    },
    {
      id: 'ubnt-airfiber-5x',
      name: 'Ubiquiti airFiber 5X',
      type: 'microwave',
      frequency: '5 GHz',
      maxRange: 100,
      minSignalStrength: 60,
      optimalRange: 50,
      powerOutput: '26 dBm',
      sensitivity: '-96 dBm',
      description: 'High-performance point-to-point radio for carrier-class gigabit links up to 100+km'
    },
    {
      id: 'cambium-ptp-670',
      name: 'Cambium PTP 670',
      type: 'microwave',
      frequency: '5/6 GHz',
      maxRange: 150,
      minSignalStrength: 65,
      optimalRange: 80,
      powerOutput: '28 dBm',
      sensitivity: '-94 dBm',
      description: 'Ultra-long-range point-to-point wireless Ethernet bridge for distances exceeding 100km'
    },
    {
      id: 'motorola-ptp-820',
      name: 'Motorola PTP 820',
      type: 'microwave',
      frequency: '6-42 GHz',
      maxRange: 80,
      minSignalStrength: 65,
      optimalRange: 40,
      powerOutput: '30 dBm',
      sensitivity: '-92 dBm',
      description: 'Carrier-grade microwave radio for high-capacity backhaul applications'
    },
    {
      id: 'lte-cat4-modem',
      name: 'LTE Cat 4 Cellular',
      type: 'cellular',
      frequency: '700-2600 MHz',
      maxRange: 10,
      minSignalStrength: 35,
      optimalRange: 5,
      powerOutput: '23 dBm',
      sensitivity: '-110 dBm',
      description: 'Standard LTE cellular modem for mobile connectivity (up to 150 Mbps)'
    },
    {
      id: 'lte-cat6-modem',
      name: 'LTE Cat 6 Cellular',
      type: 'cellular',
      frequency: '700-2600 MHz',
      maxRange: 15,
      minSignalStrength: 40,
      optimalRange: 8,
      powerOutput: '23 dBm',
      sensitivity: '-110 dBm',
      description: 'Advanced LTE cellular modem with carrier aggregation (up to 300 Mbps)'
    },
    {
      id: '5g-nr-modem',
      name: '5G NR Sub-6',
      type: 'cellular',
      frequency: '3.5 GHz',
      maxRange: 12,
      minSignalStrength: 45,
      optimalRange: 6,
      powerOutput: '23 dBm',
      sensitivity: '-105 dBm',
      description: '5G New Radio sub-6 GHz cellular for high-speed mobile connectivity (up to 2 Gbps)'
    },
    {
      id: 'vhf-radio',
      name: 'VHF Radio (150 MHz)',
      type: 'radio',
      frequency: '136-174 MHz',
      maxRange: 50,
      minSignalStrength: 30,
      optimalRange: 30,
      powerOutput: '50W',
      sensitivity: '-120 dBm',
      description: 'VHF two-way radio for reliable long-range voice communications'
    },
    {
      id: 'uhf-radio',
      name: 'UHF Radio (450 MHz)',
      type: 'radio',
      frequency: '400-512 MHz',
      maxRange: 40,
      minSignalStrength: 35,
      optimalRange: 25,
      powerOutput: '45W',
      sensitivity: '-119 dBm',
      description: 'UHF two-way radio for medium to long-range voice and data communications'
    }
  ];

  constructor() { }

  getAllDevices(): RadioDevice[] {
    return this.devices;
  }

  getDevicesByType(type: 'wifi' | 'cellular' | 'radio' | 'microwave'): RadioDevice[] {
    return this.devices.filter(d => d.type === type);
  }

  getRecommendations(connection: Connection): DeviceRecommendation[] {
    const distanceKm = connection.distance / 1000;
    const signalStrength = connection.signalStrength;
    const recommendations: DeviceRecommendation[] = [];

    this.devices.forEach(device => {
      let suitability: 'excellent' | 'good' | 'marginal' | 'unsuitable';
      let reason = '';
      let estimatedPerformance = '';

      // Check if distance is within range
      if (distanceKm > device.maxRange) {
        suitability = 'unsuitable';
        reason = `Distance (${distanceKm.toFixed(2)} km) exceeds maximum range (${device.maxRange} km)`;
        estimatedPerformance = 'Connection not possible';
      } else if (signalStrength < device.minSignalStrength) {
        suitability = 'unsuitable';
        reason = `Signal strength (${signalStrength.toFixed(1)}) below minimum required (${device.minSignalStrength})`;
        estimatedPerformance = 'Unreliable connection';
      } else {
        // Device is suitable, determine the level
        const rangeRatio = distanceKm / device.optimalRange;
        const signalMargin = signalStrength - device.minSignalStrength;

        if (distanceKm <= device.optimalRange && signalMargin > 20) {
          suitability = 'excellent';
          reason = `Distance within optimal range (${device.optimalRange} km) with strong signal margin (+${signalMargin.toFixed(1)} dB)`;
          estimatedPerformance = 'Maximum throughput and reliability expected';
        } else if (distanceKm <= device.optimalRange * 1.5 && signalMargin > 10) {
          suitability = 'good';
          reason = `Distance acceptable with good signal margin (+${signalMargin.toFixed(1)} dB)`;
          estimatedPerformance = 'High throughput and good reliability expected';
        } else {
          suitability = 'marginal';
          reason = `Near maximum range or minimal signal margin (+${signalMargin.toFixed(1)} dB)`;
          estimatedPerformance = 'Reduced throughput, may experience occasional connectivity issues';
        }
      }

      recommendations.push({
        device,
        suitability,
        reason,
        estimatedPerformance
      });
    });

    // Sort by suitability (excellent > good > marginal > unsuitable)
    const suitabilityOrder = { excellent: 0, good: 1, marginal: 2, unsuitable: 3 };
    recommendations.sort((a, b) => suitabilityOrder[a.suitability] - suitabilityOrder[b.suitability]);

    return recommendations;
  }

  getTopRecommendations(connection: Connection, limit: number = 5): DeviceRecommendation[] {
    const allRecommendations = this.getRecommendations(connection);
    // Filter out unsuitable devices and return top recommendations
    return allRecommendations.filter(r => r.suitability !== 'unsuitable').slice(0, limit);
  }
}
