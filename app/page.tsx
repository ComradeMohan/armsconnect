"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

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
