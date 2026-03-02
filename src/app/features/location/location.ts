import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AdminService, StoreInfo } from '../../core/services/admin';
import { SafeUrlPipe } from '../../core/pipes/safe-url-pipe';

@Component({
  selector: 'app-location',
  standalone: true,
  imports: [CommonModule, SafeUrlPipe],
  templateUrl: './location.html',
  styleUrls: ['./location.scss']
})
export class Location implements OnInit {
  storeInfo = signal<StoreInfo | null>(null);
  loading = signal(true);

  constructor(private adminService: AdminService) {}

  async ngOnInit(): Promise<void> {
    try {
      const info = await this.adminService.getStoreInfo();
      this.storeInfo.set(info);
    } finally {
      this.loading.set(false);
    }
  }
}