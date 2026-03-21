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
  date?:          string;   // retrocompatibilidad (un solo día)
  dates?:         string[]; // múltiples días
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
    tournamentName, city = 'Medellín',
    referee, director, observations, withLed = false, schedule,
  } = options;

  // Normalizar: aceptar date (string) o dates (string[])
  const allDates: string[] = options.dates?.length
    ? [...options.dates].sort()
    : options.date ? [options.date] : [];

  // ── NORMALIZAR FILAS ──────────────────────────────
  const normalizedRows: (MatchRow & { date?: string })[] = schedule.map(row => ({
    ...row,
    court: (row.court && row.court !== '—') ? row.court
         : (row.courtId && row.courtId !== '—') ? row.courtId
         : 'Sin cancha',
    sede:  (row.sede && row.sede !== '—') ? row.sede : 'Principal',
  }));

  if (normalizedRows.length === 0) {
    alert('No hay partidos para exportar en los días seleccionados.');
    return;
  }

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  const formatDate = (d: string) =>
    new Date(d + 'T12:00:00')
      .toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      .toUpperCase();

  // Cuando hay múltiples días el encabezado muestra el rango
  const headerDateText = allDates.length === 1
    ? formatDate(allDates[0])
    : `${formatDate(allDates[0])} AL ${formatDate(allDates[allDates.length - 1])}`;

  const drawHeader = (dateLabel?: string) => {
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
    doc.text(`ORDEN DE JUEGO — ${dateLabel || headerDateText}`, pageW / 2, 17, { align: 'center' });
    doc.text(`${city.toUpperCase()}, COL`, pageW - 12, 14, { align: 'right' });
  };

  const drawLedBanner = (y: number) => {
    doc.setFillColor(251, 191, 36);
    doc.rect(10, y - 1, pageW - 20, 8, 'F');
    doc.setTextColor(120, 53, 15);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text('SISTEMA LET: SAQUE QUE TOCA LA RED Y CAE EN EL CUADRO SE JUEGA EL PUNTO', pageW / 2, y + 4, { align: 'center' });
  };

  drawHeader();
  let yPos = 28;
  if (withLed) { drawLedBanner(yPos); yPos += 11; }

  // Agrupar filas por día → luego por sede
  const rowsByDate: Record<string, (MatchRow & { date?: string })[]> = {};
  if (allDates.length <= 1) {
    // Un solo día o sin fecha: agrupar todo junto
    rowsByDate[allDates[0] || ''] = normalizedRows;
  } else {
    normalizedRows.forEach(row => {
      const d = (row as MatchRow & { date?: string }).date || allDates[0];
      if (!rowsByDate[d]) rowsByDate[d] = [];
      rowsByDate[d].push(row);
    });
  }

  let isFirstBlock = true;

  for (const currentDate of allDates.length > 1 ? allDates : [allDates[0] || '']) {
    const rowsForDate = rowsByDate[currentDate] || [];
    if (rowsForDate.length === 0) continue;

    // Si hay múltiples días, nueva página con encabezado del día
    if (!isFirstBlock) {
      doc.addPage();
      drawHeader(allDates.length > 1 ? formatDate(currentDate) : undefined);
      yPos = 28;
      if (withLed) { drawLedBanner(yPos); yPos += 11; }
    }
    isFirstBlock = false;

    // Agrupar por sede
    const bySede: Record<string, MatchRow[]> = {};
    rowsForDate.forEach(row => {
      if (!bySede[row.sede]) bySede[row.sede] = [];
      bySede[row.sede].push(row);
    });

    let isFirstSede = true;

  for (const [sede, rows] of Object.entries(bySede)) {
    if (!isFirstSede) {
      doc.addPage();
      drawHeader(allDates.length > 1 ? formatDate(currentDate) : undefined);
      yPos = 28;
      if (withLed) { drawLedBanner(yPos); yPos += 11; }
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

    // ── AGRUPAR CANCHAS POR DURACIÓN MÍNIMA DE SUS PARTIDOS ──
    // Canchas con partidos de diferente duración generan slots en horarios distintos,
    // causando celdas vacías cuando se mezclan en una sola tabla.
    // Solución: una tabla separada por cada grupo de duración.
    const courtMinDur = new Map<string, number>();
    allCourtLabels.forEach(courtLabel => {
      const durs: number[] = [];
      times.forEach(t => {
        (byTime[t]?.[courtLabel] ?? []).forEach(m => {
          const d = parseInt(m.duration);
          if (!isNaN(d)) durs.push(d);
        });
      });
      courtMinDur.set(courtLabel, durs.length > 0 ? Math.min(...durs) : 90);
    });

    // Grupos ordenados por duración ascendente
    const durationGroups = new Map<number, string[]>();
    allCourtLabels.forEach(court => {
      const dur = courtMinDur.get(court) ?? 90;
      if (!durationGroups.has(dur)) durationGroups.set(dur, []);
      durationGroups.get(dur)!.push(court);
    });
    const sortedGroups = [...durationGroups.entries()].sort((a, b) => a[0] - b[0]);
    const multipleGroups = sortedGroups.length > 1;

    const renderMatchCell = (matches: MatchRow[]): string =>
      matches.map(m => {
        const roundLabel = ROUND_LABELS[m.round] || m.round;
        const cat = m.category || '';
        const isTbd1 = !m.player1 || m.player1 === 'BYE' || m.player1 === 'Por definir';
        const isTbd2 = !m.player2 || m.player2 === 'BYE' || m.player2 === 'Por definir';
        const p1 = isTbd1 ? `Ganador ${ROUND_LABELS[m.round] || m.round}` : m.player1;
        const p2 = isTbd2 ? 'Por definir' : m.player2;
        const sysText = describeFormat(m.gameFormat) || m.gameSystem || '';
        const ledTag  = withLed ? ' · LET' : '';
        const infoLine = [m.duration, sysText, ledTag].filter(Boolean).join(' · ');
        return `${cat} — ${roundLabel}\n${p1}\nvs.\n${p2}\n(${infoLine})`;
      }).join('\n\n');

    for (const [, groupCourts] of sortedGroups) {
      // Solo los horarios donde esta ronda de canchas tiene partidos
      const groupTimes = times.filter(t =>
        groupCourts.some(c => (byTime[t]?.[c] ?? []).length > 0),
      );
      if (groupTimes.length === 0) continue;

      // Sub-título si hay múltiples grupos (ej: "CANCHAS MINI — 30 MIN")
      if (multipleGroups) {
        const groupLabel = groupCourts.map(c => c.toUpperCase()).join(', ');
        doc.setFillColor(60, 120, 60);
        doc.rect(10, yPos - 1, pageW - 20, 6, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text(groupLabel, pageW / 2, yPos + 3, { align: 'center' });
        yPos += 8;
      }

      const head = [['#', 'Hora', ...groupCourts.map(c => c.toUpperCase())]];
      const body = groupTimes.map((time, idx) => {
        const tableRow: string[] = [String(idx + 1), time];
        groupCourts.forEach(courtLabel => {
          const matches = byTime[time]?.[courtLabel] ?? [];
          tableRow.push(matches.length === 0 ? '' : renderMatchCell(matches));
        });
        return tableRow;
      });

      const courtColW = Math.max(28, Math.floor((pageW - 20 - 22) / groupCourts.length));
      const columnStyles: Record<number, object> = {
        0: { cellWidth: 8,  halign: 'center', fontStyle: 'bold', fillColor: [240, 253, 244] },
        1: { cellWidth: 14, halign: 'center', fontStyle: 'bold', fillColor: [240, 253, 244] },
      };
      groupCourts.forEach((_, i) => {
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

      yPos = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
    }
  } // fin for sede
  } // fin for fecha

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
  const dateTag = allDates.length === 1 ? allDates[0] : `${allDates[0]}_al_${allDates[allDates.length - 1]}`;
  doc.save(`Programacion_${safeName}_${dateTag}.pdf`);
}
