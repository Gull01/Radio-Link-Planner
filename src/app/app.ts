import { Component, signal, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { TabsComponent } from './components/tabs/tabs';
import { NotificationComponent } from './components/notification/notification';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog';
import { WelcomeComponent } from './components/welcome/welcome';
import { LoginComponent } from './components/login/login';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet, 
    TabsComponent, 
    NotificationComponent, 
    ConfirmDialogComponent,
    WelcomeComponent,
    LoginComponent
  ],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly authService = inject(AuthService);
  protected readonly router = inject(Router);
  protected readonly title = signal('Spatial Analysis & Connectivity Tool');
  protected showWelcome = signal(false);
  protected showLogin = signal(false);
  protected appStarted = signal(false);

  ngOnInit(): void {
    // Check if we're on a special route (like verify-email)
    const currentPath = this.router.url;
    if (currentPath.includes('/verify-email')) {
      // Let the router handle it
      return;
    }

    // Check if user is authenticated
    if (this.authService.isAuthenticated()) {
      this.appStarted.set(true);
    } else {
      // Show welcome screen first
      this.showWelcome.set(true);
    }
  }

  onWelcomeStart(): void {
    this.showWelcome.set(false);
    this.showLogin.set(true);
  }

  onLoginSuccess(): void {
    this.showLogin.set(false);
    this.appStarted.set(true);
  }
}
