import { Component, OnInit, OnDestroy, signal, output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { GisService } from '../../services/gis.service';
import { ElevationService } from '../../services/elevation.service';
import { PdfExportService } from '../../services/pdf-export.service';
import { ProjectService, ProjectData } from '../../services/project.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmService } from '../../services/confirm.service';
import { POI, Connection, AnalysisStats } from '../../models/poi.model';

@Component({
  selector: 'app-map',
  imports: [CommonModule, FormsModule],
  templateUrl: './map.html',
  styleUrl: './map.css'
})
export class MapComponent implements OnInit, OnDestroy {
  private map!: L.Map;
  private baseLayers: { [key: string]: L.TileLayer } = {};
  
  pois = signal<POI[]>([]);
  connections = signal<Connection[]>([]);
  stats = signal<AnalysisStats>({
    totalPoints: 0,
    totalConnections: 0,
    maxDistance: 0,
    averageDistance: 0,
    strongestConnection: null
  });
  
  selectedPOI: POI | null = null;
  selectedConnection = signal<Connection | null>(null);
  isConnectMode = false;
  isLoadingElevation = false;
  showHelp = false;
  isExportingPdf = signal<boolean>(false);
  currentProject: ProjectData | null = null;
  showNamingDialog = signal<boolean>(false);
  tempPointName = '';
  tempPointData: { lat: number; lng: number; defaultName: string } | null = null;
  searchQuery = '';
  isSearching = false;
  searchMarker: L.Marker | null = null;
  
  connectionSelected = output<Connection | null>();
  
  // Layer visibility flags
  layerVisibility = {
    osm: true,
    satellite: false
  };
  
  private projectService = inject(ProjectService);
  private notificationService = inject(NotificationService);
  private confirmService = inject(ConfirmService);

  constructor(
    private gisService: GisService,
    private elevationService: ElevationService,
    private pdfExportService: PdfExportService
  ) {}

  ngOnInit(): void {
    this.initializeMap();
    this.setupBaseLayers();
    this.setupMapClickHandler();
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private initializeMap(): void {
    // Initialize map centered on Islamabad/Rawalpindi
    this.map = L.map('map', {
      center: [33.6844, 73.0479], // Islamabad, Pakistan
      zoom: 12
    });

    // Create custom marker icons
    const iconDefault = L.icon({
      iconUrl: 'assets/marker-icon.png',
      iconRetinaUrl: 'assets/marker-icon-2x.png',
      shadowUrl: 'assets/marker-shadow.png',
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
      tooltipAnchor: [16, -28],
      shadowSize: [41, 41]
    });
    
    L.Marker.prototype.options.icon = iconDefault;
  }

  // Create custom colored marker
  private createCustomIcon(color: string = '#3388ff'): L.DivIcon {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div class="marker-pin" style="background-color: ${color}">
          <div class="marker-dot"></div>
        </div>
        <div class="marker-shadow"></div>
      `,
      iconSize: [30, 42],
      iconAnchor: [15, 42],
      popupAnchor: [0, -42]
    });
  }

  private setupBaseLayers(): void {
    // OpenStreetMap layer
    this.baseLayers['osm'] = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    });

    // Satellite layer (using ESRI World Imagery)
    this.baseLayers['satellite'] = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles © Esri',
        maxZoom: 19
      }
    );

    // Add default layer
    this.baseLayers['osm'].addTo(this.map);
  }

  private setupMapClickHandler(): void {
    this.map.on('click', (e: L.LeafletMouseEvent) => {
      if (this.isConnectMode && this.selectedPOI) {
        // In connect mode with a selected POI - do nothing (click on another marker to connect)
        return;
      }
      
      // Add new POI
      this.addPOI(e.latlng.lat, e.latlng.lng);
    });
  }

  toggleBaseLayer(layer: 'osm' | 'satellite'): void {
    // Remove all base layers
    Object.values(this.baseLayers).forEach(l => this.map.removeLayer(l));
    
    // Reset visibility flags
    this.layerVisibility.osm = false;
    this.layerVisibility.satellite = false;
    
    // Add selected layer
    this.baseLayers[layer].addTo(this.map);
    this.layerVisibility[layer] = true;
  }

  async addPOI(lat: number, lng: number): Promise<void> {
    const poiCount = this.pois().length + 1;
    const defaultName = `Point ${poiCount}`;
    
    // Show custom naming dialog
    this.tempPointData = { lat, lng, defaultName };
    this.tempPointName = '';
    this.showNamingDialog.set(true);
  }

  async confirmPointName(): Promise<void> {
    if (!this.tempPointData) return;
    
    const { lat, lng, defaultName } = this.tempPointData;
    const pointName = this.tempPointName.trim() || defaultName;
    const poiCount = this.pois().length + 1;
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    const color = colors[(poiCount - 1) % colors.length];
    
    this.showNamingDialog.set(false);
    
    // Fetch elevation
    const elevation = await this.elevationService.getElevation(lat, lng);
    
    const poi: POI = {
      id: `poi-${Date.now()}`,
      name: pointName,
      latitude: lat,
      longitude: lng,
      elevation
    };

    // Create custom marker with drag enabled
    const marker = L.marker([lat, lng], {
      icon: this.createCustomIcon(color),
      draggable: true
    }).addTo(this.map);

    // Handle marker drag
    marker.on('dragend', async () => {
      const newLatLng = marker.getLatLng();
      await this.updatePOIPosition(poi, newLatLng.lat, newLatLng.lng, marker, color);
    });

    // Bind popup
    this.updateMarkerPopup(poi, marker, color);
    
    // Handle popup open to attach event listeners
    marker.on('popupopen', () => {
      const deleteBtn = document.getElementById(`delete-poi-${poi.id}`);
      const editNameBtn = document.getElementById(`edit-name-${poi.id}`);
      const nameInput = document.getElementById(`name-input-${poi.id}`) as HTMLInputElement;
      const saveNameBtn = document.getElementById(`save-name-${poi.id}`);
      const nameDisplay = document.getElementById(`name-display-${poi.id}`);
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deletePOI(poi));
      }

      if (editNameBtn && nameInput && saveNameBtn && nameDisplay) {
        editNameBtn.addEventListener('click', () => {
          nameDisplay!.style.display = 'none';
          nameInput.style.display = 'block';
          saveNameBtn!.style.display = 'inline-block';
          editNameBtn.style.display = 'none';
          nameInput.focus();
          nameInput.select();
        });

        saveNameBtn.addEventListener('click', () => {
          const newName = nameInput.value.trim();
          if (newName) {
            poi.name = newName;
            this.updateMarkerPopup(poi, marker, color);
            this.updateConnectionsDisplay();
          }
        });

        nameInput.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            saveNameBtn!.click();
          }
        });
      }
    });

    // Handle marker click for connection mode
    marker.on('click', (e) => {
      if (this.isConnectMode) {
        L.DomEvent.stopPropagation(e);
        marker.closePopup();
        
        if (!this.selectedPOI) {
          // Select first point
          this.startConnection(poi);
        } else if (this.selectedPOI.id !== poi.id) {
          // Connect to second point
          this.createConnection(this.selectedPOI, poi);
        }
      }
    });

    poi.marker = marker;
    this.pois.update(pois => [...pois, poi]);
    this.updateStats();

    // Save to backend if project is loaded
    if (this.currentProject?.id) {
      this.projectService.createPOI(this.currentProject.id, {
        name: poi.name,
        latitude: poi.latitude,
        longitude: poi.longitude,
        elevation: poi.elevation || 0,
        tower_height: poi.towerHeight || 0,
        color: color
      }).subscribe({
        next: (savedPoi) => {
          console.log('POI saved to backend:', savedPoi);
          poi.dbId = savedPoi.id;
          // Update POI with weather data from backend
          if (savedPoi.weather) {
            console.log('Weather data received:', savedPoi.weather);
            poi.weather = savedPoi.weather;
            // Refresh the marker popup to show weather
            this.updateMarkerPopup(poi, marker, color);
            // If popup is already open, close and reopen to show weather
            if (marker.isPopupOpen()) {
              marker.closePopup();
              setTimeout(() => marker.openPopup(), 100);
            }
          } else {
            console.log('No weather data in response');
          }
        },
        error: (err) => console.error('Error saving POI:', err)
      });
    }
  }

  toggleConnectMode(): void {
    if (this.isConnectMode) {
      this.cancelConnection();
    } else {
      this.isConnectMode = true;
    }
  }

  startConnection(poi: POI): void {
    this.selectedPOI = poi;
    
    // Close the popup
    if (poi.marker) {
      poi.marker.closePopup();
      
      // Add pulsing effect to selected marker
      const markerElement = poi.marker.getElement();
      if (markerElement) {
        markerElement.classList.add('selected-marker');
      }
    }
  }

  async createConnection(fromPOI: POI, toPOI: POI): Promise<void> {
    // Check if connection already exists
    const existingConnection = this.connections().find(
      c => (c.fromPOI.id === fromPOI.id && c.toPOI.id === toPOI.id) ||
           (c.fromPOI.id === toPOI.id && c.toPOI.id === fromPOI.id)
    );

    if (existingConnection) {
      this.notificationService.warning('Connection already exists between these points!');
      this.cancelConnection();
      return;
    }

    this.isLoadingElevation = true;
    
    const connection = this.gisService.createConnection(fromPOI, toPOI);

    // Fetch elevation profile
    const elevationProfile = await this.elevationService.getElevationProfile(
      fromPOI.latitude,
      fromPOI.longitude,
      toPOI.latitude,
      toPOI.longitude,
      25
    );
    
    connection.elevationProfile = elevationProfile;
    
    // Initial LOS check without tower heights
    const losResult = this.elevationService.checkLineOfSight(
      elevationProfile,
      fromPOI.towerHeight || 0,
      toPOI.towerHeight || 0
    );
    
    connection.lineOfSight = losResult.isClear;
    connection.minClearance = losResult.minClearance;
    
    // Recalculate signal strength with LOS consideration
    connection.signalStrength = this.gisService.calculateSignalStrength(
      connection.distance,
      losResult.isClear,
      losResult.minClearance
    );
    
    const color = this.gisService.getSignalColor(connection.signalStrength);
    const category = this.gisService.getSignalCategory(connection.signalStrength);

    // Create polyline with enhanced styling for better stability
    const polyline = L.polyline(
      [
        [fromPOI.latitude, fromPOI.longitude],
        [toPOI.latitude, toPOI.longitude]
      ],
      {
        color: color,
        weight: 4,
        opacity: 0.9,
        dashArray: connection.lineOfSight ? '' : '10, 5',
        className: 'connection-line',
        smoothFactor: 1,
        renderer: L.canvas()
      }
    ).addTo(this.map);

    // Bind popup to polyline
    const popupContent = `
      <div class="connection-popup">
        <h3 style="margin: 0 0 10px 0; font-size: 16px; color: ${color};">🔗 Connection</h3>
        <p style="margin: 5px 0; font-size: 13px;"><strong>From:</strong> ${fromPOI.name}</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>To:</strong> ${toPOI.name}</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>📏 Distance:</strong> ${connection.distance} km</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>📡 Signal:</strong> ${connection.signalStrength}% (${category})</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>👁️ LoS:</strong> ${connection.lineOfSight ? '✓ Clear' : '✗ Blocked'}</p>
        <div style="margin-top: 10px; display: flex; gap: 5px;">
          <button id="view-profile-${connection.id}" style="flex: 1; padding: 6px 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">📈 View Profile</button>
          <button id="delete-connection-${connection.id}" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
        </div>
      </div>
    `;
    
    polyline.bindPopup(popupContent);
    
    // Handle popup open
    polyline.on('popupopen', () => {
      const viewBtn = document.getElementById(`view-profile-${connection.id}`);
      const deleteBtn = document.getElementById(`delete-connection-${connection.id}`);
      
      if (viewBtn) {
        viewBtn.addEventListener('click', () => {
          this.selectedConnection.set(connection);
          this.connectionSelected.emit(connection);
          polyline.closePopup();
        });
      }
      
      if (deleteBtn) {
        deleteBtn.addEventListener('click', () => this.deleteConnection(connection));
      }
    });

    // Click handler to select connection
    polyline.on('click', () => {
      this.selectedConnection.set(connection);
    });

    connection.polyline = polyline;
    this.connections.update(connections => [...connections, connection]);
    this.updateStats();
    this.cancelConnection();
    this.isLoadingElevation = false;

    // Save to backend if project is loaded
    if (this.currentProject?.id && fromPOI.dbId && toPOI.dbId) {
      this.projectService.createConnection(this.currentProject.id, {
        from_poi_id: fromPOI.dbId,
        to_poi_id: toPOI.dbId,
        distance: connection.distance,
        signal_strength: connection.signalStrength,
        line_of_sight: connection.lineOfSight || false,
        min_clearance: connection.minClearance || 0
      }).subscribe({
        next: (savedConn) => {
          connection.dbId = savedConn.id;
        },
        error: (err) => console.error('Error saving connection:', err)
      });
    }
  }

  cancelConnection(): void {
    // Remove selection visual feedback
    if (this.selectedPOI?.marker) {
      const markerElement = this.selectedPOI.marker.getElement();
      if (markerElement) {
        markerElement.classList.remove('selected-marker');
      }
    }
    
    this.selectedPOI = null;
    this.isConnectMode = false;
  }

  deletePOI(poi: POI): void {
    // Remove connections associated with this POI
    const connectionsToDelete = this.connections().filter(
      c => c.fromPOI.id === poi.id || c.toPOI.id === poi.id
    );
    
    connectionsToDelete.forEach(c => this.deleteConnection(c));
    
    // Remove marker from map
    if (poi.marker) {
      this.map.removeLayer(poi.marker);
    }
    
    // Remove from array
    this.pois.update(pois => pois.filter(p => p.id !== poi.id));
    this.updateStats();

    // Delete from backend
    if (this.currentProject?.id && poi.dbId) {
      this.projectService.deletePOI(this.currentProject.id, poi.dbId).subscribe({
        error: (err) => console.error('Error deleting POI:', err)
      });
    }
  }

  deleteConnection(connection: Connection): void {
    // Remove polyline from map
    if (connection.polyline) {
      this.map.removeLayer(connection.polyline);
    }
    
    // Remove from array
    this.connections.update(connections => 
      connections.filter(c => c.id !== connection.id)
    );
    
    // Always clear elevation profile when any connection is deleted
    const currentSelected = this.selectedConnection();
    if (currentSelected && 
        ((currentSelected.fromPOI.id === connection.fromPOI.id && currentSelected.toPOI.id === connection.toPOI.id) ||
         (currentSelected.fromPOI.id === connection.toPOI.id && currentSelected.toPOI.id === connection.fromPOI.id))) {
      this.selectedConnection.set(null);
      this.connectionSelected.emit(null);
    }
    
    this.updateStats();

    // Delete from backend
    if (this.currentProject?.id && connection.dbId) {
      this.projectService.deleteConnection(this.currentProject.id, connection.dbId).subscribe({
        error: (err) => console.error('Error deleting connection:', err)
      });
    }
  }

  async clearAll(skipConfirm: boolean = false): Promise<void> {
    if (!skipConfirm) {
      const confirmed = await this.confirmService.confirm(
        'Are you sure you want to clear all points and connections?',
        'Clear All',
        'Cancel'
      );
      
      if (!confirmed) return;
    }
    
    // Remove all markers
    this.pois().forEach(poi => {
      if (poi.marker) {
        this.map.removeLayer(poi.marker);
      }
    });
    
    // Remove all polylines
    this.connections().forEach(connection => {
      if (connection.polyline) {
        this.map.removeLayer(connection.polyline);
      }
    });
    
    this.pois.set([]);
    this.connections.set([]);
    this.selectedConnection.set(null);
    this.connectionSelected.emit(null);
    this.updateStats();
  }

  private updateMarkerPopup(poi: POI, marker: L.Marker, color: string): void {
    const elevation = poi.elevation || 0;
    
    // Debug logging
    console.log('Updating marker popup for POI:', poi.name);
    console.log('Weather data:', poi.weather);
    
    // Weather section HTML
    let weatherHtml = '';
    if (poi.weather && poi.weather.temp !== null && poi.weather.temp !== undefined) {
      const windDir = this.getWindDirection(poi.weather.wind_direction);
      const iconUrl = `https://openweathermap.org/img/wn/${poi.weather.icon}@2x.png`;
      weatherHtml = `
        <div style="margin: 10px 0; padding: 8px; background: #f0f8ff; border-radius: 4px; border-left: 3px solid #2196F3;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
            <img src="${iconUrl}" style="width: 40px; height: 40px;" alt="weather">
            <div>
              <p style="margin: 0; font-size: 14px; font-weight: bold; color: #2196F3;">🌡️ ${poi.weather.temp.toFixed(1)}°C</p>
              <p style="margin: 0; font-size: 11px; color: #666;">${poi.weather.description}</p>
            </div>
          </div>
          <p style="margin: 3px 0; font-size: 12px;">💧 Humidity: ${poi.weather.humidity}%</p>
          <p style="margin: 3px 0; font-size: 12px;">💨 Wind: ${poi.weather.wind_speed.toFixed(1)} m/s ${windDir}</p>
          <p style="margin: 3px 0; font-size: 10px; color: #999;">Updated: ${this.formatTimeAgo(poi.weather.updated_at)}</p>
        </div>
      `;
    } else {
      weatherHtml = `
        <div style="margin: 10px 0; padding: 8px; background: #fff3cd; border-radius: 4px; border-left: 3px solid #ffc107;">
          <p style="margin: 0; font-size: 12px; color: #856404;">⏳ Weather data loading...</p>
        </div>
      `;
    }
    
    const popupContent = `
      <div class="poi-popup">
        <div id="name-display-${poi.id}" style="margin-bottom: 10px;">
          <h3 style="color: ${color}; margin: 0; font-size: 16px; display: inline;">${poi.name}</h3>
          <button id="edit-name-${poi.id}" style="margin-left: 8px; padding: 2px 8px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">✏️ Edit</button>
        </div>
        <div style="margin-bottom: 10px; display: none;">
          <input 
            id="name-input-${poi.id}" 
            type="text" 
            value="${poi.name}" 
            style="width: calc(100% - 60px); padding: 4px; border: 1px solid #ddd; border-radius: 3px; font-size: 13px; display: none;" 
            placeholder="Enter name">
          <button id="save-name-${poi.id}" style="margin-left: 5px; padding: 4px 8px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; display: none;">💾</button>
        </div>
        <p style="margin: 5px 0; font-size: 13px;"><strong>📍 Latitude:</strong> ${poi.latitude.toFixed(6)}</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>📍 Longitude:</strong> ${poi.longitude.toFixed(6)}</p>
        <p style="margin: 5px 0; font-size: 13px;"><strong>⛰️ Elevation:</strong> ${elevation.toFixed(0)} m</p>
        ${weatherHtml}
        <div style="margin-top: 10px; display: flex; gap: 5px;">
          <button id="delete-poi-${poi.id}" style="flex: 1; padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️ Delete</button>
        </div>
      </div>
    `;
    
    // Unbind old popup and create new one with updated content
    marker.unbindPopup();
    marker.bindPopup(popupContent);
  }
  
  private getWindDirection(degrees: number): string {
    const directions = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const index = Math.round(degrees / 22.5) % 16;
    return directions[index];
  }
  
  private formatTimeAgo(timestamp: string): string {
    const now = new Date();
    const updated = new Date(timestamp);
    const diffMs = now.getTime() - updated.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  }

  private updateConnectionsDisplay(): void {
    // Update all connection polylines tooltips with updated POI names
    this.connections().forEach(connection => {
      if (connection.polyline) {
        const tooltipContent = `${connection.fromPOI.name} ↔ ${connection.toPOI.name}<br>Distance: ${(connection.distance / 1000).toFixed(2)} km<br>Signal: ${connection.signalStrength.toFixed(1)} dBm`;
        connection.polyline.setTooltipContent(tooltipContent);
      }
    });
  }

  private updateStats(): void {
    const poisArray = this.pois();
    const connectionsArray = this.connections();
    
    const totalPoints = poisArray.length;
    const totalConnections = connectionsArray.length;
    
    let maxDistance = 0;
    let totalDistance = 0;
    let strongestConnection: Connection | null = null;
    let maxSignalStrength = -1;
    
    connectionsArray.forEach(connection => {
      if (connection.distance > maxDistance) {
        maxDistance = connection.distance;
      }
      totalDistance += connection.distance;
      
      if (connection.signalStrength > maxSignalStrength) {
        maxSignalStrength = connection.signalStrength;
        strongestConnection = connection;
      }
    });
    
    const averageDistance = totalConnections > 0 
      ? Math.round((totalDistance / totalConnections) * 100) / 100 
      : 0;
    
    this.stats.set({
      totalPoints,
      totalConnections,
      maxDistance,
      averageDistance,
      strongestConnection
    });
  }

  private async updatePOIPosition(poi: POI, newLat: number, newLng: number, marker: L.Marker, color: string): Promise<void> {
    // Update POI coordinates
    poi.latitude = newLat;
    poi.longitude = newLng;

    // Fetch new elevation
    const elevation = await this.elevationService.getElevation(newLat, newLng);
    poi.elevation = elevation;

    // Update popup with new coordinates
    this.updateMarkerPopup(poi, marker, color);

    // Update all connections associated with this POI
    const affectedConnections = this.connections().filter(
      c => c.fromPOI.id === poi.id || c.toPOI.id === poi.id
    );

    for (const connection of affectedConnections) {
      // Update polyline position
      if (connection.polyline) {
        const fromPos: [number, number] = [connection.fromPOI.latitude, connection.fromPOI.longitude];
        const toPos: [number, number] = [connection.toPOI.latitude, connection.toPOI.longitude];
        connection.polyline.setLatLngs([fromPos, toPos]);

        // Recalculate distance
        connection.distance = this.gisService.calculateDistance(
          connection.fromPOI.latitude,
          connection.fromPOI.longitude,
          connection.toPOI.latitude,
          connection.toPOI.longitude
        );

        // Fetch new elevation profile
        const elevationProfile = await this.elevationService.getElevationProfile(
          connection.fromPOI.latitude,
          connection.fromPOI.longitude,
          connection.toPOI.latitude,
          connection.toPOI.longitude,
          25
        );
        connection.elevationProfile = elevationProfile;

        // Recalculate line of sight
        const losResult = this.elevationService.checkLineOfSight(
          elevationProfile,
          connection.fromPOI.towerHeight || 0,
          connection.toPOI.towerHeight || 0
        );
        connection.lineOfSight = losResult.isClear;
        connection.minClearance = losResult.minClearance;

        // Recalculate signal strength
        connection.signalStrength = this.gisService.calculateSignalStrength(
          connection.distance,
          losResult.isClear,
          losResult.minClearance
        );

        // Update polyline style based on new signal strength
        const newColor = this.gisService.getSignalColor(connection.signalStrength);
        connection.polyline.setStyle({
          color: newColor,
          dashArray: connection.lineOfSight ? '' : '12, 8'
        });

        // Update polyline popup
        const category = this.gisService.getSignalCategory(connection.signalStrength);
        const popupContent = `
          <div class="connection-popup">
            <h3 style="margin: 0 0 10px 0; font-size: 16px; color: ${newColor};">🔗 Connection</h3>
            <p style="margin: 5px 0; font-size: 13px;"><strong>From:</strong> ${connection.fromPOI.name}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>To:</strong> ${connection.toPOI.name}</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>📏 Distance:</strong> ${connection.distance} km</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>📡 Signal:</strong> ${connection.signalStrength}% (${category})</p>
            <p style="margin: 5px 0; font-size: 13px;"><strong>👁️ LoS:</strong> ${connection.lineOfSight ? '✓ Clear' : '✗ Blocked'}</p>
            <div style="margin-top: 10px; display: flex; gap: 5px;">
              <button id="view-profile-${connection.id}" style="flex: 1; padding: 6px 12px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">📈 View Profile</button>
              <button id="delete-connection-${connection.id}" style="padding: 6px 12px; background: #f44336; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🗑️</button>
            </div>
          </div>
        `;
        connection.polyline.setPopupContent(popupContent);

        // Update backend connection if project is loaded
        if (this.currentProject?.id && connection.dbId) {
          this.projectService.updateConnection(this.currentProject.id, connection.dbId, {
            distance: connection.distance,
            signal_strength: connection.signalStrength,
            line_of_sight: connection.lineOfSight,
            min_clearance: connection.minClearance || 0
          }).subscribe({
            error: (err) => console.error('Error updating connection:', err)
          });
        }
      }
    }

    // Update stats
    this.updateStats();

    // Update POI in backend if project is loaded
    if (this.currentProject?.id && poi.dbId) {
      this.projectService.updatePOI(this.currentProject.id, poi.dbId, {
        name: poi.name,
        latitude: poi.latitude,
        longitude: poi.longitude,
        elevation: poi.elevation || 0,
        tower_height: poi.towerHeight || 0
      }).subscribe({
        error: (err) => console.error('Error updating POI:', err)
      });
    }

    this.notificationService.success(`${poi.name} moved successfully!`);
  }

  async exportProjectToPdf(): Promise<void> {
    if (this.pois().length === 0) {
      this.notificationService.warning('No data to export. Please add some points first.');
      return;
    }

    this.isExportingPdf.set(true);
    
    try {
      await this.pdfExportService.exportAnalysis(
        this.pois(),
        this.connections(),
        this.stats()
      );
      this.notificationService.success('PDF exported successfully!');
    } catch (error) {
      console.error('Error exporting PDF:', error);
      this.notificationService.error('Failed to export PDF. Please try again.');
    } finally {
      this.isExportingPdf.set(false);
    }
  }

  setCurrentProject(project: ProjectData): void {
    this.currentProject = project;
    this.clearAll(true); // Skip confirmation for project operations
  }

  async loadProject(project: ProjectData): Promise<void> {
    this.currentProject = project;
    await this.clearAll(true); // Skip confirmation for project operations

    if (!project.pois || project.pois.length === 0) {
      return;
    }

    // Load POIs
    for (const poiData of project.pois) {
      const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
      const color = colors[(this.pois().length) % colors.length];
      
      const poi: POI = {
        id: poiData.id ? `db-${poiData.id}` : `poi-${Date.now()}-${Math.random()}`,
        name: poiData.name,
        latitude: poiData.latitude,
        longitude: poiData.longitude,
        elevation: poiData.elevation,
        dbId: poiData.id,
        weather: poiData.weather  // Load weather data from backend
      };

      const marker = L.marker([poi.latitude, poi.longitude], {
        icon: this.createCustomIcon(color),
        draggable: true
      }).addTo(this.map);

      // Handle marker drag
      marker.on('dragend', async () => {
        const newLatLng = marker.getLatLng();
        await this.updatePOIPosition(poi, newLatLng.lat, newLatLng.lng, marker, color);
      });

      this.updateMarkerPopup(poi, marker, color);
      
      marker.on('popupopen', () => {
        const deleteBtn = document.getElementById(`delete-poi-${poi.id}`);
        const editNameBtn = document.getElementById(`edit-name-${poi.id}`);
        const nameInput = document.getElementById(`name-input-${poi.id}`) as HTMLInputElement;
        const saveNameBtn = document.getElementById(`save-name-${poi.id}`);
        const nameDisplay = document.getElementById(`name-display-${poi.id}`);
        
        if (deleteBtn) {
          deleteBtn.addEventListener('click', () => this.deletePOI(poi));
        }

        if (editNameBtn && nameInput && saveNameBtn && nameDisplay) {
          editNameBtn.addEventListener('click', () => {
            nameDisplay!.style.display = 'none';
            nameInput.style.display = 'block';
            saveNameBtn!.style.display = 'inline-block';
            editNameBtn.style.display = 'none';
            nameInput.focus();
            nameInput.select();
          });

          saveNameBtn.addEventListener('click', () => {
            const newName = nameInput.value.trim();
            if (newName) {
              poi.name = newName;
              this.updateMarkerPopup(poi, marker, color);
              this.updateConnectionsDisplay();
              
              // Update in backend
              if (poi.dbId && this.currentProject?.id) {
                this.projectService.updatePOI(this.currentProject.id, poi.dbId, { name: newName }).subscribe();
              }
            }
          });

          nameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              saveNameBtn!.click();
            }
          });
        }
      });

      marker.on('click', (e) => {
        if (this.isConnectMode) {
          L.DomEvent.stopPropagation(e);
          marker.closePopup();
          
          if (!this.selectedPOI) {
            this.startConnection(poi);
          } else if (this.selectedPOI.id !== poi.id) {
            this.createConnection(this.selectedPOI, poi);
          }
        }
      });

      poi.marker = marker;
      this.pois.update(pois => [...pois, poi]);
    }

    // Load connections after all POIs are loaded
    if (project.connections && project.connections.length > 0) {
      for (const connData of project.connections) {
        const fromPOI = this.pois().find(p => p.dbId === connData.from_poi_id);
        const toPOI = this.pois().find(p => p.dbId === connData.to_poi_id);
        
        if (fromPOI && toPOI) {
          await this.recreateConnection(fromPOI, toPOI, connData);
        }
      }
    }

    this.updateStats();
    
    // Center map on loaded POIs
    if (this.pois().length > 0) {
      const bounds = L.latLngBounds(this.pois().map(p => [p.latitude, p.longitude]));
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  private async recreateConnection(from: POI, to: POI, connData: any): Promise<void> {
    // Use the same method as createConnection
    const connectionObj = this.gisService.createConnection(from, to);
    
    const polyline = L.polyline(
      [[from.latitude, from.longitude], [to.latitude, to.longitude]],
      {
        color: connectionObj.lineOfSight ? '#4CAF50' : '#FF5252',
        weight: 4,
        opacity: 0.9,
        dashArray: connectionObj.lineOfSight ? undefined : '10, 5',
        smoothFactor: 1,
        renderer: L.canvas()
      }
    ).addTo(this.map);

    // Calculate midpoint manually
    const midLat = (from.latitude + to.latitude) / 2;
    const midLng = (from.longitude + to.longitude) / 2;
    const tooltip = L.tooltip({
      permanent: true,
      direction: 'center',
      className: 'connection-label'
    }).setContent(`${connectionObj.distance.toFixed(2)} km`).setLatLng([midLat, midLng]);
    
    polyline.bindTooltip(tooltip).openTooltip();

    const connection: Connection = {
      id: connData.id ? `db-${connData.id}` : `conn-${Date.now()}-${Math.random()}`,
      fromPOI: from,
      toPOI: to,
      distance: connData.distance || connectionObj.distance,
      lineOfSight: connData.line_of_sight || connectionObj.lineOfSight,
      signalStrength: connData.signal_strength || connectionObj.signalStrength,
      minClearance: connData.min_clearance,
      elevationProfile: [],
      polyline,
      dbId: connData.id
    };

    polyline.on('click', () => {
      this.selectedConnection.set(connection);
      this.connectionSelected.emit(connection);
    });

    this.connections.update(conns => [...conns, connection]);
  }

  cancelNamingDialog(): void {
    this.showNamingDialog.set(false);
    this.tempPointData = null;
    this.tempPointName = '';
  }

  async newProject(): Promise<void> {
    if (this.pois().length > 0 || this.connections().length > 0) {
      const confirmed = await this.confirmService.confirm(
        'This will clear all current data. Are you sure?',
        'Clear Data',
        'Cancel'
      );
      
      if (confirmed) {
        await this.clearAll(true); // Skip double confirmation
      }
    }
  }

  async searchCity(): Promise<void> {
    const query = this.searchQuery.trim();
    if (!query) return;

    this.isSearching = true;
    
    try {
      // Use Nominatim API for geocoding
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`
      );
      
      const results = await response.json();
      
      if (results && results.length > 0) {
        const location = results[0];
        const lat = parseFloat(location.lat);
        const lon = parseFloat(location.lon);
        
        // Move map to location
        this.map.setView([lat, lon], 13);
        
        // Remove previous search marker if exists
        if (this.searchMarker) {
          this.map.removeLayer(this.searchMarker);
        }
        
        // Add temporary marker
        this.searchMarker = L.marker([lat, lon], {
          icon: L.divIcon({
            className: 'search-marker',
            html: '<div style="background: #ff4444; color: white; padding: 5px 10px; border-radius: 20px; font-size: 12px; white-space: nowrap; box-shadow: 0 2px 5px rgba(0,0,0,0.3);">📍 ' + location.display_name.split(',')[0] + '</div>',
            iconSize: [150, 40],
            iconAnchor: [75, 40]
          })
        }).addTo(this.map);
        
        this.notificationService.success(`Found: ${location.display_name}`);
      } else {
        this.notificationService.error('City not found. Try a different search term.');
      }
    } catch (error) {
      console.error('Search error:', error);
      this.notificationService.error('Search failed. Please try again.');
    } finally {
      this.isSearching = false;
    }
  }
}
