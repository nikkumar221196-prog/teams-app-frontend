import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ViewChild, ElementRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocketService } from '../../services/socket.service';
import { Subscription } from 'rxjs';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.relay.metered.ca:80' },
    {
      urls: 'turn:global.relay.metered.ca:80',
      username: '03e30e749faba492217cea6e',
      credential: 'n5cHnbrcc+rkdXL/'
    },
    {
      urls: 'turn:global.relay.metered.ca:80?transport=tcp',
      username: '03e30e749faba492217cea6e',
      credential: 'n5cHnbrcc+rkdXL/'
    },
    {
      urls: 'turn:global.relay.metered.ca:443',
      username: '03e30e749faba492217cea6e',
      credential: 'n5cHnbrcc+rkdXL/'
    },
    {
      urls: 'turns:global.relay.metered.ca:443?transport=tcp',
      username: '03e30e749faba492217cea6e',
      credential: 'n5cHnbrcc+rkdXL/'
    }
  ],
  iceCandidatePoolSize: 10
};

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
  @ViewChild('remoteAudio') remoteAudio!: ElementRef<HTMLAudioElement>;

  private pc!: RTCPeerConnection;
  private localStream!: MediaStream;
  private subs: Subscription[] = [];
  private pendingCandidates: RTCIceCandidateInit[] = [];
  private remoteDescSet = false;

  isVideo = false;
  callStatus = 'Connecting...';
  showAccept = false;

  constructor(private socketService: SocketService, private zone: NgZone) {}

  async ngOnInit() {
    this.isVideo = this.callData?.type === 'video';
    this.showAccept = !!this.callData?.incoming;

    if (this.callData?.incoming) {
      this.callStatus = `Incoming ${this.isVideo ? 'video' : 'audio'} call from ${this.callData.from}`;
    } else {
      this.callStatus = `Calling ${this.callData.to}...`;
    }

    // Subscribe to signaling events first
    this.subs.push(
      this.socketService.callAnswered$.subscribe(async (data) => {
        try {
          await this.pc.setRemoteDescription(new RTCSessionDescription(data.answer));
          this.remoteDescSet = true;
          await this.flushPendingCandidates();
          this.zone.run(() => this.callStatus = 'Connected');
        } catch (e) {
          console.error('setRemoteDescription (answer) error:', e);
        }
      }),
      this.socketService.iceCandidate$.subscribe(async (data) => {
        if (!data.candidate) return;
        if (this.remoteDescSet) {
          try {
            await this.pc.addIceCandidate(new RTCIceCandidate(data.candidate));
          } catch (e) {
            console.error('addIceCandidate error:', e);
          }
        } else {
          this.pendingCandidates.push(data.candidate);
        }
      })
    );

    // Get media
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: this.isVideo
      });
    } catch (err) {
      console.error('getUserMedia error:', err);
      this.zone.run(() => this.callStatus = 'Microphone/camera access denied');
      return;
    }

    // Show local video preview
    setTimeout(() => {
      if (this.localVideo?.nativeElement) {
        this.localVideo.nativeElement.srcObject = this.localStream;
      }
    }, 100);

    // Create peer connection
    this.pc = new RTCPeerConnection(ICE_SERVERS);

    this.pc.onicecandidate = (e) => {
      if (e.candidate) {
        const target = this.callData.incoming ? this.callData.from : this.callData.to;
        this.socketService.sendIceCandidate(target, e.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('Connection state:', this.pc.connectionState);
      this.zone.run(() => {
        if (this.pc.connectionState === 'connected') {
          this.callStatus = 'Connected';
          this.showAccept = false;
        } else if (this.pc.connectionState === 'failed') {
          this.callStatus = 'Call failed';
        } else if (this.pc.connectionState === 'disconnected') {
          this.callStatus = 'Disconnected';
        }
      });
    };

    this.pc.ontrack = (e) => {
      console.log('ontrack fired, streams:', e.streams.length);
      const stream = e.streams[0];
      setTimeout(() => {
        if (this.remoteAudio?.nativeElement) {
          this.remoteAudio.nativeElement.srcObject = stream;
          this.remoteAudio.nativeElement.play().catch(console.error);
        }
        if (this.isVideo && this.remoteVideo?.nativeElement) {
          this.remoteVideo.nativeElement.srcObject = stream;
        }
      }, 100);
    };

    // Add local tracks
    this.localStream.getTracks().forEach(t => this.pc.addTrack(t, this.localStream));

    // If caller: create and send offer
    if (!this.callData.incoming) {
      try {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.socketService.callUser(this.callData.to, this.callData.type, offer);
      } catch (e) {
        console.error('createOffer error:', e);
      }
    }
  }

  async acceptCall() {
    if (!this.pc) return;
    try {
      await this.pc.setRemoteDescription(new RTCSessionDescription(this.callData.offer));
      this.remoteDescSet = true;
      await this.flushPendingCandidates();
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.socketService.answerCall(this.callData.from, answer);
      this.zone.run(() => {
        this.callStatus = 'Connected';
        this.showAccept = false;
      });
    } catch (e) {
      console.error('acceptCall error:', e);
    }
  }

  private async flushPendingCandidates() {
    for (const c of this.pendingCandidates) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(c));
      } catch (e) {
        console.error('flush candidate error:', e);
      }
    }
    this.pendingCandidates = [];
  }

  endCall() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.pc?.close();
    this.callEnd.emit();
  }

  ngOnDestroy() {
    this.localStream?.getTracks().forEach(t => t.stop());
    this.pc?.close();
    this.subs.forEach(s => s.unsubscribe());
  }
}
