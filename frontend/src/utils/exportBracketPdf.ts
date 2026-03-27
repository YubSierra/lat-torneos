// frontend/src/utils/exportBracketPdf.ts
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Match {
  id: string;
  category: string;
  round: string;
  player1Name?: string;
  player2Name?: string;
  player1Id?: string;
  player2Id?: string;
  seeding1?: number;
  seeding2?: number;
  winnerId?: string;
  status: string;
  scheduledAt?: string;
  groupLabel?: string;
  sets1?: number;
  sets2?: number;
  games1?: number;
  games2?: number;
  bracketPosition?: number;
}

export interface ExportOptions {
  tournamentName: string;
  matches: Match[];
  mode?: 'both' | 'rr' | 'maindraw';
  modality?: 'all' | 'singles' | 'doubles';
}

// ── Constantes ─────────────────────────────────────────────────────────────
const ELIM_ROUNDS = ['R64','R32','R16','QF','SF','F'];
const RR_ROUNDS   = ['RR','RR_A','RR_B'];
const ROUND_LABELS: Record<string,string> = {
  R64:'R64', R32:'R32', R16:'R16',
  QF:'Cuartos', SF:'Semifinal', F:'Final',
  RR:'Round Robin', RR_A:'Grupo A', RR_B:'Grupo B',
  SF_M:'SF Master', F_M:'Final Master',
};

// Dimensiones tarjeta SVG en PDF (mm)
const CARD_W  = 42;
const CARD_H  = 14;
const COL_GAP = 10;
const ROW_GAP = 4;
const SLOT_H  = CARD_H + ROW_GAP;
const HEADER_H = 10; // altura reservada para el header de ronda

function lastName(name?: string): string {
  if (!name || name === 'BYE') return name || 'BYE';
  const parts = name.trim().split(' ');
  return parts.length >= 2 ? parts[1] : parts[0];
}

function fullName(name?: string): string {
  if (!name || name === 'BYE') return name || 'BYE';
  return name.trim();
}

function getPlayerText(
  match: Match, player: 1|2, prevMatches: Match[], matchIdx: number
): { text: string; placeholder: boolean } {
  const id   = player === 1 ? match.player1Id   : match.player2Id;
  const name = player === 1 ? match.player1Name : match.player2Name;
  // Jugador real asignado → nombre completo
  if (id && name) return { text: fullName(name), placeholder: false };
  // BYE real (partido completado, playerId null) → mostrar BYE
  if (!id && name === 'BYE') return { text: 'BYE', placeholder: true };
  // Slot pendiente (name === null): buscar en ronda anterior
  const prevIdx = matchIdx * 2 + (player === 1 ? 0 : 1);
  const prev    = prevMatches[prevIdx];
  if (prev) {
    if (prev.winnerId) {
      // Ganador conocido → solo apellido
      const wName = prev.winnerId === prev.player1Id ? prev.player1Name : prev.player2Name;
      return { text: `Gan.${lastName(wName)}`, placeholder: true };
    }
    if (prev.player1Name && prev.player2Name) {
      // Si uno de los dos es BYE, el otro avanza directo → nombre completo
      if (prev.player1Name === 'BYE') return { text: fullName(prev.player2Name), placeholder: false };
      if (prev.player2Name === 'BYE') return { text: fullName(prev.player1Name), placeholder: false };
      // Partido pendiente entre dos jugadores reales → solo apellidos
      return { text: `${lastName(prev.player1Name)}/${lastName(prev.player2Name)}`, placeholder: true };
    }
  }
  return { text: 'Por definir', placeholder: true };
}

