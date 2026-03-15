import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, OnChanges, SimpleChanges, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SocketService } from '../../services/socket.service';
import { HttpClient } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.css']
})
export class ChatComponent implements OnInit, OnChanges, OnDestroy {
  @Input() currentUser = '';
  @Input() selectedUser: any = null;
  @Input() allMessages: any[] = [];
  @Input() isMobile = false;
  @Output() startCall = new EventEmitter<any>();
  @Output() deleteMessage = new EventEmitter<number>();
  @Output() goBack = new EventEmitter<void>();
  @ViewChild('msgEnd') msgEnd!: ElementRef;

  messages: any[] = [];
  newMessage = '';
  apiUrl = environment.apiUrl;
  private sub!: Subscription;

  constructor(private socketService: SocketService, private http: HttpClient) {
    console.log('ChatComponent constructor called');
  }

  ngOnInit() {
    console.log('ChatComponent ngOnInit - currentUser:', this.currentUser, 'selectedUser:', this.selectedUser);
    // Filter messages on init
    if (this.selectedUser) {
      this.filterMessages();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['selectedUser'] && this.selectedUser) {
      console.log('ngOnChanges: selectedUser changed, filtering messages');
      this.filterMessages();
    }
    // Re-filter when allMessages changes
    if (changes['allMessages'] && this.selectedUser) {
      console.log('ngOnChanges: allMessages changed, filtering messages');
      this.filterMessages();
    }
  }

  filterMessages() {
    if (!this.selectedUser) {
      console.log('filterMessages: no selectedUser');
      this.messages = [];
      return;
    }
    console.log('Filtering messages for selectedUser:', JSON.stringify(this.selectedUser));
    console.log('currentUser:', this.currentUser);
    console.log('All messages:', JSON.stringify(this.allMessages));
    
    const selectedName = this.selectedUser.name || this.selectedUser;
    
    this.messages = this.allMessages.filter(msg => {
      const relevant =
        (msg.from === this.currentUser && msg.to === selectedName) ||
        (msg.from === selectedName && msg.to === this.currentUser);
      console.log(`Message from:${msg.from} to:${msg.to} - relevant:${relevant} (comparing with current:${this.currentUser} selected:${selectedName})`);
      return relevant;
    });
    console.log('Filtered messages count:', this.messages.length);
    setTimeout(() => this.msgEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' }), 50);
  }

  send() {
    const text = this.newMessage.trim();
    if (!text) return;
    console.log('Sending message to:', this.selectedUser.name, 'text:', text);
    this.socketService.sendMessage(this.selectedUser.name, text);
    this.newMessage = '';
  }

  onFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;
    const file = input.files[0];
    const formData = new FormData();
    formData.append('file', file);
    this.http.post<any>(`${environment.apiUrl}/api/chat/upload`, formData).subscribe(res => {
      this.socketService.sendMessage(this.selectedUser.name, `📎 ${res.filename}`, res.url);
    });
  }

  initiateCall(type: 'audio' | 'video') {
    this.startCall.emit({ to: this.selectedUser.name, type, incoming: false });
  }

  getInitial(name: string) { return name?.charAt(0).toUpperCase() || '?'; }

  formatTime(ts: string) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  isMine(msg: any): boolean {
    const result = msg?.from === this.currentUser;
    console.log('isMine check:', msg?.from, '===', this.currentUser, '=', result);
    return result;
  }

  trackByMsgId(index: number, msg: any): any {
    return msg.id || index;
  }

  onDeleteMessage(messageId: number) {
    if (confirm('Delete this message?')) {
      this.deleteMessage.emit(messageId);
    }
  }

  ngOnDestroy() { }
}
