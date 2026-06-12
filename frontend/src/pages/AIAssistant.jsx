import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, Sparkles, User, BrainCircuit } from "lucide-react";
import { chatAPI } from "../api";

export default function AIAssistant() {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef(null);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const res = await chatAPI.getHistory();
      setMessages(res);
    } catch (err) {
      console.error("Error loading chat history", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const userText = inputText;
    setInputText("");
    
    // Add user message optimistically
    const temporaryUserMsg = {
      id: Date.now(),
      sender: "user",
      content: userText,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, temporaryUserMsg]);
    setIsTyping(true);

    try {
      const aiResponse = await chatAPI.sendMessage(userText);
      // Replace or update messages list
      setMessages((prev) => {
        // filter out any duplicate of user msg if backend seeded differently, or just add AI response
        return [...prev.filter(m => m.id !== temporaryUserMsg.id), temporaryUserMsg, aiResponse];
      });
    } catch (err) {
      console.error("Error sending chat message", err);
      // Add error mock response
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          sender: "ai",
          content: "Sorry, I am having trouble connecting to the medical server. Please check if the FastAPI backend is running properly.",
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="p-8 space-y-6 font-sans max-w-4xl mx-auto h-[calc(100vh-6rem)] flex flex-col animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="w-10 h-10 rounded-xl bg-brand-50 text-brand-600 flex items-center justify-center">
          <BrainCircuit className="w-5.5 h-5.5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight font-sans flex items-center gap-1.5">
            AI Clinical Assistant <Sparkles className="w-4 h-4 text-amber-500 fill-current" />
          </h1>
          <p className="text-xs text-slate-400 mt-0.5 font-sans">
            Symptom assistant chatbot. Not a substitute for professional clinical advice.
          </p>
        </div>
      </div>

      {/* Chat messages viewport */}
      <div className="flex-1 bg-white border border-slate-100 rounded-3xl shadow-premium p-6 overflow-y-auto space-y-6 min-h-0">
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="h-10 bg-slate-100 rounded-xl w-3/4"></div>
            <div className="h-14 bg-slate-100 rounded-xl w-2/3 ml-auto"></div>
          </div>
        ) : (
          <>
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-4 max-w-[85%] ${
                  msg.sender === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
                }`}
              >
                {/* Avatar Icon */}
                <div
                  className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
                    msg.sender === "user"
                      ? "bg-slate-50 text-slate-500 border-slate-100"
                      : "bg-brand-50 text-brand-600 border-brand-100"
                  }`}
                >
                  {msg.sender === "user" ? <User className="w-4.5 h-4.5" /> : <BrainCircuit className="w-4.5 h-4.5" />}
                </div>

                {/* Message Body */}
                <div
                  className={`p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-line font-sans ${
                    msg.sender === "user"
                      ? "bg-brand-600 text-white rounded-tr-none font-medium"
                      : "bg-slate-50 border border-slate-100 text-slate-700 rounded-tl-none font-medium"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex gap-4 max-w-[80%] mr-auto items-center">
                <div className="w-9 h-9 rounded-xl bg-brand-50 border border-brand-100 text-brand-600 flex items-center justify-center shrink-0">
                  <BrainCircuit className="w-4.5 h-4.5" />
                </div>
                <div className="bg-slate-50 border border-slate-100 rounded-2xl rounded-tl-none p-4 flex gap-1.5 items-center">
                  <span className="w-2.5 h-2.5 bg-slate-300 rounded-full animate-bounce"></span>
                  <span className="w-2.5 h-2.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="w-2.5 h-2.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </>
        )}
      </div>

      {/* Input row */}
      <form onSubmit={handleSendMessage} className="flex gap-3 shrink-0">
        <input
          type="text"
          placeholder="Ask me anything: 'I have headache and fever', 'What is my medicine schedule?'"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          className="flex-1 bg-white border border-slate-100 rounded-2xl shadow-premium px-6 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 font-sans font-medium"
        />
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 text-white font-bold p-4 rounded-2xl shadow-md smooth-hover flex items-center justify-center"
        >
          <Send className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
