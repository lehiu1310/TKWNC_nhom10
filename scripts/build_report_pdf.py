from __future__ import annotations

import html
import re
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, PageBreak, Paragraph, Preformatted, Flowable,
    Spacer, Table, TableStyle, KeepTogether, Image,
)

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "reports" / "bao_cao_do_an.md"
OUTPUT = ROOT / "output" / "pdf" / "Bao-cao-do-an-Vuon-Hoa-AI-2026-10-23-bia-mucluc.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

# Embed Times New Roman to match the academic report reference.
font_candidates = [
    (Path(r"C:\Windows\Fonts\times.ttf"), Path(r"C:\Windows\Fonts\timesbd.ttf")),
    (Path("/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf"), Path("/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman_Bold.ttf")),
]
for regular, bold in font_candidates:
    if regular.exists() and bold.exists():
        pdfmetrics.registerFont(TTFont("ReportSans", str(regular)))
        pdfmetrics.registerFont(TTFont("ReportSans-Bold", str(bold)))
        break
else:
    raise FileNotFoundError("Install Arial or DejaVu Sans before building the Vietnamese report")
pdfmetrics.registerFontFamily("ReportSans", normal="ReportSans", bold="ReportSans-Bold", italic="ReportSans", boldItalic="ReportSans-Bold")

INK = colors.HexColor("#111111")
GREEN = colors.HexColor("#222222")
PALE = colors.HexColor("#F5F5F5")
CREAM = colors.HexColor("#FFFFFF")
PINK = colors.HexColor("#EEEEEE")
MUTED = colors.HexColor("#444444")
GOLD = colors.HexColor("#333333")
PAGE_W, PAGE_H = A4
LEFT = RIGHT = 17 * mm
TOP = 20 * mm
BOTTOM = 15 * mm
CONTENT_W = PAGE_W - LEFT - RIGHT

styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="BodyVN", fontName="ReportSans", fontSize=9.1, leading=12.3, textColor=INK, spaceAfter=5.5, splitLongWords=1, allowWidows=0, allowOrphans=0, alignment=4))
styles.add(ParagraphStyle(name="BodySmall", parent=styles["BodyVN"], fontSize=7.8, leading=10.3, spaceAfter=3.4))
styles.add(ParagraphStyle(name="TitleVN", fontName="ReportSans-Bold", fontSize=20, leading=25, textColor=INK, alignment=TA_CENTER, spaceAfter=8))
styles.add(ParagraphStyle(name="SectionVN", fontName="ReportSans-Bold", fontSize=14, leading=18, textColor=INK, alignment=TA_CENTER, spaceBefore=3, spaceAfter=8, keepWithNext=True))
styles.add(ParagraphStyle(name="SubheadVN", fontName="ReportSans-Bold", fontSize=10.2, leading=13, textColor=INK, spaceBefore=5, spaceAfter=4, keepWithNext=True))
styles.add(ParagraphStyle(name="MetaVN", fontName="ReportSans", fontSize=8.5, leading=12, textColor=MUTED, spaceAfter=2))
styles.add(ParagraphStyle(name="TableHeadVN", fontName="ReportSans-Bold", fontSize=7.5, leading=9.2, textColor=colors.white, alignment=TA_LEFT))
styles.add(ParagraphStyle(name="TableCellVN", fontName="ReportSans", fontSize=7.15, leading=9.2, textColor=INK, splitLongWords=1))
styles.add(ParagraphStyle(name="NoteVN", fontName="ReportSans", fontSize=8.1, leading=11, textColor=INK, leftIndent=7, rightIndent=7, spaceBefore=3, spaceAfter=3))
styles.add(ParagraphStyle(name="CodeVN", fontName="ReportSans", fontSize=7.1, leading=10.3, textColor=INK, leftIndent=4, rightIndent=4, spaceAfter=5))
styles.add(ParagraphStyle(name="SmallCenter", fontName="ReportSans", fontSize=7.4, leading=9, textColor=MUTED, alignment=TA_CENTER))


def clean(text: str) -> str:
    return (text.replace("—", "-").replace("–", "-").replace("‑", "-")
            .replace("→", "->").replace("×", "x").replace("“", '"').replace("”", '"')
            .replace("’", "'").replace("‘", "'").replace("…", "..."))


