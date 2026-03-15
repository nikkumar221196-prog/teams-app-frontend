import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { UserService } from '../../services/user.service';
import { SocketService } from '../../services/socket.service';
import { SidebarComponent } from '../sidebar/sidebar.component';
import { ChatComponent } from '../chat/chat.component';
import { CallComponent } from '../call/call.component';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, SidebarComponent, ChatComponent, CallComponent],
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit, OnDestroy {
  users: any[] = [];
  selectedUser: any = null;
  activeCall: any = null;
  currentUser = '';
  unreadCounts: { [userName: string]: number } = {};
  allMessages: any[] = [];
  showChat = false; // mobile: toggle between sidebar and chat

  isMobile(): boolean {
    return window.innerWidth <= 768;
  }

  constructor(
    public userService: UserService,
    private socketService: SocketService,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit() {
    if (!this.userService.isLoggedIn()) {
      this.router.navigate(['/']);
      return;
    }
    this.currentUser = this.userService.name;
    const organization = this.userService.organization;

    // Load message history from backend for this organization
    this.http.get<any>(`${environment.apiUrl}/api/chat/messages/${organization}`).subscribe({
      next: (response) => {
        console.log('Loaded message history:', response.messages);
        this.allMessages = response.messages || [];
        // Calculate initial unread counts
        this.calculateUnreadCounts();
      },
      error: (err) => console.error('Failed to load message history:', err)
    });

    this.socketService.users$.subscribe(users => {
      this.users = users.filter(u => u.name !== this.currentUser);
    });

    this.socketService.messages$.subscribe(msg => {
      console.log('Main: received message:', msg);
      // Create new array reference to trigger ngOnChanges in child
      this.allMessages = [...this.allMessages, msg];
      
      // If message is from someone else to me, and I'm not viewing their chat, increment unread
      if (msg.to === this.currentUser && msg.from !== this.currentUser) {
        if (!this.selectedUser || this.selectedUser.name !== msg.from) {
          this.unreadCounts[msg.from] = (this.unreadCounts[msg.from] || 0) + 1;
        }
      }
    });

    this.socketService.incomingCall$.subscribe(data => {
      this.activeCall = { ...data, incoming: true };
    });
  }

  calculateUnreadCounts() {
    // Calculate unread counts from message history
    this.unreadCounts = {};
    for (const msg of this.allMessages) {
      if (msg.to === this.currentUser && msg.from !== this.currentUser) {
        this.unreadCounts[msg.from] = (this.unreadCounts[msg.from] || 0) + 1;
      }
    }
  }

  deleteMessage(messageId: number) {
    const organization = this.userService.organization;
    this.http.post(`${environment.apiUrl}/api/chat/delete-message`, { 
      message_id: messageId, 
      organization 
    }).subscribe({
      next: () => {
        this.allMessages = this.allMessages.filter(m => m.id !== messageId);
      },
      error: (err) => console.error('Failed to delete message:', err)
    });
  }

  deleteAllMessages() {
    if (!confirm('Are you sure you want to delete all messages in this organization?')) {
      return;
    }
    const organization = this.userService.organization;
    this.http.post(`${environment.apiUrl}/api/chat/delete-all-messages`, { organization }).subscribe({
      next: () => {
        this.allMessages = [];
        this.unreadCounts = {};
      },
      error: (err) => console.error('Failed to delete messages:', err)
    });
  }

  selectUser(user: any) { 
    this.selectedUser = user;
    const userName = user.name || user;
    if (this.unreadCounts[userName]) {
      this.unreadCounts[userName] = 0;
    }
    if (this.isMobile()) {
      this.showChat = true;
    }
  }

  backToSidebar() {
    this.showChat = false;
    this.selectedUser = null;
  }

  getUnreadCount(userName: string): number {
    return this.unreadCounts[userName] || 0;
  }

  onCallEnd() { this.activeCall = null; }

  ngOnDestroy() { this.socketService.disconnect(); }
}
