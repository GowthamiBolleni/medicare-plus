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
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from "chart.js";

// Register ChartJS modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

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
                    <Line 
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
                  </div>
                </div>

                {/* Vitamin D Graph */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-premium space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    Vitamin D Level Over Time
                  </h4>
                  <div className="h-60">
                    <Line 
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
                  </div>
                </div>

                {/* Blood Sugar Graph */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-premium space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                    Blood Sugar Level Over Time
                  </h4>
                  <div className="h-60">
                    <Line 
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
                  </div>
                </div>

                {/* Health Score Graph */}
                <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-premium space-y-4">
                  <h4 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-success-500"></span>
                    Aggregated Health Score Trend
                  </h4>
                  <div className="h-60">
                    <Line 
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
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Upgraded Analysis Details Dialog/Modal */}
      {showAnalysisModal && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in print:absolute print:inset-0 print:bg-white print:p-0 print:z-0">
          <div className="bg-white rounded-3xl w-full max-w-7xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden animate-scale-up border border-slate-100 print:max-h-none print:shadow-none print:border-none print:w-full">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-brand-50 flex items-center justify-center text-brand-600">
                  <FileText className="w-5.5 h-5.5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-800">AI Advanced Report Diagnostics</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{selectedReport.file_name}</p>
                </div>
              </div>
              
              {/* Toolbar */}
              <div className="flex items-center gap-2">
                <button
                  onClick={triggerPrint}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm transition-all"
                  title="Print PDF Report"
                >
                  <Printer className="w-4 h-4" />
                </button>
                <button
                  onClick={exportCSV}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm transition-all"
                  title="Download CSV Table"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                </button>
                <button
                  onClick={exportJSON}
                  className="p-2 rounded-xl text-slate-500 hover:text-slate-800 bg-white border border-slate-200 shadow-sm transition-all"
                  title="Download Raw JSON"
                >
                  <Download className="w-4 h-4" />
                </button>
                <span className="w-px h-6 bg-slate-200 mx-2"></span>
                <button
                  onClick={() => {
                    setShowAnalysisModal(false);
                    setAnalysisDetail(null);
                  }}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-slate-650 hover:bg-slate-100 transition-all shadow-sm"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body: Left clinical findings, Right AI chat */}
            <div className="flex-1 overflow-hidden flex flex-col lg:flex-row print:block">
              {loadingAnalysis ? (
                <div className="flex-1 flex flex-col items-center justify-center py-20 gap-3">
                  <RefreshCw className="w-7 h-7 text-brand-500 animate-spin" />
                  <p className="text-xs text-slate-400 font-medium">Extracting metadata values...</p>
                </div>
              ) : !analysisDetail || !analysisDetail.analysis ? (
                <div className="flex-1 text-center py-12 space-y-3">
                  <AlertCircle className="w-12 h-12 text-emergency-500 mx-auto" />
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
                          <User className="w-4 h-4 text-brand-500" /> Patient Metadata
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

                    {/* 2. Gauges & Overview Row (Risk Score & Health Score Impact) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      
                      {/* Risk Score Circular SVG Gauge */}
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
                          <svg className="w-24 h-24 transform -rotate-90">
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

                      {/* Health Score Impact Breakdown */}
                      <div className="bg-white border border-slate-100 shadow-sm p-4.5 rounded-2xl flex flex-col justify-between gap-3 col-span-2">
                        <div className="w-full flex justify-between items-center border-b border-slate-50 pb-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Health Score Impact Breakdown</span>
                          <span className="text-[10px] font-extrabold text-emergency-600 flex items-center gap-0.5">
                            <TrendingDown className="w-3.5 h-3.5" /> {analysisDetail.analysis.health_score_impact || 0} Points
                          </span>
                        </div>
                        
                        <div className="space-y-2 flex-1 overflow-y-auto max-h-24 py-1">
                          {analysisDetail.analysis.health_score_impact_breakdown && Object.keys(analysisDetail.analysis.health_score_impact_breakdown).length > 0 ? (
                            Object.entries(analysisDetail.analysis.health_score_impact_breakdown).map(([param, impact]) => (
                              <div key={param} className="flex justify-between items-center text-xs font-semibold">
                                <span className="text-slate-600 font-medium">{param}</span>
                                <div className="flex items-center gap-2">
                                  <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
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
                        <div className="flex items-center justify-between border-t border-slate-50 pt-2 text-[10px] text-slate-400">
                          <span>Initial Base Score: {selectedReport.user_id === 1 ? 85 : 100}</span>
                          <span>Total Impact: {analysisDetail.analysis.health_score_impact || 0}</span>
                        </div>
                      </div>
                    </div>

                    {/* 3. Upgraded Summaries: Executive Summary, Key Findings, Recommended Actions */}
                    <div className="space-y-4">
                      {/* Executive Summary & Key Findings Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="md:col-span-2 bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-2.5">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <FileText className="w-4 h-4 text-brand-500" /> Executive Summary
                          </h4>
                          <p className="text-sm font-medium text-slate-700 leading-relaxed">
                            {analysisDetail.analysis.executive_summary || analysisDetail.analysis.summary}
                          </p>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-2.5">
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-4 h-4 text-violet-500" /> Key Findings
                          </h4>
                          <ul className="text-xs space-y-1.5 text-slate-650 list-disc list-inside">
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

                      {/* Critical Findings Warning banner if any */}
                      {analysisDetail.analysis.critical_findings && analysisDetail.analysis.critical_findings.length > 0 && (
                        <div className="bg-emergency-50 border border-emergency-150 p-4 rounded-xl space-y-2">
                          <h4 className="text-xs font-extrabold text-emergency-650 uppercase flex items-center gap-1.5">
                            ⚠️ Critical Attention Items Noted
                          </h4>
                          <ul className="text-xs text-emergency-850 space-y-1">
                            {analysisDetail.analysis.critical_findings.map((cf, i) => (
                              <li key={i} className="font-semibold flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emergency-500 animate-pulse"></span> {cf}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>

                    {/* 4. Structured Parameters Table (Normal & Abnormal findings) */}
                    <div className="space-y-3.5">
                      <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Layers className="w-4.5 h-4.5 text-brand-650" /> Laboratory Parameters Grid
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
                            
                            {/* Abnormal Parameters */}
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
                                      sev === "Critical" ? "text-rose-700" :
                                      sev === "High" ? "text-amber-700" :
                                      "text-orange-700"
                                    }`}>
                                      {sev === "Critical" ? "🔴 Critical" :
                                       sev === "High" ? "🟠 High" :
                                       sev === "Moderate" ? "🟡 Moderate" : "🟡 Mild"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}

                            {/* Normal Parameters */}
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

                    {/* 5. Recommended Actions & Suggestions */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      <div className="bg-slate-50 border border-slate-100 p-5 rounded-2xl space-y-2.5">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                          <CheckCircle2 className="w-4.5 h-4.5 text-success-600" /> Recommended Actions
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
                          <Clock className="w-4.5 h-4.5 text-brand-650" /> Follow-Up Suggestions
                        </h4>
                        <ul className="text-xs space-y-1 text-slate-700 list-inside list-disc font-medium">
                          {analysisDetail.analysis.follow_up_suggestions?.map((sug, i) => (
                            <li key={i}>{sug}</li>
                          ))}
                        </ul>
                        <div className="border-t border-slate-200 pt-2.5 flex justify-between items-center text-[10px]">
                          <span className="font-bold text-slate-400 uppercase">Recommended Next Review</span>
                          <span className="font-bold text-brand-650 bg-brand-50 px-2 py-0.5 rounded">
                            {analysisDetail.analysis.next_review_date || "Unknown"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* 6. AI Confidence & Warnings Footer */}
                    <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3 text-[10px] text-slate-400 font-semibold print:hidden">
                      <div className="flex items-center gap-3.5">
                        <span>OCR Confidence: <strong className="text-slate-650 font-black">{analysisDetail.analysis.ocr_confidence || 90}%</strong></span>
                        <span>Analysis Confidence: <strong className="text-slate-650 font-black">{analysisDetail.analysis.analysis_confidence || 90}%</strong></span>
                        <span>Level: <strong className="text-brand-650 font-black">{analysisDetail.analysis.confidence_level || "High"}</strong></span>
                      </div>
                      <div className="italic text-slate-400 max-w-sm text-right">
                        Disclaimer: AI evaluations are educational aids. Consult qualified practitioners.
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Inline AI Chat Panel (30% width) */}
                  <div className="w-full lg:w-[360px] border-t lg:border-t-0 lg:border-l border-slate-150 flex flex-col h-[40vh] lg:h-auto bg-slate-50 print:hidden">
                    {/* Panel Header */}
                    <div className="p-4 border-b border-slate-150 bg-slate-100/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-violet-500" />
                        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Ask AI About Report</h3>
                      </div>
                      <HelpCircle className="w-4 h-4 text-slate-400" />
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
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
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
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-650 px-2 py-1 rounded-lg text-left truncate max-w-full"
                        >
                          Explain out-of-range results
                        </button>
                        <button 
                          onClick={() => sendChatMessage("What should I do about Vitamin D deficiency?")}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-655 px-2 py-1 rounded-lg text-left truncate max-w-full"
                        >
                          What to do for Vitamin D?
                        </button>
                        <button 
                          onClick={() => sendChatMessage("Which finding is most concerning?")}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-[10px] text-slate-655 px-2 py-1 rounded-lg text-left truncate max-w-full"
                        >
                          Which finding is most concerning?
                        </button>
                      </div>
                    </div>

                    {/* TextInput Box */}
                    <div className="p-3 border-t border-slate-150 bg-white flex gap-2">
                      <input 
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
                        className="p-2 bg-brand-600 hover:bg-brand-700 text-white rounded-xl active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        disabled={sendingChat || !chatInput.trim()}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>

                  </div>
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2 print:hidden">
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
