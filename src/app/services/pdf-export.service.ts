import { Injectable } from '@angular/core';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { POI, Connection, AnalysisStats, DeviceRecommendation } from '../models/poi.model';

@Injectable({
  providedIn: 'root'
})
export class PdfExportService {

  constructor() { }

  async exportAnalysis(
    pois: POI[],
    connections: Connection[],
    stats: AnalysisStats,
    selectedConnection?: Connection,
    deviceRecommendations?: DeviceRecommendation[]
  ): Promise<void> {
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 15;
    let yPosition = margin;

    // Helper function to check if we need a new page
    const checkPageBreak = (spaceNeeded: number) => {
      if (yPosition + spaceNeeded > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
        return true;
      }
      return false;
    };

    // Title
    pdf.setFontSize(24);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Radio Link Analysis Report', pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Report date
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    const reportDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    pdf.text(`Generated: ${reportDate}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 15;

    // Project Statistics
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Project Statistics', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(11);
    pdf.setFont('helvetica', 'normal');
    const statsText = [
      `Total Points: ${stats.totalPoints}`,
      `Total Connections: ${stats.totalConnections}`,
      `Maximum Distance: ${stats.maxDistance.toFixed(2)} km`,
      `Average Distance: ${stats.averageDistance.toFixed(2)} km`
    ];

    statsText.forEach(text => {
      pdf.text(text, margin + 5, yPosition);
      yPosition += 6;
    });
    yPosition += 5;

    // Points of Interest
    checkPageBreak(20);
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Points of Interest', margin, yPosition);
    yPosition += 8;

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');

    pois.forEach((poi, index) => {
      checkPageBreak(20);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`${index + 1}. ${poi.name}`, margin + 5, yPosition);
      yPosition += 5;
      
      pdf.setFont('helvetica', 'normal');
      pdf.text(`   Latitude: ${poi.latitude.toFixed(6)}°`, margin + 5, yPosition);
      yPosition += 5;
      pdf.text(`   Longitude: ${poi.longitude.toFixed(6)}°`, margin + 5, yPosition);
      yPosition += 5;
      pdf.text(`   Elevation: ${poi.elevation?.toFixed(0) || 'N/A'} m`, margin + 5, yPosition);
      yPosition += 5;
      if (poi.towerHeight && poi.towerHeight > 0) {
        pdf.text(`   Tower Height: ${poi.towerHeight} m`, margin + 5, yPosition);
        yPosition += 5;
      }
      yPosition += 3;
    });

    yPosition += 5;

    // Connections
    if (connections.length > 0) {
      checkPageBreak(20);
      pdf.setFontSize(16);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Connections', margin, yPosition);
      yPosition += 8;

      connections.forEach((conn, index) => {
        checkPageBreak(35);
        pdf.setFontSize(11);
        pdf.setFont('helvetica', 'bold');
        pdf.text(`${index + 1}. ${conn.fromPOI.name} ↔ ${conn.toPOI.name}`, margin + 5, yPosition);
        yPosition += 6;

        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`   Distance: ${conn.distance.toFixed(2)} km`, margin + 5, yPosition);
        yPosition += 5;
        pdf.text(`   Signal Strength: ${conn.signalStrength.toFixed(1)}%`, margin + 5, yPosition);
        yPosition += 5;
        
        if (conn.lineOfSight !== undefined) {
          const losStatus = conn.lineOfSight ? '✓ Clear' : '✗ Blocked';
          pdf.text(`   Line of Sight: ${losStatus}`, margin + 5, yPosition);
          yPosition += 5;
        }
        
        if (conn.minClearance !== undefined) {
          pdf.text(`   Minimum Clearance: ${conn.minClearance.toFixed(1)} m`, margin + 5, yPosition);
          yPosition += 5;
        }
        
        yPosition += 3;
      });
    }

    // Selected Connection Details (if provided)
    if (selectedConnection) {
      pdf.addPage();
      yPosition = margin;

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Detailed Connection Analysis', margin, yPosition);
      yPosition += 10;

      pdf.setFontSize(14);
      pdf.text(`${selectedConnection.fromPOI.name} ↔ ${selectedConnection.toPOI.name}`, margin, yPosition);
      yPosition += 10;

      // Connection details
      pdf.setFontSize(11);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Distance: ${selectedConnection.distance.toFixed(2)} km`, margin + 5, yPosition);
      yPosition += 6;
      pdf.text(`Signal Strength: ${selectedConnection.signalStrength.toFixed(1)}%`, margin + 5, yPosition);
      yPosition += 6;
      
      if (selectedConnection.lineOfSight !== undefined) {
        pdf.text(`Line of Sight: ${selectedConnection.lineOfSight ? 'Clear' : 'Blocked'}`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      if (selectedConnection.minClearance !== undefined) {
        pdf.text(`Minimum Clearance: ${selectedConnection.minClearance.toFixed(1)} m`, margin + 5, yPosition);
        yPosition += 6;
      }
      
      yPosition += 8;

      // Try to capture elevation profile chart if it exists
      const chartContainer = document.querySelector('.chart-container');
      if (chartContainer) {
        try {
          // Give the DOM a moment to fully render
          await new Promise(resolve => setTimeout(resolve, 100));
          
          checkPageBreak(120);
          pdf.setFontSize(14);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Elevation Profile', margin, yPosition);
          yPosition += 8;

          const canvas = await html2canvas(chartContainer as HTMLElement, {
            scale: 2,
            backgroundColor: '#ffffff',
            logging: false,
            useCORS: true,
            allowTaint: true
          });
          
          const imgData = canvas.toDataURL('image/png');
          const imgWidth = pageWidth - 2 * margin;
          const imgHeight = (canvas.height * imgWidth) / canvas.width;
          
          // Ensure we don't exceed page height
          const maxHeight = pageHeight - margin - yPosition;
          const finalHeight = Math.min(imgHeight, maxHeight);
          
          if (finalHeight < imgHeight) {
            pdf.addPage();
            yPosition = margin;
          }
          
          pdf.addImage(imgData, 'PNG', margin, yPosition, imgWidth, finalHeight);
          yPosition += finalHeight + 10;
        } catch (error) {
          console.error('Error capturing elevation chart:', error);
          pdf.setFontSize(10);
          pdf.setFont('helvetica', 'italic');
          pdf.text('(Chart capture failed - please view in app)', margin + 5, yPosition);
          yPosition += 10;
        }
      }
    }

    // Device Recommendations (if provided)
    if (deviceRecommendations && deviceRecommendations.length > 0) {
      pdf.addPage();
      yPosition = margin;

      pdf.setFontSize(18);
      pdf.setFont('helvetica', 'bold');
      pdf.text('Device Recommendations', margin, yPosition);
      yPosition += 10;

      deviceRecommendations.forEach((rec, index) => {
        checkPageBreak(60);
        
        // Device name and suitability
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        const suitabilityIcons = {
          excellent: '⭐',
          good: '✓',
          marginal: '⚠',
          unsuitable: '✗'
        };
        const icon = suitabilityIcons[rec.suitability as keyof typeof suitabilityIcons] || '';
        pdf.text(`${index + 1}. ${icon} ${rec.device.name}`, margin + 5, yPosition);
        yPosition += 6;

        // Suitability badge
        pdf.setFontSize(10);
        pdf.setFont('helvetica', 'bold');
        const suitabilityColor = this.getSuitabilityColor(rec.suitability);
        pdf.setTextColor(suitabilityColor.r, suitabilityColor.g, suitabilityColor.b);
        pdf.text(`   ${rec.suitability.toUpperCase()}`, margin + 5, yPosition);
        pdf.setTextColor(0, 0, 0);
        yPosition += 6;

        // Device specs
        pdf.setFont('helvetica', 'normal');
        pdf.text(`   Type: ${rec.device.type}`, margin + 5, yPosition);
        yPosition += 5;
        pdf.text(`   Frequency: ${rec.device.frequency}`, margin + 5, yPosition);
        yPosition += 5;
        pdf.text(`   Max Range: ${rec.device.maxRange} km`, margin + 5, yPosition);
        yPosition += 5;
        pdf.text(`   Power Output: ${rec.device.powerOutput}`, margin + 5, yPosition);
        yPosition += 5;

        // Reason
        pdf.setFontSize(9);
        const reasonLines = pdf.splitTextToSize(`   ${rec.reason}`, pageWidth - 2 * margin - 10);
        reasonLines.forEach((line: string) => {
          checkPageBreak(5);
          pdf.text(line, margin + 5, yPosition);
          yPosition += 4;
        });
        yPosition += 3;

        // Expected performance
        pdf.setFont('helvetica', 'italic');
        const perfLines = pdf.splitTextToSize(`   Expected: ${rec.estimatedPerformance}`, pageWidth - 2 * margin - 10);
        perfLines.forEach((line: string) => {
          checkPageBreak(5);
          pdf.text(line, margin + 5, yPosition);
          yPosition += 4;
        });
        yPosition += 8;
      });
    }

    // Footer on all pages
    const totalPages = (pdf as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setFont('helvetica', 'italic');
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
      pdf.text(
        'Generated by Radio Link Planner',
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );
    }

    // Save the PDF
    const filename = `radio-link-analysis-${Date.now()}.pdf`;
    pdf.save(filename);
  }

  private getSuitabilityColor(suitability: string): { r: number; g: number; b: number } {
    const colors = {
      excellent: { r: 76, g: 175, b: 80 },  // Green
      good: { r: 33, g: 150, b: 243 },       // Blue
      marginal: { r: 255, g: 152, b: 0 },    // Orange
      unsuitable: { r: 244, g: 67, b: 54 }   // Red
    };
    return colors[suitability as keyof typeof colors] || { r: 0, g: 0, b: 0 };
  }
}
