import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { UserService } from '../../services/user.service';
import { SocketService } from '../../services/socket.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  name = '';
  organization = '';
  error = '';

  constructor(
    private router: Router,
    private userService: UserService,
    private socketService: SocketService,
    private http: HttpClient
  ) {}

  login() {
    const trimmedName = this.name.trim();
    const trimmedOrg = this.organization.trim();
    if (!trimmedName) { this.error = 'Please enter your name'; return; }
    if (!trimmedOrg) { this.error = 'Please enter your organization'; return; }

    this.http.post(`${environment.apiUrl}/api/auth/login`, { 
      name: trimmedName, organization: trimmedOrg 
    }).subscribe({
      next: () => {
        this.userService.name = trimmedName;
        this.userService.organization = trimmedOrg;
        this.socketService.connect(trimmedName, trimmedOrg);
        this.router.navigate(['/app']);
      },
      error: () => { this.error = 'Could not connect to server'; }
    });
  }
}
