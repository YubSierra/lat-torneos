// frontend/src/utils/exportBracketPdf.ts
import jsPDF     from 'jspdf';
import autoTable from 'jspdf-autotable';

const ROUND_ORDER = ['RR','RR_A','RR_B','R64','R32','R16','QF','SF','F','SF_M','F_M'];
const ROUND_LABELS: Record<string,string> = {
  RR:'Round Robin', RR_A:'Grupo A', RR_B:'Grupo B',
  R64:'Ronda 64',   R32:'Ronda 32', R16:'Ronda 16',
  QF:'Cuartos de Final', SF:'Semifinal', F:'Final',
  SF_M:'Semifinal Máster', F_M:'Final Máster',
};

const RR_ROUNDS = new Set(['RR','RR_A','RR_B']);
const MD_ROUNDS = new Set(['R64','R32','R16','QF','SF','F','SF_M','F_M']);

const C_DARK : [number,number,number] = [27,58,27];
const C_MID  : [number,number,number] = [45,106,45];
const C_WHITE: [number,number,number] = [255,255,255];
const C_GRAY : [number,number,number] = [249,250,251];

const PAGE_H       = 279;  // Letter portrait mm
const FOOTER_H     = 14;
const USABLE_BOTTOM = PAGE_H - FOOTER_H - 8; // margen inferior útil

interface Match {
  id: string;
  category: string;
  round: string;
  player1Id?: string;
  player2Id?: string;
  player1Name?: string;
  player2Name?: string;
  seeding1?: number | null;
  seeding2?: number | null;
  winnerId?: string;
  status: string;
  groupLabel?: string | null;
}

// Estima mm que ocupa una tabla de N filas con encabezado
function estimateTableHeight(rows: number): number {
  const HEADER_H  = 9;   // cabecera de la tabla
  const ROW_H     = 8.5; // cada fila
  const PADDING   = 4;   // espacio después
  return HEADER_H + rows * ROW_H + PADDING;
}

// Altura que ocupa el bloque de un grupo (título + tabla + pie)
function estimateGroupBlock(players: number): number {
  return 9          // header "GRUPO X"
    + estimateTableHeight(players)
    + 6;            // línea de estado "Terminados/Pendientes"
}

