import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class SocketService {
  private socket: any;

  messages$ = new Subject<any>();
  users$ = new Subject<any[]>();
  incomingCall$ = new Subject<any>();
  callAnswered$ = new Subject<any>();
  iceCandidate$ = new Subject<any>();

  async connect(name: string, organization: string) {
    const { io } = await import('socket.io-client');
    this.socket = io(environment.apiUrl, { transports: ['websocket'] });

    this.socket.on('connect', () => {
      this.socket.emit('join', { name, organization });
    });

    this.socket.on('disconnect', () => console.log('Socket disconnected'));
    this.socket.on('new_message', (msg: any) => this.messages$.next(msg));
    this.socket.on('users_update', (users: any[]) => this.users$.next(users));
    this.socket.on('incoming_call', (data: any) => this.incomingCall$.next(data));
    this.socket.on('call_answered', (data: any) => this.callAnswered$.next(data));
    this.socket.on('ice_candidate', (data: any) => this.iceCandidate$.next(data));
  }

  sendMessage(to: string, text: string, attachment?: string) {
    this.socket?.emit('send_message', { to, text, attachment });
  }

  callUser(to: string, type: 'audio' | 'video', offer: any) {
    this.socket?.emit('call_user', { to, type, offer });
  }

  answerCall(to: string, answer: any) {
    this.socket?.emit('call_answer', { to, answer });
  }

  sendIceCandidate(to: string, candidate: any) {
    this.socket?.emit('ice_candidate', { to, candidate });
  }

  disconnect() {
    this.socket?.disconnect();
  }
}