// ── Tarjeta SVG ─────────────────────────────────────────────────────────────
function drawMatchCard(
  doc: jsPDF, x: number, y: number, match: Match,
  p1: { text: string; placeholder: boolean },
  p2: { text: string; placeholder: boolean },
) {
  const isDone = match.status === 'completed' || match.status === 'wo';
  const isLive = match.status === 'live';

  doc.setFillColor(
    isLive ? 255 : isDone ? 240 : 255,
    isLive ? 245 : isDone ? 253 : 255,
    isLive ? 245 : isDone ? 244 : 255,
  );
  doc.roundedRect(x, y, CARD_W, CARD_H, 1.5, 1.5, 'F');
  doc.setDrawColor(
    isLive ? 239 : isDone ? 134 : 200,
    isLive ? 68  : isDone ? 239 : 200,
    isLive ? 68  : isDone ? 172 : 200,
  );
  doc.setLineWidth(0.4);
  doc.roundedRect(x, y, CARD_W, CARD_H, 1.5, 1.5, 'D');
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.2);
  doc.line(x + 1, y + CARD_H / 2, x + CARD_W - 1, y + CARD_H / 2);

  const halfH = CARD_H / 2;
  const textX = x + 2;
  const maxW  = CARD_W - 10;
  const p1Won = match.winnerId === match.player1Id;
  const p2Won = match.winnerId === match.player2Id;

  doc.setFontSize(6.5);
  doc.setFont('helvetica', p1Won ? 'bold' : 'normal');
  doc.setTextColor(
    p1.placeholder ? 150 : p1Won ? 21 : 31,
    p1.placeholder ? 150 : p1Won ? 128 : 41,
    p1.placeholder ? 150 : p1Won ? 61 : 51,
  );
  doc.text(doc.splitTextToSize(p1.text, maxW)[0] || p1.text, textX, y + halfH * 0.62);
  if (isDone && match.sets1 !== undefined) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(p1Won ? 21 : 150, p1Won ? 128 : 150, p1Won ? 61 : 150);
    doc.text(String(match.sets1), x + CARD_W - 3, y + halfH * 0.62, { align: 'right' });
  }

  doc.setFont('helvetica', p2Won ? 'bold' : 'normal');
  doc.setTextColor(
    p2.placeholder ? 150 : p2Won ? 21 : 31,
    p2.placeholder ? 150 : p2Won ? 128 : 41,
    p2.placeholder ? 150 : p2Won ? 61 : 51,
  );
  doc.text(doc.splitTextToSize(p2.text, maxW)[0] || p2.text, textX, y + halfH * 1.58);
  if (isDone && match.sets2 !== undefined) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(p2Won ? 21 : 150, p2Won ? 128 : 150, p2Won ? 61 : 150);
    doc.text(String(match.sets2), x + CARD_W - 3, y + halfH * 1.58, { align: 'right' });
  }
}

// ── Conectores ──────────────────────────────────────────────────────────────
function drawConnector(doc: jsPDF, x: number, y1: number, y2: number, yMid: number) {
  doc.setDrawColor(180, 200, 180);
  doc.setLineWidth(0.3);
  const h = COL_GAP / 2;
  doc.line(x, y1, x + h, y1);
  doc.line(x, y2, x + h, y2);
  doc.line(x + h, y1, x + h, y2);
  doc.line(x + h, yMid, x + COL_GAP, yMid);
}

// ── Calcular altura total del bracket ───────────────────────────────────────
function bracketHeight(firstCount: number): number {
  return HEADER_H + firstCount * SLOT_H - ROW_GAP + 8;
}

