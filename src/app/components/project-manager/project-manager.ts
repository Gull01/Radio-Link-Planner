import { Component, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectService, ProjectData } from '../../services/project.service';
import { NotificationService } from '../../services/notification.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
  selector: 'app-project-manager',
  imports: [CommonModule, FormsModule],
  templateUrl: './project-manager.html',
  styleUrl: './project-manager.css'
})
export class ProjectManagerComponent {
  private projectService = inject(ProjectService);
  private notificationService = inject(NotificationService);
  private confirmService = inject(ConfirmService);
  
  showDialog = signal<boolean>(false);
  dialogMode = signal<'list' | 'new' | 'load'>('list');
  projects = signal<ProjectData[]>([]);
  
  newProjectName = '';
  newProjectDescription = '';
  
  onProjectLoad = output<ProjectData>();
  onNewProject = output<ProjectData>();

  openDialog(mode: 'list' | 'new' | 'load' = 'list'): void {
    this.dialogMode.set(mode);
    this.showDialog.set(true);
    if (mode === 'list' || mode === 'load') {
      this.loadProjects();
    }
  }

  closeDialog(): void {
    this.showDialog.set(false);
    this.newProjectName = '';
    this.newProjectDescription = '';
  }

  loadProjects(): void {
    this.projectService.getProjects().subscribe({
      next: (projects) => {
        this.projects.set(projects);
      },
      error: (err) => {
        console.error('Error loading projects:', err);
        this.notificationService.error('Failed to load projects. Make sure the backend is running.');
      }
    });
  }

  createNewProject(): void {
    if (!this.newProjectName.trim()) {
      this.notificationService.warning('Please enter a project name');
      return;
    }

    const newProject: ProjectData = {
      name: this.newProjectName.trim(),
      description: this.newProjectDescription.trim()
    };

    this.projectService.createProject(newProject).subscribe({
      next: (project) => {
        this.notificationService.success('Project created successfully!');
        this.onNewProject.emit(project);
        this.closeDialog();
      },
      error: (err) => {
        console.error('Error creating project:', err);
        this.notificationService.error('Failed to create project');
      }
    });
  }

  loadProject(project: ProjectData): void {
    if (!project.id) return;
    
    this.projectService.getProject(project.id).subscribe({
      next: (fullProject) => {
        this.notificationService.success('Project loaded successfully!');
        this.onProjectLoad.emit(fullProject);
        this.closeDialog();
      },
      error: (err) => {
        console.error('Error loading project:', err);
        this.notificationService.error('Failed to load project');
      }
    });
  }

  async deleteProject(project: ProjectData, event: Event): Promise<void> {
    event.stopPropagation();
    
    if (!project.id) return;
    
    const confirmed = await this.confirmService.confirm(
      `Are you sure you want to delete "${project.name}"?`,
      'Delete',
      'Cancel'
    );
    
    if (confirmed) {
      this.projectService.deleteProject(project.id).subscribe({
        next: () => {
          this.notificationService.success('Project deleted successfully!');
          this.loadProjects();
        },
        error: (err) => {
          console.error('Error deleting project:', err);
          this.notificationService.error('Failed to delete project');
        }
      });
    }
  }
}
