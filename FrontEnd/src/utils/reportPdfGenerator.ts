import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { AdminOrder } from '../services/adminOrderService';
import oppaDruLogo from '../assets/oppadrulogo.jpg';
import { formatCurrency } from './formatters';

export interface ReportFilterDetails {
  year: string;
  month: string;
  week: string;
  day: string;
  date: string;
  channel: string;
  weekRangeText?: string;
}

export interface ReportPdfData {
  orders: AdminOrder[];
  metrics: {
    totalSales: number;
    totalOrders: number;
    channels: Array<{
      key: 'online' | 'onsite' | 'foodpanda' | 'grabfood';
      label: string;
      orders: number;
      sales: number;
      percent: number;
    }>;
  };
  payments: Array<{ method: string; orders: number; amount: number }>;
  goal: number;
  goalReached: boolean;
  goalSet: boolean;
  timelineRange: string;
  activeFilterSummary: string;
  filters?: ReportFilterDetails;
  topProducts: {
    all: [string, number][];
    online: [string, number][];
    onsite: [string, number][];
    foodpanda: [string, number][];
    grabfood: [string, number][];
  };
  generatedBy?: {
    name?: string;
    email?: string;
    role?: string;
  };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
];

const formatCurrencyForPdf = (amount: number | string | null | undefined): string => {
  return formatCurrency(amount).replace('₱', 'PHP ');
};

const loadImageAsDataUrl = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas context not available'));
          return;
        }
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.95));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = url;
  });
};