def inline(text: str) -> str:
    text = clean(text)
    text = html.escape(text, quote=False)
    text = re.sub(r"`([^`]+)`", r'<font name="Courier">\1</font>', text)
    text = re.sub(r"\*\*(.+?)\*\*", r"<b>\1</b>", text)
    text = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<i>\1</i>", text)
    text = re.sub(r"(https?://[^\s<>()]+)", r'<link href="\1" color="#557653">\1</link>', text)
    return text


def p(text: str, style="BodyVN") -> Paragraph:
    return Paragraph(inline(text), styles[style])


def draw_page(canvas, doc):
    canvas.saveState()
    page = canvas.getPageNumber()
    if page >= 3:
        canvas.setStrokeColor(colors.HexColor("#AAAAAA"))
        canvas.setLineWidth(0.55)
        canvas.line(LEFT, PAGE_H - 12 * mm, PAGE_W - RIGHT, PAGE_H - 12 * mm)
        canvas.setFont("ReportSans-Bold", 7.1)
        canvas.setFillColor(INK)
        canvas.drawCentredString(PAGE_W / 2, PAGE_H - 9.3 * mm, "BÁO CÁO ĐỒ ÁN  ·  VƯỜN HOA AI")
    if page >= 2:
        canvas.setStrokeColor(colors.HexColor("#AAAAAA"))
        canvas.setLineWidth(0.5)
        canvas.line(LEFT, 10 * mm, PAGE_W - RIGHT, 10 * mm)
        canvas.setFont("ReportSans", 7)
        canvas.setFillColor(MUTED)
        canvas.drawString(LEFT, 6 * mm, "Lập trình Web nâng cao  ·  Nhóm 10")
        canvas.drawRightString(PAGE_W - RIGHT, 6 * mm, f"Trang {page}")
    canvas.restoreState()


class ReportDoc(BaseDocTemplate):
    def __init__(self, filename):
        super().__init__(str(filename), pagesize=A4, leftMargin=LEFT, rightMargin=RIGHT, topMargin=TOP, bottomMargin=BOTTOM,
                         title="Báo cáo đồ án Vườn Hoa AI", author="TKWNC Nhóm 10", subject="Lập trình Web nâng cao")
        frame = Frame(LEFT, BOTTOM, CONTENT_W, PAGE_H - TOP - BOTTOM, id="main", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id="report", frames=frame, onPage=draw_page))


class ArchitectureDiagram(Flowable):
    """Small vector architecture sketch that stays legible in the report PDF."""
    def __init__(self, width=CONTENT_W, height=110):
        super().__init__()
        self.width = width
        self.height = height

    def draw(self):
        c = self.canv
        browser_x, browser_w = 4, 116
        api_x, api_w = 154, 205
        db_x, db_w = self.width - 122, 118
        center_y = 55

        def box(x, y, w, h, fill, stroke, title, subtitle=()):
            c.setFillColor(fill)
            c.setStrokeColor(stroke)
            c.setLineWidth(0.8)
            c.roundRect(x, y, w, h, 5, fill=1, stroke=1)
            c.setFillColor(INK)
            c.setFont("ReportSans-Bold", 7.4)
            c.drawCentredString(x + w / 2, y + h - 13, title)
            c.setFont("ReportSans", 6.4)
            for i, line in enumerate(subtitle):
                c.drawCentredString(x + w / 2, y + h - 26 - i * 10, line)

        box(browser_x, center_y - 26, browser_w, 52, CREAM, GOLD,
            "Trình duyệt", ("React / Vite", "Vercel"))
        box(api_x, 3, api_w, self.height - 6, PALE, GREEN,
            "Express gateway + FastAPI",
            ("Vercel: auth/account gateway", "Render: account proxy + AI REST/SSE",
             "Neon: account PostgreSQL", "ResNet-18 · 103 nhãn",
             "YOLO11n · 4 lớp · BM25/RAG"))
        box(db_x, center_y - 28, db_w, 56, colors.HexColor("#EEF4EE"), GREEN,
            "Neon PostgreSQL", ("users · sessions", "user_data"))

        def arrow(x1, x2, label):
            y = center_y
            c.setStrokeColor(GREEN)
            c.setFillColor(GREEN)
            c.setLineWidth(1)
            c.line(x1, y, x2, y)
            c.line(x2, y, x2 - 4, y + 2.5)
            c.line(x2, y, x2 - 4, y - 2.5)
            c.setFont("ReportSans", 5.6)
            c.setFillColor(MUTED)
            c.drawCentredString((x1 + x2) / 2, y + 7, label)

        arrow(browser_x + browser_w + 3, api_x - 5, "HTTPS · Vercel rewrite")
        arrow(api_x + api_w + 3, db_x - 5, "SQL · TLS")


