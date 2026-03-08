import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class ExportService {
  private platformId = inject(PLATFORM_ID);

  exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
    const csvContent = [
      headers.map(escape).join(','),
      ...rows.map((row) => row.map(escape).join(',')),
    ].join('\r\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    this.downloadBlob(blob, filename + '.csv');
  }

  async exportToExcel(
    filename: string,
    sheetName: string,
    headers: string[],
    rows: (string | number)[][],
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, filename + '.xlsx');
  }

  async exportToPdf(
    filename: string,
    title: string,
    headers: string[],
    rows: (string | number)[][],
  ): Promise<void> {
    if (!isPlatformBrowser(this.platformId)) return;

    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(title, 14, 15);
    autoTable(doc, {
      head: [headers],
      body: rows.map((row) => row.map(String)),
      startY: 22,
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [0, 51, 160] },
    });
    doc.save(filename + '.pdf');
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
