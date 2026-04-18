import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-manual',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './manual.component.html',
  styleUrls: ['./manual.component.scss'],
})
export class ManualComponent {
  pdfUrl = 'https://qqrllytqukyamfmxoszi.supabase.co/storage/v1/object/public/manuales/ManualUusarios.pdf';
  safePdfUrl: SafeResourceUrl;

  constructor(private sanitizer: DomSanitizer) {
    this.safePdfUrl = this.sanitizer.bypassSecurityTrustResourceUrl(this.pdfUrl);
  }
}