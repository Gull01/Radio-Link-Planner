export interface POI {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  elevation?: number;
  towerHeight?: number;
  marker?: L.Marker;
  dbId?: number;  // Database ID for backend persistence
  weather?: WeatherData;
}

export interface WeatherData {
  temp: number;  // Temperature in Celsius
  humidity: number;  // Humidity percentage
  wind_speed: number;  // Wind speed in m/s
  wind_direction: number;  // Wind direction in degrees
  description: string;  // Weather condition description
  icon: string;  // Weather icon code
  updated_at: string;  // ISO timestamp of last update
}

export interface ElevationPoint {
  distance: number;
  elevation: number;
  lat: number;
  lon: number;
}

export interface Connection {
  id: string;
  fromPOI: POI;
  toPOI: POI;
  distance: number;
  signalStrength: number;
  elevationProfile?: ElevationPoint[];
  lineOfSight?: boolean;
  minClearance?: number;
  polyline?: L.Polyline;
  dbId?: number;  // Database ID for backend persistence
}

export interface LOSAnalysis {
  isClear: boolean;
  minClearance: number;
  signalStrength: number;
  recommendation: string;
  status: 'excellent' | 'good' | 'fair' | 'poor' | 'blocked';
}

export interface AnalysisStats {
  totalPoints: number;
  totalConnections: number;
  maxDistance: number;
  averageDistance: number;
  strongestConnection: Connection | null;
  elevationRange?: { min: number; max: number };
}

export interface RadioDevice {
  id: string;
  name: string;
  type: 'wifi' | 'cellular' | 'radio' | 'microwave';
  frequency: string; // e.g., "2.4 GHz", "5 GHz", "900 MHz"
  maxRange: number; // in kilometers
  minSignalStrength: number; // minimum required signal strength
  optimalRange: number; // optimal range in kilometers
  powerOutput: string; // e.g., "20 dBm", "100 mW"
  sensitivity: string; // e.g., "-95 dBm"
  description: string;
}

export interface DeviceRecommendation {
  device: RadioDevice;
  suitability: 'excellent' | 'good' | 'marginal' | 'unsuitable';
  reason: string;
  estimatedPerformance: string;
}
