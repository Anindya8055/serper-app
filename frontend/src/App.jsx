import { useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Moon,
  Sun,
  Copy,
  Download,
  FileSpreadsheet,
  History,
  Globe,
  ArrowLeft,
  Database,
  Wifi,
  RefreshCw,
  LoaderCircle
} from "lucide-react";
import "./App.css";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";

const countries = [
  { code: "bd", name: "Bangladesh" },
  { code: "us", name: "United States" },
  { code: "in", name: "India" },
  { code: "pk", name: "Pakistan" },
  { code: "ae", name: "United Arab Emirates" },
  { code: "sa", name: "Saudi Arabia" },
  { code: "qa", name: "Qatar" },
  { code: "kw", name: "Kuwait" },
  { code: "om", name: "Oman" },
  { code: "bh", name: "Bahrain" },
  { code: "sg", name: "Singapore" },
  { code: "my", name: "Malaysia" },
  { code: "th", name: "Thailand" },
  { code: "id", name: "Indonesia" },
  { code: "ph", name: "Philippines" },
  { code: "vn", name: "Vietnam" },
  { code: "jp", name: "Japan" },
  { code: "kr", name: "South Korea" },
  { code: "cn", name: "China" },
  { code: "hk", name: "Hong Kong" },
  { code: "tw", name: "Taiwan" },
  { code: "au", name: "Australia" },
  { code: "nz", name: "New Zealand" },
  { code: "ca", name: "Canada" },
  { code: "uk", name: "United Kingdom" },
  { code: "ie", name: "Ireland" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "it", name: "Italy" },
  { code: "es", name: "Spain" },
  { code: "nl", name: "Netherlands" },
  { code: "be", name: "Belgium" },
  { code: "ch", name: "Switzerland" },
  { code: "at", name: "Austria" },
  { code: "se", name: "Sweden" },
  { code: "no", name: "Norway" },
  { code: "dk", name: "Denmark" },
  { code: "fi", name: "Finland" },
  { code: "pl", name: "Poland" },
  { code: "pt", name: "Portugal" },
  { code: "gr", name: "Greece" },
  { code: "tr", name: "Turkey" },
  { code: "za", name: "South Africa" },
  { code: "ng", name: "Nigeria" },
  { code: "eg", name: "Egypt" },
  { code: "ke", name: "Kenya" },
  { code: "ma", name: "Morocco" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
  { code: "ar", name: "Argentina" },
  { code: "cl", name: "Chile" },
  { code: "co", name: "Colombia" },
  { code: "pe", name: "Peru" }
];

const POLL_INTERVAL = 2000;

function App() {
  const [view, setView] = useState("home");
  const [keyword, setKeyword] = useState("");
  const [country, setCountry] = useState("us");
  const [results, setResults] = useState([]);
  const [historyItems, setHistoryItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const [message, setMessage] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [resultSource, setResultSource] = useState("");
  const [activeSearchMeta, setActiveSearchMeta] = useState(null);
  const [progress, setProgress] = useState({
    total: 0,
    doneCount: 0,
    processingCount: 0,
    pendingCount: 0,
    analyzed: false
  });

  const pollTimeoutRef = useRef(null);
  const abortRef = useRef(null);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    document.documentElement.setAttribute("data-theme", initialTheme);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  const selectedCountryName = useMemo(() => {
    return countries.find((item) => item.code === country)?.name || "Unknown";
  }, [country]);

  const clearPolling = () => {
    if (pollTimeoutRef.current) {
      clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setPolling(false);
  };

  const fetchHistory = async () => {
    try {
      setHistoryLoading(true);
      const res = await fetch(`${API_BASE}/api/history`);
      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to load history.");
        return;
      }

      setHistoryItems(Array.isArray(data) ? data : []);
    } catch {
      setMessage("Failed to load history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = async () => {
    setView("history");
    await fetchHistory();
  };

  const pollSearchStatus = async (searchKeyword, searchCountry, countryName) => {
    setPolling(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const params = new URLSearchParams({
        keyword: searchKeyword,
        country: searchCountry
      });

      const res = await fetch(`${API_BASE}/api/search-status?${params.toString()}`, {
        signal: controller.signal
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Failed to check analysis status.");
        setPolling(false);
        return;
      }

      const resultRows = Array.isArray(data.results) ? data.results : [];
      setResults(resultRows);
      setProgress({
        total: data.total || resultRows.length,
        doneCount: data.doneCount || 0,
        processingCount: data.processingCount || 0,
        pendingCount: data.pendingCount || 0,
        analyzed: !!data.analyzed
      });

      setActiveSearchMeta({
        keyword: searchKeyword,
        country: searchCountry,
        countryName,
        total: data.total || resultRows.length
      });

      if (data.analyzed) {
        setPolling(false);
        setLoading(false);
        setMessage(
          `Analysis completed. Found ${data.total || 0} results for "${searchKeyword}" in ${countryName}.`
        );
        return;
      }

      setMessage(
        `Analyzing "${searchKeyword}" in ${countryName}... ${data.doneCount || 0}/${data.total || 0} done.`
      );

      pollTimeoutRef.current = setTimeout(() => {
        pollSearchStatus(searchKeyword, searchCountry, countryName);
      }, POLL_INTERVAL);
    } catch (error) {
      if (error.name !== "AbortError") {
        setMessage("Failed to poll analysis status.");
        setPolling(false);
        setLoading(false);
      }
    }
  };

  const handleSearch = async () => {
    const cleanKeyword = keyword.trim();

    if (!cleanKeyword) {
      setMessage("Please enter a keyword.");
      setHasSearched(false);
      setResults([]);
      setResultSource("");
      return;
    }

    clearPolling();

    try {
      setLoading(true);
      setPolling(false);
      setMessage("");
      setResults([]);
      setHasSearched(true);
      setResultSource("");
      setProgress({
        total: 0,
        doneCount: 0,
        processingCount: 0,
        pendingCount: 0,
        analyzed: false
      });

      const res = await fetch(`${API_BASE}/api/search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          keyword: cleanKeyword,
          country
        })
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data.error || "Something went wrong.");
        setResults([]);
        setLoading(false);
        return;
      }

      const resultRows = Array.isArray(data.results) ? data.results : [];
      setResults(resultRows);
      setResultSource(data.source || "");
      setActiveSearchMeta({
        keyword: cleanKeyword,
        country,
        countryName: selectedCountryName,
        total: data.total || resultRows.length
      });

      setProgress({
        total: data.total || resultRows.length,
        doneCount: data.analyzed ? resultRows.length : 0,
        processingCount: 0,
        pendingCount: data.analyzed ? 0 : resultRows.length,
        analyzed: !!data.analyzed
      });

      if (data.analyzed) {
        setMessage(
          `Found ${data.total || 0} cached results for "${cleanKeyword}" in ${selectedCountryName}.`
        );
        setLoading(false);
        return;
      }

      setMessage(
        `Found ${data.total || 0} results for "${cleanKeyword}" in ${selectedCountryName}. Analysis is running...`
      );

      pollTimeoutRef.current = setTimeout(() => {
        pollSearchStatus(cleanKeyword, country, selectedCountryName);
      }, POLL_INTERVAL);
    } catch {
      setMessage("Server error. Please try again.");
      setResults([]);
      setResultSource("");
      setLoading(false);
    }
  };

  const loadHistoryItem = (item) => {
    clearPolling();

    const snapshot = Array.isArray(item.resultsSnapshot) ? item.resultsSnapshot : [];
    const countryName =
      countries.find((c) => c.code === item.country)?.name || item.country;

    const doneCount = snapshot.filter((x) => x.analysisStatus === "done").length;
    const processingCount = snapshot.filter((x) => x.analysisStatus === "processing").length;
    const pendingCount = snapshot.filter((x) => x.analysisStatus === "pending").length;
    const analyzed = snapshot.length > 0 && doneCount === snapshot.length;

    setKeyword(item.keyword);
    setCountry(item.country);
    setResults(snapshot);
    setHasSearched(true);
    setResultSource("cache");
    setActiveSearchMeta({
      keyword: item.keyword,
      country: item.country,
      countryName,
      total: snapshot.length
    });
    setProgress({
      total: snapshot.length,
      doneCount,
      processingCount,
      pendingCount,
      analyzed
    });

    setMessage(
      `Loaded ${snapshot.length} cached results for "${item.keyword}" in ${countryName}.`
    );

    setView("home");

    if (!analyzed && item.keyword && item.country) {
      pollTimeoutRef.current = setTimeout(() => {
        pollSearchStatus(item.keyword, item.country, countryName);
      }, POLL_INTERVAL);
    }
  };

  const copyAllUrls = async () => {
    if (!results.length) return;

    try {
      await navigator.clipboard.writeText(results.map((item) => item.url).join("\n"));
      setMessage("All URLs copied to clipboard.");
    } catch {
      setMessage("Copy failed. Please try again.");
    }
  };

  const downloadTxt = () => {
    if (!results.length) return;

    const blob = new Blob([results.map((item) => item.url).join("\n")], {
      type: "text/plain;charset=utf-8"
    });

    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "urls.txt";
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage("TXT file downloaded.");
  };

  const downloadCsv = () => {
    if (!results.length) return;

    const csvRows = [
      ["No", "URL", "Content Type", "Site Type", "Confidence", "Status"].join(",")
    ];

    results.forEach((item, index) => {
      csvRows.push(
        [
          index + 1,
          `"${String(item.url || "").replace(/"/g, '""')}"`,
          `"${String(item.contentType || "").replace(/"/g, '""')}"`,
          `"${String(item.siteType || "").replace(/"/g, '""')}"`,
          `"${String(item.confidence || "").replace(/"/g, '""')}"`,
          `"${String(item.analysisStatus || "").replace(/"/g, '""')}"`
        ].join(",")
      );
    });

    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "analyzed-results.csv";
    link.click();
    URL.revokeObjectURL(link.href);
    setMessage("CSV file downloaded.");
  };

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !loading) {
      handleSearch();
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <button
          type="button"
          className="brand-mark"
          onClick={() => setView("home")}
          aria-label="Go to home"
        >
          <span className="brand-dot"></span>
          <span className="brand-text">SERP URL TOOL</span>
        </button>

        <div className="header-actions">
          <button type="button" className="ghost-btn" onClick={openHistory}>
            <History size={16} />
            <span>Search History</span>
          </button>

          <button type="button" className="ghost-btn" onClick={toggleTheme}>
            {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
          </button>
        </div>
      </header>

      {view === "home" ? (
        <main className="home-view">
          <section className="hero-block">
            <h1>Search, filter, and export URLs</h1>
            <p>
              Search by keyword and country, collect clean URLs, classify website types, and export them instantly.
            </p>
          </section>

          <section className="search-panel">
            <div className="field-group keyword-group">
              <label htmlFor="keyword">Keyword</label>
              <div className="input-wrap">
                <Search size={18} className="input-icon" />
                <input
                  id="keyword"
                  type="text"
                  placeholder="e.g. mobile price in bangladesh"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={onKeyDown}
                  disabled={loading}
                />
              </div>
            </div>

            <div className="field-group country-group">
              <label htmlFor="country">Country</label>
              <div className="select-wrap">
                <Globe size={18} className="input-icon" />
                <select
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  disabled={loading}
                >
                  {countries.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <span className="select-arrow">▾</span>
              </div>
            </div>

            <div className="button-group">
              <button
                className="primary-btn"
                onClick={handleSearch}
                disabled={loading || !keyword.trim()}
                type="button"
              >
                {loading || polling ? <LoaderCircle size={18} className="spin-icon" /> : <Search size={18} />}
                <span>{loading ? "Searching..." : polling ? "Updating..." : "Search"}</span>
              </button>
            </div>
          </section>

          {message && <div className="status-message">{message}</div>}

          {!!resultSource && (
            <div className="source-badge">
              {resultSource === "cache" ? <Database size={15} /> : <Wifi size={15} />}
              <span>
                {resultSource === "cache"
                  ? "Loaded from cache"
                  : "Fetched live and analyzing in background"}
              </span>
            </div>
          )}

          {hasSearched && (
            <div className="source-badge">
              <RefreshCw size={15} className={polling ? "spin-icon" : ""} />
              <span>
                Done: {progress.doneCount} · Processing: {progress.processingCount} · Pending: {progress.pendingCount}
              </span>
            </div>
          )}

          <section className="results-section">
            <div className="results-topbar">
              <div>
                <h2>Results</h2>
                <p className="subtext-small">
                  {activeSearchMeta
                    ? `${activeSearchMeta.total} result${
                        activeSearchMeta.total > 1 ? "s" : ""
                      } for "${activeSearchMeta.keyword}" in ${activeSearchMeta.countryName}`
                    : "No results yet"}
                </p>
              </div>

              <div className="action-buttons">
                <button
                  className="ghost-btn"
                  onClick={copyAllUrls}
                  disabled={results.length === 0}
                  type="button"
                >
                  <Copy size={16} />
                  <span>Copy URLs</span>
                </button>
                <button
                  className="ghost-btn"
                  onClick={downloadTxt}
                  disabled={results.length === 0}
                  type="button"
                >
                  <Download size={16} />
                  <span>TXT</span>
                </button>
                <button
                  className="ghost-btn"
                  onClick={downloadCsv}
                  disabled={results.length === 0}
                  type="button"
                >
                  <FileSpreadsheet size={16} />
                  <span>CSV</span>
                </button>
              </div>
            </div>

            {results.length > 0 ? (
              <div className="table-shell">
                <table className="results-table">
                  <thead>
                    <tr>
                      <th className="col-index">#</th>
                      <th className="col-url">URL</th>
                      <th className="col-content">Content Type</th>
                      <th className="col-site">Site Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item, index) => (
                      <tr key={`${item.url}-${index}`}>
                        <td className="col-index">{index + 1}</td>
                        <td className="col-url">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="url-link"
                            title={item.url}
                          >
                            {item.url}
                          </a>
                        </td>
                        <td className="col-content">
                          <span className="pill neutral-pill">
                            {item.contentType || "Pending"}
                          </span>
                        </td>
                        <td className="col-site">
                          <div className="site-type-cell">
                            <span className="pill primary-pill">
                              {item.siteType || "Pending"}
                            </span>
                            <span className="confidence-text">
                              {item.confidence || "Low"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className={`status-pill ${item.analysisStatus || "pending"}`}>
                            {item.analysisStatus || "pending"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : hasSearched ? (
              <div className="empty-state">
                <h3>No URLs found</h3>
                <p>Try another keyword or another country.</p>
              </div>
            ) : (
              <div className="empty-state">
                <h3>Start your first search</h3>
                <p>
                  Search a keyword, analyze site types automatically, and open saved searches instantly.
                </p>
              </div>
            )}
          </section>
        </main>
      ) : (
        <main className="history-view">
          <div className="history-page-header">
            <div>
              <p className="eyebrow">Saved analysis</p>
              <h2>Search History</h2>
              <p className="subtext">
                Open any previous search instantly without rerunning the website analysis.
              </p>
            </div>

            <div className="history-header-actions">
              <button type="button" className="ghost-btn" onClick={() => setView("home")}>
                <ArrowLeft size={16} />
                <span>Back to Home</span>
              </button>
              <button type="button" className="ghost-btn" onClick={fetchHistory}>
                <RefreshCw size={16} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {historyLoading ? (
            <div className="empty-state">
              <div className="spinner"></div>
              <h3>Loading history</h3>
              <p>Please wait while saved searches are loaded.</p>
            </div>
          ) : historyItems.length ? (
            <div className="history-grid">
              {historyItems.map((item) => {
                const snapshot = Array.isArray(item.resultsSnapshot)
                  ? item.resultsSnapshot
                  : [];

                const countryName =
                  countries.find((c) => c.code === item.country)?.name || item.country;

                return (
                  <button
                    type="button"
                    key={item.id}
                    className="history-card"
                    onClick={() => loadHistoryItem(item)}
                  >
                    <div className="history-card-top">
                      <span className="history-keyword">{item.keyword}</span>
                      <span className="history-count">{snapshot.length} results</span>
                    </div>

                    <div className="history-card-meta">
                      <span>{countryName}</span>
                      <span>{new Date(item.createdAt).toLocaleString()}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <h3>No search history yet</h3>
              <p>Your saved analyzed searches will appear here.</p>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

export default App;
