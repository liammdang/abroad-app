import type { Task } from "@/data/types";
import { mapsUrl } from "@/data/cities";

/** Builds and downloads a printable checklist PDF for one Life Admin task. */
export async function downloadChecklist(task: Task, cityName: string, studentName: string) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 56;
  let y = 64;

  const ensure = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - 56) {
      doc.addPage();
      y = 64;
    }
  };
  const para = (text: string, size = 11, color: [number, number, number] = [60, 62, 80]) => {
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(text, W - M * 2);
    ensure(lines.length * size * 1.35);
    doc.text(lines, M, y);
    y += lines.length * size * 1.35;
  };
  const heading = (text: string) => {
    y += 14;
    ensure(24);
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(43, 47, 126);
    doc.text(text, M, y);
    y += 18;
  };

  // header band
  doc.setFillColor(43, 47, 126).rect(0, 0, W, 8, "F");
  doc.setFont("helvetica", "bold").setFontSize(9).setTextColor(43, 47, 126);
  doc.text(`ABROAD · ${cityName.toUpperCase()} · LIFE ADMIN CHECKLIST`, M, y);
  y += 26;
  doc.setFontSize(22).setTextColor(27, 29, 58);
  const title = doc.splitTextToSize(task.title, W - M * 2);
  doc.text(title, M, y);
  y += title.length * 26;
  para(task.summary, 12);
  para(`Prepared for ${studentName} · ${new Date().toLocaleDateString("en-GB")}`, 9, [120, 122, 140]);

  heading("What you'll need");
  for (const d of task.documents) {
    ensure(20);
    doc.setDrawColor(43, 47, 126).setLineWidth(1).rect(M, y - 9, 10, 10);
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(27, 29, 58);
    const lines = doc.splitTextToSize(d, W - M * 2 - 20);
    doc.text(lines, M + 20, y);
    y += Math.max(lines.length * 15, 20);
  }

  if (task.samples.length) {
    heading("Forms you'll fill in");
    task.samples.forEach((s) => para(`•  ${s.replace(/\.pdf$/i, "")}`));
  }

  heading("Insider tip");
  para(task.tip);

  if (task.mapsQuery) {
    heading("Where to go");
    ensure(16);
    doc.setFont("helvetica", "normal").setFontSize(11).setTextColor(43, 47, 126);
    doc.textWithLink("Open in Google Maps", M, y, { url: mapsUrl(task.mapsQuery, cityName) });
    y += 16;
  }

  heading("Notes");
  for (let i = 0; i < 5; i++) {
    ensure(26);
    doc.setDrawColor(220, 220, 232).line(M, y + 8, W - M, y + 8);
    y += 26;
  }

  const slug = task.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  doc.save(`abroad-${slug}.pdf`);
}
