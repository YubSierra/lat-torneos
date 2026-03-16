import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface MatchRow {
  time:       string;
  court:      string;
  courtId?:   string;
  sede:       string;
  round:      string;
  category:   string;
  player1:    string;
  player2:    string;
  duration:   string;
  gameSystem?: string;
  matchId?:   string;
  status?:    string;
}

interface ExportOptions {
  tournamentName: string;
  date:           string;
  city?:          string;
  referee?:       string;
  director?:      string;
  observations?:  string;
  schedule:       MatchRow[];
}

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'RR', RR_A: 'Grupo A', RR_B: 'Grupo B',
  SF_M: 'SF Máster', F_M: 'Final Máster',
};

export function exportSchedulePdf(options: ExportOptions) {
  const {
    tournamentName, date, city = 'Medellín',
    referee, director, observations, schedule,
  } = options;

  // ── NORMALIZAR: garantizar court y sede válidos ────────────
  const normalizedRows: MatchRow[] = schedule.map(row => ({
    ...row,
    court: (row.court && row.court !== '—') ? row.court
         : (row.courtId && row.courtId !== '—') ? row.courtId
         : 'Sin cancha',
    sede:  (row.sede && row.sede !== '—') ? row.sede : 'Principal',
  }));

  if (normalizedRows.length === 0) {
    alert('No hay partidos para exportar en el día seleccionado.');
    return;
  }

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // Fecha legible sin bug de timezone (+T12:00:00 evita desfase UTC)
  const dateFormatted = new Date(date + 'T12:00:00')
    .toLocaleDateString('es-CO', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    })
    .toUpperCase();

  const drawHeader = () => {
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
    doc.text(`${city.toUpperCase()}, COL`, pageW - 12, 14, { align: 'right' });
  };

  drawHeader();

  // ── AGRUPAR POR SEDE ──────────────────────────────────────
  const bySede: Record<string, MatchRow[]> = {};
  normalizedRows.forEach(row => {
    if (!bySede[row.sede]) bySede[row.sede] = [];
    bySede[row.sede].push(row);
  });

  let yPos       = 28;
  let isFirstSede = true;

  for (const [sede, rows] of Object.entries(bySede)) {
    if (!isFirstSede) {
      doc.addPage();
      drawHeader();
      yPos = 28;
    }
    isFirstSede = false;

    // Header sede
    doc.setFillColor(45, 106, 45);
    doc.rect(10, yPos - 5, pageW - 20, 9, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(
      `SEDE: ${sede.toUpperCase()}  |  ${rows.length} PARTIDOS`,
      pageW / 2, yPos + 0.5,
      { align: 'center' },
    );
    yPos += 8;

    // ── CLAVES DE CANCHA: mismo valor para head Y body ──────
    const allCourtLabels = [...new Set(rows.map(r => r.court))].sort();

    // byTime[time][court] → array de filas
    const byTime: Record<string, Record<string, MatchRow[]>> = {};
    rows.forEach(row => {
      if (!byTime[row.time])             byTime[row.time] = {};
      if (!byTime[row.time][row.court])  byTime[row.time][row.court] = [];
      byTime[row.time][row.court].push(row);
    });

    const times = Object.keys(byTime).sort();

    // HEAD: usa allCourtLabels (misma clave que byTime)
    const head = [['#', 'Hora', ...allCourtLabels.map(c => c.toUpperCase())]];

    // BODY: itera allCourtLabels para buscar en byTime
    const body = times.map((time, idx) => {
      const tableRow: string[] = [String(idx + 1), time];
      allCourtLabels.forEach(courtLabel => {
        const matches = byTime[time]?.[courtLabel] ?? [];
        if (matches.length === 0) {
          tableRow.push('');
        } else {
          tableRow.push(
            matches.map(m => {
              const roundLabel = ROUND_LABELS[m.round] || m.round;
              const cat = m.category || '';
              return (
                `${cat} — ${roundLabel}\n` +
                `${m.player1 || '?'}\nvs.\n${m.player2 || '?'}\n` +
                `(${m.duration || ''}${m.gameSystem ? ' · ' + m.gameSystem : ''})`
              );
            }).join('\n\n')
          );
        }
      });
      return tableRow;
    });

    // Ancho de columnas
    const courtColW = Math.max(28, Math.floor((pageW - 20 - 22) / allCourtLabels.length));
    const columnStyles: Record<number, any> = {
      0: { cellWidth: 8,  halign: 'center', fontStyle: 'bold', fillColor: [240, 253, 244] },
      1: { cellWidth: 14, halign: 'center', fontStyle: 'bold', fillColor: [240, 253, 244] },
    };
    allCourtLabels.forEach((_, i) => {
      columnStyles[i + 2] = { cellWidth: courtColW, valign: 'top' };
    });

    autoTable(doc, {
      head,
      body,
      startY: yPos,
      margin: { left: 10, right: 10 },
      styles: {
        fontSize: 7,
        cellPadding: 2.5,
        valign: 'top',
        overflow: 'linebreak',
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: [27, 58, 27],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 9,
        halign: 'center',
        cellPadding: 3,
      },
      columnStyles,
      alternateRowStyles: { fillColor: [248, 250, 248] },
      didDrawCell: (data) => {
        if (data.row.index >= 0 && data.column.index >= 2) {
          if (data.cell.text?.join('').trim()) {
            doc.setDrawColor(45, 106, 45);
            doc.setLineWidth(0.4);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
          }
        }
      },
    });

    yPos = (doc as any).lastAutoTable.finalY + 6;
  }

  // ── OBSERVACIONES ─────────────────────────────────────────
  if (observations?.trim()) {
    if (yPos > 165) { doc.addPage(); drawHeader(); yPos = 28; }
    doc.setFillColor(254, 249, 195);
    doc.rect(10, yPos, pageW - 20, 18, 'F');
    doc.setDrawColor(253, 224, 71);
    doc.setLineWidth(0.5);
    doc.rect(10, yPos, pageW - 20, 18);
    doc.setTextColor(146, 64, 14);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('OBSERVACIONES:', 14, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const obsLines = doc.splitTextToSize(observations, pageW - 30);
    doc.text(obsLines, 14, yPos + 10);
    yPos += 22;
  }

  // ── FOOTER EN TODAS LAS PÁGINAS ──────────────────────────
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    const fY = doc.internal.pageSize.getHeight() - 12;
    doc.setFillColor(27, 58, 27);
    doc.rect(0, fY - 4, pageW, 16, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('SE RECOMIENDA LLEGAR AL MENOS 20 MINUTOS ANTES', 12, fY + 2);
    if (director) doc.text(`Director: ${director}`, pageW / 2, fY - 1, { align: 'center' });
    if (referee)  doc.text(`Arbitro: ${referee}`,   pageW / 2, fY + 4, { align: 'center' });
    doc.text(
      `Pag. ${p}/${totalPages}  —  ${new Date().toLocaleString('es-CO')}`,
      pageW - 12, fY + 2, { align: 'right' },
    );
  }

  // ── GUARDAR ───────────────────────────────────────────────
  const safeName = tournamentName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  doc.save(`Programacion_${safeName}_${date}.pdf`);
}