def table_from_rows(rows):
    if not rows:
        return Spacer(1, 1)
    cols = max(map(len, rows))
    if cols == 2:
        widths = [CONTENT_W * 0.34, CONTENT_W * 0.66]
    elif cols == 3:
        widths = [CONTENT_W * 0.27, CONTENT_W * 0.34, CONTENT_W * 0.39]
    elif cols == 4:
        widths = [CONTENT_W * 0.25, CONTENT_W * 0.38, CONTENT_W * 0.16, CONTENT_W * 0.21]
    else:
        widths = [CONTENT_W / cols] * cols
    data = []
    for ri, row in enumerate(rows):
        row = row + [""] * (cols - len(row))
        data.append([Paragraph(inline(cell.strip()), styles["TableHeadVN" if ri == 0 else "TableCellVN"]) for cell in row])
    t = Table(data, colWidths=widths, repeatRows=1, hAlign="LEFT")
    commands = [
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#DDDDDD")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D8E0D7")),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 4.2), ("BOTTOMPADDING", (0, 0), (-1, -1), 4.2),
    ]
    for ri in range(1, len(rows)):
        commands.append(("BACKGROUND", (0, ri), (-1, ri), colors.white if ri % 2 else PALE))
    t.setStyle(TableStyle(commands))
    return t


