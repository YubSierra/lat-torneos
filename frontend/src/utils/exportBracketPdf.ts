// frontend/src/utils/exportBracketPdf.ts
// PDF de cuadro de torneo
//   - Round Robin: SOLO tabla de posiciones por grupo (sin lista de partidos)
//   - Main Draw:   cuadro de llave por rondas
//
// Dependencias: npm install jspdf jspdf-autotable

import jsPDF     from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ROUND_ORDER = ['RR','RR_A','RR_B','R64','R32','R16','QF','SF','F','SF_M','F_M'];

const ROUND_LABELS: Record<string, string> = {
  RR:   'Round Robin',
  RR_A: 'Grupo A',
  RR_B: 'Grupo B',
  R64:  'Ronda 64',
  R32:  'Ronda 32',
  R16:  'Ronda 16',
  QF:   'Cuartos de Final',
  SF:   'Semifinal',
  F:    'Final',
  SF_M: 'Semifinal Master',
  F_M:  'Final Master',
};

const RR_ROUNDS       = new Set(['RR', 'RR_A', 'RR_B']);
const MAIN_DRAW_ROUNDS = new Set(['R64','R32','R16','QF','SF','F','SF_M','F_M']);

const GREEN_DARK  : [number,number,number] = [27,  58, 27];
const GREEN_MID   : [number,number,number] = [45, 106, 45];
const GREEN_LIGHT : [number,number,number] = [240,253,244];
const GRAY_LIGHT  : [number,number,number] = [249,250,251];
const WHITE       : [number,number,number] = [255,255,255];

