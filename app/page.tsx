"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Connecting to ARMS...");
  const [progress, setProgress] = useState(0);
  const [keepMeLoggedIn, setKeepMeLoggedIn] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);



  const steps = [
    "Connecting to ARMS...",
    "Authenticating credentials...",
    "Fetching student profile...",
    "Syncing attendance data...",
    "Retrieving latest grades...",
    "Finalizing dashboard..."
  ];

  // Auto-redirect if already logged in
  useEffect(() => {
    if (typeof window !== "undefined") {
      let stored = sessionStorage.getItem("profile");
      if (!stored) {
        stored = localStorage.getItem("profile");
        if (stored) {
          sessionStorage.setItem("profile", stored);
        }
      }
      if (stored) {
        router.push("/profile");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!acceptTerms) {
      setError("Please accept the Terms and Conditions to continue.");
      return;
    }
    
    setError("");
    setIsLoading(true);
    setProgress(0);
    setLoadingStatus(steps[0]);

    // Animate loader
    let progressVal = 0;
    let stepIdx = 0;
    const interval = setInterval(() => {
      progressVal = Math.min(progressVal + 1.5, 98);
      setProgress(progressVal);

      const targetStepIdx = Math.min(Math.floor(progressVal / 16), steps.length - 1);
      if (targetStepIdx !== stepIdx) {
        stepIdx = targetStepIdx;
        setLoadingStatus(steps[stepIdx]);
      }
    }, 150);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();

      clearInterval(interval);

      if (res.status === 200) {
        setProgress(100);
        setLoadingStatus("Redirecting...");
        sessionStorage.setItem("profile", JSON.stringify(data));
        if (keepMeLoggedIn) {
          localStorage.setItem("profile", JSON.stringify(data));
          localStorage.setItem("saved_username", username);
          localStorage.setItem("saved_password", password);
        } else {
          localStorage.removeItem("profile");
          localStorage.removeItem("saved_username");
          localStorage.removeItem("saved_password");
        }
        setTimeout(() => {
          window.location.href = "/profile";
        }, 500);
      } else {
        setIsLoading(false);
        setError(data.error || "Login failed. Please check credentials.");
      }
    } catch (err: any) {
      clearInterval(interval);
      setIsLoading(false);
      setError("Unable to connect to the server.");
      console.error(err);
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
                    I agree to the <Link href="/terms" style={{ color: "#FF80AB", textDecoration: "none", fontWeight: 600 }}>Terms and Conditions</Link>, <Link href="/privacy" style={{ color: "#FF80AB", textDecoration: "none", fontWeight: 600 }}>Privacy Policy</Link>, and <Link href="/warnings" style={{ color: "#FF80AB", textDecoration: "none", fontWeight: 600 }}>Warnings</Link>
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

      {/* Loading Overlay */}
      <div className={`loading-overlay ${isLoading ? "active" : ""}`}>
        <div className="loading-content">
          <div className="spinner"></div>
          <div className="loading-status">{loadingStatus}</div>
          <div className="progress-container">
            <div className="progress-bar" style={{ width: `${progress}%` }}></div>
          </div>
          <p style={{ marginTop: "20px", color: "var(--text-dim)", fontSize: "14px" }}>
            This might take up to 20 seconds as we securely sync your data.
          </p>
        </div>
      </div>
    </div>
  );
}
