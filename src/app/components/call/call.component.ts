import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-call',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './call.component.html',
  styleUrls: ['./call.component.css']
})
export class CallComponent implements OnInit, OnDestroy {
  @Input() callData: any = null;
  @Input() currentUser = '';
  @Output() callEnd = new EventEmitter<void>();
  @ViewChild('localVideo') localVideo!: ElementRef<HTMLVideoElement>;
  @ViewChild('remoteVideo') remoteVideo!: ElementRef<HTMLVideoElement>;

  private pc!: RTCPeerConnection;
  private subs: Subscription[] = [];
  isVideo = false;
  callStatus = 'Connecting...';

  constructor(private socketService: SocketService) {}

  async ngOnInit() {
    this.isVideo = this.callData?.type === 'video';

    // ICE servers with STUN + free TURN for cross-network calls
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        {
          urls: 'turn:openrelay.metered.ca:80',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        },
        {
          urls: 'turn:openrelay.metered.ca:443?transport=tcp',
          username: 'openrelayproject',
          credential: 'openrelayproject'
        }
      ]
    });

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        this.socketService.sendIceCandidate(this.callData.to || this.callData.from, e.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('Connection state:', this.pc.connectionState);
      if (this.pc.connectionState === 'connected') {
        this.callStatus = 'Connected';
      } else if (this.pc.connectionState === 'failed') {
        this.callStatus = 'Call failed - check network';
      }
    };

    this.pc.ontrack = (e) => {
      if (this.remoteVideo?.nativeElement) {
        this.remoteVideo.nativeElement.srcObject = e.streams[0];
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true, video: this.isVideo
    }).catch(() => null);

    if (stream) {
      if (this.localVideo?.nativeElement) {
        this.localVideo.nativeElement.srcObject = stream;
      }
      stream.getTracks().forEach(t => this.pc.addTrack(t, stream));
    }

    if (!this.callData.incoming) {
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      this.socketService.callUser(this.callData.to, this.callData.type, offer);
      this.callStatus = `Calling ${this.callData.to}...`;
    } else {
      this.callStatus = `Incoming call from ${this.callData.from}`;
    }

    this.subs.push(
      this.socketService.callAnswered$.subscribe(async (data) => {
        await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        this.callStatus = 'Connected';
      }),
      this.socketService.iceCandidate$.subscribe(async (data) => {
        if (data.candidate) await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      })
    );
  }

  async acceptCall() {
    await this.pc.setRemoteDescription(new RTCSessionDescription(this.callData.offer));
    const answer = await this.pc.createAnswer();
    await this.pc.setLocalDescription(answer);
    this.socketService.answerCall(this.callData.from, answer);
    this.callStatus = 'Connected';
  }

  endCall() {
    this.pc?.close();
    this.callEnd.emit();
  }

  ngOnDestroy() {
    this.pc?.close();
    this.subs.forEach(s => s.unsubscribe());
  }
}
