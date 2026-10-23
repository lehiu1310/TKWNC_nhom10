from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "submission-draft-2026-10-23" / "Bang-phan-cong.pdf"
PEOPLE = [
    ("Nguyễn Hữu Lê Hiếu", "23010895"),
    ("Phạm Văn Huấn", "23010331"),
    ("Đào Duy Đông", "24100085"),
]

pdfmetrics.registerFont(TTFont("ReportSans", r"C:\Windows\Fonts\arial.ttf"))
pdfmetrics.registerFont(TTFont("ReportSans-Bold", r"C:\Windows\Fonts\arialbd.ttf"))
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(
    name="TitleVN", fontName="ReportSans-Bold", fontSize=15, leading=19,
    textColor=colors.HexColor("#233B31"), alignment=TA_CENTER, spaceAfter=4,
))
styles.add(ParagraphStyle(
    name="MetaVN", fontName="ReportSans", fontSize=9, leading=13,
    textColor=colors.HexColor("#59645C"), alignment=TA_CENTER,
))
styles.add(ParagraphStyle(
    name="CellVN", fontName="ReportSans", fontSize=8.5, leading=12,
    textColor=colors.HexColor("#233B31"),
))
styles.add(ParagraphStyle(
    name="HeadVN", fontName="ReportSans-Bold", fontSize=8.5, leading=11,
    textColor=colors.white,
))

data = [[
    Paragraph("STT", styles["HeadVN"]),
    Paragraph("Họ và tên / mã sinh viên", styles["HeadVN"]),
    Paragraph("Phần việc thực tế", styles["HeadVN"]),
    Paragraph("Tỷ lệ tự đánh giá", styles["HeadVN"]),
    Paragraph("Xác nhận / chữ ký", styles["HeadVN"]),
]]
for index, (name, student_id) in enumerate(PEOPLE, 1):
    data.append([
        Paragraph(str(index), styles["CellVN"]),
        Paragraph(f"{name}<br/>{student_id}", styles["CellVN"]),
        Paragraph("<br/><br/><br/>", styles["CellVN"]),
        Paragraph("<br/><br/>", styles["CellVN"]),
        Paragraph("<br/><br/><br/>", styles["CellVN"]),
    ])
data.append([
    Paragraph("", styles["CellVN"]),
    Paragraph("<b>Tổng</b>", styles["CellVN"]),
    Paragraph("", styles["CellVN"]),
    Paragraph("Điền tổng 100%", styles["CellVN"]),
    Paragraph("", styles["CellVN"]),
])

table = Table(
    data,
    colWidths=[13 * mm, 56 * mm, 80 * mm, 42 * mm, 65 * mm],
    rowHeights=[13 * mm, 34 * mm, 34 * mm, 34 * mm, 15 * mm],
    repeatRows=1,
)
table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#557653")),
    ("GRID", (0, 0), (-1, -1), 0.6, colors.HexColor("#C9D3C8")),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ALIGN", (0, 0), (0, -1), "CENTER"),
    ("ALIGN", (3, 0), (3, -1), "CENTER"),
    ("LEFTPADDING", (0, 0), (-1, -1), 7),
    ("RIGHTPADDING", (0, 0), (-1, -1), 7),
    ("BACKGROUND", (0, -1), (-1, -1), colors.HexColor("#F4F6F0")),
]))

document = SimpleDocTemplate(
    str(OUTPUT), pagesize=landscape(A4), rightMargin=14 * mm,
    leftMargin=14 * mm, topMargin=14 * mm, bottomMargin=14 * mm,
    title="Bảng phân công và xác nhận đóng góp",
)
document.build([
    Paragraph("BẢNG PHÂN CÔNG VÀ XÁC NHẬN ĐÓNG GÓP", styles["TitleVN"]),
    Paragraph(
        "Tên và mã sinh viên đã điền theo thông tin nhóm cung cấp. Bổ sung phần việc thực tế, tỷ lệ tổng 100% và chữ ký xác nhận.",
        styles["MetaVN"],
    ),
    Spacer(1, 9 * mm),
    table,
])
print(OUTPUT)
