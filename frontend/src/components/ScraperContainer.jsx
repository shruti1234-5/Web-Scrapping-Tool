import React, { useState, useEffect } from "react";
import ResultCard from "./ResultCard";
import toast, { Toaster } from "react-hot-toast";
import { 
  Loader, 
  AlertTriangle, 
  Search, 
  Globe, 
  Database, 
  TrendingUp,
  Sparkles,
  Zap
} from "lucide-react";

 // Use environment variable for API URL, but override with localhost in development
const API_URL = import.meta.env.DEV 
  ? "http://localhost:5000/scrape" 
  : (import.meta.env.VITE_API_URL || "https://web-scrapping-tool.onrender.com/scrape");

// Debug: Log the API URL being used
console.log('Environment:', import.meta.env.MODE);
console.log('Is Development:', import.meta.env.DEV);
console.log('API URL:', API_URL);
console.log('VITE_API_URL:', import.meta.env.VITE_API_URL); 

function validateUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

function ScraperContainer() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [isVisible, setIsVisible] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setResults([]);
    setHasSearched(false);
    let payload = {};
    const trimmedInput = input.trim();
    if (!trimmedInput) {i
      toast.error("Please enter a search query or URL(s).");
      return;
    }
    // If input contains any http/https, treat as URLs, else as query
    if (/https?:\/\//i.test(trimmedInput)) {
      const urlList = trimmedInput
        .split(/\s|,|;/)
        .map((u) => u.trim())
        .filter((u) => u);
      for (let u of urlList) {
        if (!validateUrl(u)) {
          toast.error(`Invalid URL: ${u}`);
          return;
        }
      }
      payload = { urls: urlList };
    } else {
      payload = { query: trimmedInput };
    }
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to fetch results");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.results || data.results.length === 0) {
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch (err) {
      toast.error(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  // Get all unique keys from results for dynamic card fields
  const allKeys = Array.from(
    results.reduce((set, r) => {
      Object.keys(r).forEach((k) => set.add(k));
      return set;
    }, new Set())
  ).filter((k) => k !== "error");

  return (
    <div className={`container py-4 ${isVisible ? 'fade-in' : ''}`}>
      <Toaster 
        position="top-center" 
        toastOptions={{
          duration: 4000,
          style: {
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '12px',
            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
          },
        }}
      />
      
      {/* Enhanced Header */}
      <div className="text-center mb-5">
        <div className="d-flex justify-content-center align-items-center mb-3">
          <div className="icon-wrapper icon-primary me-3">
            <Sparkles size={32} color="#fff" />
          </div>
          <h1
            className="mb-0"
            style={{
              color: '#fff',
              fontWeight: 900,
              textShadow: '0 2px 8px rgba(0,0,0,0.45)',
              opacity: 1,
              background: 'none',
              WebkitBackgroundClip: 'unset',
              WebkitTextFillColor: 'unset'
            }}
          >
             Web Scrapping Tool
          </h1>
        </div>
        <p className="fs-5" style={{ color: '#f3f4f6', fontWeight: 600, textShadow: '0 1px 4px rgba(0,0,0,0.18)' }}>
          Extract comprehensive company data with AI-powered insights
        </p>
      </div>

      {/* Enhanced Form */}
      <div className="row justify-content-center mb-5">
        <div className="col-12 col-md-8 col-lg-6">
          <form onSubmit={handleSubmit} className="slide-in-up">
            <div className="position-relative mb-4">
              <div className="input-group" style={{
                background: 'rgba(255,255,255,0.85)',
                borderRadius: '16px',
                boxShadow: '0 4px 24px 0 rgba(99,102,241,0.08)',
                border: '1.5px solid #e0e7ef',
                padding: '0.25rem 0.5rem',
                alignItems: 'center',
                minHeight: '56px',
                fontSize: '1.15rem',
                fontWeight: 500
              }}>
                <span className="input-group-text bg-transparent border-0" style={{ paddingRight: 0, paddingLeft: '0.5rem' }}>
                  <Search size={22} color="#6366f1" />
                </span>
                <input
                  type="text"
                  placeholder="Search companies or URLs (separated by ' ', 'newline' or ',')"
                  value={input}
                  onChange={(e) => { setInput(e.target.value); setHasSearched(false); }}
                  className="form-control border-0 shadow-none"
                  style={{
                    background: 'transparent',
                    fontSize: '1.15rem',
                    fontWeight: 500,
                    color: '#23213a',
                    borderRadius: '16px',
                    minHeight: '48px',
                    boxShadow: 'none',
                    outline: 'none'
                  }}
                />
              </div>
            </div>
            <div className="d-flex justify-content-center">
              <button 
                type="submit" 
                disabled={loading} 
                className="btn btn-primary btn-lg px-5 d-flex align-items-center justify-content-center"
                style={{ minWidth: '200px' }}
              >
                <Zap className="me-2" size={22} color="#fff" />
                Start Scraping
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Enhanced Loading State */}
      {loading && (
        <div className="d-flex justify-content-center align-items-center loading-container slide-in-up" style={{ minHeight: '180px' }}>
          <div className="text-center">
            <div className="loading-spinner mb-3 mx-auto"></div>
            <p className="text-muted fs-5 mb-0">Analyzing companies...</p>
            <div className="d-flex justify-content-center mt-3">
              <div className="icon-wrapper icon-success me-2">
                <Database size={16} color="white" />
              </div>
              <div className="icon-wrapper icon-info me-2">
                <Globe size={16} color="white" />
              </div>
              <div className="icon-wrapper icon-warning">
                <TrendingUp size={16} color="white" />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Results */}
      {results.length > 0 && (
        <div className="row justify-content-center">
          <div className="col-12 text-center mb-1">
            {/* <h3 style={{ color: '#fff', fontWeight: 800, textShadow: '0 2px 8px rgba(0,0,0,0.18)' }}>
              <Database className="me-2" size={24} />
              Found {results.length} companies
            </h3> */}
          </div>
          {results.map((r, i) => (
            <div 
              className="col-12 col-md-6 col-lg-4 d-flex align-items-stretch" 
              key={i}
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <ResultCard result={r} allKeys={allKeys} index={i} />
            </div>
          ))}
        </div>
      )}

      {/* Enhanced Empty State */}
      {!loading && hasSearched && results.length === 0 && (
        <div className="text-center mt-5 slide-in-up">
          <div className="icon-wrapper icon-warning mb-3">
            <AlertTriangle size={32} color="white" />
          </div>
          <h4 className="text-white mb-2">No Results Found</h4>
          <p className="text-white-50">Try different keywords or URLs to find company information.</p>
        </div>
      )}
    </div>
  );
}

export default ScraperContainer; 