interface Match {
  id:          string;
  category:    string;
  round:       string;
  player1Id?:  string;
  player2Id?:  string;
  player1Name?: string;
  player2Name?: string;
  seeding1?:   number | null;
  seeding2?:   number | null;
  winnerId?:   string;
  status:      string;
  scheduledAt?: string;
  groupLabel?:  string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Función principal de exportación
// ─────────────────────────────────────────────────────────────────────────────
export function exportBracketPdf(matches: Match[], tournamentName: string, category: string) {
  const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  let yPos    = 15;

  // ── Portada / Encabezado ──────────────────────────────────────────────────
  doc.setFillColor(...GREEN_DARK);
  doc.rect(0, 0, pageW, 28, 'F');

  doc.setTextColor(...WHITE);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('LIGA ANTIOQUEÑA DE TENIS', pageW / 2, 11, { align: 'center' });

  doc.setFontSize(11);
  doc.text(tournamentName, pageW / 2, 19, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text(`Categoria: ${category}`, pageW / 2, 25, { align: 'center' });

  yPos = 35;

  // ── Separar partidos RR de Main Draw ──────────────────────────────────────
  const rrMatches   = matches.filter(m => RR_ROUNDS.has(m.round));
  const mainMatches = matches.filter(m => MAIN_DRAW_ROUNDS.has(m.round));

  // ════════════════════════════════════════════════════════════════════════════
  // SECCIÓN 1 — ROUND ROBIN: solo tabla de posiciones
  // ════════════════════════════════════════════════════════════════════════════
  if (rrMatches.length > 0) {
    // Título de sección
    doc.setFillColor(...GREEN_MID);
    doc.rect(10, yPos, pageW - 20, 8, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CUADRO ROUND ROBIN', pageW / 2, yPos + 5.5, { align: 'center' });
    yPos += 12;

    // Agrupar por groupLabel (Grupo A, Grupo B, etc.)
    // Si no tienen groupLabel, agrupar por round (RR_A, RR_B, RR)
    const byGroup: Record<string, Match[]> = {};
    rrMatches.forEach(m => {
      const key = m.groupLabel
        ? m.groupLabel
        : ROUND_LABELS[m.round] ?? m.round;
      if (!byGroup[key]) byGroup[key] = [];
      byGroup[key].push(m);
    });

    // Para cada grupo, calcular standings y dibujar tabla de posiciones
    Object.entries(byGroup).sort().forEach(([groupLabel, groupMatches]) => {
      if (yPos > 220) { doc.addPage(); yPos = 15; }

      // Header del grupo
      doc.setFillColor(...GREEN_LIGHT);
      doc.setDrawColor(...GREEN_MID);
      doc.rect(10, yPos, pageW - 20, 7, 'FD');
      doc.setTextColor(...GREEN_MID);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`GRUPO: ${groupLabel}  (${groupMatches.length} partidos)`, 14, yPos + 5);
      yPos += 9;

      // ── Calcular standings ────────────────────────────────────────────────
      // Recolectamos todos los jugadores del grupo
      const playerData = new Map<string, {
        name: string;
        seeding: number | null;
        wins: number;
        losses: number;
        setsWon: number;
        setsLost: number;
        played: number;
      }>();

      groupMatches.forEach(m => {
        // Inicializar jugador 1
        if (m.player1Id && !playerData.has(m.player1Id)) {
          playerData.set(m.player1Id, {
            name:     m.player1Name || `Jugador`,
            seeding:  m.seeding1 ?? null,
            wins: 0, losses: 0, setsWon: 0, setsLost: 0, played: 0,
          });
        }
        // Inicializar jugador 2
        if (m.player2Id && !playerData.has(m.player2Id)) {
          playerData.set(m.player2Id, {
            name:     m.player2Name || `Jugador`,
            seeding:  m.seeding2 ?? null,
            wins: 0, losses: 0, setsWon: 0, setsLost: 0, played: 0,
          });
        }

        // Contabilizar resultados
        if (m.status === 'completed' && m.winnerId) {
          const loserId = m.winnerId === m.player1Id ? m.player2Id! : m.player1Id!;
          const winner  = playerData.get(m.winnerId);
          const loser   = playerData.get(loserId);
          if (winner) { winner.wins++;   winner.played++;  }
          if (loser)  { loser.losses++;  loser.played++;   }
        } else if (m.player1Id && m.player2Id) {
          // Partido pendiente: contar como jugado si está programado
          const p1 = playerData.get(m.player1Id);
          const p2 = playerData.get(m.player2Id);
          // No contamos partidos no terminados en el standings
        }
      });

      // Ordenar: primero por victorias desc, luego por nombre
      const sorted = [...playerData.entries()]
        .sort((a, b) => b[1].wins - a[1].wins || a[1].name.localeCompare(b[1].name));

      // Calcular partidos pendientes del grupo
      const pending   = groupMatches.filter(m => m.status !== 'completed').length;
      const completed = groupMatches.filter(m => m.status === 'completed').length;

      // ── Tabla de posiciones ───────────────────────────────────────────────
      autoTable(doc, {
        head: [['Pos.', 'Jugador', 'Siembra', 'PJ', 'V', 'D']],
        body: sorted.map(([, p], idx) => [
          `${idx + 1}`,
          p.name,
          p.seeding ? `[${p.seeding}]` : '-',
          `${p.played}`,
          `${p.wins}`,
          `${p.losses}`,
        ]),
        startY: yPos,
        margin: { left: 10, right: 10 },
        styles: {
          fontSize: 9,
          cellPadding: { top: 3, bottom: 3, left: 5, right: 5 },
          valign: 'middle',
        },
        headStyles: {
          fillColor: GREEN_DARK,
          textColor: WHITE,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 8,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 14 },  // Pos
          1: { halign: 'left',   cellWidth: 'auto' }, // Nombre
          2: { halign: 'center', cellWidth: 18 },  // Siembra
          3: { halign: 'center', cellWidth: 14 },  // PJ
          4: { halign: 'center', cellWidth: 14 },  // V
          5: { halign: 'center', cellWidth: 14 },  // D
        },
        alternateRowStyles: { fillColor: GRAY_LIGHT },
        // Resaltar el líder (pos 1) en verde suave
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === 0) {
            data.cell.styles.fillColor = [220, 252, 231]; // green-100
            data.cell.styles.textColor = GREEN_DARK;
            data.cell.styles.fontStyle = 'bold';
          }
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 4;

      // Estado del grupo debajo de la tabla
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128); // gray-500
      doc.text(
        `Partidos terminados: ${completed} / ${groupMatches.length}  |  Pendientes: ${pending}`,
        14, yPos,
      );
      yPos += 10;
    });
  }

  // ════════════════════════════════════════════════════════════════════════════
  // SECCIÓN 2 — MAIN DRAW: cuadro de llave por rondas
  // ════════════════════════════════════════════════════════════════════════════
  if (mainMatches.length > 0) {
    if (yPos > 60) { doc.addPage(); yPos = 15; }

    // Título de sección
    doc.setFillColor(...GREEN_MID);
    doc.rect(10, yPos, pageW - 20, 8, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('CUADRO PRINCIPAL (MAIN DRAW)', pageW / 2, yPos + 5.5, { align: 'center' });
    yPos += 12;

    // Agrupar por ronda
    const byRound: Record<string, Match[]> = {};
    mainMatches.forEach(m => {
      if (!byRound[m.round]) byRound[m.round] = [];
      byRound[m.round].push(m);
    });

    // Ordenar rondas según ROUND_ORDER
    const sortedRounds = Object.keys(byRound)
      .sort((a, b) => ROUND_ORDER.indexOf(a) - ROUND_ORDER.indexOf(b));

    sortedRounds.forEach(round => {
      if (yPos > 220) { doc.addPage(); yPos = 15; }

      const roundMatches = byRound[round];
      const roundLabel   = ROUND_LABELS[round] ?? round;

      // Sub-encabezado de ronda
      doc.setFillColor(...GREEN_LIGHT);
      doc.setDrawColor(...GREEN_MID);
      doc.rect(10, yPos, pageW - 20, 7, 'FD');
      doc.setTextColor(...GREEN_MID);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`${roundLabel.toUpperCase()}  (${roundMatches.length} partido${roundMatches.length !== 1 ? 's' : ''})`, 14, yPos + 5);
      yPos += 9;

      autoTable(doc, {
        head: [['#', 'Jugador 1', 'S1', 'vs', 'Jugador 2', 'S2', 'Ganador', 'Estado']],
        body: roundMatches.map((m, idx) => {
          const p1    = m.player1Name || 'BYE';
          const p2    = m.player2Name || 'BYE';
          const s1    = m.seeding1 ? `[${m.seeding1}]` : '-';
          const s2    = m.seeding2 ? `[${m.seeding2}]` : '-';
          const winner = m.status === 'completed' && m.winnerId
            ? (m.winnerId === m.player1Id ? p1 : p2)
            : '-';
          const estado = m.status === 'completed'
            ? 'Terminado'
            : m.status === 'live'
            ? 'En vivo'
            : 'Pendiente';
          return [`${idx + 1}`, p1, s1, 'vs', p2, s2, winner, estado];
        }),
        startY: yPos,
        margin: { left: 10, right: 10 },
        styles: {
          fontSize: 8,
          cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
          valign: 'middle',
        },
        headStyles: {
          fillColor: GREEN_DARK,
          textColor: WHITE,
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 7.5,
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 10  },
          1: { halign: 'left'                   },
          2: { halign: 'center', cellWidth: 14  },
          3: { halign: 'center', cellWidth: 10  },
          4: { halign: 'left'                   },
          5: { halign: 'center', cellWidth: 14  },
          6: { halign: 'left'                   },
          7: { halign: 'center', cellWidth: 20  },
        },
        alternateRowStyles: { fillColor: GRAY_LIGHT },
        // Resaltar filas terminadas
        didParseCell: (data) => {
          if (data.section === 'body') {
            const m = roundMatches[data.row.index];
            if (m?.status === 'completed') {
              data.cell.styles.textColor = [75, 85, 99]; // gray completado
            }
          }
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    });
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const lastPage = doc.getNumberOfPages();
  for (let page = 1; page <= lastPage; page++) {
    doc.setPage(page);
    const footerY = doc.internal.pageSize.getHeight() - 10;
    doc.setFillColor(...GREEN_DARK);
    doc.rect(0, footerY - 4, pageW, 14, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Generado: ${new Date().toLocaleString('es-CO')} · ${tournamentName} · Pagina ${page} de ${lastPage}`,
      pageW / 2, footerY + 2, { align: 'center' },
    );
  }

  doc.save(`Cuadro_${tournamentName.replace(/\s+/g, '_')}_${category}.pdf`);
}