import React, { useEffect, useState, Suspense } from "react";
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
  TrendingUp,
  RefreshCw,
  X,
  Sparkles,
  Send,
  Printer,
  FileSpreadsheet,
  Brain,
  ShieldCheck,
  User,
  Heart,
  HelpCircle,
  FileDigit,
  BarChart3,
  Calendar,
  Layers
} from "lucide-react";
import { reportsAPI } from "../api";
const BPChart = React.lazy(() => import("../components/BPChart"));
const ReportAnalysisModal = React.lazy(() => import("../components/ReportAnalysisModal"));

function ChartLoader() {
  return (
    <div className="h-60 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
    </div>
  );
}

function ModalLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl p-8 flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-brand-600 rounded-full animate-spin"></div>
        <p className="text-xs font-bold text-slate-400 font-sans">Loading diagnostics...</p>
      </div>
    </div>
  );
}


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
  const [downloadingPDF, setDownloadingPDF] = useState(false);

  // Upgraded Feature States
  const [activeTab, setActiveTab] = useState("reports"); // "reports" or "trends"
  const [comparison, setComparison] = useState(null);
  const [loadingComparison, setLoadingComparison] = useState(false);

  // Chat inline state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [sendingChat, setSendingChat] = useState(false);

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

  const fetchComparison = async () => {
    try {
      setLoadingComparison(true);
      const data = await reportsAPI.getComparison();
      setComparison(data);
    } catch (err) {
      console.error("Error loading comparison:", err);
    } finally {
      setLoadingComparison(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (activeTab === "trends") {
      fetchComparison();
    }
  }, [activeTab]);

  // Set chat greeting when report analysis is loaded
  useEffect(() => {
    if (selectedReport && analysisDetail?.analysis) {
      const patientName = analysisDetail.analysis.patient_name || "Gowthami Bolleni";
      setChatMessages([
        {
          role: "ai",
          content: `Hello! I'm the MediCare+ AI Assistant. I have analyzed the report for ${patientName}. Ask me anything about the metrics, out-of-range results, or recommendations.`
        }
      ]);
    }
  }, [selectedReport, analysisDetail]);

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
      setSuccessMsg(`"${file.name}" uploaded successfully! Starting analysis...`);
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
      
      // Refresh comparison if tab is trends
      if (activeTab === "trends") {
        fetchComparison();
      }
      
      // Open modal
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
      if (activeTab === "trends") {
        fetchComparison();
      }
    } catch (err) {
      console.error("Delete error:", err);
      setErrorMsg("Failed to delete report.");
    }
  };

  // Send message about report
  const sendChatMessage = async (textOverride = null) => {
    const textToSend = textOverride || chatInput;
    if (!textToSend.trim() || !selectedReport) return;

    setChatMessages(prev => [...prev, { role: "user", content: textToSend }]);
    setChatInput("");
    setSendingChat(true);

    try {
      const response = await reportsAPI.chat(selectedReport.id, textToSend);
      setChatMessages(prev => [...prev, { role: "ai", content: response.content }]);
    } catch (err) {
      console.error("Chat error:", err);
      setChatMessages(prev => [...prev, { role: "ai", content: "Sorry, I could not answer at this moment. Please try again." }]);
    } finally {
      setSendingChat(false);
    }
  };

  // Export functions
  const exportJSON = () => {
    if (!analysisDetail?.analysis) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(analysisDetail.analysis, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `medicare_analysis_${analysisDetail.analysis.patient_name || "report"}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const exportCSV = () => {
    if (!analysisDetail?.analysis) return;
    const { abnormal_findings, normal_findings } = analysisDetail.analysis;
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Type,Parameter,Result,Reference Range,Status,Severity\n";

    const abList = Array.isArray(abnormal_findings) ? abnormal_findings : [];
    const nList = Array.isArray(normal_findings) ? normal_findings : [];

    abList.forEach(f => {
      const p = typeof f === 'object' ? f.parameter : f;
      const res = typeof f === 'object' ? f.result : "";
      const rr = typeof f === 'object' ? f.reference_range : "";
      const st = typeof f === 'object' ? f.status : "Abnormal";
      const sev = typeof f === 'object' ? f.severity : "";
      csvContent += `Abnormal,"${p || ""}","${res || ""}","${rr || ""}","${st || ""}","${sev || ""}"\n`;
    });

    nList.forEach(f => {
      const p = typeof f === 'object' ? f.parameter : f;
      const res = typeof f === 'object' ? f.result : "";
      const rr = typeof f === 'object' ? f.reference_range : "";
      const st = typeof f === 'object' ? f.status : "Normal";
      csvContent += `Normal,"${p || ""}","${res || ""}","${rr || ""}","${st || ""}","None"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", encodedUri);
    downloadAnchor.setAttribute("download", `medicare_findings_${analysisDetail.analysis.patient_name || "report"}.csv`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const triggerPrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    if (!selectedReport) return;
    setDownloadingPDF(true);
    try {
      const data = await reportsAPI.downloadPDF(selectedReport.id);
      const blob = new Blob([data], { type: "application/pdf" });
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = `MediCare_Analysis_${selectedReport.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("PDF download failed:", err);
      alert("Failed to download PDF report.");
    } finally {
      setDownloadingPDF(false);
    }
  };

  // Vitals Chart Configurations
  const timelineDates = comparison?.timeline?.map(t => t.report_date) || [];
  
  const getLineOptions = (titleY) => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { enabled: true }
    },
    scales: {
      x: { grid: { display: false } },
      y: { title: { display: true, text: titleY }, grid: { borderDash: [2, 2] } }
    }
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 font-sans print:p-0 print:bg-white print:text-black">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-5 print:hidden">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Medical Reports Hub</h1>
          <p className="text-sm text-slate-500 mt-1">SaaS portal for secure diagnostics, historical comparisons, and AI consultation.</p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Tab buttons */}
          <div className="bg-slate-100 p-1 rounded-xl flex">
            <button
              onClick={() => setActiveTab("reports")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "reports" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              All Reports
            </button>
            <button
              onClick={() => setActiveTab("trends")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === "trends" ? "bg-white text-brand-600 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
            >
              Vitals & Trends
            </button>
          </div>

          {/* Upload Button */}
          <label className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-brand-600 hover:bg-brand-700 shadow-premium transition-all cursor-pointer select-none active:scale-95 ${uploading ? "opacity-75 pointer-events-none" : ""}`}>
            <Upload className="w-4 h-4" />
            <span>{uploading ? "Uploading..." : "Upload Report"}</span>
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
      </div>

      {/* Alert Banners */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-emergency-50 border border-emergency-100 flex items-start gap-3 animate-fade-in text-emergency-850 text-sm font-medium print:hidden">
          <AlertCircle className="w-5 h-5 text-emergency-500 shrink-0 mt-0.5" />
          <div>{errorMsg}</div>
        </div>
      )}
      {successMsg && (
        <div className="p-4 rounded-xl bg-success-50 border border-success-100 flex items-start gap-3 animate-fade-in text-success-800 text-sm font-medium print:hidden">
          <CheckCircle2 className="w-5 h-5 text-success-500 shrink-0 mt-0.5" />
          <div>{successMsg}</div>
        </div>
      )}

      {/* Tab: Reports list */}
      {activeTab === "reports" && (
        <>
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
              <p className="text-sm text-slate-400 font-medium font-sans">Syncing medical database...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-premium flex flex-col items-center justify-center max-w-xl mx-auto mt-8">
              <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600 mb-5">
                <FileText className="w-8 h-8" />
              </div>
              <h2 className="text-lg font-bold text-slate-800">No lab reports uploaded</h2>
              <p className="text-slate-550 text-sm mt-2 max-w-sm">Upload Blood Tests, Thyroid Profiles, CBCs, and Lipid Reports to start AI extraction, severity classifications, and trends tracking.</p>
              <label className="mt-6 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-md cursor-pointer transition-colors active:scale-95">
                <Upload className="w-4 h-4" />
                <span>Select Laboratory File</span>
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
                      <h3 className="text-sm font-bold text-slate-850 truncate" title={report.file_name}>
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
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-success-700 bg-success-50 px-2.5 py-1 rounded-full">
                          <CheckCircle2 className="w-3.5 h-3.5 text-success-500" />
                          Analyzed
                        </span>
                      )}
                      {report.analysis_status === "Analyzing" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-brand-650 bg-brand-50 px-2.5 py-1 rounded-full animate-pulse">
                          <RefreshCw className="w-3.5 h-3.5 text-brand-500 animate-spin" />
                          Processing
                        </span>
                      )}
                      {report.analysis_status === "Pending" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-550 bg-slate-50 px-2.5 py-1 rounded-full">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          Pending
                        </span>
                      )}
                      {report.analysis_status === "Failed" && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emergency-600 bg-emergency-50 px-2.5 py-1 rounded-full">
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
                      <Trash2 className="w-4.5 h-4.5" />
                    </button>
                    
                    <div className="flex gap-2">
                      <a
                        href={report.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Source</span>
                      </a>
                      
                      {report.analysis_status === "Completed" ? (
                        <button
                          onClick={() => handleViewAnalysis(report)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-brand-600 hover:bg-brand-700 shadow-sm transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Report</span>
                        </button>
                      ) : report.analysis_status === "Failed" || report.analysis_status === "Pending" ? (
                        <button
                          onClick={() => handleAnalyze(report.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 shadow-sm transition-colors"
                          disabled={report.analysis_status === "Analyzing"}
                        >
                          <Activity className="w-3.5 h-3.5 animate-pulse" />
                          <span>Analyze</span>
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
        </>
      )}

      {/* Tab: Vitals & Trends */}
      {activeTab === "trends" && (
        <div className="space-y-8 animate-fade-in">
          {loadingComparison ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <RefreshCw className="w-8 h-8 text-brand-500 animate-spin" />
              <p className="text-sm text-slate-400 font-medium font-sans">Compiling historical report timelines...</p>
            </div>
          ) : !comparison || !comparison.timeline || comparison.timeline.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-premium flex flex-col items-center justify-center max-w-xl mx-auto">
              <BarChart3 className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="font-bold text-slate-800">Insufficient reports data</h3>
              <p className="text-slate-500 text-sm mt-2">You need at least 2 completed report analyses to plot trends and compare results over time.</p>
            </div>
          ) : (
            <>
              {/* Executive Timeline Comparison Card */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 flex flex-col md:flex-row gap-6 items-start">
                <div className="w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shrink-0">
                  <Brain className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-2 flex-1">
                  <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">AI Clinical History Summary</h3>
                  <p className="text-sm text-slate-650 leading-relaxed font-medium">
                    {comparison.summary}
                  </p>
                </div>
              </div>

              {/* Trend summary indicators */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(comparison.trends).map(([vital, status]) => (
                  <div key={vital} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{vital.replace("_", " ")}</p>
                      <p className="text-sm font-extrabold text-slate-800 mt-1 capitalize">{vital.replace("_", " ")}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${
                      status === "Improved" ? "text-success-700 bg-success-50" :
                      status === "Worsened" ? "text-emergency-700 bg-emergency-50" :
                      "text-slate-600 bg-slate-50"
                    }`}>
                      {status === "Improved" && <TrendingUp className="w-3.5 h-3.5 text-success-500" />}
                      {status === "Worsened" && <TrendingDown className="w-3.5 h-3.5 text-emergency-500" />}
                      {status}
                    </span>
                  </div>
                ))}
              </div>

              {/* Graphs Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Hemoglobin Graph */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-premium space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emergency-500"></span>
                    Hemoglobin Level Over Time
                  </h4>
                  <div className="h-60">
                    <Suspense fallback={<ChartLoader />}>
                      <BPChart 
                        data={{
                          labels: timelineDates,
                          datasets: [{
                            label: "Hemoglobin (g/dL)",
                            data: comparison.timeline.map(t => t.hemoglobin),
                            borderColor: "#ef4444",
                            backgroundColor: "rgba(239, 68, 68, 0.05)",
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4
                          }]
                        }} 
                        options={getLineOptions("g/dL")} 
                      />
                    </Suspense>
                  </div>
                </div>

                {/* Vitamin D Graph */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-premium space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Vitamin D Level Over Time
                  </h4>
                  <div className="h-60">
                    <Suspense fallback={<ChartLoader />}>
                      <BPChart 
                        data={{
                          labels: timelineDates,
                          datasets: [{
                            label: "Vitamin D (ng/mL)",
                            data: comparison.timeline.map(t => t.vitamin_d),
                            borderColor: "#f59e0b",
                            backgroundColor: "rgba(245, 158, 11, 0.05)",
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4
                          }]
                        }} 
                        options={getLineOptions("ng/mL")} 
                      />
                    </Suspense>
                  </div>
                </div>

                {/* Blood Sugar Graph */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-premium space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    Blood Sugar Level Over Time
                  </h4>
                  <div className="h-60">
                    <Suspense fallback={<ChartLoader />}>
                      <BPChart 
                        data={{
                          labels: timelineDates,
                          datasets: [{
                            label: "Glucose (mg/dL)",
                            data: comparison.timeline.map(t => t.blood_sugar),
                            borderColor: "#3b82f6",
                            backgroundColor: "rgba(59, 130, 246, 0.05)",
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4
                          }]
                        }} 
                        options={getLineOptions("mg/dL")} 
                      />
                    </Suspense>
                  </div>
                </div>

                {/* Health Score Graph */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-premium space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-success-500"></span>
                    Aggregated Health Score Trend
                  </h4>
                  <div className="h-60">
                    <Suspense fallback={<ChartLoader />}>
                      <BPChart 
                        data={{
                          labels: timelineDates,
                          datasets: [{
                            label: "Score",
                            data: comparison.timeline.map(t => t.health_score),
                            borderColor: "#10b981",
                            backgroundColor: "rgba(16, 185, 129, 0.05)",
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4
                          }]
                        }} 
                        options={getLineOptions("Points")} 
                      />
                    </Suspense>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Upgraded Analysis Details Dialog/Modal */}
      {showAnalysisModal && selectedReport && (
        <Suspense fallback={<ModalLoader />}>
          <ReportAnalysisModal
            isOpen={showAnalysisModal}
            onClose={() => {
              setShowAnalysisModal(false);
              setAnalysisDetail(null);
            }}
            selectedReport={selectedReport}
            analysisDetail={analysisDetail}
            loadingAnalysis={loadingAnalysis}
            downloadingPDF={downloadingPDF}
            triggerPrint={triggerPrint}
            handleDownloadPDF={handleDownloadPDF}
            exportCSV={exportCSV}
            exportJSON={exportJSON}
            chatMessages={chatMessages}
            sendingChat={sendingChat}
            chatInput={chatInput}
            setChatInput={setChatInput}
            sendChatMessage={sendChatMessage}
          />
        </Suspense>
      )}
    </div>
  );
}
