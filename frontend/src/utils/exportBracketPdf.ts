// frontend/src/utils/exportBracketPdf.ts
// ── CUADROS ONLY — sin lista de partidos ─────────────────────────────────────
// RR    → tabla de posiciones por grupo  (Pos / Jugador / Siem. / PJ / V / D)
// Main  → cuadro de llave visual por columnas (una columna por ronda)
import jsPDF     from 'jspdf';
import autoTable from 'jspdf-autotable';

const RR_ROUNDS   = new Set(['RR', 'RR_A', 'RR_B']);
const ELIM_ORDER  = ['R64', 'R32', 'R16', 'QF', 'SF', 'F', 'SF_M', 'F_M'];

const ROUND_LABELS: Record<string, string> = {
  R64: 'R64',  R32: 'R32',  R16: 'R16',
  QF:  'Cuartos', SF: 'Semi', F: 'Final',
  SF_M: 'Semi M.', F_M: 'Final M.',
  RR: 'Round Robin', RR_A: 'Grupo A', RR_B: 'Grupo B',
};

const C_DARK  : [number,number,number] = [27,  58,  27];
const C_MID   : [number,number,number] = [45,  106, 45];
const C_WHITE : [number,number,number] = [255, 255, 255];
const C_GRAY  : [number,number,number] = [249, 250, 251];
const C_GREEN : [number,number,number] = [220, 252, 231];
const C_GOLD  : [number,number,number] = [254, 249, 195];
const C_BLUE  : [number,number,number] = [219, 234, 254];

const PAGE_H        = 210;          // A4 landscape mm (alto)
const FOOTER_H      = 14;
const USABLE_BOTTOM = PAGE_H - FOOTER_H - 8;

interface Match {
  id         : string;
  category   : string;
  round      : string;
  player1Id? : string;
  player2Id? : string;
  player1Name?: string;
  player2Name?: string;
  seeding1?  : number | null;
  seeding2?  : number | null;
  winnerId?  : string;
  status     : string;
  groupLabel?: string | null;
}

function estimateTableH(rows: number): number {
  return 9 + rows * 8.5 + 4;   // header + filas + padding
}

function estimateGroupBlock(players: number): number {
  return 9 + estimateTableH(players) + 6;
}