// ── Renderizar bracket de eliminación SVG ───────────────────────────────────
function renderElimBracket(
  doc: jsPDF, rounds: Record<string, Match[]>,
  startX: number, startY: number,
): number {
  const existingRounds = ELIM_ROUNDS.filter(r => rounds[r]);
  if (existingRounds.length === 0) return startY;

  const firstIdx  = ELIM_ROUNDS.indexOf(existingRounds[0]);
  const allRounds = ELIM_ROUNDS.slice(firstIdx);
  const firstCount = rounds[existingRounds[0]]?.length ?? 1;

  // Completar con placeholders
  allRounds.forEach((r, idx) => {
    if (!rounds[r]) {
      const count = Math.max(1, Math.ceil(firstCount / Math.pow(2, idx)));
      rounds[r] = Array.from({ length: count }, (_, i) => ({
        id: `ph-${r}-${i}`, round: r, category: '', status: 'pending',
      } as Match));
    }
  });

  // Posiciones top
  function getTopPositions(roundIdx: number, count: number): number[] {
    const base = startY + HEADER_H;
    if (roundIdx === 0) return Array.from({ length: count }, (_, i) => base + i * SLOT_H);
    const prev = getTopPositions(roundIdx - 1, count * 2);
    return Array.from({ length: count }, (_, i) => {
      const t1 = prev[i * 2];
      const t2 = prev[i * 2 + 1] ?? t1;
      return (t1 + t2) / 2;
    });
  }

  // Headers de ronda
  allRounds.forEach((round, rIdx) => {
    const colX = startX + rIdx * (CARD_W + COL_GAP);
    doc.setFillColor(27, 58, 27);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.roundedRect(colX, startY, CARD_W, 7, 1, 1, 'F');
    doc.text(
      `${ROUND_LABELS[round] || round} (${rounds[round]?.length || 0})`,
      colX + CARD_W / 2, startY + 4.8, { align: 'center' },
    );
  });

  // Tarjetas + conectores
  allRounds.forEach((round, rIdx) => {
    const roundMatches = rounds[round] ?? [];
    const positions    = getTopPositions(rIdx, roundMatches.length);
    const prevRound    = rIdx > 0 ? rounds[allRounds[rIdx - 1]] ?? [] : [];
    const colX         = startX + rIdx * (CARD_W + COL_GAP);

    roundMatches.forEach((m, mIdx) => {
      const p1 = getPlayerText(m, 1, prevRound, mIdx);
      const p2 = getPlayerText(m, 2, prevRound, mIdx);
      drawMatchCard(doc, colX, positions[mIdx], m, p1, p2);
    });

    if (rIdx < allRounds.length - 1) {
      const nextPositions = getTopPositions(rIdx + 1, (rounds[allRounds[rIdx + 1]] ?? []).length);
      roundMatches.forEach((_, mIdx) => {
        if (mIdx % 2 !== 0) return;
        const y1   = positions[mIdx] + CARD_H / 2;
        const y2   = (positions[mIdx + 1] ?? positions[mIdx]) + CARD_H / 2;
        const yMid = (nextPositions[Math.floor(mIdx / 2)] ?? positions[mIdx]) + CARD_H / 2;
        drawConnector(doc, colX + CARD_W, y1, y2, yMid);
      });
    }
  });

  return startY + bracketHeight(firstCount);
}

