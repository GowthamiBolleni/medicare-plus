import React, { useState, useEffect } from "react";
import { Receipt, Plus, Upload, FileText, CheckCircle, TrendingUp, X, Loader2 } from "lucide-react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from "chart.js";
import { expensesAPI } from "../api";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function BillsExpenses() {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUploader, setShowUploader] = useState(false);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showConfirmScreen, setShowConfirmScreen] = useState(false);
  const [ocrError, setOcrError] = useState("");
  const [isManual, setIsManual] = useState(false);
  const [ocrResult, setOcrResult] = useState({
    hospital: "",
    amount: "",
    date: "",
    description: "",
    confidence: 0
  });
  const [expandedBillId, setExpandedBillId] = useState(null);
  const [selectedOcrReview, setSelectedOcrReview] = useState(null);

  // New Expense form state
  const [newExp, setNewExp] = useState({
    id: null,
    hospital: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    file_path: "",
    confidence: 0,
    bill_file: ""
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const formatDateForInput = (dateStr) => {
    if (!dateStr) return "";
    const clean = dateStr.replace(/\//g, "-");
    const parts = clean.split("-");
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return clean; // YYYY-MM-DD
      } else if (parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`; // DD-MM-YYYY -> YYYY-MM-DD
      }
    }
    return dateStr;
  };

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const res = await expensesAPI.getAll();
      setExpenses(res);
    } catch (err) {
      console.error("Error loading expenses", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const handleOcrUpload = async (file) => {
    if (!file) return;
    setSelectedFile(file);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("hospital", "");
    formData.append("description", "");
    formData.append("amount", "");
    formData.append("date", "");

    setOcrLoading(true);
    setOcrError("");
    setShowReview(false);
    setShowConfirmScreen(false);
    try {
      const res = await expensesAPI.uploadBill(formData);
      
      setOcrResult(res);

      // If OCR success is false, show manual entry fallback
      if (res.ocr_success === false) {
        setOcrError("Unable to read bill. Please enter details manually.");
        setNewExp({
          id: null,
          hospital: res.hospital || "",
          description: res.description || "",
          amount: res.amount || "",
          date: res.date ? formatDateForInput(res.date) : new Date().toISOString().split("T")[0],
          file_path: res.file_path || "",
          confidence: res.confidence || 0,
          bill_file: res.bill_file || ""
        });
        setShowReview(true);
        setShowConfirmScreen(false);
      } else if ((res.confidence || 0) < 70) {
        // Low confidence: auto fill but show manual review form (ID is null since it wasn't auto-saved)
        setOcrError("Could not read bill with high confidence. Please verify details manually.");
        setNewExp({
          id: null,
          hospital: res.hospital || "",
          description: res.description || "",
          amount: res.amount || "",
          date: res.date ? formatDateForInput(res.date) : new Date().toISOString().split("T")[0],
          file_path: res.file_path || "",
          confidence: res.confidence || 0,
          bill_file: res.bill_file || ""
        });
        setShowReview(true);
        setShowConfirmScreen(false);
      } else {
        // High confidence: Show confirmation screen
        setNewExp({
          id: res.expense?.id || null,
          hospital: res.hospital || "",
          description: res.description || "",
          amount: res.amount || "",
          date: res.date ? formatDateForInput(res.date) : new Date().toISOString().split("T")[0],
          file_path: res.file_path || "",
          confidence: res.confidence || 0,
          bill_file: res.bill_file || ""
        });
        setShowConfirmScreen(true);
        setShowReview(false);
      }
    } catch (err) {
      console.error("Error during OCR upload:", err);
      setOcrError("Unable to read bill. Please enter details manually.");
      setNewExp({
        id: null,
        hospital: "",
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        file_path: "",
        confidence: 0,
        bill_file: ""
      });
      setShowReview(true);
      setShowConfirmScreen(false);
    } finally {
      setOcrLoading(false);
    }
  };

  const handleClose = async () => {
    // If a high-confidence expense was auto-created but not confirmed/saved, delete it (only if not a duplicate)
    if (newExp.id && (!ocrResult || !ocrResult.duplicate)) {
      try {
        await expensesAPI.delete(newExp.id);
      } catch (err) {
        console.error("Error cleaning up discarded bill:", err);
      }
    }
    setShowUploader(false);
    setSelectedFile(null);
    setShowReview(false);
    setShowConfirmScreen(false);
    setIsManual(false);
    setOcrError("");
    setOcrResult({
      hospital: "",
      amount: "",
      date: "",
      description: "",
      confidence: 0
    });
    setNewExp({
      id: null,
      hospital: "",
      description: "",
      amount: "",
      date: new Date().toISOString().split("T")[0],
      file_path: "",
      confidence: 0,
      bill_file: ""
    });
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        hospital: newExp.hospital,
        description: newExp.description,
        amount: parseFloat(newExp.amount) || 0.0,
        date: new Date(newExp.date).toISOString(),
        file_path: newExp.file_path || null,
        confidence: newExp.confidence || 95,
        bill_file: newExp.bill_file || null
      };

      if (newExp.id) {
        // Update existing expense that was auto-created
        const res = await expensesAPI.update(newExp.id, payload);
        setExpenses(prev => prev.map(exp => exp.id === newExp.id ? res : exp));
      } else {
        // Create new expense manually
        const res = await expensesAPI.create(payload);
        setExpenses(prev => [...prev, res]);
      }
      
      // Reset state
      setShowUploader(false);
      setSelectedFile(null);
      setShowReview(false);
      setShowConfirmScreen(false);
      setOcrError("");
      setIsManual(false);
      setOcrResult({
        hospital: "",
        amount: "",
        date: "",
        description: "",
        confidence: 0
      });
      setNewExp({
        id: null,
        hospital: "",
        description: "",
        amount: "",
        date: new Date().toISOString().split("T")[0],
        file_path: "",
        confidence: 0,
        bill_file: ""
      });
    } catch (err) {
      console.error("Error logging expense", err);
    }
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm("Are you sure you want to delete this bill?")) return;
    try {
      await expensesAPI.delete(id);
      setExpenses(prev => prev.filter(e => e.id !== id));
      if (expandedBillId === id) setExpandedBillId(null);
    } catch (err) {
      console.error("Error deleting expense", err);
    }
  };

  const formatDateShort = (dateStr) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      if (isNaN(d)) return dateStr;
      return d.toLocaleDateString("en-US", { day: "2-digit", month: "short" });
    } catch {
      return dateStr;
    }
  };

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Group and sum expenses by month dynamically using the rolling last 6 months
  const getLast6Months = () => {
    const months = [];
    const d = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
      months.push(m.toLocaleDateString("en-US", { month: "short" }));
    }
    return months;
  };

  const last6Months = getLast6Months();
  const expenseMonthlySum = {};
  last6Months.forEach(m => {
    expenseMonthlySum[m] = 0;
  });

  expenses.forEach(e => {
    if (!e.date) return;
    let month = null;
    const parts = e.date.trim().split(/\s+/);
    if (parts.length >= 2) {
      const m = parts[1].substring(0, 3);
      month = m.charAt(0).toUpperCase() + m.slice(1).toLowerCase();
    } else if (e.date.includes("-")) {
      const d = new Date(e.date);
      if (!isNaN(d)) {
        month = d.toLocaleDateString("en-US", { month: "short" });
      }
    }
    if (month && expenseMonthlySum.hasOwnProperty(month)) {
      expenseMonthlySum[month] += e.amount;
    }
  });

  const barData = {
    labels: last6Months,
    datasets: [
      {
        label: "Expenses",
        data: last6Months.map(m => expenseMonthlySum[m]),
        backgroundColor: "#6d7ef2",
        borderRadius: 8,
        barThickness: 20,
      },
    ],
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
    },
    scales: {
      x: { grid: { display: false } },
      y: { grid: { color: "#f1f5f9" } },
    },
  };

  return (
    <div className="p-8 space-y-8 font-sans max-w-5xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 tracking-tight font-sans">Bills & Expenses</h1>
          <p className="text-slate-500 mt-1 text-sm font-sans">Monitor medical invoices and historical expenses.</p>
        </div>
        <button
          onClick={() => setShowUploader(true)}
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm px-5 py-3 rounded-xl shadow-md smooth-hover flex items-center gap-2 font-sans"
        >
          <Plus className="w-4 h-4" /> Upload Bill
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Expenses bar chart */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col sm:flex-row items-baseline sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider font-sans">Total Expense</h3>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold text-slate-800 font-sans">
                  ₹{totalExpense.toLocaleString()}
                </span>
                <span className="text-xs text-slate-400 font-sans">This Month</span>
              </div>
            </div>
            <span className="text-xs font-bold bg-success-50 text-success-600 border border-success-100 px-3 py-1.5 rounded-lg flex items-center gap-1 font-sans">
              <TrendingUp className="w-4 h-4" /> +15% from last month
            </span>
          </div>

          {/* Bar graph */}
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium h-80 flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-800 font-sans mb-4">Monthly Expenses</h3>
            <div className="flex-1 min-h-0">
              {expenses.length > 0 ? (
                <Bar data={barData} options={barOptions} />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 border border-dashed border-slate-200 rounded-2xl">
                  <Receipt className="w-8 h-8 text-slate-350 mb-2" />
                  <p className="text-xs font-bold text-slate-400 font-sans">No expenses logged yet.</p>
                  <button
                    type="button"
                    onClick={() => setShowUploader(true)}
                    className="text-[10px] text-brand-600 hover:underline font-extrabold mt-1.5 font-sans uppercase tracking-wider block cursor-pointer"
                  >
                    Upload Your First Bill
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right column: Recent bills */}
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-premium flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-800 font-sans mb-4">Recent Bills</h2>
            {loading ? (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 bg-slate-100 rounded-xl"></div>
                ))}
              </div>
            ) : expenses.length === 0 ? (
              <div className="text-center py-10 text-slate-400 font-sans text-xs">No logged bills found.</div>
            ) : (
              <div className="space-y-3">
                {expenses.map((exp) => (
                  <div
                    key={exp.id}
                    className="border border-slate-100 rounded-xl overflow-hidden bg-white hover:border-slate-200 smooth-hover"
                  >
                    <div
                      onClick={() => setExpandedBillId(expandedBillId === exp.id ? null : exp.id)}
                      className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-slate-50/30 smooth-hover"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand-600 flex items-center justify-center">
                          <Receipt className="w-4.5 h-4.5" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-slate-800 font-sans">{exp.hospital || "General Expense"}</h4>
                          <p className="text-[10px] text-slate-400 font-sans mt-0.5">
                            {exp.description} · {formatDateShort(exp.date)}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-bold text-slate-800 font-sans block">
                          ₹{exp.amount.toLocaleString()}
                        </span>
                        {exp.confidence && (
                          <span className={`text-[9px] font-extrabold ${exp.confidence >= 80 ? "text-success-600" : "text-warning-600"}`}>
                            {exp.confidence >= 80 ? "🟢 High" : "🟡 Review"}
                          </span>
                        )}
                      </div>
                    </div>

                    {expandedBillId === exp.id && (
                      <div className="px-3.5 pb-3.5 pt-1.5 bg-slate-50/50 border-t border-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs font-sans text-slate-500 animate-fade-in">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">OCR Stats:</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            (exp.confidence || 95) >= 80 
                              ? "bg-success-50 text-success-700 border border-success-100" 
                              : "bg-warning-50 text-warning-700 border border-warning-100"
                          }`}>
                            {(exp.confidence || 95) >= 80 ? "🟢 High Confidence" : "🟡 Review Required"} ({(exp.confidence || 95)}%)
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {exp.file_path && (
                            <>
                              <button
                                onClick={() => setSelectedOcrReview(exp)}
                                className="text-brand-600 hover:text-brand-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                View OCR
                              </button>
                              <a
                                href={`http://localhost:8000/api/expenses/download-bill/${exp.file_path.split('/').pop()}?token=${localStorage.getItem("medicare_token")}`}
                                target="_blank"
                                rel="noreferrer"
                                className="text-slate-600 hover:text-slate-700 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                              >
                                Download
                              </a>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteExpense(exp.id)}
                            className="text-red-500 hover:text-red-650 font-bold text-[11px] flex items-center gap-1 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bill Upload Modal Overlay */}
      {showUploader && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-4xl p-6 max-h-[85vh] overflow-y-auto animate-slide-up relative">
            <X
              onClick={handleClose}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 hover:text-slate-600 smooth-hover w-5 h-5"
            />

            {/* Tab Header Selector */}
            <div className="flex border-b border-slate-100 mb-6 max-w-md mx-auto">
              <button
                type="button"
                onClick={() => {
                  setIsManual(false);
                  setSelectedFile(null);
                  setShowReview(false);
                  setOcrError("");
                }}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 smooth-hover ${
                  !isManual
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Scan Bill (AI OCR)
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsManual(true);
                  setSelectedFile(null);
                  setShowReview(false);
                  setOcrError("");
                  setNewExp({
                    id: null,
                    hospital: "",
                    description: "",
                    amount: "",
                    date: new Date().toISOString().split("T")[0],
                    file_path: "",
                    confidence: 0,
                    bill_file: ""
                  });
                }}
                className={`flex-1 pb-3 text-sm font-bold border-b-2 smooth-hover ${
                  isManual
                    ? "border-brand-600 text-brand-600"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                }`}
              >
                Enter Manually
              </button>
            </div>

            {/* Layout switch based on mode */}
            {isManual ? (
              // Manual Mode: Single column clean form
              <div className="max-w-md mx-auto py-4">
                <h3 className="text-lg font-bold text-slate-800 font-sans mb-6 text-center">Log Expense Manually</h3>
                <form onSubmit={handleCreateExpense} className="space-y-4 font-sans text-sm">
                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Hospital / Vendor</label>
                    <input
                      type="text"
                      placeholder="e.g. Apollo Hospital"
                      value={newExp.hospital}
                      onChange={(e) => setNewExp({ ...newExp, hospital: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Amount (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 1500"
                        value={newExp.amount}
                        onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Date</label>
                      <input
                        type="date"
                        value={newExp.date}
                        onChange={(e) => setNewExp({ ...newExp, date: e.target.value })}
                        onClick={(e) => e.target.showPicker()}
                        className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 cursor-pointer"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Service Description</label>
                    <input
                      type="text"
                      placeholder="e.g. Consultation"
                      value={newExp.description}
                      onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                      required
                    />
                  </div>

                  <div className="flex gap-4 mt-6">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl font-sans smooth-hover"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl shadow-md font-sans smooth-hover"
                    >
                      Save Bill
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              // OCR Mode: 2-column layout
              <div>
                <h3 className="text-lg font-bold text-slate-800 font-sans mb-6">Scan & Verify Bill</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Left Column: File selection or preview */}
                  <div className="space-y-4">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide">Receipt Document</label>
                    
                    {!selectedFile ? (
                      <div className="border-2 border-dashed border-slate-200 hover:border-brand-500 rounded-2xl p-8 text-center smooth-hover bg-slate-50 cursor-pointer relative h-64 flex flex-col items-center justify-center">
                        <input
                          type="file"
                          onChange={(e) => handleOcrUpload(e.target.files[0])}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Upload className="w-10 h-10 mx-auto text-slate-350 mb-3" />
                        <p className="text-xs font-bold text-slate-600 font-sans">
                          Select or drag invoice receipt file
                        </p>
                        <p className="text-[10px] text-slate-400 mt-1.5 font-sans">Supports PDF, PNG, JPG up to 10MB</p>
                      </div>
                    ) : (
                      <div className="rounded-2xl overflow-hidden border border-slate-100 p-4 flex flex-col items-center justify-center bg-slate-50/50 min-h-[16rem]">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-3">Document Preview</span>
                        {selectedFile.type?.startsWith("image/") ? (
                          <img
                            src={URL.createObjectURL(selectedFile)}
                            alt="Receipt preview"
                            className="max-h-60 object-contain rounded-lg"
                          />
                        ) : (
                          <div className="p-8 text-center">
                            <FileText className="w-14 h-14 mx-auto text-slate-300 mb-3" />
                            <p className="text-xs font-bold text-slate-700 font-sans break-all">{selectedFile.name}</p>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={handleClose}
                          className="mt-4 text-xs font-bold text-red-500 hover:text-red-650 cursor-pointer"
                        >
                          Remove file
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Right Column: Loader, results, or form */}
                  <div className="relative border border-slate-50 rounded-2xl p-4 bg-slate-50/20">
                    {ocrLoading && (
                      <div className="absolute inset-0 bg-white/95 z-10 flex flex-col items-center justify-center text-center p-6 rounded-2xl">
                        <Loader2 className="animate-spin h-10 w-10 text-brand-600 mb-3" />
                        <p className="text-sm font-bold text-slate-600 font-sans">Extracting Bill Details...</p>
                        <p className="text-xs text-slate-400 mt-1 font-sans">Running AI OCR parser on receipt...</p>
                      </div>
                    )}

                    {!selectedFile && (
                      // Empty state when no file is selected
                      <div className="h-full flex flex-col items-center justify-center text-center p-6">
                        <FileText className="w-10 h-10 text-slate-300 mb-3" />
                        <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">Automatic Extraction</h4>
                        <p className="text-xs text-slate-400 max-w-xs mb-4">
                          Upload your hospital bill or medical receipt on the left. MediCare+ will automatically extract the details.
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsManual(true)}
                          className="text-xs text-brand-600 hover:text-brand-700 font-bold border border-brand-200 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 smooth-hover cursor-pointer"
                        >
                          Enter details manually
                        </button>
                      </div>
                    )}

                    {selectedFile && showConfirmScreen && ocrResult && (
                      <div className="space-y-6 font-sans">
                        {ocrResult.duplicate && (
                          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 text-xs font-medium text-amber-800 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                              ⚠️ Duplicate Bill Detected
                            </div>
                            <p>This bill matches an existing expense in your records.</p>
                          </div>
                        )}

                        <div className="text-center py-4">
                          <div className="w-12 h-12 bg-success-50 text-success-600 rounded-full flex items-center justify-center mx-auto mb-3">
                            <CheckCircle className="w-6 h-6" />
                          </div>
                          <h4 className="text-base font-bold text-slate-800 font-sans">✓ Bill Processed</h4>
                          <p className="text-xs text-slate-400 mt-1 font-sans">Confidence Score: {ocrResult.confidence}%</p>
                        </div>

                        <div className="bg-slate-50/50 rounded-2xl p-5 space-y-3.5 text-xs font-medium border border-slate-100">
                          <div className="flex justify-between items-center py-1 border-b border-slate-100/60">
                            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Hospital</span>
                            <span className="text-slate-800 font-bold text-right">{ocrResult.hospital || "General Expense"}</span>
                          </div>
                          <div className="flex justify-between items-center py-1 border-b border-slate-100/60">
                            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Amount</span>
                            <span className="text-slate-800 font-bold text-sm text-right">₹{ocrResult.amount || "0"}</span>
                          </div>
                          <div className="flex justify-between items-center py-1">
                            <span className="text-slate-400 font-semibold uppercase tracking-wider text-[10px]">Date</span>
                            <span className="text-slate-800 font-bold text-right">{ocrResult.date || "Not found"}</span>
                          </div>
                        </div>

                        <div className="flex gap-4 mt-6">
                          <button
                            type="button"
                            onClick={() => {
                              setShowConfirmScreen(false);
                              setShowReview(true);
                              if (ocrResult.duplicate) {
                                // Clear the ID so editing creates a new expense
                                setNewExp(prev => ({ ...prev, id: null }));
                              }
                            }}
                            className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold py-3.5 rounded-xl font-sans smooth-hover cursor-pointer text-center text-sm"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (ocrResult.expense) {
                                setExpenses(prev => {
                                  if (prev.some(e => e.id === ocrResult.expense.id)) {
                                    return prev;
                                  }
                                  return [...prev, ocrResult.expense];
                                });
                              }
                              setShowUploader(false);
                              setSelectedFile(null);
                              setShowReview(false);
                              setShowConfirmScreen(false);
                              setOcrError("");
                              setIsManual(false);
                            }}
                            className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl shadow-md font-sans smooth-hover cursor-pointer text-center text-sm"
                          >
                            Confirm
                          </button>
                        </div>
                      </div>
                    )}

                    {selectedFile && (!showConfirmScreen || !ocrResult) && (
                      <form onSubmit={handleCreateExpense} className="space-y-4 font-sans text-sm">
                        {/* Warning/Error if OCR fails */}
                        {ocrError && (
                          <div className="bg-amber-50/80 border border-amber-100 rounded-2xl p-4 text-xs font-medium text-amber-800 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[10px]">
                              ⚠️ OCR Warning
                            </div>
                            <p>{ocrError}</p>
                          </div>
                        )}

                        {/* OCR Result Card if OCR succeeded */}
                        {showReview && !ocrError && ocrResult && (
                          <div className="bg-green-50/80 border border-green-100 rounded-2xl p-4 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-bold text-green-800 uppercase tracking-wider">OCR Extracted Data</h4>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                                ocrResult.confidence >= 80 
                                  ? "bg-success-100 text-success-800 border border-success-200" 
                                  : "bg-warning-100 text-warning-800 border border-warning-200"
                              }`}>
                                {ocrResult.confidence >= 80 ? "🟢 High Confidence" : "🟡 Review Required"} ({ocrResult.confidence}%)
                              </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs font-medium text-green-700">
                              <p>Hospital: <strong className="text-green-900">{ocrResult.hospital || "Not found"}</strong></p>
                              <p>Amount: <strong className="text-green-900">₹{ocrResult.amount || "0"}</strong></p>
                              <p className="col-span-2">Date: <strong className="text-green-900">{ocrResult.date || "Not found"}</strong></p>
                            </div>
                          </div>
                        )}

                        {showReview && (
                          <>
                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Hospital / Vendor</label>
                              <input
                                type="text"
                                placeholder="e.g. Apollo Hospital"
                                value={newExp.hospital}
                                onChange={(e) => setNewExp({ ...newExp, hospital: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                                required
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Amount (₹)</label>
                                <input
                                  type="number"
                                  placeholder="e.g. 1500"
                                  value={newExp.amount}
                                  onChange={(e) => setNewExp({ ...newExp, amount: e.target.value })}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                                  required
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Date</label>
                                <input
                                  type="date"
                                  value={newExp.date}
                                  onChange={(e) => setNewExp({ ...newExp, date: e.target.value })}
                                  onClick={(e) => e.target.showPicker()}
                                  className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium text-slate-800 cursor-pointer"
                                  required
                                />
                              </div>
                            </div>

                            <div>
                              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Service Description</label>
                              <input
                                type="text"
                                placeholder="e.g. Lab Consultation"
                                value={newExp.description}
                                onChange={(e) => setNewExp({ ...newExp, description: e.target.value })}
                                className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500 font-medium"
                                required
                              />
                            </div>

                            <div className="flex gap-4 mt-6">
                              <button
                                type="button"
                                onClick={handleClose}
                                className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-650 font-bold py-3.5 rounded-xl font-sans smooth-hover text-sm"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="flex-1 bg-brand-600 hover:bg-brand-700 text-white font-bold py-3.5 rounded-xl shadow-md font-sans smooth-hover text-sm"
                              >
                                Save Bill
                              </button>
                            </div>
                          </>
                        )}
                      </form>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* View OCR Details Modal Overlay */}
      {selectedOcrReview && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-2xl w-full max-w-md p-6 max-h-[80vh] overflow-y-auto animate-slide-up relative">
            <X
              onClick={() => setSelectedOcrReview(null)}
              className="absolute top-4 right-4 cursor-pointer text-slate-400 hover:text-slate-600 smooth-hover w-5 h-5"
            />
            <h3 className="text-lg font-bold text-slate-800 font-sans mb-4">OCR Metadata Analysis</h3>
            
            <div className="space-y-4 font-sans text-sm">
              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Hospital / Vendor</p>
                <p className="text-sm font-bold text-slate-800">{selectedOcrReview.hospital}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Extracted Amount</p>
                <p className="text-sm font-bold text-slate-800">₹{selectedOcrReview.amount?.toLocaleString()}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Processed Date</p>
                <p className="text-sm font-bold text-slate-800">{formatDateShort(selectedOcrReview.date)}</p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl space-y-2">
                <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">OCR Confidence Score</p>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    (selectedOcrReview.confidence || 95) >= 80 
                      ? "bg-success-100 text-success-800 border border-success-200" 
                      : "bg-warning-100 text-warning-800 border border-warning-200"
                  }`}>
                    {(selectedOcrReview.confidence || 95) >= 80 ? "🟢 High Confidence" : "🟡 Review Required"}
                  </span>
                  <span className="text-xs text-slate-500 font-bold">({selectedOcrReview.confidence || 95}%)</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
