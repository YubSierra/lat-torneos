import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MatchRow {
  time: string;
  court: string;
  sede: string;
  round: string;
  category: string;
  player1: string;
  player2: string;
  duration: string;
  gameSystem?: string;
}

interface ExportOptions {
  tournamentName: string;
  date: string;
  city: string;
  referee?: string;
  director?: string;
  observations?: string;
  schedule: MatchRow[];
}

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
  SF_M: 'SF Máster', F_M: 'Final Máster',
};

// ── Función helper para dibujar el header en cada página ─────────────────────
function drawPageHeader(
  doc: jsPDF,
  tournamentName: string,
  dateFormatted: string,
  city: string,
  pageW: number,
) {
  doc.setFillColor(27, 58, 27);
  doc.rect(0, 0, pageW, 22, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('LAT', 12, 14);

  doc.setFontSize(13);
  doc.text(tournamentName.toUpperCase(), pageW / 2, 9, { align: 'center' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`ORDEN DE JUEGO — ${dateFormatted}`, pageW / 2, 17, { align: 'center' });

  doc.text(`${city || 'MEDELLÍN'}, COL`, pageW - 12, 14, { align: 'right' });
}

// ── Función helper para dibujar footer con número de página ──────────────────
function drawFooter(
  doc: jsPDF,
  pageW: number,
  referee?: string,
  director?: string,
) {
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const footerY = doc.internal.pageSize.getHeight() - 12;

    doc.setFillColor(27, 58, 27);
    doc.rect(0, footerY - 4, pageW, 16, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');

    // Izquierda
    doc.text('SE RECOMIENDA LLEGAR AL MENOS 20 MINUTOS ANTES', 12, footerY + 2);

    // Centro — árbitro y director
    if (director) doc.text(`Director: ${director}`, pageW / 2, footerY - 1, { align: 'center' });
    if (referee)  doc.text(`Árbitro: ${referee}`,   pageW / 2, footerY + 4, { align: 'center' });

    // Derecha — página / total
    const now = new Date().toLocaleString('es-CO');
    doc.text(`Pág. ${p}/${totalPages}  ·  ${now}`, pageW - 12, footerY + 2, { align: 'right' });
  }
}

export function exportSchedulePdf(options: ExportOptions) {
  const {
    tournamentName, date, city,
    referee, director, observations, schedule,
  } = options;

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  const dateFormatted = new Date(date + 'T12:00:00').toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();

  // Header de la primera página
  drawPageHeader(doc, tournamentName, dateFormatted, city, pageW);

  // ── AGRUPAR POR SEDE ──────────────────────────────────────────────────────
  const bySede: Record<string, MatchRow[]> = {};
  schedule.forEach(row => {
    const s = row.sede || 'Principal';
    if (!bySede[s]) bySede[s] = [];
    bySede[s].push(row);
  });

  const sedeEntries = Object.entries(bySede);
  let yPos = 28;

  sedeEntries.forEach(([sede, rows], sedeIndex) => {

    // ── NUEVA PÁGINA por cada sede (excepto la primera) ───────────────────
    if (sedeIndex > 0) {
      doc.addPage();
      drawPageHeader(doc, tournamentName, dateFormatted, city, pageW);
      yPos = 28;
    }

    // ── HEADER SEDE ───────────────────────────────────────────────────────
    doc.setFillColor(45, 106, 45);
    doc.rect(10, yPos - 5, pageW - 20, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `SEDE: ${sede.toUpperCase()}  |  ${rows.length} PARTIDOS`,
      pageW / 2, yPos + 1, { align: 'center' },
    );
    yPos += 10;

    // ── AGRUPAR POR CANCHA y POR HORA ─────────────────────────────────────
    const byCourt: Record<string, MatchRow[]> = {};
    rows.forEach(row => {
      const key = row.court || 'Sin cancha';
      if (!byCourt[key]) byCourt[key] = [];
      byCourt[key].push(row);
    });

    const byTime: Record<string, Record<string, MatchRow[]>> = {};
    rows.forEach(row => {
      if (!byTime[row.time])              byTime[row.time] = {};
      if (!byTime[row.time][row.court])   byTime[row.time][row.court] = [];
      byTime[row.time][row.court].push(row);
    });

    const courts = Object.keys(byCourt).sort();
    const times  = Object.keys(byTime).sort();

    // ── TABLA: filas = horas, columnas = canchas ───────────────────────────
    const head = [['#  Hora', ...courts.map(c => c.toUpperCase())]];

    const body = times.map((time, timeIdx) => {
      const row: string[] = [`${timeIdx + 1}\n${time}`];
      courts.forEach(court => {
        const matches = byTime[time]?.[court] || [];
        if (matches.length === 0) {
          row.push('');
          return;
        }
        const cell = matches.map(m =>
          `[${m.category}] ${ROUND_LABELS[m.round] ?? m.round}\n` +
          `${m.player1}\nvs\n${m.player2}\n` +
          `⏱ ${m.duration}` +
          (m.gameSystem ? `\n· ${m.gameSystem}` : ''),
        ).join('\n\n');
        row.push(cell);
      });
      return row;
    });

    // Ancho equitativo para columnas de cancha
    const courtColW = (pageW - 20 - 22) / courts.length;
    const columnStyles: Record<number, any> = {
      0: { cellWidth: 22, halign: 'center', fontStyle: 'bold', fillColor: [240, 253, 244] },
    };
    courts.forEach((_, i) => {
      columnStyles[i + 1] = { cellWidth: courtColW };
    });

    autoTable(doc, {
      head,
      body,
      startY: yPos,
      margin: { left: 10, right: 10 },
      styles: {
        fontSize: 8,
        cellPadding: 3,
        valign: 'top',
        overflow: 'linebreak',
        lineColor: [220, 220, 220],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [27, 58, 27],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      columnStyles,
      alternateRowStyles: { fillColor: [248, 252, 248] },
      didDrawCell: (data) => {
        // Borde verde suave en celdas con contenido
        if (data.row.index >= 0 && data.column.index > 0) {
          const cell = data.cell;
          if (cell.text?.join('').trim()) {
            doc.setDrawColor(45, 106, 45);
            doc.setLineWidth(0.4);
            doc.rect(cell.x, cell.y, cell.width, cell.height);
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  });

  // ── OBSERVACIONES ─────────────────────────────────────────────────────────
  if (observations?.trim()) {
    // Si no cabe en la página actual, nueva página
    if (yPos > 160) {
      doc.addPage();
      drawPageHeader(doc, tournamentName, dateFormatted, city, pageW);
      yPos = 28;
    }

    doc.setFillColor(254, 249, 195);
    doc.setDrawColor(253, 224, 71);
    doc.setLineWidth(0.5);

    const obsLines = doc.splitTextToSize(observations, pageW - 36);
    const obsH     = 12 + obsLines.length * 5;
    doc.rect(10, yPos, pageW - 20, obsH, 'FD');

    doc.setTextColor(146, 64, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES:', 14, yPos + 6);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(obsLines, 14, yPos + 11);
    yPos += obsH + 6;
  }

  // ── FOOTER en todas las páginas ───────────────────────────────────────────
  drawFooter(doc, pageW, referee, director);

  // ── GUARDAR ───────────────────────────────────────────────────────────────
  const fileName = `Programacion_${tournamentName.replace(/\s+/g, '_')}_${date}.pdf`;
  doc.save(fileName);
}