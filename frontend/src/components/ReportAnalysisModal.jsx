import React, { useEffect, useRef } from "react";
import { 
  FileText, 
  Download, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  File, 
  User, 
  TrendingDown, 
  Sparkles, 
  Send, 
  Printer, 
  FileSpreadsheet, 
  HelpCircle, 
  X, 
  RefreshCw,
  Layers
} from "lucide-react";

export default function ReportAnalysisModal({
  isOpen,
  onClose,
  selectedReport,
  analysisDetail,
  loadingAnalysis,
  downloadingPDF,
  triggerPrint,
  handleDownloadPDF,
  exportCSV,
  exportJSON,
  chatMessages,
  sendingChat,
  chatInput,
  setChatInput,
  sendChatMessage
}) {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    // Save previous active element to restore focus on close
    const previousActiveElement = document.activeElement;
    const modalElement = modalRef.current;
    if (!modalElement) return;

    // Find all focusable elements inside the modal
    const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    const focusableElements = modalElement.querySelectorAll(focusableSelectors);
    
    // Focus the first element on open
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const els = modalElement.querySelectorAll(focusableSelectors);
        if (els.length === 0) return;
        const first = els[0];
        const last = els[els.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            last.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === last) {
            first.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (previousActiveElement) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen || !selectedReport) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:absolute print:inset-0 print:bg-white print:p-0 print:z-0"
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-modal-title"
    >
      <div className="bg-white rounded-3xl w-full max-w-7xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up border border-slate-100 print:max-h-none print:shadow-none print:border-none print:w-full">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
              <FileText className="w-5.5 h-5.5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="analysis-modal-title" className="text-base font-bold text-slate-800">
                AI Advanced Report Diagnostics
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">{selectedReport.file_name}</p>
            </div>
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center gap-2">
            <button
              onClick={triggerPrint}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
              title="Print PDF Report"
              aria-label="Print PDF Report"
            >
              <Printer className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloadingPDF}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-brand-500"
              title="Download AI PDF Report"
              aria-label="Download AI PDF Report"
            >
              {downloadingPDF ? (
                <RefreshCw className="w-4 h-4 animate-spin text-rose-500" aria-hidden="true" />
              ) : (
                <FileText className="w-4 h-4 text-rose-500" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={exportCSV}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
              title="Download CSV Table"
              aria-label="Download CSV Table"
            >
              <FileSpreadsheet className="w-4 h-4" aria-hidden="true" />
            </button>
            <button
              onClick={exportJSON}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-brand-500"
              title="Download Raw JSON"
              aria-label="Download Raw JSON"
            >
              <Download className="w-4 h-4" aria-hidden="true" />
            </button>
            <span className="w-px h-6 bg-slate-200 mx-2" aria-hidden="true"></span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-slate-400 hover:text-slate-650 hover:bg-slate-100 transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row print:block">
          {loadingAnalysis ? (
            <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-7 h-7 text-brand-500 animate-spin" aria-hidden="true" />
              <p className="text-xs text-slate-400 font-medium">Extracting metadata values...</p>
            </div>
          ) : !analysisDetail || !analysisDetail.analysis ? (
            <div className="flex-1 text-center py-12 space-y-3">
              <AlertCircle className="w-12 h-12 text-emergency-500 mx-auto" aria-hidden="true" />
              <h3 className="font-bold text-slate-850">Analysis not found</h3>
              <p className="text-slate-555 text-xs max-w-sm mx-auto">AI clinical findings are not registered for this report.</p>
            </div>
          ) : (
            <>
              {/* Left Column: Diagnostics (70% width) */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 print:p-0">
                
                {/* 1. Patient Metadata Section */}
                <div className="bg-slate-50/70 p-5 rounded-2xl border border-slate-100 grid grid-cols-2 md:grid-cols-3 gap-4 text-left">
                  <div className="col-span-2 md:col-span-3 pb-2 border-b border-dashed border-slate-200 flex justify-between items-center">
                    <span className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <User className="w-4 h-4 text-brand-500" aria-hidden="true" /> Patient Metadata
                    </span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">
                      {analysisDetail.analysis.report_category || "General Report"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Patient Name</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{analysisDetail.analysis.patient_name || "Unknown"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Age / Gender</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">
                      {analysisDetail.analysis.patient_age !== null ? `${analysisDetail.analysis.patient_age} Yrs` : "N/A"} / {analysisDetail.analysis.patient_gender || "Unknown"}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Report Date</span>
                    <p className="text-sm font-bold text-slate-800 mt-0.5">{analysisDetail.analysis.report_date || "Unknown"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400">Laboratory</span>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5 truncate" title={analysisDetail.analysis.lab_name}>{analysisDetail.analysis.lab_name || "Unknown"}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Diagnosed Type</span>
                    <p className="text-sm font-semibold text-slate-700 mt-0.5">{analysisDetail.analysis.report_type || "Unknown"}</p>
                  </div>
                </div>

                {/* 2. Gauges & Overview Row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {/* Risk Score */}
                  <div className="bg-white border border-slate-100 shadow-sm p-4.5 rounded-2xl flex flex-col items-center justify-between text-center gap-3">
                    <div className="w-full flex justify-between items-center border-b border-slate-50 pb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Report Risk Score</span>
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                        analysisDetail.analysis.risk_level === "High Risk" ? "bg-emergency-50 text-emergency-700" :
                        analysisDetail.analysis.risk_level === "Moderate Risk" ? "bg-amber-50 text-amber-700" :
                        "bg-success-50 text-success-700"
                      }`}>
                        {analysisDetail.analysis.risk_level || "Low Risk"}
                      </span>
                    </div>
                    
                    <div className="relative flex items-center justify-center my-1">
                      <svg className="w-24 h-24 transform -rotate-90" aria-label={`Risk score: ${analysisDetail.analysis.risk_score || 0}%`}>
                        <circle cx="48" cy="48" r="40" className="stroke-slate-100 fill-none" strokeWidth="8" />
                        <circle 
                          cx="48" cy="48" r="40" 
                          className={`fill-none transition-all duration-500 ${
                            analysisDetail.analysis.risk_score > 70 ? "stroke-emergency-500" :
                            analysisDetail.analysis.risk_score > 35 ? "stroke-amber-500" :
                            "stroke-success-500"
                          }`} 
                          strokeWidth="8" 
                          strokeDasharray={2 * Math.PI * 40}
                          strokeDashoffset={2 * Math.PI * 40 - (analysisDetail.analysis.risk_score / 100) * 2 * Math.PI * 40}
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-xl font-black text-slate-800">{analysisDetail.analysis.risk_score || 0}</span>
                        <span className="text-[10px] text-slate-400 font-bold block">/ 100</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-400 font-medium">Computed based on out-of-range counts & clinical severity values.</p>
                  </div>

                  {/* Health Score Impact */}
                  <div className="bg-white border border-slate-100 shadow-sm p-4.5 rounded-2xl flex flex-col justify-between gap-3 col-span-2">
                    <div className="w-full flex justify-between items-center border-b border-slate-50 pb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Health Score Impact Breakdown</span>
                      <span className="text-[10px] font-extrabold text-emergency-600 flex items-center gap-0.5">
                        <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" /> {analysisDetail.analysis.health_score_impact || 0} Points
                      </span>
                    </div>
                    
                    <div className="space-y-2 flex-1 overflow-y-auto max-h-24 py-1">
                      {analysisDetail.analysis.health_score_impact_breakdown && Object.keys(analysisDetail.analysis.health_score_impact_breakdown).length > 0 ? (
                        Object.entries(analysisDetail.analysis.health_score_impact_breakdown).map(([param, impact]) => (
                          <div key={param} className="flex justify-between items-center text-xs font-semibold">
                            <span className="text-slate-655 font-medium">{param}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden" aria-hidden="true">
                                <div className="bg-emergency-500 h-full" style={{ width: `${Math.min(Math.abs(impact) * 10, 100)}%` }}></div>
                              </div>
                              <span className="font-bold text-emergency-600">{impact}</span>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 italic">No negative score deductions recorded.</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-50 pt-2 text-[10px] text-slate-450 font-medium">
                      <span>Initial Base Score: {selectedReport.user_id === 1 ? 85 : 100}</span>
                      <span>Total Impact: {analysisDetail.analysis.health_score_impact || 0}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Summaries */}
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2 bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <FileText className="w-4 h-4 text-brand-500" aria-hidden="true" /> Executive Summary
                      </h4>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">
                        {analysisDetail.analysis.executive_summary || analysisDetail.analysis.summary}
                      </p>
                    </div>

                    <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-2.5">
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Sparkles className="w-4 h-4 text-violet-500" aria-hidden="true" /> Key Findings
                      </h4>
                      <ul className="text-xs space-y-1.5 text-slate-655 list-disc list-inside font-medium">
                        {analysisDetail.analysis.key_findings && analysisDetail.analysis.key_findings.length > 0 ? (
                          analysisDetail.analysis.key_findings.map((kf, i) => (
                            <li key={i} className="truncate" title={kf}>{kf}</li>
                          ))
                        ) : (
                          <li className="italic">No overall findings listed.</li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {analysisDetail.analysis.critical_findings && analysisDetail.analysis.critical_findings.length > 0 && (
                    <div className="bg-emergency-50 border border-emergency-150 p-4 rounded-xl space-y-2">
                      <h4 className="text-xs font-extrabold text-emergency-650 uppercase flex items-center gap-1.5">
                        ⚠️ Critical Attention Items Noted
                      </h4>
                      <ul className="text-xs text-emergency-850 space-y-1">
                        {analysisDetail.analysis.critical_findings.map((cf, i) => (
                          <li key={i} className="font-semibold flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emergency-500 animate-pulse" aria-hidden="true"></span> {cf}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* 4. Structured Parameters Table */}
                <div className="space-y-3.5">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4.5 h-4.5 text-brand-650" aria-hidden="true" /> Laboratory Parameters Grid
                  </h3>
                  
                  <div className="overflow-x-auto rounded-2xl border border-slate-100">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase font-bold text-slate-400">
                        <tr>
                          <th className="p-3">Parameter Name</th>
                          <th className="p-3">Extracted Result</th>
                          <th className="p-3">Standard Reference Range</th>
                          <th className="p-3">Diagnostic Status</th>
                          <th className="p-3">Clinical Severity</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {analysisDetail.analysis.abnormal_findings?.map((f, i) => {
                          const p = typeof f === 'object' ? f.parameter : f;
                          const res = typeof f === 'object' ? f.result : "";
                          const rr = typeof f === 'object' ? f.reference_range : "";
                          const st = typeof f === 'object' ? f.status : "Abnormal";
                          const sev = typeof f === 'object' ? f.severity : "High";

                          return (
                            <tr key={`ab-${i}`} className="bg-emergency-50/10 hover:bg-emergency-50/20 font-medium">
                              <td className="p-3 font-semibold text-slate-900">{p}</td>
                              <td className="p-3 font-mono text-emergency-600">{res}</td>
                              <td className="p-3 font-mono">{rr}</td>
                              <td className="p-3">
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-black uppercase text-emergency-650 bg-emergency-50 px-2 py-0.5 rounded">
                                  {st}
                                </span>
                              </td>
                              <td className="p-3">
                                <span className={`inline-flex items-center gap-1 text-[9px] font-bold ${
                                  sev === "Critical" ? "text-rose-705 font-extrabold" :
                                  sev === "High" ? "text-amber-705 font-bold" :
                                  "text-orange-705 font-bold"
                                }`}>
                                  {sev === "Critical" ? "🔴 Critical" :
                                   sev === "High" ? "🟠 High" :
                                   sev === "Moderate" ? "🟡 Moderate" : "🟡 Mild"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                        {analysisDetail.analysis.normal_findings?.map((f, i) => {
                          const p = typeof f === 'object' ? f.parameter : f;
                          const res = typeof f === 'object' ? f.result : "";
                          const rr = typeof f === 'object' ? f.reference_range : "";
                          const st = typeof f === 'object' ? f.status : "Normal";

                          return (
                            <tr key={`n-${i}`} className="hover:bg-slate-50">
                              <td className="p-3 font-semibold text-slate-800">{p}</td>
                              <td className="p-3 font-mono text-success-600">{res}</td>
                              <td className="p-3 font-mono">{rr}</td>
                              <td className="p-3">
                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-success-700 bg-success-50 px-2 py-0.5 rounded">
                                  {st}
                                </span>
                              </td>
                              <td className="p-3 text-slate-400 italic">None</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 5. Recommended Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <CheckCircle2 className="w-4.5 h-4.5 text-success-600" aria-hidden="true" /> Recommended Actions
                    </h4>
                    <ul className="text-xs space-y-1 text-slate-700 list-inside list-decimal font-medium">
                      {analysisDetail.analysis.recommended_actions?.map((act, i) => (
                        <li key={i}>{act}</li>
                      )) || analysisDetail.analysis.recommendations?.map((act, i) => (
                        <li key={i}>{act}</li>
                      ))}
                    </ul>
                  </div>

                  <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-2.5">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-4.5 h-4.5 text-brand-650" aria-hidden="true" /> Follow-Up Suggestions
                    </h4>
                    <ul className="text-xs space-y-1 text-slate-700 list-inside list-disc font-medium">
                      {analysisDetail.analysis.follow_up_suggestions?.map((sug, i) => (
                        <li key={i}>{sug}</li>
                      ))}
                    </ul>
                    <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center text-[10px]">
                      <span className="font-bold text-slate-400 uppercase">Recommended Next Review</span>
                      <span className="font-bold text-brand-655 bg-brand-50 px-2 py-0.5 rounded">
                        {analysisDetail.analysis.next_review_date || "Unknown"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 6. AI Confidence & Warnings Footer */}
                <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-[10px] text-slate-400 font-semibold print:hidden">
                  <div className="flex items-center gap-3.5">
                    <span>OCR Confidence: <strong className="text-slate-655 font-black">{analysisDetail.analysis.ocr_confidence || 90}%</strong></span>
                    <span>Analysis Confidence: <strong className="text-slate-655 font-black">{analysisDetail.analysis.analysis_confidence || 90}%</strong></span>
                    <span>Level: <strong className="text-brand-655 font-black">{analysisDetail.analysis.confidence_level || "High"}</strong></span>
                  </div>
                  <div className="italic text-slate-400 max-w-sm text-right">
                    Disclaimer: AI evaluations are educational aids. Consult qualified practitioners.
                  </div>
                </div>

              </div>

              {/* Right Column: Inline AI Chat Panel (30% width) */}
              <div className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-slate-150 flex flex-col h-[40vh] lg:h-auto bg-slate-50 print:hidden">
                {/* Panel Header */}
                <div className="p-4 border-b border-slate-155 bg-slate-100/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-500" aria-hidden="true" />
                    <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ask AI About Report</h3>
                  </div>
                  <HelpCircle className="w-4 h-4 text-slate-400" aria-hidden="true" />
                </div>

                {/* Chat Messages Log */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3.5 scrollbar-thin">
                  {chatMessages.map((msg, idx) => (
                    <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl p-3 text-xs leading-relaxed ${
                        msg.role === "user" 
                          ? "bg-brand-600 text-white font-medium shadow-sm" 
                          : "bg-white border border-slate-100 text-slate-750 shadow-sm"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {sendingChat && (
                    <div className="flex justify-start">
                      <div className="bg-white border border-slate-100 rounded-2xl p-3 text-xs text-slate-400 flex items-center gap-1.5">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                        <span>Clinical reasoning...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Preset suggestion prompts */}
                <div className="p-3 border-t border-slate-150 bg-slate-100/30 space-y-1.5">
                  <p className="text-[9px] uppercase font-bold text-slate-400 px-1">Suggested Questions</p>
                  <div className="flex flex-wrap gap-1">
                    <button 
                      onClick={() => sendChatMessage("Explain my out-of-range results.")}
                      className="bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-655 px-2 py-1 rounded-lg text-left truncate max-w-full focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      Explain out-of-range results
                    </button>
                    <button 
                      onClick={() => sendChatMessage("What should I do about Vitamin D deficiency?")}
                      className="bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-655 px-2 py-1 rounded-lg text-left truncate max-w-full focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      What to do for Vitamin D?
                    </button>
                    <button 
                      onClick={() => sendChatMessage("Which finding is most concerning?")}
                      className="bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-655 px-2 py-1 rounded-lg text-left truncate max-w-full focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      Which finding is most concerning?
                    </button>
                  </div>
                </div>

                {/* TextInput Box */}
                <div className="p-3 border-t border-slate-150 bg-white flex gap-2">
                  <label htmlFor="ai-chat-input" className="sr-only">Type report question</label>
                  <input 
                    id="ai-chat-input"
                    type="text" 
                    placeholder="Type report question..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                    className="flex-1 border border-slate-250 rounded-xl px-3 text-xs focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    disabled={sendingChat}
                  />
                  <button 
                    onClick={() => sendChatMessage()}
                    className="p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500"
                    disabled={sendingChat || !chatInput.trim()}
                    aria-label="Send query to AI"
                  >
                    <Send className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>

              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 print:hidden">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-bold text-slate-750 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer active:scale-95 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            Close View
          </button>
        </div>
      </div>
    </div>
  );
}
