import io
import json
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

def generate_report_pdf(analysis, report_file_name: str) -> io.BytesIO:
    """Generates a professional, tabulated medical report analysis PDF."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=letter,
        rightMargin=54,
        leftMargin=54,
        topMargin=54,
        bottomMargin=54
    )
    
    styles = getSampleStyleSheet()
    
    # Custom Styles for Sleek Theme
    primary_color = colors.HexColor("#0f172a") # Slate 900
    secondary_color = colors.HexColor("#0284c7") # Sky 600
    text_color = colors.HexColor("#334155") # Slate 700
    bg_light = colors.HexColor("#f8fafc") # Slate 50
    border_color = colors.HexColor("#e2e8f0") # Slate 200
    
    title_style = ParagraphStyle(
        'DocTitle',
        parent=styles['Heading1'],
        fontSize=22,
        leading=26,
        textColor=primary_color,
        spaceAfter=15
    )
    
    section_heading = ParagraphStyle(
        'SectionHeading',
        parent=styles['Heading2'],
        fontSize=14,
        leading=18,
        textColor=secondary_color,
        spaceBefore=15,
        spaceAfter=8,
        keepWithNext=True
    )
    
    body_style = ParagraphStyle(
        'BodyTextCustom',
        parent=styles['BodyText'],
        fontSize=10,
        leading=14,
        textColor=text_color,
        spaceAfter=6
    )
    
    disclaimer_style = ParagraphStyle(
        'DisclaimerText',
        parent=styles['Italic'],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#64748b"), # Slate 500
        spaceBefore=15
    )
    
    meta_label_style = ParagraphStyle(
        'MetaLabel',
        parent=body_style,
        fontName='Helvetica-Bold',
        textColor=primary_color
    )
    
    story = []
    
    # Title
    story.append(Paragraph("MediCare+ Medical Report Analysis", title_style))
    story.append(Spacer(1, 10))
    
    # 1. Patient Demographics & Metadata Table
    patient_name = analysis.patient_name or "Unknown"
    patient_age = str(analysis.patient_age) if analysis.patient_age else "N/A"
    patient_gender = analysis.patient_gender or "N/A"
    report_date = analysis.report_date or "N/A"
    lab_name = analysis.lab_name or "N/A"
    report_type = analysis.report_type or "N/A"
    
    meta_data = [
        [Paragraph("Patient Name:", meta_label_style), Paragraph(patient_name, body_style),
         Paragraph("Report Date:", meta_label_style), Paragraph(report_date, body_style)],
        [Paragraph("Age / Gender:", meta_label_style), Paragraph(f"{patient_age} / {patient_gender}", body_style),
         Paragraph("Lab Name:", meta_label_style), Paragraph(lab_name, body_style)],
        [Paragraph("Report Type:", meta_label_style), Paragraph(report_type, body_style),
         Paragraph("Original File:", meta_label_style), Paragraph(report_file_name, body_style)]
    ]
    
    meta_table = Table(meta_data, colWidths=[1.2*inch, 2.3*inch, 1.2*inch, 2.3*inch])
    meta_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,-1), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 8),
        ('TOPPADDING', (0,0), (-1,-1), 8),
    ]))
    
    story.append(meta_table)
    story.append(Spacer(1, 15))
    
    # 2. Executive Summary & Health Metrics
    story.append(Paragraph("Executive Summary", section_heading))
    story.append(Paragraph(analysis.executive_summary or analysis.summary or "No summary available.", body_style))
    
    metrics_data = [
        [Paragraph("Health Score Impact", meta_label_style), Paragraph("Risk Level", meta_label_style), Paragraph("Analysis Confidence", meta_label_style)],
        [Paragraph(f"{analysis.health_score_impact} pts", body_style), Paragraph(analysis.risk_level or "Normal", body_style), Paragraph(f"{analysis.analysis_confidence or analysis.confidence_level or '95%'}", body_style)]
    ]
    metrics_table = Table(metrics_data, colWidths=[2.3*inch, 2.3*inch, 2.4*inch])
    metrics_table.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), bg_light),
        ('BOX', (0,0), (-1,-1), 1, border_color),
        ('INNERGRID', (0,0), (-1,-1), 0.5, border_color),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
        ('ALIGN', (0,0), (-1,-1), 'CENTER'),
    ]))
    story.append(metrics_table)
    story.append(Spacer(1, 15))
    
    # Helper to clean lists / JSON fields
    def get_findings_list(field_val):
        if not field_val:
            return []
        if isinstance(field_val, str):
            try:
                return json.loads(field_val)
            except Exception:
                return [field_val]
        return field_val
        
    # 3. Abnormal Findings
    abnormal_findings = get_findings_list(analysis.abnormal_findings)
    story.append(Paragraph("Abnormal Findings", section_heading))
    if abnormal_findings:
        abnormal_data = [[Paragraph("Finding / Parameter", meta_label_style)]]
        for f in abnormal_findings:
            abnormal_data.append([Paragraph(f"🔴 {f}", body_style)])
            
        ab_table = Table(abnormal_data, colWidths=[7*inch])
        ab_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#fef2f2")), # red 50
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#fee2e2")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#fee2e2")),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(ab_table)
    else:
        story.append(Paragraph("No abnormal findings detected.", body_style))
    story.append(Spacer(1, 10))
    
    # 4. Normal Findings
    normal_findings = get_findings_list(analysis.normal_findings)
    story.append(Paragraph("Normal Findings", section_heading))
    if normal_findings:
        normal_data = [[Paragraph("Finding / Parameter", meta_label_style)]]
        for f in normal_findings:
            normal_data.append([Paragraph(f"🟢 {f}", body_style)])
            
        n_table = Table(normal_data, colWidths=[7*inch])
        n_table.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor("#f0fdf4")), # green 50
            ('BOX', (0,0), (-1,-1), 1, colors.HexColor("#dcfce7")),
            ('INNERGRID', (0,0), (-1,-1), 0.5, colors.HexColor("#dcfce7")),
            ('BOTTOMPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 6),
        ]))
        story.append(n_table)
    else:
        story.append(Paragraph("No normal findings reported.", body_style))
    story.append(Spacer(1, 10))
    
    # 5. Recommendations
    recommendations = get_findings_list(analysis.recommendations)
    story.append(Paragraph("Recommendations", section_heading))
    if recommendations:
        for r in recommendations:
            story.append(Paragraph(f"• {r}", body_style))
    else:
        story.append(Paragraph("No specific recommendations provided.", body_style))
    story.append(Spacer(1, 10))
    
    # 6. Next Steps & Suggestions
    follow_up = get_findings_list(analysis.follow_up_suggestions)
    if follow_up:
        story.append(Paragraph("Follow-up Suggestions", section_heading))
        for f in follow_up:
            story.append(Paragraph(f"• {f}", body_style))
        if analysis.next_review_date:
            story.append(Spacer(1, 5))
            story.append(Paragraph(f"<b>Recommended Next Review:</b> {analysis.next_review_date}", body_style))
            
    story.append(Spacer(1, 15))
    
    # Disclaimer
    disclaimer_text = (
        "<b>Clinical Disclaimer:</b> This document is an automated analysis of a medical lab report using artificial intelligence. "
        "This information is for educational purposes only and does NOT constitute clinical or medical advice. "
        "Please consult a qualified healthcare professional to verify these findings, receive diagnosis, or get treatment recommendations."
    )
    story.append(Paragraph(disclaimer_text, disclaimer_style))
    
    # Build Document
    doc.build(story)
    buffer.seek(0)
    return buffer
