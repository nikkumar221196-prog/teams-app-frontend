import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './sidebar.component.html',
  styleUrls: ['./sidebar.component.css']
})
export class SidebarComponent {
  @Input() users: any[] = [];
  @Input() currentUser = '';
  @Input() selectedUser: any = null;
  @Input() unreadCounts: { [userName: string]: number } = {};
  @Output() userSelected = new EventEmitter<any>();

  select(user: any) { this.userSelected.emit(user); }

  getInitial(name: string) { return name?.charAt(0).toUpperCase() || '?'; }

  getUnreadCount(userName: string): number {
    return this.unreadCounts[userName] || 0;
  }

  formatTime(ts: string): string {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
