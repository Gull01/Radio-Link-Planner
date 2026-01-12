import { Component, signal, viewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MapComponent } from '../map/map';
import { ProfileComponent } from '../profile/profile';
import { WelcomeComponent } from '../welcome/welcome';
import { ChatComponent } from '../chat/chat';
import { ProjectManagerComponent } from '../project-manager/project-manager';
import { Connection, POI, AnalysisStats } from '../../models/poi.model';
import { ProjectService, ProjectData } from '../../services/project.service';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-tabs',
  imports: [CommonModule, MapComponent, ProfileComponent, WelcomeComponent, ChatComponent, ProjectManagerComponent],
  templateUrl: './tabs.html',
  styleUrl: './tabs.css'
})
export class TabsComponent {
  private projectService = inject(ProjectService);
  private notificationService = inject(NotificationService);
  protected authService = inject(AuthService);
  private confirmService = inject(ConfirmService);
  
  showWelcome = signal<boolean>(true);
  activeTab = signal<'map' | 'profile'>('map');
  selectedConnection = signal<Connection | null>(null);
  currentProject = signal<ProjectData | null>(null);
  showUserMenu = signal<boolean>(false);
  
  // Get references
  mapComponent = viewChild<MapComponent>('mapComp');
  projectManager = viewChild<ProjectManagerComponent>('projectManager');
  
  // Signals for chat context
  pois = signal<POI[]>([]);
  connections = signal<Connection[]>([]);
  stats = signal<AnalysisStats | null>(null);

  async logout(): Promise<void> {
    const confirmed = await this.confirmService.confirm(
      'Are you sure you want to logout?',
      'Logout',
      'Cancel'
    );

    if (confirmed) {
      this.authService.logout();
      this.notificationService.info('You have been logged out');
      window.location.reload(); // Reload to show login screen
    }
  }

  toggleUserMenu(): void {
    this.showUserMenu.set(!this.showUserMenu());
  }

  switchTab(tab: 'map' | 'profile'): void {
    this.activeTab.set(tab);
  }

  onConnectionSelected(connection: Connection | null): void {
    this.selectedConnection.set(connection);
    if (connection) {
      this.activeTab.set('profile');
    } else {
      // If connection is cleared, switch back to map view
      this.activeTab.set('map');
    }
    this.updateChatContext();
  }

  startApp(): void {
    this.showWelcome.set(false);
  }

  private updateChatContext(): void {
    // Update chat context whenever map data changes
    const map = this.mapComponent();
    if (map) {
      this.pois.set(map.pois());
      this.connections.set(map.connections());
      this.stats.set(map.stats());
    }
  }

  ngAfterViewInit(): void {
    // Initial context update
    setTimeout(() => this.updateChatContext(), 100);
    
    // Update context periodically (every 2 seconds when data might change)
    setInterval(() => this.updateChatContext(), 2000);
    
    // Add click listener to close user menu when clicking outside
    document.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-menu-container')) {
        this.showUserMenu.set(false);
      }
    });
  }

  openProjectDialog(): void {
    const manager = this.projectManager();
    if (manager) {
      manager.openDialog('load');
    }
  }

  createNewProject(): void {
    const manager = this.projectManager();
    if (manager) {
      manager.openDialog('new');
    }
  }

  onProjectCreated(project: ProjectData): void {
    this.currentProject.set(project);
    const map = this.mapComponent();
    if (map) {
      map.setCurrentProject(project);
    }
  }

  onProjectLoaded(project: ProjectData): void {
    this.currentProject.set(project);
    const map = this.mapComponent();
    if (map) {
      map.loadProject(project);
    }
  }

  saveCurrentProject(): void {
    const project = this.currentProject();
    if (!project || !project.id) {
      this.notificationService.warning('No project loaded. Please create or load a project first.');
      return;
    }

    const map = this.mapComponent();
    if (!map) return;

    // Update project info
    this.projectService.updateProject(project.id, {
      name: project.name,
      description: project.description
    }).subscribe({
      next: () => {
        this.notificationService.success('Project saved successfully!');
      },
      error: (err) => {
        console.error('Error saving project:', err);
        this.notificationService.error('Failed to save project');
      }
    });
  }
}