export function exportBracketPdf({ tournamentName, matches }: {
  tournamentName: string;
  matches: Match[];
}) {
  if (!matches || matches.length === 0) {
    alert('No hay partidos para exportar');
    return;
  }

  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 0;

  // ── Helper: nueva página con reset de y ──────────────────────────────────
  function newPage() {
    doc.addPage();
    y = 15;
  }

  // ── Helper: asegurar que cabe `needed` mm en la página actual ────────────
  // Si no cabe, salta a página nueva
  function ensureSpace(needed: number) {
    if (y + needed > USABLE_BOTTOM) newPage();
  }

  // ── Encabezado primera página ────────────────────────────────────────────
  doc.setFillColor(...C_DARK);
  doc.rect(0, 0, pageW, 28, 'F');
  doc.setTextColor(...C_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('LIGA ANTIOQUEÑA DE TENIS', pageW / 2, 11, { align: 'center' });
  doc.setFontSize(11);
  doc.text(tournamentName, pageW / 2, 20, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(
    `Exportado: ${new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' })}`,
    pageW / 2, 26, { align: 'center' },
  );
  y = 34;

  // ── Agrupar por categoría ─────────────────────────────────────────────────
  const byCategory: Record<string, Match[]> = {};
  matches.forEach(m => {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  });

  Object.entries(byCategory).forEach(([cat, catMatches]) => {

    // Header categoría necesita ~14mm — si no cabe, nueva página
    ensureSpace(14);

    doc.setFillColor(...C_MID);
    doc.rect(0, y - 1, pageW, 9, 'F');
    doc.setTextColor(...C_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`CATEGORÍA: ${cat.toUpperCase()}`, pageW / 2, y + 5.5, { align: 'center' });
    y += 13;

    const rrMatches = catMatches.filter(m => RR_ROUNDS.has(m.round));
    const mdMatches = catMatches.filter(m => MD_ROUNDS.has(m.round));

    // ══════════════════════════════════════════════════════════════════════
    // ROUND ROBIN — tabla de posiciones por grupo
    // ══════════════════════════════════════════════════════════════════════
    if (rrMatches.length > 0) {

      // Título sección RR: ~12mm
      ensureSpace(12);
      doc.setFillColor(220, 252, 231);
      doc.setDrawColor(...C_MID);
      doc.rect(10, y, pageW - 20, 7, 'FD');
      doc.setTextColor(...C_MID);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('ROUND ROBIN — POSICIONES POR GRUPO', 14, y + 5);
      y += 10;

      // Agrupar por groupLabel
      const byGroup: Record<string, Match[]> = {};
      rrMatches.forEach(m => {
        const key = m.groupLabel ? String(m.groupLabel) : (ROUND_LABELS[m.round] ?? m.round);
        if (!byGroup[key]) byGroup[key] = [];
        byGroup[key].push(m);
      });

      Object.entries(byGroup).sort().forEach(([groupLabel, gMatches]) => {

        // Calcular jugadores únicos del grupo
        const playerIds = new Set<string>();
        gMatches.forEach(m => {
          if (m.player1Id) playerIds.add(m.player1Id);
          if (m.player2Id) playerIds.add(m.player2Id);
        });
        const numPlayers = playerIds.size;

        // ── CLAVE: asegurar que TODO el bloque del grupo cabe en la página
        ensureSpace(estimateGroupBlock(numPlayers));

        // Header grupo
        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(...C_MID);
        doc.rect(10, y, pageW - 20, 7, 'FD');
        doc.setTextColor(...C_MID);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(`GRUPO: ${groupLabel}`, 14, y + 5);
        y += 9;

        // Calcular standings
        const pm = new Map<string, { name: string; seed: number|null; w: number; l: number; pj: number }>();

        gMatches.forEach(m => {
          if (m.player1Id && !pm.has(m.player1Id))
            pm.set(m.player1Id, { name: m.player1Name || 'Jugador', seed: m.seeding1 ?? null, w: 0, l: 0, pj: 0 });
          if (m.player2Id && !pm.has(m.player2Id))
            pm.set(m.player2Id, { name: m.player2Name || 'Jugador', seed: m.seeding2 ?? null, w: 0, l: 0, pj: 0 });

          if ((m.status === 'completed' || m.status === 'wo') && m.winnerId) {
            const loserId = m.winnerId === m.player1Id ? m.player2Id : m.player1Id;
            const winner  = pm.get(m.winnerId);
            const loser   = loserId ? pm.get(loserId) : undefined;
            if (winner) { winner.w++; winner.pj++; }
            if (loser)  { loser.l++;  loser.pj++;  }
          }
        });

        const sorted    = [...pm.entries()].sort((a,b) => b[1].w - a[1].w);
        const pending   = gMatches.filter(m => m.status === 'pending').length;
        const completed = gMatches.length - pending;

        autoTable(doc, {
          head: [['Pos.', 'Jugador', 'Siem.', 'PJ', 'V', 'D']],
          body: sorted.map(([, p], i) => [
            `${i + 1}`,
            p.name,
            p.seed ? `[${p.seed}]` : '-',
            `${p.pj}`, `${p.w}`, `${p.l}`,
          ]),
          startY: y,
          margin: { left: 10, right: 10 },
          // ── CLAVE: no partir filas entre páginas ──────────────────────
          rowPageBreak: 'avoid',
          pageBreak: 'avoid',          // evita que autoTable parta la tabla
          styles: { fontSize: 8.5, cellPadding: 3, valign: 'middle' },
          headStyles: {
            fillColor: C_DARK, textColor: C_WHITE,
            fontStyle: 'bold', halign: 'center', fontSize: 8,
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 13 },
            2: { halign: 'center', cellWidth: 16 },
            3: { halign: 'center', cellWidth: 13 },
            4: { halign: 'center', cellWidth: 13 },
            5: { halign: 'center', cellWidth: 13 },
          },
          alternateRowStyles: { fillColor: C_GRAY },
          didParseCell: (data) => {
            // Líder resaltado en verde
            if (data.section === 'body' && data.row.index === 0) {
              data.cell.styles.fillColor = [220, 252, 231];
              data.cell.styles.textColor = C_DARK;
              data.cell.styles.fontStyle = 'bold';
            }
          },
        });

        y = (doc as any).lastAutoTable.finalY + 3;

        // Pie del grupo
        doc.setFontSize(7);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(107, 114, 128);
        doc.text(
          `Terminados: ${completed}/${gMatches.length}   Pendientes: ${pending}`,
          14, y,
        );
        y += 9;
      });
    }

    // ══════════════════════════════════════════════════════════════════════
    // MAIN DRAW — tabla de llave por rondas
    // ══════════════════════════════════════════════════════════════════════
    if (mdMatches.length > 0) {
      // Título sección MD — forzar nueva página si queda muy poco espacio
      ensureSpace(20);

      doc.setFillColor(219, 234, 254);
      doc.setDrawColor(59, 130, 246);
      doc.rect(10, y, pageW - 20, 7, 'FD');
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CUADRO PRINCIPAL (MAIN DRAW)', 14, y + 5);
      y += 10;

      const byRound: Record<string, Match[]> = {};
      mdMatches.forEach(m => {
        if (!byRound[m.round]) byRound[m.round] = [];
        byRound[m.round].push(m);
      });

      const sortedRounds = Object.keys(byRound)
        .sort((a, b) => ROUND_ORDER.indexOf(a) - ROUND_ORDER.indexOf(b));

      sortedRounds.forEach(round => {
        const rMatches = byRound[round];

        // Asegurar que la ronda entera cabe
        ensureSpace(estimateTableHeight(rMatches.length) + 9);

        doc.setFillColor(240, 253, 244);
        doc.setDrawColor(...C_MID);
        doc.rect(10, y, pageW - 20, 7, 'FD');
        doc.setTextColor(...C_MID);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(
          `${(ROUND_LABELS[round] ?? round).toUpperCase()}  (${rMatches.length} partido${rMatches.length !== 1 ? 's' : ''})`,
          14, y + 5,
        );
        y += 9;

        autoTable(doc, {
          head: [['#', 'Jugador 1', 'Siem.', '', 'Jugador 2', 'Siem.', 'Ganador', 'Estado']],
          body: rMatches.map((m, i) => {
            const p1   = m.player1Name || 'BYE';
            const p2   = m.player2Name || 'BYE';
            const done = m.status === 'completed' || m.status === 'wo';
            const winner = done && m.winnerId
              ? (m.winnerId === m.player1Id ? p1 : p2) : '-';
            const estado =
              m.status === 'completed' ? 'Terminado' :
              m.status === 'wo'        ? 'W.O.'      :
              m.status === 'live'      ? 'En vivo'   : 'Pendiente';
            return [`${i+1}`, p1, m.seeding1 ? `[${m.seeding1}]` : '-', 'vs',
                    p2, m.seeding2 ? `[${m.seeding2}]` : '-', winner, estado];
          }),
          startY: y,
          margin: { left: 10, right: 10 },
          rowPageBreak: 'avoid',
          pageBreak: 'avoid',
          styles: { fontSize: 8, cellPadding: 3, valign: 'middle' },
          headStyles: {
            fillColor: C_DARK, textColor: C_WHITE,
            fontStyle: 'bold', halign: 'center', fontSize: 7.5,
          },
          columnStyles: {
            0: { halign: 'center', cellWidth: 10 },
            2: { halign: 'center', cellWidth: 14 },
            3: { halign: 'center', cellWidth: 10 },
            5: { halign: 'center', cellWidth: 14 },
            7: { halign: 'center', cellWidth: 22 },
          },
          alternateRowStyles: { fillColor: C_GRAY },
        });

        y = (doc as any).lastAutoTable.finalY + 8;
      });
    }
  });

  // ── Footer en TODAS las páginas ───────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const fY = PAGE_H - 10;
    doc.setFillColor(...C_DARK);
    doc.rect(0, fY - 4, pageW, 14, 'F');
    doc.setTextColor(...C_WHITE);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text(
      `${tournamentName} · Página ${p} de ${total}`,
      pageW / 2, fY + 2, { align: 'center' },
    );
  }

  doc.save(`Cuadro_${tournamentName.replace(/\s+/g,'_')}.pdf`);
}