import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface GameFormat {
  sets: number;
  gamesPerSet: number;
  withAd: boolean;
  tiebreakAtDeuce: boolean;
  tiebreakPoints: number;
  finalSetTiebreak: boolean;
  finalSetPoints: number;
  playByPoints?: boolean;
  pointsPerSet?: number;
}

interface MatchRow {
  time:        string;
  court:       string;
  courtId?:    string;
  sede:        string;
  round:       string;
  category:    string;
  player1:     string;
  player2:     string;
  duration:    string;
  gameSystem?: string;
  gameFormat?: GameFormat | null;
  matchId?:    string;
  status?:     string;
}

interface ExportOptions {
  tournamentName: string;
  date:           string;
  city?:          string;
  referee?:       string;
  director?:      string;
  observations?:  string;
  withLed?:       boolean;
  schedule:       MatchRow[];
}

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64', R32: 'R32', R16: 'R16',
  QF: 'Cuartos', SF: 'Semifinal', F: 'Final',
  RR: 'RR', RR_A: 'Grupo A', RR_B: 'Grupo B',
  SF_M: 'SF Máster', F_M: 'Final Máster',
};

/** Convierte un gameFormat a texto compacto para el PDF */
function describeFormat(fmt: GameFormat | null | undefined): string {
  if (!fmt) return '';
  const parts: string[] = [];

  if (fmt.playByPoints) {
    // Modo por puntos (categorías infantiles)
    const pts = fmt.pointsPerSet ?? 11;
    parts.push(fmt.sets === 1 ? `1 set a ${pts} pts` : `${fmt.sets} sets a ${pts} pts`);
    parts.push(fmt.withAd ? 'Con ventaja' : 'Sin ventaja');
    if (fmt.tiebreakAtDeuce) parts.push(`TB ${fmt.tiebreakPoints}pts`);
    if (fmt.finalSetTiebreak && fmt.sets > 1) parts.push(`MTB ${fmt.finalSetPoints}pts`);
  } else {
    // Modo tradicional por games
    parts.push(fmt.sets === 1 ? `1 set a ${fmt.gamesPerSet} jgs` : `${fmt.sets} sets a ${fmt.gamesPerSet}`);
    parts.push(fmt.withAd ? 'Con Ad' : 'Sin Ad');
    if (fmt.tiebreakAtDeuce) parts.push(`TB ${fmt.tiebreakPoints}pts`);
    if (fmt.finalSetTiebreak && fmt.sets > 1) parts.push(`FS TB ${fmt.finalSetPoints}pts`);
  }

  return parts.join(' · ');
}

export function exportSchedulePdf(options: ExportOptions) {
  const {
    tournamentName, date, city = 'Medellín',
    referee, director, observations, withLed = false, schedule,
  } = options;

  // ── NORMALIZAR ────────────────────────────────────
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

  let yPos = 28;

  // ── BANNER LED (si aplica) ─────────────────────────────────────────────
  if (withLed) {
    doc.setFillColor(251, 191, 36);
    doc.rect(10, yPos - 1, pageW - 20, 8, 'F');
    doc.setTextColor(120, 53, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SISTEMA LED: SAQUE QUE TOCA LA RED Y CAE EN EL CUADRO SE JUEGA EL PUNTO', pageW / 2, yPos + 4, { align: 'center' });
    yPos += 11;
  }

  // ── AGRUPAR POR SEDE ──────────────────────────────────────────────────
  const bySede: Record<string, MatchRow[]> = {};
  normalizedRows.forEach(row => {
    if (!bySede[row.sede]) bySede[row.sede] = [];
    bySede[row.sede].push(row);
  });

  let isFirstSede = true;

  for (const [sede, rows] of Object.entries(bySede)) {
    if (!isFirstSede) {
      doc.addPage();
      drawHeader();
      yPos = 28;
      if (withLed) {
        doc.setFillColor(251, 191, 36);
        doc.rect(10, yPos - 1, pageW - 20, 8, 'F');
        doc.setTextColor(120, 53, 15);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.text('SISTEMA LED: SAQUE QUE TOCA LA RED Y CAE EN EL CUADRO SE JUEGA EL PUNTO', pageW / 2, yPos + 4, { align: 'center' });
        yPos += 11;
      }
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

    const allCourtLabels = [...new Set(rows.map(r => r.court))].sort();

    const byTime: Record<string, Record<string, MatchRow[]>> = {};
    rows.forEach(row => {
      if (!byTime[row.time])             byTime[row.time] = {};
      if (!byTime[row.time][row.court])  byTime[row.time][row.court] = [];
      byTime[row.time][row.court].push(row);
    });

    const times = Object.keys(byTime).sort();

    const head = [['#', 'Hora', ...allCourtLabels.map(c => c.toUpperCase())]];

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
              const p1  = m.player1 && m.player1 !== 'BYE' ? m.player1 : `Ganador ${ROUND_LABELS[m.round] || m.round}`;
              const p2  = m.player2 && m.player2 !== 'BYE' ? m.player2 : 'Por definir';

              // Sistema de juego: preferir gameFormat sobre gameSystem string
              const sysText = describeFormat(m.gameFormat) || m.gameSystem || '';
              const ledTag  = withLed ? ' · LED' : '';
              const infoLine = [m.duration, sysText, ledTag].filter(Boolean).join(' · ');

              return (
                `${cat} — ${roundLabel}\n` +
                `${p1}\nvs.\n${p2}\n` +
                `(${infoLine})`
              );
            }).join('\n\n')
          );
        }
      });
      return tableRow;
    });

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

  // ── OBSERVACIONES ─────────────────────────────────────────────────────
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

  // ── FOOTER EN TODAS LAS PÁGINAS ──────────────────────────────────────
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

  const safeName = tournamentName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
  doc.save(`Programacion_${safeName}_${date}.pdf`);
}
