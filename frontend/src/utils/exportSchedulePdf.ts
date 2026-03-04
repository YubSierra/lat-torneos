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

export function exportSchedulePdf(options: ExportOptions) {
  const {
    tournamentName, date, city,
    referee, director, observations, schedule,
  } = options;

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // ── HEADER ────────────────────────────────────
  // Fondo verde oscuro
  doc.setFillColor(27, 58, 27);
  doc.rect(0, 0, pageW, 22, 'F');

  // Logo LAT
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('LAT', 12, 14);

  // Título torneo
  doc.setFontSize(13);
  doc.text(tournamentName.toUpperCase(), pageW / 2, 9, { align: 'center' });

  // Fecha
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  const dateFormatted = new Date(date).toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }).toUpperCase();
  doc.text(`ORDEN DE JUEGO — ${dateFormatted}`, pageW / 2, 17, { align: 'center' });

  // Ciudad
  doc.text(`${city || 'MEDELLÍN'}, COL`, pageW - 12, 14, { align: 'right' });

  // ── AGRUPAR POR SEDE ──────────────────────────
  const bySede: Record<string, MatchRow[]> = {};
  schedule.forEach(row => {
    const s = row.sede || 'Principal';
    if (!bySede[s]) bySede[s] = [];
    bySede[s].push(row);
  });

  let yPos = 28;

  Object.entries(bySede).forEach(([sede, rows]) => {
    // ── HEADER SEDE ─────────────────────────────
    doc.setFillColor(45, 106, 45);
    doc.rect(10, yPos - 5, pageW - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`PARTIDOS ${dateFormatted} — SEDE ${sede.toUpperCase()}`, pageW / 2, yPos, { align: 'center' });
    yPos += 6;

    // ── AGRUPAR POR CANCHA ───────────────────────
    const byCourt: Record<string, MatchRow[]> = {};
    rows.forEach(row => {
      if (!byCourt[row.court]) byCourt[row.court] = [];
      byCourt[row.court].push(row);
    });

    // ── AGRUPAR POR HORA ─────────────────────────
    const byTime: Record<string, Record<string, MatchRow[]>> = {};
    rows.forEach(row => {
      if (!byTime[row.time]) byTime[row.time] = {};
      if (!byTime[row.time][row.court]) byTime[row.time][row.court] = [];
      byTime[row.time][row.court].push(row);
    });

    const courts = Object.keys(byCourt).sort();
    const times  = Object.keys(byTime).sort();

    // ── TABLA POR COLUMNAS (una columna por cancha) ──
    const head = [['Hora', ...courts.map(c => c.toUpperCase())]];
    const body = times.map((time, timeIdx) => {
      const row = [`${timeIdx + 1}\n${time}`];
      courts.forEach(court => {
        const matches = byTime[time]?.[court] || [];
        if (matches.length === 0) {
          row.push('');
        } else {
          const cell = matches.map(m =>
            `${m.category} ${ROUND_LABELS[m.round] || m.round}\n` +
            `${m.player1}\nvs.\n${m.player2}\n` +
            `(${m.duration}${m.gameSystem ? ' · ' + m.gameSystem : ''})`
          ).join('\n\n');
          row.push(cell);
        }
      });
      return row;
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
      },
      headStyles: {
        fillColor: [27, 58, 27],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
      },
      columnStyles: {
        0: { cellWidth: 18, halign: 'center', fontStyle: 'bold', fillColor: [240, 253, 244] },
      },
      alternateRowStyles: { fillColor: [248, 250, 248] },
      didDrawCell: (data) => {
        // Borde verde en celdas de partido
        if (data.row.index >= 0 && data.column.index > 0) {
          const cell = data.cell;
          if (cell.text?.join('').trim()) {
            doc.setDrawColor(45, 106, 45);
            doc.setLineWidth(0.3);
            doc.rect(cell.x, cell.y, cell.width, cell.height);
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Nueva página si no hay espacio
    if (yPos > 175) {
      doc.addPage();
      yPos = 15;
    }
  });

  // ── OBSERVACIONES ────────────────────────────
  if (observations?.trim()) {
    if (yPos > 160) { doc.addPage(); yPos = 15; }

    doc.setFillColor(254, 249, 195);
    doc.rect(10, yPos, pageW - 20, 18, 'F');
    doc.setDrawColor(253, 224, 71);
    doc.rect(10, yPos, pageW - 20, 18);

    doc.setTextColor(146, 64, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES:', 14, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);

    const lines = doc.splitTextToSize(observations, pageW - 30);
    doc.text(lines, 14, yPos + 10);
    yPos += 22;
  }

  // ── FOOTER ───────────────────────────────────
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  const footerY = doc.internal.pageSize.getHeight() - 12;

  doc.setFillColor(27, 58, 27);
  doc.rect(0, footerY - 4, pageW, 16, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  // Izquierda
  doc.text('SE RECOMIENDA LLEGAR AL MENOS 20 MINUTOS ANTES', 12, footerY + 2);

  // Centro
  if (director) doc.text(`Director: ${director}`, pageW / 2, footerY - 1, { align: 'center' });
  if (referee)  doc.text(`Árbitro: ${referee}`, pageW / 2, footerY + 4, { align: 'center' });

  // Derecha — fecha de generación
  const now = new Date().toLocaleString('es-CO');
  doc.text(`Generado: ${now}`, pageW - 12, footerY + 2, { align: 'right' });

  // ── GUARDAR ──────────────────────────────────
  const fileName = `Programacion_${tournamentName.replace(/\s+/g, '_')}_${date}.pdf`;
  doc.save(fileName);
}