export function exportBracketPdf({ tournamentName, matches }: {
  tournamentName: string;
  matches: Match[];
}) {
  if (!matches?.length) { alert('No hay partidos para exportar'); return; }

  const doc   = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 0;

  function newPage() { doc.addPage(); y = 15; }
  function ensureSpace(needed: number) { if (y + needed > USABLE_BOTTOM) newPage(); }

  // ── Encabezado primera página ─────────────────────────────────────────────
  doc.setFillColor(...C_DARK);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(...C_WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('LIGA ANTIOQUEÑA DE TENIS', pageW / 2, 10, { align: 'center' });
  doc.setFontSize(10);
  doc.text(tournamentName.toUpperCase(), pageW / 2, 17, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text(
    `Exportado: ${new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' })}`,
    pageW - 12, 20, { align: 'right' },
  );
  y = 28;

  // ── Agrupar por categoría ─────────────────────────────────────────────────
  const byCategory: Record<string, Match[]> = {};
  matches.forEach(m => {
    if (!byCategory[m.category]) byCategory[m.category] = [];
    byCategory[m.category].push(m);
  });

  // ── Helper: nombre con siembra ────────────────────────────────────────────
  function playerLabel(name: string | undefined, seed: number | null | undefined): string {
    const n = name || 'BYE';
    return seed ? `[${seed}] ${n}` : n;
  }

  Object.entries(byCategory).forEach(([cat, catMatches]) => {

    ensureSpace(14);
    doc.setFillColor(...C_MID);
    doc.rect(0, y - 1, pageW, 9, 'F');
    doc.setTextColor(...C_WHITE);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text(`CATEGORÍA: ${cat.toUpperCase()}`, pageW / 2, y + 5.5, { align: 'center' });
    y += 13;

    const rrMatches   = catMatches.filter(m => RR_ROUNDS.has(m.round));
    const elimMatches = catMatches.filter(m => ELIM_ORDER.includes(m.round));

    // ══════════════════════════════════════════════════════════════════════
    // SECCIÓN RR — SOLO TABLA DE POSICIONES
    // ══════════════════════════════════════════════════════════════════════
    if (rrMatches.length > 0) {

      ensureSpace(12);
      doc.setFillColor(...C_GREEN);
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
        // Jugadores únicos
        const playerIds = new Set<string>();
        gMatches.forEach(m => {
          if (m.player1Id) playerIds.add(m.player1Id);
          if (m.player2Id) playerIds.add(m.player2Id);
        });

        ensureSpace(estimateGroupBlock(playerIds.size));

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
        const pm = new Map<string, {
          name: string; seed: number | null;
          w: number; l: number; pj: number;
        }>();

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

        const sorted    = [...pm.entries()].sort((a, b) => b[1].w - a[1].w);
        const pending   = gMatches.filter(m => m.status === 'pending').length;
        const completed = gMatches.length - pending;

        // ── SOLO tabla de posiciones — sin filas de partidos ─────────────
        autoTable(doc, {
          head: [['Pos.', 'Jugador', 'Siem.', 'PJ', 'V', 'D']],
          body: sorted.map(([, p], i) => [
            `${i + 1}`,
            p.name,
            p.seed ? `[${p.seed}]` : '-',
            `${p.pj}`,
            `${p.w}`,
            `${p.l}`,
          ]),
          startY: y,
          margin: { left: 10, right: 10 },
          rowPageBreak: 'avoid',
          pageBreak:    'avoid',
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
            if (data.section === 'body' && data.row.index === 0) {
              data.cell.styles.fillColor  = C_GREEN;
              data.cell.styles.textColor  = C_DARK;
              data.cell.styles.fontStyle  = 'bold';
            }
          },
        });

        y = (doc as any).lastAutoTable.finalY + 3;

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
    // SECCIÓN MAIN DRAW — CUADRO VISUAL POR COLUMNAS
    // Cada columna = una ronda | cada celda = nombre del jugador/siembra
    // ══════════════════════════════════════════════════════════════════════
    if (elimMatches.length > 0) {

      ensureSpace(20);
      doc.setFillColor(...C_BLUE);
      doc.setDrawColor(59, 130, 246);
      doc.rect(10, y, pageW - 20, 7, 'FD');
      doc.setTextColor(30, 64, 175);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('CUADRO PRINCIPAL (MAIN DRAW)', 14, y + 5);
      y += 10;

      // Rondas presentes, en orden
      const presentRounds = ELIM_ORDER.filter(r =>
        elimMatches.some(m => m.round === r)
      );

      if (presentRounds.length === 0) return;

      // Para el cuadro visual, construimos una lista de "slots" por ronda.
      // Cada slot = una celda con el nombre del jugador.
      // Ronda inicial: todos los jugadores en pares (matchup por matchup)
      // Rondas siguientes: ganador o "Por def." si el partido no terminó

      const firstRound  = presentRounds[0];
      const firstMatches = elimMatches.filter(m => m.round === firstRound);

      // Filas de la tabla = un matchup de la primera ronda (2 jugadores)
      // Columnas = rondas presentes
      const numRows = firstMatches.length * 2; // cada partido → 2 filas (p1 y p2)

      // Construir contenido columna por columna
      // column[roundIndex] = array de strings (nombre por slot)
      const columns: string[][] = presentRounds.map(round => {
        const rMatches = elimMatches.filter(m => m.round === round);
        const slots: string[] = [];

        rMatches.forEach(m => {
          const p1 = playerLabel(m.player1Name, m.seeding1);
          const p2 = playerLabel(m.player2Name, m.seeding2);

          if (round === firstRound) {
            // Primera ronda: mostrar los dos jugadores del matchup
            slots.push(p1);
            slots.push(p2);
          } else {
            // Rondas siguientes: solo el ganador (o placeholder)
            const winner =
              (m.status === 'completed' || m.status === 'wo') && m.winnerId
                ? playerLabel(
                    m.winnerId === m.player1Id ? m.player1Name : m.player2Name,
                    m.winnerId === m.player1Id ? m.seeding1   : m.seeding2,
                  )
                : '···';
            // Cada partido ocupa el doble de filas que la ronda siguiente
            // → repetir el ganador para alinear visualmente
            slots.push(winner);
            slots.push('');   // fila vacía para el par
          }
        });

        // Rellenar hasta numRows si faltan filas
        while (slots.length < numRows) slots.push('');
        return slots;
      });

      // Encabezados de columna
      const head = [presentRounds.map(r => (ROUND_LABELS[r] ?? r).toUpperCase())];

      // Cuerpo: transponer columnas → filas
      const body: string[][] = [];
      for (let row = 0; row < numRows; row++) {
        body.push(columns.map(col => col[row] ?? ''));
      }

      // Número de columnas para calcular ancho
      const colCount   = presentRounds.length;
      const tableWidth = pageW - 20;
      const colWidth   = tableWidth / colCount;

      // Calcular si la tabla cabe
      const tableH = estimateTableH(numRows);
      ensureSpace(tableH + 10);

      autoTable(doc, {
        head,
        body,
        startY: y,
        margin: { left: 10, right: 10 },
        rowPageBreak: 'avoid',
        styles: {
          fontSize    : 8,
          cellPadding : 3,
          valign      : 'middle',
          overflow    : 'linebreak',
          minCellHeight: 9,
        },
        headStyles: {
          fillColor: C_DARK,
          textColor: C_WHITE,
          fontStyle: 'bold',
          halign   : 'center',
          fontSize : 8,
        },
        columnStyles: Object.fromEntries(
          presentRounds.map((_, i) => [i, { cellWidth: colWidth, halign: 'left' }])
        ),
        alternateRowStyles: { fillColor: C_GRAY },
        didParseCell: (data) => {
          if (data.section !== 'body') return;

          const val = String(data.cell.raw ?? '');

          // Fila vacía (par sin jugador) → gris más oscuro
          if (!val.trim()) {
            data.cell.styles.fillColor  = [241, 245, 249];
            return;
          }

          // Placeholder "···" (partido no jugado aún)
          if (val === '···') {
            data.cell.styles.textColor  = [156, 163, 175];
            data.cell.styles.fontStyle  = 'italic';
            return;
          }

          // Última columna (Final) → fondo dorado para el campeón
          const isLastCol = data.column.index === presentRounds.length - 1;
          if (isLastCol && val.trim() && val !== '···') {
            data.cell.styles.fillColor  = C_GOLD;
            data.cell.styles.textColor  = [146, 64, 14];
            data.cell.styles.fontStyle  = 'bold';
          }

          // Siembras en verde oscuro
          if (val.startsWith('[')) {
            data.cell.styles.textColor  = C_DARK;
            data.cell.styles.fontStyle  = 'bold';
          }
        },
      });

      y = (doc as any).lastAutoTable.finalY + 10;
    }
  });

  // ── Footer en todas las páginas ───────────────────────────────────────────
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    const fY = doc.internal.pageSize.getHeight() - 10;
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

  doc.save(`Cuadro_${tournamentName.replace(/\s+/g, '_')}.pdf`);
}