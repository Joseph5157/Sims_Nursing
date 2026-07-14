const PDFDocument = require('pdfkit');
const { APP_SHORT_NAME } = require('./branding');

const BRAND_BLUE = '#2563EB';
const ROW_ALT    = '#EFF6FF';
const TEXT_MUTED = '#64748B';
const TEXT_DARK  = '#0F172A';

// Builds a simple tabular report PDF (title + generated-date header, an
// optional summary key/value block, then a table) and returns a Buffer.
// `columns`: [{ header, key, width? }] — widths are proportional shares of
// the printable page width; omitted widths split the remainder evenly.
// `summary`: [{ label, value }] — rendered as a key/value block above the table.
function buildReportPdf({ title, subtitle, summary = [], columns, rows }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── Header ──────────────────────────────────────────────────────────────
    doc.fontSize(16).font('Helvetica-Bold').fillColor(TEXT_DARK).text(APP_SHORT_NAME, { align: 'center' });
    doc.fontSize(13).text(title, { align: 'center' });
    doc.fontSize(9).font('Helvetica').fillColor(TEXT_MUTED)
      .text(`${subtitle ? subtitle + ' · ' : ''}Generated ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.moveDown(1);

    // ── Summary block ───────────────────────────────────────────────────────
    if (summary.length > 0) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor(TEXT_DARK).text('Summary');
      doc.font('Helvetica').fontSize(9.5).fillColor(TEXT_DARK);
      for (const { label, value } of summary) {
        doc.text(`${label}: ${value}`);
      }
      doc.moveDown(1);
    }

    // ── Table ───────────────────────────────────────────────────────────────
    const explicitWidth = columns.reduce((sum, c) => sum + (c.width ?? 0), 0);
    const unsizedCount   = columns.filter((c) => !c.width).length;
    const remaining      = Math.max(0, pageWidth - explicitWidth);
    const fallbackWidth  = unsizedCount > 0 ? remaining / unsizedCount : 0;
    const colWidths = columns.map((c) => c.width ?? fallbackWidth);

    const left    = doc.page.margins.left;
    const rowH    = 20;
    let   y       = doc.y;

    function drawHeaderRow() {
      doc.rect(left, y, pageWidth, rowH).fill(BRAND_BLUE);
      let x = left;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#FFFFFF');
      columns.forEach((c, i) => {
        doc.text(c.header, x + 4, y + 6, { width: colWidths[i] - 8, ellipsis: true });
        x += colWidths[i];
      });
      y += rowH;
    }

    function ensureSpace() {
      if (y + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeaderRow();
      }
    }

    drawHeaderRow();

    rows.forEach((row, idx) => {
      ensureSpace();
      if (idx % 2 === 1) {
        doc.rect(left, y, pageWidth, rowH).fill(ROW_ALT);
      }
      let x = left;
      doc.font('Helvetica').fontSize(8.5).fillColor(TEXT_DARK);
      columns.forEach((c) => {
        const value = row[c.key] ?? '';
        doc.text(String(value), x + 4, y + 6, { width: colWidths[columns.indexOf(c)] - 8, ellipsis: true });
        x += colWidths[columns.indexOf(c)];
      });
      y += rowH;
    });

    doc.end();
  });
}

function sendPdf(res, buffer, filename) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(buffer);
}

module.exports = { buildReportPdf, sendPdf };