const getOrderDisplayDate = (order: AdminOrder): string => {
  const value = order.created_at || order.timestamp;
  if (!value) return 'N/A';
  const normalizedValue = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}+08:00`;
  const date = new Date(normalizedValue);
  if (Number.isNaN(date.getTime())) return 'N/A';
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const generateSalesReportPdf = async (data: ReportPdfData): Promise<void> => {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  // Professional Color Palette
  const brandDarkGreen: [number, number, number] = [27, 67, 50]; // #1B4332
  const brandForestGreen: [number, number, number] = [45, 106, 79]; // #2D6A4F
  const brandGold: [number, number, number] = [217, 148, 26]; // #D9941A
  const darkSlateText: [number, number, number] = [24, 34, 28]; // #18221C
  const mutedText: [number, number, number] = [95, 110, 100]; // #5F6E64
  const lightCardBg: [number, number, number] = [249, 250, 248]; // #F9FAF8
  const lightGreenBg: [number, number, number] = [232, 245, 235]; // #E8F5EB
  const borderLineColor: [number, number, number] = [218, 226, 220]; // #DAE2DC
  const accentSuccess: [number, number, number] = [34, 139, 34]; // #228B22
  const accentWarning: [number, number, number] = [194, 65, 12]; // #C2410C
  const accentDanger: [number, number, number] = [185, 28, 28]; // #B91C1C

  // 1. Top Decorative Brand Bar
  doc.setFillColor(...brandDarkGreen);
  doc.rect(0, 0, pageWidth, 5, 'F');
  doc.setFillColor(...brandGold);
  doc.rect(0, 5, pageWidth, 1.2, 'F');

  // 2. Header Section
  let logoDataUrl = '';
  try {
    logoDataUrl = await loadImageAsDataUrl(oppaDruLogo);
  } catch {
    // Fallback if image load fails
  }

  const headerY = 11.5;
  const logoBoxSize = 19;

  if (logoDataUrl) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...borderLineColor);
      doc.setLineWidth(0.3);
      doc.roundedRect(margin, headerY, logoBoxSize, logoBoxSize, 2.5, 2.5, 'FD');
      doc.addImage(logoDataUrl, 'JPEG', margin + 1, headerY + 1, logoBoxSize - 2, logoBoxSize - 2);
    } catch {
      // Ignore image rendering error
    }
  }

  const brandTextStartX = logoDataUrl ? margin + logoBoxSize + 4 : margin;

  // Store Brand and Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13.5);
  doc.setTextColor(...brandDarkGreen);
  doc.text('OPPA DRU RESTAURANT', brandTextStartX, headerY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...mutedText);
  doc.text('Korean Street Food & Beverages • Management Information System', brandTextStartX, headerY + 9.8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...darkSlateText);
  doc.text('EXECUTIVE SALES & PERFORMANCE REPORT', brandTextStartX, headerY + 16);

  // Metadata Card (Right Aligned)
  const metaCardWidth = 68;
  const metaCardHeight = 24.5;
  const metaCardX = pageWidth - margin - metaCardWidth;

  doc.setFillColor(...lightCardBg);
  doc.setDrawColor(...borderLineColor);
  doc.setLineWidth(0.3);
  doc.roundedRect(metaCardX, headerY, metaCardWidth, metaCardHeight, 2, 2, 'FD');

  const generatedDateStr = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const adminAccountName = data.generatedBy?.name || 'System Administrator';
  const adminAccountEmail = data.generatedBy?.email || 'admin@oppadru.com';

  // Metadata items
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...mutedText);
  doc.text('GENERATED:', metaCardX + 3, headerY + 4);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...darkSlateText);
  doc.text(generatedDateStr, metaCardX + 22, headerY + 4);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...mutedText);
  doc.text('ADMIN NAME:', metaCardX + 3, headerY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...brandDarkGreen);
  const trimmedAdminName = doc.splitTextToSize(adminAccountName, metaCardWidth - 25)[0] || adminAccountName;
  doc.text(trimmedAdminName, metaCardX + 22, headerY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...mutedText);
  doc.text('ADMIN EMAIL:', metaCardX + 3, headerY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.8);
  doc.setTextColor(...darkSlateText);
  const trimmedAdminEmail = doc.splitTextToSize(adminAccountEmail, metaCardWidth - 25)[0] || adminAccountEmail;
  doc.text(trimmedAdminEmail, metaCardX + 22, headerY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...mutedText);
  doc.text('TIMELINE:', metaCardX + 3, headerY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...brandDarkGreen);
  doc.text(data.timelineRange.toUpperCase(), metaCardX + 22, headerY + 16);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.6);
  doc.setTextColor(...mutedText);
  doc.text('RECORDS:', metaCardX + 3, headerY + 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...darkSlateText);
  doc.text(`${data.orders.length} Sales Orders`, metaCardX + 22, headerY + 20);

  // Header bottom dividing line
  const dividerY = headerY + Math.max(logoBoxSize, metaCardHeight) + 2.5;
  doc.setDrawColor(...borderLineColor);
  doc.setLineWidth(0.35);
  doc.line(margin, dividerY, pageWidth - margin, dividerY);

  // 3. Detailed Filter Parameters & Audit Scope Panel (Without cut-short text)
  const paramY = dividerY + 2.5;
  const paramHeight = 14;

  doc.setFillColor(...lightCardBg);
  doc.setDrawColor(...borderLineColor);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, paramY, contentWidth, paramHeight, 2, 2, 'FD');

  // Title bar inside filter panel
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...brandDarkGreen);
  doc.text('APPLIED REPORT FILTERS & AUDIT CRITERIA', margin + 3.5, paramY + 3.8);

  const filters = data.filters;
  const channelDisplay = !filters || filters.channel === 'all'
    ? 'All Channels'
    : filters.channel === 'foodpanda'
      ? 'Foodpanda Only'
      : filters.channel === 'grabfood'
        ? 'GrabFood Only'
        : filters.channel === 'online'
          ? 'Online Only'
          : 'Onsite Only';

  const yearDisplay = !filters || filters.year === 'all' ? 'All Years' : filters.year;
  const monthDisplay = !filters || filters.month === 'all'
    ? 'All Months'
    : MONTH_NAMES[Number(filters.month)] || filters.month;

  const weekDisplay = !filters || filters.week === 'all'
    ? 'All Weeks'
    : filters.weekRangeText
      ? `Week ${filters.week} (${filters.weekRangeText})`
      : `Week ${filters.week}`;

  const dayDisplay = !filters || filters.day === 'all'
    ? 'All Days'
    : DAY_NAMES[Number(filters.day)] || `Day ${filters.day}`;

  const isExactDateUsed = Boolean(filters?.date && filters.date.trim() !== '');
  const exactDateDisplay = isExactDateUsed
    ? new Date(`${filters!.date}T00:00:00+08:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Not Stated';

  // 4 Filter Columns with full wording
  const col1X = margin + 3.5;
  const col2X = margin + 48;
  const col3X = margin + 93;
  const col4X = margin + 138;

  // Row 1
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...mutedText);
  doc.text('Channel:', col1X, paramY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkSlateText);
  doc.text(channelDisplay, col1X + 13, paramY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('Year:', col2X, paramY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkSlateText);
  doc.text(yearDisplay, col2X + 8, paramY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('Week:', col3X, paramY + 8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkSlateText);
  doc.text(weekDisplay, col3X + 9, paramY + 8);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('Exact Date:', col4X, paramY + 8);
  doc.setFont('helvetica', isExactDateUsed ? 'bold' : 'normal');
  doc.setTextColor(...(isExactDateUsed ? brandDarkGreen : mutedText));
  doc.text(exactDateDisplay, col4X + 15, paramY + 8);

  // Row 2
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('Timeline:', col1X, paramY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkSlateText);
  doc.text(data.timelineRange.toUpperCase(), col1X + 13, paramY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('Month:', col2X, paramY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkSlateText);
  doc.text(monthDisplay, col2X + 10, paramY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('Day:', col3X, paramY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkSlateText);
  doc.text(dayDisplay, col3X + 7, paramY + 12);

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...mutedText);
  doc.text('Scope:', col4X, paramY + 12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkSlateText);
  doc.text(data.activeFilterSummary || 'All Data', col4X + 10, paramY + 12);

  // 4. KPI Performance Metric Cards
  const kpiY = paramY + paramHeight + 3;
  const numCards = 2 + data.metrics.channels.length;
  const cardGap = 3;
  const cardWidth = (contentWidth - (numCards - 1) * cardGap) / numCards;
  const cardHeight = 17;

  const avgOrderValue = data.metrics.totalOrders > 0
    ? data.metrics.totalSales / data.metrics.totalOrders
    : 0;

  const kpis = [
    {
      title: 'TOTAL REVENUE',
      value: formatCurrencyForPdf(data.metrics.totalSales),
      subtitle: `${data.metrics.totalOrders} total sales orders`,
      isPrimary: true,
    },
    {
      title: 'AVG ORDER VALUE',
      value: formatCurrencyForPdf(avgOrderValue),
      subtitle: data.metrics.totalOrders > 0 ? 'Per customer order' : 'No sales recorded',
      isPrimary: false,
    },
    ...data.metrics.channels.map((channel) => ({
      title: channel.label.toUpperCase(),
      value: formatCurrencyForPdf(channel.sales),
      subtitle: `${channel.orders} orders (${channel.percent}%)`,
      isPrimary: false,
    })),
  ];

  kpis.forEach((card, index) => {
    const cardX = margin + index * (cardWidth + cardGap);

    if (card.isPrimary) {
      // Primary highlight card
      doc.setFillColor(...brandDarkGreen);
      doc.roundedRect(cardX, kpiY, cardWidth, cardHeight, 2, 2, 'F');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.2);
      doc.setTextColor(215, 235, 220);
      doc.text(card.title, cardX + 3, kpiY + 4.2);

      doc.setFont('helvetica', 'bold');
      const valSize = card.value.length > 13 ? 8.2 : 9.2;
      doc.setFontSize(valSize);
      doc.setTextColor(255, 255, 255);
      doc.text(card.value, cardX + 3, kpiY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(215, 235, 220);
      doc.text(card.subtitle, cardX + 3, kpiY + 14.5);
    } else {
      // Standard metric card
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(...borderLineColor);
      doc.setLineWidth(0.25);
      doc.roundedRect(cardX, kpiY, cardWidth, cardHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.2);
      doc.setTextColor(...mutedText);
      doc.text(card.title, cardX + 3, kpiY + 4.2);

      doc.setFont('helvetica', 'bold');
      const valSize = card.value.length > 13 ? 8 : 8.8;
      doc.setFontSize(valSize);
      doc.setTextColor(...darkSlateText);
      doc.text(card.value, cardX + 3, kpiY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(...mutedText);
      doc.text(card.subtitle, cardX + 3, kpiY + 14.5);
    }
  });

  // 5. Secondary Section: Target Progress & Top Performing Items (With Multi-Line Full Word Wrapping)
  const secY = kpiY + cardHeight + 3;
  const secCardHeight = 42;
  const leftBoxWidth = 72;
  const rightBoxWidth = contentWidth - leftBoxWidth - 3.5; // 106.5mm
  const rightBoxX = margin + leftBoxWidth + 3.5;

  // --- Left Box: Sales Target Performance ---
  doc.setFillColor(...lightCardBg);
  doc.setDrawColor(...borderLineColor);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, secY, leftBoxWidth, secCardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...brandDarkGreen);
  doc.text('TARGET & PERFORMANCE GOAL', margin + 3.5, secY + 4.8);

  // Target Key-Value grid
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  doc.setTextColor(...mutedText);
  doc.text('Target Amount:', margin + 3.5, secY + 10.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkSlateText);
  doc.text(data.goalSet ? formatCurrencyForPdf(data.goal) : 'Not configured', margin + 26, secY + 10.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('Current Sales:', margin + 3.5, secY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkSlateText);
  doc.text(formatCurrencyForPdf(data.metrics.totalSales), margin + 26, secY + 16);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...mutedText);
  doc.text('Status:', margin + 3.5, secY + 21.5);
  doc.setFont('helvetica', 'bold');

  if (data.goalSet && data.goal > 0) {
    const pct = ((data.metrics.totalSales / data.goal) * 100).toFixed(1);
    if (data.goalReached) {
      doc.setTextColor(...accentSuccess);
      doc.text(`Reached (${pct}%)`, margin + 26, secY + 21.5);
    } else {
      doc.setTextColor(...accentWarning);
      doc.text(`In Progress (${pct}%)`, margin + 26, secY + 21.5);
    }

    // Progress Bar Track
    const barX = margin + 3.5;
    const barY = secY + 25.5;
    const barWidth = leftBoxWidth - 7;
    const barHeight = 2.5;

    doc.setFillColor(...lightGreenBg);
    doc.roundedRect(barX, barY, barWidth, barHeight, 1, 1, 'F');

    const progressRatio = Math.min(data.metrics.totalSales / data.goal, 1);
    doc.setFillColor(...(data.goalReached ? accentSuccess : brandForestGreen));
    doc.roundedRect(barX, barY, barWidth * progressRatio, barHeight, 1, 1, 'F');
  } else {
    doc.setTextColor(...mutedText);
    doc.text('No active goal set', margin + 26, secY + 21.5);
  }

  // --- Right Box: Top Selling Products (Full Product Names without Truncation) ---
  doc.setFillColor(...lightCardBg);
  doc.setDrawColor(...borderLineColor);
  doc.setLineWidth(0.25);
  doc.roundedRect(rightBoxX, secY, rightBoxWidth, secCardHeight, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.2);
  doc.setTextColor(...brandDarkGreen);
  doc.text('TOP PERFORMING MENU ITEMS (BY UNITS SOLD)', rightBoxX + 3.5, secY + 4.8);

  const subColWidth = (rightBoxWidth - 7 - 4) / 2;
  const onsiteColX = rightBoxX + 3.5 + subColWidth + 4;
  const leftColumnX = rightBoxX + 3.5;
  const maxItemNameWidth = subColWidth - 13;

  doc.setDrawColor(...borderLineColor);
  doc.setLineWidth(0.2);
  doc.line(onsiteColX - 2, secY + 7, onsiteColX - 2, secY + secCardHeight - 2.5);
  doc.line(leftColumnX, secY + 24, rightBoxX + rightBoxWidth - 3.5, secY + 24);

  const renderChannelProducts = (
    channel: 'online' | 'onsite' | 'foodpanda' | 'grabfood',
    label: string,
    x: number,
    y: number,
  ) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.2);
    doc.setTextColor(...brandForestGreen);
    doc.text(`${label} (Top 2)`, x, y);

    const items = data.topProducts[channel].slice(0, 2);
    if (items.length === 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...mutedText);
      doc.text('No sales recorded', x, y + 4);
      return;
    }

    let rowY = y + 3.8;
    items.forEach((item, index) => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.4);
      doc.setTextColor(...darkSlateText);
      const lines = doc.splitTextToSize(`${index + 1}. ${item[0] || 'Unnamed item'}`, maxItemNameWidth);
      doc.text(lines, x, rowY);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...mutedText);
      doc.text(`${item[1]} sold`, x + subColWidth, rowY, { align: 'right' });
      rowY += Math.max(lines.length * 2.5, 3.2) + 0.3;
    });
  };

  renderChannelProducts('online', 'Online', leftColumnX, secY + 9.5);
  renderChannelProducts('foodpanda', 'Foodpanda', leftColumnX, secY + 26);
  renderChannelProducts('onsite', 'Onsite', onsiteColX, secY + 9.5);
  renderChannelProducts('grabfood', 'GrabFood', onsiteColX, secY + 26);

  // 6. Detailed Orders Breakdown Table (autoTable with Full Text Wrapping)
  const tableStartY = secY + secCardHeight + 3.5;

  const tableHeaders = [
    '#',
    'Order No.',
    'Customer',
    'Channel',
    'Date & Time',
    'Status',
    'Amount',
  ];

  const tableRows = data.orders.map((order, idx) => {
    const orderNo = order.order_number || String(order.id || '');
    const customer = order.customerName || order.customer_name || order.email || 'Walk-in Customer';
    const channel = (order.third_party_platform || order.channel || 'online').toUpperCase();
    const dateStr = getOrderDisplayDate(order);
    const status = String(order.status || 'PENDING').toUpperCase();
    const amount = formatCurrencyForPdf(order.total);

    return [
      String(idx + 1),
      orderNo,
      customer,
      channel,
      dateStr,
      status,
      amount,
    ];
  });

  // Column Widths sum to exactly 182mm (contentWidth)
  autoTable(doc, {
    startY: tableStartY,
    head: [tableHeaders],
    body: tableRows,
    foot: [
      [
        '',
        `Total: ${data.orders.length} orders`,
        '',
        '',
        '',
        'Grand Total:',
        formatCurrencyForPdf(data.metrics.totalSales),
      ],
    ],
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 16, top: 20 },
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      textColor: darkSlateText,
      cellPadding: { top: 2, right: 2.5, bottom: 2, left: 2.5 },
      lineColor: borderLineColor,
      lineWidth: 0.15,
      valign: 'middle',
      overflow: 'linebreak',
    },
    headStyles: {
      fillColor: brandDarkGreen,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
      halign: 'left',
      minCellHeight: 6.5,
    },
    footStyles: {
      fillColor: lightGreenBg,
      textColor: brandDarkGreen,
      fontStyle: 'bold',
      fontSize: 7.5,
      lineColor: brandDarkGreen,
      lineWidth: 0.25,
      minCellHeight: 6.5,
    },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 26, fontStyle: 'bold' },
      2: { cellWidth: 38, halign: 'left' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 40, halign: 'left' },
      5: { cellWidth: 22, halign: 'center' },
      6: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: {
      fillColor: lightCardBg,
    },
    didDrawCell: (hookData) => {
      // Clean custom status formatting
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const rawStatus = String(hookData.cell.raw || '').toLowerCase();
        if (rawStatus.includes('delivered') || rawStatus.includes('completed')) {
          doc.setTextColor(...accentSuccess);
        } else if (rawStatus.includes('cancel')) {
          doc.setTextColor(...accentDanger);
        } else if (rawStatus.includes('preparing') || rawStatus.includes('on_the_way')) {
          doc.setTextColor(...accentWarning);
        }
      }
    },
    didDrawPage: (pageData) => {
      // Header for Page 2 and beyond
      if (pageData.pageNumber > 1) {
        doc.setFillColor(...brandDarkGreen);
        doc.rect(0, 0, pageWidth, 4, 'F');
        doc.setFillColor(...brandGold);
        doc.rect(0, 4, pageWidth, 0.8, 'F');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(...brandDarkGreen);
        doc.text('OPPA DRU • Executive Sales Report (Continued)', margin, 11);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(...mutedText);
        doc.text(`Scope: ${data.activeFilterSummary || 'All Data'}`, pageWidth - margin, 11, { align: 'right' });

        doc.setDrawColor(...borderLineColor);
        doc.setLineWidth(0.25);
        doc.line(margin, 14, pageWidth - margin, 14);
      }

      // Running Footer on ALL pages
      const footerY = pageHeight - 9;
      doc.setDrawColor(...borderLineColor);
      doc.setLineWidth(0.25);
      doc.line(margin, footerY - 2, pageWidth - margin, footerY - 2);

      const adminFooterText = data.generatedBy?.name
        ? `Exported by: ${data.generatedBy.name}${data.generatedBy.email ? ` (${data.generatedBy.email})` : ''} • `
        : '';

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(5.8);
      doc.setTextColor(...mutedText);
      doc.text(
        `${adminFooterText}CONFIDENTIAL • Oppa Dru Restaurant & Management System • Internal Use Only`,
        margin,
        footerY + 2
      );

      const pageStr = `Page ${pageData.pageNumber} of ${doc.getNumberOfPages()}`;
      doc.text(pageStr, pageWidth - margin, footerY + 2, { align: 'right' });
    },
  });

  const paymentTableStartY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY
    ? (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 7
    : tableStartY + 7;
  autoTable(doc, {
    startY: paymentTableStartY,
    head: [['Payment method', 'Orders', 'Amount']],
    body: data.payments.length
      ? data.payments.map((payment) => [payment.method, String(payment.orders), formatCurrencyForPdf(payment.amount)])
      : [['No payment data', '', '']],
    foot: [['Total', String(data.payments.reduce((sum, payment) => sum + payment.orders, 0)), formatCurrencyForPdf(data.payments.reduce((sum, payment) => sum + payment.amount, 0))]],
    theme: 'grid',
    margin: { left: margin, right: margin, bottom: 16, top: 20 },
    styles: {
      font: 'helvetica',
      fontSize: 7.2,
      textColor: darkSlateText,
      cellPadding: 2,
      lineColor: borderLineColor,
      lineWidth: 0.15,
    },
    headStyles: { fillColor: brandDarkGreen, textColor: [255, 255, 255], fontStyle: 'bold' },
    footStyles: { fillColor: lightGreenBg, textColor: brandDarkGreen, fontStyle: 'bold' },
    columnStyles: {
      0: { cellWidth: 104 },
      1: { cellWidth: 30, halign: 'right' },
      2: { cellWidth: 48, halign: 'right', fontStyle: 'bold' },
    },
  });

  // 7. Sign-off / Admin Export Verification Box below the table
  const finalTableY = (doc as any).lastAutoTable?.finalY ?? (tableStartY + 30);
  const auditBlockHeight = 18;
  const pageBottomLimit = pageHeight - 16;

  let auditY = finalTableY + 4;
  if (auditY + auditBlockHeight > pageBottomLimit) {
    doc.addPage();
    auditY = 22;
  }

  doc.setFillColor(...lightCardBg);
  doc.setDrawColor(...borderLineColor);
  doc.setLineWidth(0.25);
  doc.roundedRect(margin, auditY, contentWidth, auditBlockHeight, 2, 2, 'FD');

  const adminName = data.generatedBy?.name || 'System Administrator';
  const adminEmail = data.generatedBy?.email || 'admin@oppadru.com';
  const adminRole = data.generatedBy?.role ? data.generatedBy.role.toUpperCase() : 'ADMIN';

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  doc.setTextColor(...brandDarkGreen);
  doc.text('REPORT EXPORT & SYSTEM AUDIT VERIFICATION', margin + 3.5, auditY + 4.5);

  // Left column: Account Name & Email
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...mutedText);
  doc.text('Exported By Name:', margin + 3.5, auditY + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...darkSlateText);
  doc.text(adminName, margin + 28, auditY + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...mutedText);
  doc.text('Admin Email:', margin + 3.5, auditY + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...darkSlateText);
  doc.text(adminEmail, margin + 28, auditY + 14.5);

  // Right column: Role & Timestamp
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...mutedText);
  doc.text('Account Role:', margin + 110, auditY + 9.5);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(...brandForestGreen);
  doc.text(`Authorized ${adminRole}`, margin + 130, auditY + 9.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(...mutedText);
  doc.text('Export Timestamp:', margin + 110, auditY + 14.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.2);
  doc.setTextColor(...darkSlateText);
  doc.text(generatedDateStr, margin + 130, auditY + 14.5);

  // Final Total Pages numbering correction pass
  const totalPages = doc.getNumberOfPages();
  for (let pageNum = 1; pageNum <= totalPages; pageNum += 1) {
    doc.setPage(pageNum);
    const footerY = pageHeight - 9;
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - margin - 22, footerY - 1, 22, 5, 'F');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.2);
    doc.setTextColor(...mutedText);
    doc.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin, footerY + 2, { align: 'right' });

  }

  // Trigger download
  const filename = `OppaDru-Sales-Report-${data.timelineRange}-${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(filename);
};