// ── RR — solo tabla de posiciones ──────────────────────────────────────────
function renderRR(
  doc: jsPDF, rounds: Record<string, Match[]>,
  startY: number, pageW: number, margin: number,
  drawHeader: () => void, pageH: number, footerH: number,
): number {
  const rrPresent = RR_ROUNDS.filter(r => rounds[r]);
  if (rrPresent.length === 0) return startY;

  const groups: Record<string, Match[]> = {};
  rrPresent.forEach(r => {
    rounds[r].forEach(m => {
      const g = m.groupLabel || (r === 'RR_A' ? 'A' : r === 'RR_B' ? 'B' : 'A');
      if (!groups[g]) groups[g] = [];
      groups[g].push(m);
    });
  });

  const entries = Object.entries(groups).sort();
  const cols    = Math.min(entries.length, 2);
  const colW    = Math.floor((pageW - margin * 2 - (cols - 1) * 4) / cols);
  let   y       = startY;
  let   maxRowH = 0;
  let   colIdx  = 0;

  // Calcular altura estimada de un grupo: header + filas (4-6 jugadores × 5mm) + padding
  const groupHeight = (nPlayers: number) => 7 + (nPlayers + 1) * 5.5 + 4;

  entries.forEach(([groupLabel, gMatches], gIdx) => {
    // Al empezar una nueva fila (par de grupos)
    if (gIdx > 0 && colIdx === 0) {
      y += maxRowH + 5;
      maxRowH = 0;
    }

    // Contar jugadores únicos del grupo
    const playerIds = new Set<string>();
    gMatches.forEach(m => { if (m.player1Id) playerIds.add(m.player1Id); if (m.player2Id) playerIds.add(m.player2Id); });
    const nPlayers = playerIds.size;
    const estGroupH = groupHeight(nPlayers);

    // Si estamos en la primera columna y el grupo no cabe → nueva página
    if (colIdx === 0 && y + estGroupH > pageH - footerH) {
      doc.addPage();
      drawHeader();
      y = 24;
      maxRowH = 0;
    }

    const gX = margin + colIdx * (colW + 4);
    let   gY = y;

    // Header grupo
    doc.setFillColor(27, 58, 27);
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    const done = gMatches.filter(m => m.status === 'completed' || m.status === 'wo').length;
    doc.roundedRect(gX, gY, colW, 5.5, 1, 1, 'F');
    doc.text(`Grupo ${groupLabel}  ${done}/${gMatches.length}`, gX + colW / 2, gY + 3.8, { align: 'center' });
    gY += 7;

    // Standings
    const standings: Record<string, { name: string; wins: number; losses: number; setsWon: number; setsLost: number; gamesWon: number; gamesLost: number }> = {};
    gMatches.forEach(m => {
      [[m.player1Id, m.player1Name],[m.player2Id, m.player2Name]].forEach(([pid, name]) => {
        if (!pid) return;
        if (!standings[pid]) standings[pid] = { name: name || '', wins: 0, losses: 0, setsWon: 0, setsLost: 0, gamesWon: 0, gamesLost: 0 };
      });
      if (m.winnerId && (m.status === 'completed' || m.status === 'wo')) {
        if (standings[m.winnerId]) standings[m.winnerId].wins++;
        const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
        if (loserId && standings[loserId]) standings[loserId].losses++;
        const p1 = m.player1Id; const p2 = m.player2Id;
        if (p1 && standings[p1]) { standings[p1].setsWon += m.sets1 || 0; standings[p1].setsLost += m.sets2 || 0; standings[p1].gamesWon += m.games1 || 0; standings[p1].gamesLost += m.games2 || 0; }
        if (p2 && standings[p2]) { standings[p2].setsWon += m.sets2 || 0; standings[p2].setsLost += m.sets1 || 0; standings[p2].gamesWon += m.games2 || 0; standings[p2].gamesLost += m.games1 || 0; }
      }
    });
    const gRpdf = (w: number, l: number) => l > 0 ? w / l : w > 0 ? Infinity : 0;
    const completedPdf = gMatches.filter(m => m.status === 'completed' || m.status === 'wo');
    const standingEntriesPdf = Object.entries(standings);
    const sorted = standingEntriesPdf.sort(([idA, a], [idB, b]) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      const sA = gRpdf(a.setsWon, a.setsLost);  const sB = gRpdf(b.setsWon, b.setsLost);
      if (Math.abs(sB - sA) > 0.0001) return sB - sA;
      const gA = gRpdf(a.gamesWon, a.gamesLost); const gBv = gRpdf(b.gamesWon, b.gamesLost);
      if (Math.abs(gBv - gA) > 0.0001) return gBv - gA;
      const tiedGrp = standingEntriesPdf.filter(([, s]) =>
        s.wins === a.wins &&
        Math.abs(gRpdf(s.setsWon, s.setsLost)  - sA) <= 0.0001 &&
        Math.abs(gRpdf(s.gamesWon, s.gamesLost) - gA) <= 0.0001,
      );
      if (tiedGrp.length === 2) {
        const h2h = completedPdf.find(m =>
          (m.player1Id === idA && m.player2Id === idB) ||
          (m.player1Id === idB && m.player2Id === idA)
        );
        if (h2h?.winnerId === idA) return -1;
        if (h2h?.winnerId === idB) return  1;
      }
      return 0;
    });

    autoTable(doc, {
      head: [['#', 'Jugador', 'V', 'D']],
      body: sorted.map(([,s], pos) => [pos + 1, s.name, s.wins, s.losses]),
      startY: gY,
      margin: { left: gX, right: pageW - gX - colW },
      tableWidth: colW,
      pageBreak: 'avoid',
      styles: { fontSize: 6.5, cellPadding: 1.5, lineColor: [200,220,200], lineWidth: 0.2, overflow: 'linebreak' },
      headStyles: { fillColor: [45,106,45], textColor: [255,255,255], fontStyle: 'bold', fontSize: 6.5 },
      columnStyles: {
        0: { cellWidth: 6,  halign: 'center' },
        2: { cellWidth: 8,  halign: 'center', textColor: [21,128,61] },
        3: { cellWidth: 8,  halign: 'center', textColor: [220,38,38] },
      },
      alternateRowStyles: { fillColor: [240,253,244] },
    });

    const groupBottom = (doc as any).lastAutoTable.finalY;
    maxRowH = Math.max(maxRowH, groupBottom - y);
    colIdx  = (colIdx + 1) % cols;
  });

  let finalY = y + maxRowH + 8;

  // ── Resultado final para grupo único completo ──────────────────────────
  const isSingleGroup = entries.length === 1;
  if (isSingleGroup) {
    const [, gMatches] = entries[0];
    const done = gMatches.filter(m => m.status === 'completed' || m.status === 'wo').length;
    if (done === gMatches.length && done > 0) {
      // Reuse sorted standings already computed in entries[0]
      const st: Record<string, { name: string; wins: number; losses: number }> = {};
      gMatches.forEach(m => {
        [[m.player1Id, m.player1Name],[m.player2Id, m.player2Name]].forEach(([pid, name]) => {
          if (pid && !st[pid]) st[pid] = { name: name || '', wins: 0, losses: 0 };
        });
        if (m.winnerId && (m.status === 'completed' || m.status === 'wo')) {
          if (st[m.winnerId]) st[m.winnerId].wins++;
          const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
          if (loserId && st[loserId]) st[loserId].losses++;
        }
      });
      const gRp = (w: number, l: number) => l > 0 ? w/l : w > 0 ? Infinity : 0;
      const stEntries = Object.entries(st);
      const completedM = gMatches.filter(m => m.status === 'completed' || m.status === 'wo');
      stEntries.sort(([idA, a], [idB, b]) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        const tied2 = stEntries.filter(([,s]) => s.wins === a.wins).length === 2;
        if (tied2) {
          const h2h = completedM.find(m => (m.player1Id===idA&&m.player2Id===idB)||(m.player1Id===idB&&m.player2Id===idA));
          if (h2h?.winnerId === idA) return -1;
          if (h2h?.winnerId === idB) return 1;
        }
        return a.name.localeCompare(b.name);
      });

      const champion = stEntries[0];
      const runnerUp = stEntries[1];
      if (champion) {
        const rowH = 18;
        const neededH = 12 + rowH * (runnerUp ? 2 : 1) + 6;
        if (finalY + neededH > pageH - footerH) {
          doc.addPage();
          drawHeader();
          finalY = 24;
        }

        // Section header
        doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2);
        doc.line(margin, finalY, pageW - margin, finalY);
        doc.setFontSize(7.5); doc.setFont('helvetica', 'bold');
        doc.setTextColor(80, 80, 80);
        doc.text('RESULTADO FINAL', pageW / 2, finalY + 4, { align: 'center' });
        finalY += 10;

        const podiumW = Math.min(90, (pageW - margin * 2) / 2 - 4);

        // Champion card (gold)
        doc.setFillColor(120, 53, 15);
        doc.roundedRect(margin, finalY, podiumW, rowH, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(6); doc.setFont('helvetica', 'bold');
        doc.text('CAMPEÓN', margin + 4, finalY + 4.5);
        doc.setFontSize(8); doc.setFont('helvetica', 'bold');
        doc.text(doc.splitTextToSize(champion[1].name, podiumW - 8)[0], margin + 4, finalY + 10);
        doc.setFontSize(6); doc.setFont('helvetica', 'normal');
        doc.text(`${champion[1].wins}V – ${champion[1].losses}D`, margin + 4, finalY + 15);

        // Runner-up card (silver)
        if (runnerUp) {
          const ruX = margin + podiumW + 4;
          doc.setFillColor(75, 85, 99);
          doc.roundedRect(ruX, finalY, podiumW, rowH, 2, 2, 'F');
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(6); doc.setFont('helvetica', 'bold');
          doc.text('FINALISTA', ruX + 4, finalY + 4.5);
          doc.setFontSize(8); doc.setFont('helvetica', 'bold');
          doc.text(doc.splitTextToSize(runnerUp[1].name, podiumW - 8)[0], ruX + 4, finalY + 10);
          doc.setFontSize(6); doc.setFont('helvetica', 'normal');
          doc.text(`${runnerUp[1].wins}V – ${runnerUp[1].losses}D`, ruX + 4, finalY + 15);
        }

        finalY += rowH + 6;
      }
    }
  }

  return finalY;
}

