import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface ProjectData {
  id?: number;
  name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
  poi_count?: number;
  connection_count?: number;
  pois?: any[];
  connections?: any[];
}

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:5000/api';

  // Projects
  getProjects(): Observable<ProjectData[]> {
    return this.http.get<ProjectData[]>(`${this.API_URL}/projects`);
  }

  getProject(id: number): Observable<ProjectData> {
    return this.http.get<ProjectData>(`${this.API_URL}/projects/${id}`);
  }

  createProject(project: ProjectData): Observable<ProjectData> {
    return this.http.post<ProjectData>(`${this.API_URL}/projects`, project);
  }

  updateProject(id: number, project: Partial<ProjectData>): Observable<ProjectData> {
    return this.http.put<ProjectData>(`${this.API_URL}/projects/${id}`, project);
  }

  deleteProject(id: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/projects/${id}`);
  }

  // POIs
  createPOI(projectId: number, poi: any): Observable<any> {
    return this.http.post(`${this.API_URL}/projects/${projectId}/pois`, poi);
  }

  updatePOI(projectId: number, poiId: number, poi: any): Observable<any> {
    return this.http.put(`${this.API_URL}/projects/${projectId}/pois/${poiId}`, poi);
  }

  deletePOI(projectId: number, poiId: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/projects/${projectId}/pois/${poiId}`);
  }

  // Connections
  createConnection(projectId: number, connection: any): Observable<any> {
    return this.http.post(`${this.API_URL}/projects/${projectId}/connections`, connection);
  }

  updateConnection(projectId: number, connectionId: number, connection: any): Observable<any> {
    return this.http.put(`${this.API_URL}/projects/${projectId}/connections/${connectionId}`, connection);
  }

  deleteConnection(projectId: number, connectionId: number): Observable<void> {
    return this.http.delete<void>(`${this.API_URL}/projects/${projectId}/connections/${connectionId}`);
  }

  // Health check
  healthCheck(): Observable<any> {
    return this.http.get(`${this.API_URL}/health`);
  }
}
