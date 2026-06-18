import React, { useEffect, useState } from "react";
import { 
  FileText, 
  Upload, 
  Trash2, 
  Eye, 
  Download, 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  File, 
  Info, 
  ArrowRight,
  TrendingDown,
  RefreshCw,
  X
} from "lucide-react";
import { reportsAPI } from "../api";

export default function MedicalReports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);
  const [analysisDetail, setAnalysisDetail] = useState(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [fileInputKey, setFileInputKey] = useState(Date.now());

  // Load all reports
  const fetchReports = async () => {
    try {
      setLoading(true);
      const data = await reportsAPI.getAll();
      setReports(data || []);
    } catch (err) {
      console.error("Error loading reports:", err);
      setErrorMsg("Failed to load medical reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  // Handle file upload
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setErrorMsg("");
    setSuccessMsg("");

    // Enforce 10MB limit
    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      setErrorMsg("File size exceeds 10 MB. Please upload a smaller file.");
      return;
    }

    // Supported formats
    const allowedExts = ["pdf", "jpg", "jpeg", "png"];
    const ext = file.name.split(".").pop().toLowerCase();
    if (!allowedExts.includes(ext)) {
      setErrorMsg("Invalid format. Only PDF, JPG, JPEG, and PNG are allowed.");
      return;
    }

    setUploading(true);
    try {
      const newReport = await reportsAPI.upload(file);
      setSuccessMsg(`"${file.name}" uploaded successfully!`);
      fetchReports();
      setFileInputKey(Date.now()); // reset file input
      
      // Auto trigger analysis
      handleAnalyze(newReport.id);
    } catch (err) {
      console.error("Upload error:", err);
      setErrorMsg(err.response?.data?.detail || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  // Trigger Gemini analysis
  const handleAnalyze = async (reportId) => {
    setErrorMsg("");
    setSuccessMsg("");
    
    // Optimistically update status
    setReports(prev => prev.map(r => r.id === reportId ? { ...r, analysis_status: "Analyzing" } : r));
    
    try {
      const result = await reportsAPI.analyze(reportId);
      setSuccessMsg("Analysis completed successfully!");
      fetchReports();
      
      // If modal is not open, show analysis right away
      const report = reports.find(r => r.id === reportId) || { id: reportId, file_name: "Medical Report" };
      setSelectedReport(report);
      setAnalysisDetail(result);
      setShowAnalysisModal(true);
    } catch (err) {
      console.error("Analysis error:", err);
      fetchReports();
      setErrorMsg(err.response?.data?.detail || "Analysis failed. Please try again later.");
    }
  };

  // View AI analysis details
  const handleViewAnalysis = async (report) => {
    setSelectedReport(report);
    setLoadingAnalysis(true);
    setErrorMsg("");
    setShowAnalysisModal(true);
    
    try {
      const analysis = await reportsAPI.getAnalysis(report.id);
      setAnalysisDetail({ analysis });
    } catch (err) {
      console.error("Fetch analysis error:", err);
      setAnalysisDetail(null);
      setErrorMsg("Analysis currently unavailable. Please try again later.");
    } finally {
      setLoadingAnalysis(false);
    }
  };

  // Delete report
  const handleDelete = async (reportId) => {
    if (!window.confirm("Are you sure you want to delete this report? This will also remove its AI analysis data.")) {
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");

    try {
      await reportsAPI.delete(reportId);
      setSuccessMsg("Report deleted successfully.");
      setReports(prev => prev.filter(r => r.id !== reportId));
      if (selectedReport && selectedReport.id === reportId) {
        setShowAnalysisModal(false);
      }
    } catch (err) {
      console.error("Delete error:", err);
      setErrorMsg("Failed to delete report.");
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Medical Reports</h1>
          <p className="text-sm text-slate-500 mt-1">Upload and analyze medical laboratory reports securely using advanced Gemini AI.</p>
        </div>
        
        {/* Upload Button */}
        <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-premium transition-all cursor-pointer select-none active:scale-95 ${uploading ? "opacity-75 pointer-events-none" : ""}`}>
          <Upload className="w-4 h-4" />
          <span>{uploading ? "Uploading..." : "Upload Lab Report"}</span>
          <input 
            key={fileInputKey}
            type="file" 
            className="hidden" 
            accept=".pdf,.png,.jpg,.jpeg" 
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-emergency-50 border border-emergency-100 flex items-start gap-3 animate-fade-in text-emergency-850 text-sm font-medium">
          <AlertCircle className="w-5 h-5 text-emergency-500 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-success-50 border border-success-100 flex items-start gap-3 animate-fade-in text-success-800 text-sm font-medium">
          <CheckCircle2 className="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Main Grid View */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
          <p className="text-sm text-slate-400 font-medium font-sans">Retrieving your medical records...</p>
        </div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-premium flex flex-col items-center justify-center max-w-xl mx-auto mt-8">
          <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-5">
            <FileText className="w-8 h-8" />
          </div>
          <h2 className="text-lg font-bold text-slate-800">No medical reports found</h2>
          <p className="text-slate-500 text-sm mt-2 max-w-sm">Upload your blood tests, urine reports, or ECG scans in PDF, JPG, PNG format (up to 10MB) to start AI diagnostics.</p>
          <label className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md cursor-pointer transition-colors active:scale-95">
            <Upload className="w-4 h-4" />
            <span>Select File</span>
            <input 
              type="file" 
              className="hidden" 
              accept=".pdf,.png,.jpg,.jpeg" 
              onChange={handleUpload}
            />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-2xl border border-slate-100 shadow-premium p-5 hover-glow smooth-hover flex flex-col justify-between gap-4">
              <div className="flex justify-between items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-650 shrink-0">
                  <File className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 truncate" title={report.file_name}>
                    {report.file_name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded">
                      {report.file_type}
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {new Date(report.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                
                {/* Status badge */}
                <div className="shrink-0">
                  {report.analysis_status === "Completed" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success-700 bg-success-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5 text-success-500" />
                      Completed
                    </span>
                  )}
                  {report.analysis_status === "Analyzing" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-650 bg-brand-50 px-2 py-1 rounded-full animate-pulse">
                      <RefreshCw className="w-3.5 h-3.5 text-brand-500 animate-spin" />
                      Analyzing
                    </span>
                  )}
                  {report.analysis_status === "Pending" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-550 bg-slate-50 px-2 py-1 rounded-full">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Pending
                    </span>
                  )}
                  {report.analysis_status === "Failed" && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emergency-600 bg-emergency-50 px-2 py-1 rounded-full">
                      <AlertCircle className="w-3.5 h-3.5 text-emergency-500" />
                      Failed
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons footer */}
              <div className="flex items-center justify-between border-t border-slate-50 pt-4 mt-1">
                <button
                  onClick={() => handleDelete(report.id)}
                  className="p-2 rounded-lg text-slate-400 hover:text-emergency-500 hover:bg-emergency-50 transition-colors"
                  title="Delete Report"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                
                <div className="flex gap-2">
                  <a
                    href={report.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                    title="Download original file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                  
                  {report.analysis_status === "Completed" ? (
                    <button
                      onClick={() => handleViewAnalysis(report)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>View Analysis</span>
                    </button>
                  ) : report.analysis_status === "Failed" || report.analysis_status === "Pending" ? (
                    <button
                      onClick={() => handleAnalyze(report.id)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-sm transition-colors"
                      disabled={report.analysis_status === "Analyzing"}
                    >
                      <Activity className="w-3.5 h-3.5 animate-pulse" />
                      <span>Analyze Report</span>
                    </button>
                  ) : (
                    <button
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-slate-200 cursor-not-allowed"
                      disabled
                    >
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Analyzing...</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Analysis Details Dialog/Modal */}
      {showAnalysisModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[85vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up border border-slate-100">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                  <FileText className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">AI Report Diagnostics</h2>
                  <p className="text-xs text-slate-500 truncate max-w-md mt-0.5">{selectedReport.file_name}</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAnalysisModal(false);
                  setAnalysisDetail(null);
                }}
                className="p-1.5 rounded-xl text-slate-400 hover:text-slate-650 hover:bg-white border border-transparent hover:border-slate-100 transition-all cursor-pointer shadow-sm"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {loadingAnalysis ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="w-7 h-7 text-brand-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Fetching analysis records...</p>
                </div>
              ) : !analysisDetail || !analysisDetail.analysis ? (
                <div className="text-center py-12 space-y-3">
                  <AlertCircle className="w-12 h-12 text-emergency-500 mx-auto" />
                  <h3 className="font-bold text-slate-850">Unable to retrieve AI analysis</h3>
                  <p className="text-slate-550 text-xs max-w-sm mx-auto">No analysis findings are stored for this medical report. Try requesting a re-analysis.</p>
                  <button
                    onClick={() => {
                      setShowAnalysisModal(false);
                      handleAnalyze(selectedReport.id);
                    }}
                    className="mt-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700"
                  >
                    Run Diagnostics
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Summary & Health Score Row */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Summary Block */}
                    <div className="md:col-span-2 bg-slate-50 p-5 rounded-2xl border border-slate-100 flex flex-col justify-between gap-4">
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider font-sans">Report Summary</h4>
                        <p className="text-sm font-medium text-slate-700 mt-2.5 leading-relaxed font-sans">
                          {analysisDetail.analysis.summary}
                        </p>
                      </div>
                      <div className="text-[10px] text-slate-400 font-semibold mt-1">
                        Report Uploaded: {new Date(selectedReport.uploaded_at).toLocaleString()}
                      </div>
                    </div>

                    {/* Health Score Impact Block */}
                    <div className="bg-brand-50/50 p-5 rounded-2xl border border-brand-100 flex flex-col justify-between gap-4 items-center text-center">
                      <div className="w-full flex items-center justify-between border-b border-brand-100 pb-2">
                        <span className="text-xs font-bold text-brand-700 font-sans uppercase">Score Impact</span>
                        <div className="flex items-center gap-1 text-emergency-600 font-sans text-xs font-bold">
                          <TrendingDown className="w-4 h-4" />
                          <span>{analysisDetail.analysis.health_score_impact} pts</span>
                        </div>
                      </div>
                      
                      {/* Before / After comparison */}
                      {analysisDetail.health_score_before !== undefined && analysisDetail.health_score_after !== undefined ? (
                        <div className="flex items-center gap-5 my-1">
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-bold text-slate-400 uppercase">Before</span>
                            <span className="text-2xl font-black text-slate-500 font-sans mt-0.5">{analysisDetail.health_score_before}</span>
                          </div>
                          <ArrowRight className="w-5 h-5 text-brand-400" />
                          <div className="flex flex-col items-center">
                            <span className="text-[9px] font-bold text-brand-650 uppercase">After</span>
                            <span className="text-3xl font-black text-brand-650 font-sans mt-0.5">{analysisDetail.health_score_after}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="my-2">
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Calculated Impact</span>
                          <span className="text-3xl font-black text-brand-650 font-sans mt-1">
                            {analysisDetail.analysis.health_score_impact}
                          </span>
                        </div>
                      )}
                      
                      <p className="text-[9px] text-brand-600/80 font-medium font-sans">
                        Dynamic health score has been adjusted based on laboratory out-of-range values.
                      </p>
                    </div>
                  </div>

                  {/* Findings Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Normal Findings */}
                    <div className="bg-success-50/30 p-5 rounded-2xl border border-success-100/50">
                      <h4 className="text-xs font-bold text-success-800 uppercase tracking-wider font-sans flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-success-500"></span>
                        Normal Parameters
                      </h4>
                      <ul className="mt-3.5 space-y-2">
                        {analysisDetail.analysis.normal_findings && analysisDetail.analysis.normal_findings.length > 0 ? (
                          analysisDetail.analysis.normal_findings.map((f, i) => (
                            <li key={i} className="text-xs font-medium text-slate-700 bg-white border border-success-50 p-2.5 rounded-xl font-sans">
                              {f}
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-slate-400 italic font-sans p-2">No normal parameters listed.</li>
                        )}
                      </ul>
                    </div>

                    {/* Abnormal Findings */}
                    <div className="bg-emergency-50/30 p-5 rounded-2xl border border-emergency-100/50">
                      <h4 className="text-xs font-bold text-emergency-700 uppercase tracking-wider font-sans flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emergency-500 animate-pulse"></span>
                        Out-of-Range parameters
                      </h4>
                      <ul className="mt-3.5 space-y-2">
                        {analysisDetail.analysis.abnormal_findings && analysisDetail.analysis.abnormal_findings.length > 0 ? (
                          analysisDetail.analysis.abnormal_findings.map((f, i) => (
                            <li key={i} className="text-xs font-semibold text-emergency-850 bg-white border border-emergency-100/30 p-2.5 rounded-xl font-sans flex items-start gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-emergency-500 mt-1.5 shrink-0"></span>
                              <span>{f}</span>
                            </li>
                          ))
                        ) : (
                          <li className="text-xs text-success-700 bg-success-50 p-3 rounded-xl font-medium font-sans">
                            🎉 No abnormal or out-of-range findings detected!
                          </li>
                        )}
                      </ul>
                    </div>
                  </div>

                  {/* Recommendations */}
                  <div className="bg-violet-50/20 p-5 rounded-2xl border border-violet-100/40">
                    <h4 className="text-xs font-bold text-violet-850 uppercase tracking-wider font-sans flex items-center gap-2">
                      <Info className="w-4 h-4 text-violet-600" />
                      Educational recommendations
                    </h4>
                    <ul className="mt-3.5 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {analysisDetail.analysis.recommendations && analysisDetail.analysis.recommendations.length > 0 ? (
                        analysisDetail.analysis.recommendations.map((r, i) => (
                          <li key={i} className="text-xs font-medium text-slate-700 bg-white border border-slate-100 p-3 rounded-xl font-sans leading-relaxed">
                            {r}
                          </li>
                        ))
                      ) : (
                        <li className="text-xs text-slate-400 italic font-sans col-span-2">No recommendations provided.</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => {
                  setShowAnalysisModal(false);
                  setAnalysisDetail(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-slate-750 bg-white border border-slate-200 shadow-sm hover:bg-slate-50 cursor-pointer active:scale-95"
              >
                Close View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