def parse_markdown(source: str):
    lines = source.splitlines()
    story = []
    i = 0
    page_break_before = {"## 2.", "## 3.", "## 4.", "## 5."}
    while i < len(lines):
        raw = lines[i].rstrip()
        if not raw.strip() or raw.strip() == "---":
            i += 1
            continue
        if raw.startswith("# "):
            story.append(p(raw[2:], "TitleVN"))
            story.append(Table([[""]], colWidths=[CONTENT_W], rowHeights=[1.2], style=TableStyle([("BACKGROUND", (0,0), (-1,-1), GOLD)])))
            story.append(Spacer(1, 8))
            i += 1
            continue
        if raw.startswith("## "):
            if any(raw.startswith(prefix) for prefix in page_break_before):
                story.append(PageBreak())
            story.append(p(raw[3:], "SectionVN"))
            i += 1
            continue
        if raw.startswith("### "):
            story.append(p(raw[4:], "SubheadVN"))
            i += 1
            continue
        if raw.startswith("**"):
            story.append(p(raw, "MetaVN"))
            i += 1
            continue
        if raw.startswith("> "):
            note = p(raw[2:], "NoteVN")
            note_box = Table([[note]], colWidths=[CONTENT_W])
            note_box.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), CREAM), ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#E9D4B7")), ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7), ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
            story.append(note_box)
            story.append(Spacer(1, 5))
            i += 1
            continue
        if raw.startswith("```"):
            code = []
            i += 1
            while i < len(lines) and not lines[i].startswith("```"):
                code.append(clean(lines[i]))
                i += 1
            i += 1
            if code and code[0].startswith("Trình duyệt React/Vite"):
                story.extend([ArchitectureDiagram(), Spacer(1, 7)])
                continue
            box = Table([[Preformatted("\n".join(code), styles["CodeVN"])]], colWidths=[CONTENT_W])
            box.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), PALE), ("BOX", (0,0), (-1,-1), 0.5, colors.HexColor("#D8E0D7")), ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7), ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5)]))
            story.extend([box, Spacer(1, 7)])
            continue
        if raw.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                cells = [part.strip() for part in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-{2,}:?", c.replace(" ", "")) for c in cells):
                    rows.append(cells)
                i += 1
            story.extend([table_from_rows(rows), Spacer(1, 7)])
            continue
        if raw.startswith("- ") or raw.startswith("* "):
            items = []
            while i < len(lines) and (lines[i].startswith("- ") or lines[i].startswith("* ")):
                items.append(lines[i][2:].strip())
                i += 1
            for item in items:
                story.append(Paragraph(inline(item), ParagraphStyle(name="ListVN", parent=styles["BodyVN"], alignment=TA_LEFT, leftIndent=12, firstLineIndent=-9, bulletIndent=0, spaceAfter=3, bulletText="•")))
            story.append(Spacer(1, 3))
            continue
        # Merge wrapped source lines only while they remain ordinary prose.
        paragraph = [raw]
        i += 1
        while i < len(lines):
            nxt = lines[i].rstrip()
            if (not nxt.strip() or nxt.startswith(("#", "> ", "```", "|", "- ", "* ")) or nxt.strip() == "---"):
                break
            paragraph.append(nxt)
            i += 1
        story.append(p(" ".join(paragraph)))
    return story


def main():
    source = SOURCE.read_text(encoding="utf-8")
    doc = ReportDoc(OUTPUT)
    cover = [
        Spacer(1, 5 * mm),
        p("ĐẠI HỌC PHENIKAA", "TitleVN"),
        p("TRƯỜNG CÔNG NGHỆ THÔNG TIN PHENIKAA", "TitleVN"),
        Spacer(1, 17 * mm),
        Image(str(Path(r"D:\web\tmp\pdfs\style-reference\sample-X5.png")), width=48 * mm, height=48 * mm),
        Spacer(1, 16 * mm),
        p("BÁO CÁO ĐỒ ÁN CUỐI KỲ", "TitleVN"),
        p("LẬP TRÌNH WEB NÂNG CAO", "TitleVN"),
        Spacer(1, 8 * mm),
        p("VƯỜN HOA AI", "TitleVN"),
        p("Nhận diện, tra cứu và khám phá 103 loài hoa", "TitleVN"),
        Spacer(1, 12 * mm),
        p("Nhóm thực hiện: TKWNC — Nhóm 10", "MetaVN"),
        p("Thành viên: Nguyễn Hữu Lê Hiếu — 23010895", "MetaVN"),
        p("Phạm Văn Huấn — 23010331", "MetaVN"),
        p("Đào Duy Đông — 24100085", "MetaVN"),
        Spacer(1, 16 * mm),
        p("Hà Nội, tháng 10 năm 2026", "MetaVN"),
        PageBreak(),
    ]
    toc_rows = []
    for n, (label, page) in enumerate([
        ("1. Bài toán, người dùng và tóm tắt", 3),
        ("2. Kiến trúc, API và kịch bản demo", 4),
        ("3. Dữ liệu, kết quả AI và giới hạn", 5),
        ("4. Kiểm thử, bảo mật và production", 6),
        ("5. Công cụ AI và nguồn kiểm chứng", 7),
    ], 1):
        toc_rows.append([
            Paragraph(label, ParagraphStyle(name=f"toc{n}", fontName="ReportSans", fontSize=10, leading=18, textColor=INK)),
            Paragraph("· " * 16, ParagraphStyle(name=f"dots{n}", fontName="ReportSans", fontSize=8, leading=18, textColor=MUTED, alignment=TA_CENTER)),
            Paragraph(str(page), ParagraphStyle(name=f"pg{n}", fontName="ReportSans", fontSize=10, leading=18, textColor=INK, alignment=TA_RIGHT)),
        ])
    toc = [p("MỤC LỤC", "TitleVN"), Spacer(1, 8 * mm),
           Table(toc_rows, colWidths=[CONTENT_W * .72, CONTENT_W * .20, CONTENT_W * .08],
                 style=TableStyle([("VALIGN", (0,0),(-1,-1),"MIDDLE"), ("LEFTPADDING",(0,0),(-1,-1),0), ("RIGHTPADDING",(0,0),(-1,-1),0), ("LINEBELOW",(0,-1),(-1,-1),0.5,colors.HexColor("#999999"))])),
           Spacer(1, 10 * mm),
           p("Báo cáo tập trung vào hiện trạng có thể kiểm chứng của sản phẩm, các phép đo AI, kiểm thử và giới hạn đã biết.", "BodyVN"),
           PageBreak()]
    doc.build(cover + toc + parse_markdown(source))
    print(f"Wrote {OUTPUT}")


if __name__ == "__main__":
    main()