// ── FUNCIÓN PRINCIPAL ───────────────────────────────────────────────────────
export function exportBracketPdf({ tournamentName, matches, mode = 'both', modality = 'all' }: ExportOptions) {
  const doc    = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW  = doc.internal.pageSize.getWidth();
  const pageH  = doc.internal.pageSize.getHeight();
  const MARGIN = 12;
  const FOOTER = 12; // espacio reservado para footer

  // Filtrar partidos por modalidad
  const filteredMatches = modality === 'singles'
    ? matches.filter(m => !m.category?.endsWith('_DOBLES'))
    : modality === 'doubles'
      ? matches.filter(m => m.category?.endsWith('_DOBLES'))
      : matches;

  // Para la vista de dobles, limpiar el sufijo _DOBLES del nombre de categoría en pantalla
  const displayMatches = filteredMatches.map(m => ({
    ...m,
    category: modality === 'doubles'
      ? m.category.replace(/_DOBLES$/, ' — DOBLES')
      : m.category,
  }));

  const modalityLabel = modality === 'doubles' ? ' DOBLES' : modality === 'singles' ? ' SINGLES' : '';

  const drawHeader = () => {
    doc.setFillColor(27, 58, 27);
    doc.rect(0, 0, pageW, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16); doc.setFont('helvetica', 'bold');
    const title = mode === 'rr'       ? `MATCHLUNGO ACE — ROUND ROBIN${modalityLabel}`
                : mode === 'maindraw' ? `MATCHLUNGO ACE — CUADRO ELIMINACION DIRECTA${modalityLabel}`
                :                       `MATCHLUNGO ACE — CUADRO DE LLAVES${modalityLabel}`;
    doc.text(title, pageW / 2, 9, { align: 'center' });
    doc.setFontSize(10); doc.setFont('helvetica', 'normal');
    doc.text(tournamentName.toUpperCase(), pageW / 2, 16, { align: 'center' });
  };

  const drawFooter = (p: number, total: number) => {
    doc.setFillColor(27, 58, 27);
    doc.rect(0, pageH - FOOTER, pageW, FOOTER, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7); doc.setFont('helvetica', 'normal');
    doc.text('Matchlungo Ace - Gestor de torneo de Tenis', MARGIN, pageH - 4);
    doc.text(`Pag. ${p} / ${total}`, pageW - MARGIN, pageH - 4, { align: 'right' });
  };

  drawHeader();

  // Agrupar por categoría
  const byCategory: Record<string, Record<string, Match[]>> = {};
  displayMatches.forEach(m => {
    if (!byCategory[m.category])          byCategory[m.category] = {};
    if (!byCategory[m.category][m.round]) byCategory[m.category][m.round] = [];
    byCategory[m.category][m.round].push(m);
  });
  // Sort each round's matches by bracketPosition so sequential indexing is correct
  Object.values(byCategory).forEach(rounds => {
    Object.keys(rounds).forEach(r => {
      rounds[r].sort((a, b) => (a.bracketPosition ?? 0) - (b.bracketPosition ?? 0));
    });
  });

  let yPos    = 24;
  let isFirst = true;

  Object.entries(byCategory).forEach(([category, rounds]) => {
    const hasRR   = RR_ROUNDS.some(r => rounds[r]);
    const hasElim = ELIM_ROUNDS.some(r => rounds[r]);

    if (mode === 'maindraw' && !hasElim) return;
    if (mode === 'rr'       && !hasRR)   return;

    // ── Calcular altura necesaria para el bracket ────────────────────────
    const firstElimRound = ELIM_ROUNDS.find(r => rounds[r]);
    const firstCount     = firstElimRound ? rounds[firstElimRound]?.length ?? 1 : 0;
    const neededBracketH = firstCount > 0 ? bracketHeight(firstCount) + 20 : 0;
    const neededRRH      = hasRR ? 80 : 0; // estimado RR
    const catHeaderH     = 12;
    const needed         = catHeaderH + (mode !== 'maindraw' ? neededRRH : 0) + (mode !== 'rr' ? neededBracketH : 0);

    // ── Salto de página entre categorías ────────────────────────────────
    if (!isFirst) {
      if (mode === 'maindraw') {
        // Cada categoría arranca en página nueva
        doc.addPage();
        drawHeader();
        yPos = 24;
      } else if (hasRR && yPos + catHeaderH + neededRRH > pageH - FOOTER) {
        // 'both' / 'rr': nueva página solo si no cabe
        doc.addPage();
        drawHeader();
        yPos = 24;
      }
    }

    isFirst = false;

    // Header categoría
    doc.setFillColor(45, 106, 45);
    doc.rect(MARGIN, yPos - 4, pageW - MARGIN * 2, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11); doc.setFont('helvetica', 'bold');
    doc.text(`CATEGORIA: ${category.toUpperCase()}`, pageW / 2, yPos + 1, { align: 'center' });
    yPos += 10;

    // RR — solo standings
    if ((mode === 'both' || mode === 'rr') && hasRR) {
      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.setTextColor(27, 58, 27);
      doc.text('ROUND ROBIN — POSICIONES POR GRUPO', MARGIN, yPos + 3);
      yPos += 7;
      yPos = renderRR(doc, rounds, yPos, pageW, MARGIN, drawHeader, pageH, FOOTER);
    }

    // Main Draw — SVG cards (separador + bracket juntos en misma página)
    if ((mode === 'both' || mode === 'maindraw') && hasElim) {
      const separatorH  = (mode === 'both' && hasRR) ? 10 : 0;
      const titleH      = 10;
      const totalNeeded = separatorH + titleH + neededBracketH;

      // Si no caben separador + título + bracket juntos → nueva página
      // (en maindraw ya se hizo addPage por categoría arriba, no repetir)
      if (mode !== 'maindraw' && yPos + totalNeeded > pageH - FOOTER) {
        doc.addPage();
        drawHeader();
        yPos = 24;
      }

      // Separador MAIN DRAW — en la misma página que el bracket
      if (mode === 'both' && hasRR) {
        doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
        doc.line(MARGIN, yPos, pageW - MARGIN, yPos);
        doc.setFontSize(7); doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 100, 100);
        doc.text('MAIN DRAW', pageW / 2, yPos + 3.5, { align: 'center' });
        yPos += 8;
      }

      doc.setFontSize(8); doc.setFont('helvetica', 'bold');
      doc.setTextColor(27, 58, 27);
      doc.text('CUADRO DE ELIMINACION DIRECTA', MARGIN, yPos + 3);
      yPos += 8;
      yPos = renderElimBracket(doc, rounds, MARGIN, yPos);
    }
  });

  // Footers
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) { doc.setPage(p); drawFooter(p, totalPages); }

  const modeStr     = mode === 'rr' ? 'RR' : mode === 'maindraw' ? 'MainDraw' : 'Cuadro';
  const modalityStr = modality === 'doubles' ? '_Dobles' : modality === 'singles' ? '_Singles' : '';
  doc.save(`${modeStr}${modalityStr}_${tournamentName.replace(/\s+/g,'_')}.pdf`);
}