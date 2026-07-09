"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [terminalLines, setTerminalLines] = useState<string[]>([]);
  const [keepMeLoggedIn, setKeepMeLoggedIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLines]);

  // Auto-redirect if already logged in
  useEffect(() => {
    if (typeof window !== "undefined") {
      let stored = sessionStorage.getItem("profile");
      if (!stored) {
        stored = localStorage.getItem("profile");
        if (stored) sessionStorage.setItem("profile", stored);
      }
      if (stored) router.push("/profile");
    }
  }, [router]);

  const addLine = (line: string) => {
    setTerminalLines(prev => [...prev, line]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!acceptTerms) {
      setError("Please accept the Terms and Conditions to continue.");
      return;
    }

    setError("");
    setIsLoading(true);
    setProgress(0);
    setTerminalLines([]);

    try {
      const res = await fetch("/api/profile/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });

      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const chunk of lines) {
          const dataLine = chunk.split("\n").find(l => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const json = JSON.parse(dataLine.slice(5).trim());

            if (json.type === "step") {
              addLine(json.message);
              setProgress(json.progress);
            } else if (json.type === "error") {
              addLine(json.message);
              setIsLoading(false);
              setError(json.message.replace(/^❌\s*/, ""));
              return;
            } else if (json.type === "done" && json.payload) {
              setProgress(100);
              addLine("🚀 Redirecting to dashboard...");
              sessionStorage.setItem("profile", JSON.stringify(json.payload));
              if (keepMeLoggedIn) {
                localStorage.setItem("profile", JSON.stringify(json.payload));
                localStorage.setItem("saved_username", username);
                localStorage.setItem("saved_password", password);
              } else {
                localStorage.removeItem("profile");
                localStorage.removeItem("saved_username");
                localStorage.removeItem("saved_password");
              }
              setTimeout(() => { window.location.href = "/profile"; }, 700);
              return;
            }
          } catch {}
        }
      }
    } catch (err: any) {
      setIsLoading(false);
      setError("Unable to connect to the server.");
    }
  };

  return (
    <div className="login-wrapper">
      <div className="login-container">
        <div className="glass-card">
          {/* Left: Form */}
          <div className="form-section">
            <div className="logo" style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "center", marginBottom: "30px" }}>
              <div className="logo-icon" style={{ 
                background: "linear-gradient(135deg, #FF4081, #FF80AB)", 
                width: "44px", height: "44px", borderRadius: "14px", 
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 20px rgba(255, 64, 129, 0.4)" 
              }}>
                <i className="fas fa-layer-group" style={{ color: "white", fontSize: "20px" }}></i>
              </div>
              <span style={{ fontSize: "32px", fontWeight: 900, background: "linear-gradient(to right, #ffffff, #FF80AB)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.5px" }}>
                ARMSConnect
              </span>
            </div>
            <h1>Welcome back</h1>
            <p className="subtitle">Please Enter your Account details</p>

            {error && (
              <div className="error-message">
                <i className="fas fa-circle-exclamation"></i>
                {error}
              </div>
            )}

            <div id="loginForm">
              <div className="input-group">
                <label htmlFor="username">Registration Number</label>
                <div className="input-wrapper">
                  <i className="far fa-user"></i>
                  <input
                    type="text"
                    id="username"
                    placeholder="Enter Reg No"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                  />
                </div>
              </div>

              <div className="input-group">
                <label htmlFor="password">Password</label>
                <div className="input-wrapper">
                  <i className="fas fa-lock"></i>
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    placeholder="••••••••"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <i
                    className={`fas ${showPassword ? "fa-eye-slash" : "fa-eye"} toggle-password`}
                    onClick={() => setShowPassword(!showPassword)}
                    onTouchEnd={(e) => { e.preventDefault(); setShowPassword(!showPassword); }}
                  ></i>
                </div>
              </div>

              <div className="form-options">
                <label className="remember-me" style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontSize: "14px", color: "var(--text-dim)", userSelect: "none" }}>
                  <div style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "6px",
                    border: keepMeLoggedIn ? "none" : "2px solid rgba(255, 255, 255, 0.2)",
                    background: keepMeLoggedIn ? "linear-gradient(135deg, #FF4081, #FF80AB)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease"
                  }}>
                    {keepMeLoggedIn && <i className="fas fa-check" style={{ color: "white", fontSize: "12px" }}></i>}
                  </div>
                  <input 
                    type="checkbox" 
                    checked={keepMeLoggedIn}
                    onChange={(e) => setKeepMeLoggedIn(e.target.checked)}
                    style={{ display: "none" }} 
                  />
                  Keep me logged in
                </label>
              </div>

              <div className="terms-checkbox" style={{ marginBottom: "20px" }}>
                <label className="remember-me" style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", fontSize: "13px", color: "var(--text-dim)", userSelect: "none", lineHeight: "1.5" }}>
                  <div style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "6px",
                    border: acceptTerms ? "none" : "2px solid rgba(255, 255, 255, 0.2)",
                    background: acceptTerms ? "linear-gradient(135deg, #FF4081, #FF80AB)" : "transparent",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transition: "all 0.2s ease",
                    flexShrink: 0,
                    marginTop: "2px"
                  }}>
                    {acceptTerms && <i className="fas fa-check" style={{ color: "white", fontSize: "12px" }}></i>}
                  </div>
                  <input 
                    type="checkbox" 
                    checked={acceptTerms}
                    onChange={(e) => setAcceptTerms(e.target.checked)}
                    style={{ display: "none" }} 
                  />
                  <span>
                    I agree to the <Link href="/terms" prefetch={false} style={{ color: "#FF80AB", textDecoration: "none", fontWeight: 600 }}>Terms and Conditions</Link>, <Link href="/privacy" prefetch={false} style={{ color: "#FF80AB", textDecoration: "none", fontWeight: 600 }}>Privacy Policy</Link>, and <Link href="/warnings" prefetch={false} style={{ color: "#FF80AB", textDecoration: "none", fontWeight: 600 }}>Warnings</Link>
                  </span>
                </label>
              </div>

              <button type="button" onClick={handleSubmit} className="sign-in-btn" style={{
                background: "linear-gradient(135deg, #FF4081, #FF80AB)",
                border: "none",
                borderRadius: "16px",
                color: "white",
                fontSize: "16px",
                fontWeight: 800,
                padding: "16px",
                marginTop: "15px",
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                boxShadow: "0 8px 25px rgba(255, 64, 129, 0.4)",
                transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: "pointer"
              }}
              onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 30px rgba(255, 64, 129, 0.5)'; }}
              onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 64, 129, 0.4)'; }}
              >
                Sign In to ARMSConnect <i className="fas fa-arrow-right"></i>
              </button>
            </div>
          </div>

          {/* Right: Info Banner */}
          <div className="info-section">
            <div className="info-content">
              <div className="hero-section">
                <h1 className="hero-title">See Your ARMS Data, Reimagined.</h1>
                <p className="hero-subtitle">
                  ARMSConnect securely retrieves your academic information from the official ARMS portal and transforms it into an easy-to-read dashboard with grades, credits, CGPA, and visual insights.
                </p>
              </div>

              <div className="features-grid">
                <div className="feature-card">
                  <div className="feature-icon">📊</div>
                  <h3>Smart Dashboard</h3>
                  <p>Everything important displayed in one clean dashboard. No more searching through multiple ARMS pages.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">📈</div>
                  <h3>Visual Analytics</h3>
                  <p>Understand your academic performance through charts, grade distributions, credit summaries, and CGPA insights.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">🎓</div>
                  <h3>Better Grade View</h3>
                  <p>Quickly view grades, credits, subject status, and results without navigating multiple pages.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">⚡</div>
                  <h3>One Login</h3>
                  <p>Use your existing ARMS credentials. No separate account required.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">📱</div>
                  <h3>Optimized Experience</h3>
                  <p>Works beautifully on mobile, tablet, and desktop devices.</p>
                </div>

                <div className="feature-card">
                  <div className="feature-icon">🔄</div>
                  <h3>Real-Time Data</h3>
                  <p>Displays the latest information available from your ARMS account whenever you log in.</p>
                </div>
              </div>

              <div className="highlight-cards">
                <div className="highlight-item">✓ Grades at a Glance</div>
                <div className="highlight-item">✓ CGPA Overview</div>
                <div className="highlight-item">✓ Credit Summary</div>
                <div className="highlight-item">✓ Interactive Charts</div>
                <div className="highlight-item">✓ Cleaner Interface</div>
                <div className="highlight-item">✓ Faster Navigation</div>
              </div>

              <div className="comparison-section">
                <h3>Why ARMSConnect?</h3>
                <div className="comparison-table">
                  <div className="comparison-column">
                    <h4>Official Portal</h4>
                    <ul>
                      <li>❌ Multiple pages</li>
                      <li>❌ Limited visualization</li>
                      <li>❌ Difficult to interpret</li>
                      <li>❌ Hidden academic insights</li>
                    </ul>
                  </div>
                  <div className="comparison-column comparison-highlight">
                    <h4>ARMSConnect</h4>
                    <ul>
                      <li>✅ One unified dashboard</li>
                      <li>✅ Interactive charts</li>
                      <li>✅ Grade summaries</li>
                      <li>✅ Credit overview</li>
                      <li>✅ Modern responsive interface</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="banner-quote">
                <p>"Spend less time searching through the portal and more time understanding your academic progress."</p>
              </div>

              <div className="banner-subtitle">
                <h3>Your data. Better presented.</h3>
                <p>ARMSConnect doesn't replace ARMS—it enhances the way you view your academic information.</p>
              </div>

              <div className="security-section">
                <h3>🔒 Secure Access</h3>
                <p>Your ARMS credentials are used only to access your academic data. We do not modify any academic records. We simply present the information in a cleaner and more insightful format.</p>
              </div>

              <div className="footer-disclaimer">
                <p>
                  <strong>ARMSConnect is an independent student-developed interface.</strong> It is not affiliated with or endorsed by Saveetha School of Engineering or the official ARMS portal. All academic information displayed belongs to the logged-in user and is retrieved from the official portal for visualization purposes only.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Overlay — Terminal Style */}
      <div className={`loading-overlay ${isLoading ? "active" : ""}`}>
        <div className="loading-content" style={{ width: "100%", maxWidth: "520px", padding: "0 20px" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px" }}>
            <div style={{
              background: "linear-gradient(135deg, #FF4081, #FF80AB)",
              width: "40px", height: "40px", borderRadius: "12px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 6px 18px rgba(255,64,129,0.45)",
              flexShrink: 0
            }}>
              <i className="fas fa-layer-group" style={{ color: "white", fontSize: "18px" }}></i>
            </div>
            <div>
              <div style={{ fontSize: "18px", fontWeight: 800, color: "#fff", letterSpacing: "-0.3px" }}>ARMSConnect</div>
              <div style={{ fontSize: "12px", color: "rgba(255,255,255,0.45)", marginTop: "1px" }}>Syncing your academic data...</div>
            </div>
          </div>

          {/* Terminal Box */}
          <div ref={terminalRef} style={{
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: "14px",
            padding: "16px 18px",
            fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
            fontSize: "13px",
            lineHeight: "1.8",
            minHeight: "180px",
            maxHeight: "260px",
            overflowY: "auto",
            backdropFilter: "blur(10px)",
            scrollBehavior: "smooth",
          }}>
            {/* Terminal top bar */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "12px", opacity: 0.6 }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ff5f56" }}></div>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ffbd2e" }}></div>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#27c93f" }}></div>
              <span style={{ marginLeft: "8px", fontSize: "11px", color: "rgba(255,255,255,0.35)", letterSpacing: "0.5px" }}>arms-connect ~ login</span>
            </div>

            {terminalLines.length === 0 && (
              <div style={{ color: "rgba(255,255,255,0.3)", fontStyle: "italic" }}>Initializing...</div>
            )}

            {terminalLines.map((line, i) => {
              const isError = line.startsWith("❌");
              const isDone = line.startsWith("✅") || line.startsWith("🚀");
              const isInfo = line.startsWith("📊") || line.startsWith("👤");
              return (
                <div key={i} style={{
                  color: isError ? "#ff6b6b" : isDone ? "#4ade80" : isInfo ? "#60a5fa" : "rgba(255,255,255,0.82)",
                  animation: "terminalFadeIn 0.25s ease",
                  display: "flex",
                  gap: "8px",
                  alignItems: "flex-start"
                }}>
                  <span style={{ color: "#FF80AB", userSelect: "none", flexShrink: 0 }}>›</span>
                  <span>{line}</span>
                </div>
              );
            })}

            {/* Blinking cursor */}
            {isLoading && progress < 100 && (
              <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "2px" }}>
                <span style={{ color: "#FF80AB", userSelect: "none" }}>›</span>
                <span style={{
                  display: "inline-block",
                  width: "8px", height: "15px",
                  background: "#FF80AB",
                  animation: "cursorBlink 1s step-end infinite",
                  borderRadius: "2px",
                  opacity: 0.9
                }}></span>
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div style={{ marginTop: "18px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
              <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Progress</span>
              <span style={{ fontSize: "12px", color: "#FF80AB", fontWeight: 700 }}>{Math.round(progress)}%</span>
            </div>
            <div style={{
              background: "rgba(255,255,255,0.08)",
              borderRadius: "99px",
              height: "6px",
              overflow: "hidden"
            }}>
              <div style={{
                width: `${progress}%`,
                height: "100%",
                background: "linear-gradient(90deg, #FF4081, #FF80AB)",
                borderRadius: "99px",
                transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                boxShadow: "0 0 10px rgba(255,64,129,0.5)"
              }}></div>
            </div>
          </div>

          <p style={{ marginTop: "14px", color: "rgba(255,255,255,0.3)", fontSize: "12px", textAlign: "center" }}>
            This may take up to 20 seconds — securely syncing your data
          </p>
        </div>
      </div>
    </div>
  );
}
