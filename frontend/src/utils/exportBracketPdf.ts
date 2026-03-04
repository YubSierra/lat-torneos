import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const ROUND_ORDER  = ['R64','R32','R16','QF','SF','F','RR','RR_A','RR_B','SF_M','F_M'];
const ROUND_LABELS: Record<string,string> = {
  R64:'Ronda 64', R32:'Ronda 32', R16:'Ronda 16',
  QF:'Cuartos de Final', SF:'Semifinal', F:'Final',
  RR:'Round Robin', RR_A:'Grupo A', RR_B:'Grupo B',
  SF_M:'Semifinal Máster', F_M:'Final Máster',
};

interface Match {
  id: string;
  category: string;
  round: string;
  player1Name?: string;
  player2Name?: string;
  seeding1?: number;
  seeding2?: number;
  winnerId?: string;
  player1Id?: string;
  player2Id?: string;
  status: string;
  scheduledAt?: string;
}

interface ExportOptions {
  tournamentName: string;
  matches: Match[];
}

export function exportBracketPdf({ tournamentName, matches }: ExportOptions) {
  const doc  = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  // ── HEADER ────────────────────────────────────
  doc.setFillColor(27, 58, 27);
  doc.rect(0, 0, pageW, 20, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('LAT — CUADRO DE LLAVES', pageW / 2, 9, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(tournamentName.toUpperCase(), pageW / 2, 16, { align: 'center' });

  // ── AGRUPAR POR CATEGORÍA ─────────────────────
  const byCategory: Record<string, Record<string, Match[]>> = {};
  matches.forEach(m => {
    if (!byCategory[m.category]) byCategory[m.category] = {};
    if (!byCategory[m.category][m.round]) byCategory[m.category][m.round] = [];
    byCategory[m.category][m.round].push(m);
  });

  let yPos = 26;

  Object.entries(byCategory).forEach(([category, rounds]) => {
    // Header categoría
    doc.setFillColor(45, 106, 45);
    doc.rect(10, yPos - 4, pageW - 20, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`CATEGORIA: ${category.toUpperCase()}`, pageW / 2, yPos + 1, { align: 'center' });
    yPos += 8;

    const activeRounds = ROUND_ORDER.filter(r => rounds[r]);

    // ── RR / GRUPOS ──────────────────────────────
    const rrRounds = activeRounds.filter(r => ['RR','RR_A','RR_B'].includes(r));
    if (rrRounds.length > 0) {
      rrRounds.forEach(round => {
        const roundMatches = rounds[round];

        doc.setTextColor(27, 58, 27);
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text(ROUND_LABELS[round], 12, yPos + 4);
        yPos += 7;

        autoTable(doc, {
          head: [['#', 'Jugador 1', 'Siembra', 'vs', 'Jugador 2', 'Siembra', 'Estado']],
          body: roundMatches.map((m, i) => [
            i + 1,
            m.player1Name || 'BYE',
            m.seeding1 ? `[${m.seeding1}]` : '',
            'vs',
            m.player2Name || 'BYE',
            m.seeding2 ? `[${m.seeding2}]` : '',
            m.status === 'completed'
              ? `Gano: ${m.winnerId === m.player1Id ? m.player1Name : m.player2Name}`
              : m.status === 'live' ? 'En vivo' : 'Pendiente',
          ]),
          startY: yPos,
          margin: { left: 10, right: 10 },
          styles: { fontSize: 8, cellPadding: 3 },
          headStyles: { fillColor: [27, 58, 27], textColor: [255,255,255], fontStyle: 'bold' },
          columnStyles: {
            0: { cellWidth: 8,  halign: 'center' },
            2: { cellWidth: 15, halign: 'center', textColor: [146, 64, 14] },
            3: { cellWidth: 10, halign: 'center', fontStyle: 'bold' },
            5: { cellWidth: 15, halign: 'center', textColor: [146, 64, 14] },
            6: { cellWidth: 35 },
          },
          alternateRowStyles: { fillColor: [240, 253, 244] },
        });

        yPos = (doc as any).lastAutoTable.finalY + 6;
      });
    }

    // ── ELIMINACIÓN DIRECTA ──────────────────────
    const elimRounds = activeRounds.filter(r => !['RR','RR_A','RR_B'].includes(r));
    if (elimRounds.length > 0) {
      // Tabla por rondas lado a lado
      const head = elimRounds.map(r => ROUND_LABELS[r] || r);
      const maxMatches = Math.max(...elimRounds.map(r => rounds[r]?.length || 0));

      const body: string[][] = [];
      for (let i = 0; i < maxMatches; i++) {
        const row = elimRounds.map(round => {
          const m = rounds[round]?.[i];
          if (!m) return '';
          const p1 = `${m.seeding1 ? `[${m.seeding1}] ` : ''}${m.player1Name || 'BYE'}`;
          const p2 = `${m.seeding2 ? `[${m.seeding2}] ` : ''}${m.player2Name || 'BYE'}`;
          const winner = m.status === 'completed'
            ? `\nGano: ${m.winnerId === m.player1Id ? m.player1Name : m.player2Name}`
            : '';
          return `${p1}\nvs\n${p2}${winner}`;
        });
        body.push(row);
      }

      autoTable(doc, {
        head: [head],
        body,
        startY: yPos,
        margin: { left: 10, right: 10 },
        styles: { fontSize: 8, cellPadding: 4, valign: 'top', overflow: 'linebreak' },
        headStyles: {
          fillColor: [27, 58, 27], textColor: [255,255,255],
          fontStyle: 'bold', halign: 'center',
        },
        alternateRowStyles: { fillColor: [240, 253, 244] },
        didDrawCell: (data) => {
          if (data.row.index >= 0) {
            doc.setDrawColor(45, 106, 45);
            doc.setLineWidth(0.2);
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height);
          }
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 8;
    }

    // Nueva página si no hay espacio
    if (yPos > 175) { doc.addPage(); yPos = 15; }
  });

  // ── FOOTER ───────────────────────────────────
  const lastPage = doc.getNumberOfPages();
  doc.setPage(lastPage);
  const footerY = doc.internal.pageSize.getHeight() - 10;
  doc.setFillColor(27, 58, 27);
  doc.rect(0, footerY - 4, pageW, 14, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(
    `Generado: ${new Date().toLocaleString('es-CO')} · ${tournamentName}`,
    pageW / 2, footerY + 2, { align: 'center' }
  );

  doc.save(`MainDraw_${tournamentName.replace(/\s+/g,'_')}.pdf`);
}
