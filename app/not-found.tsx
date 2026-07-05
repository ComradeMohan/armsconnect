"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function NotFound() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at top center, #1a1a2e 0%, #0b0b14 100%)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      color: "white",
      fontFamily: "Inter, sans-serif",
      padding: "20px",
      textAlign: "center",
      overflow: "hidden",
      position: "relative"
    }}>
      {/* Animated background elements */}
      <div style={{
        position: "absolute",
        width: "400px",
        height: "400px",
        background: "rgba(255, 64, 129, 0.15)",
        filter: "blur(100px)",
        borderRadius: "50%",
        top: "20%",
        left: "50%",
        transform: "translateX(-50%)",
        animation: "pulse404 4s ease-in-out infinite alternate",
        zIndex: 0
      }} />

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes float404 {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-15px) rotate(2deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
        @keyframes pulse404 {
          0% { opacity: 0.4; transform: translateX(-50%) scale(1); }
          100% { opacity: 0.8; transform: translateX(-50%) scale(1.1); }
        }
      `}} />

      <div style={{
        position: "relative",
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "20px"
      }}>
        <div style={{
          fontSize: "140px",
          fontWeight: 900,
          background: "linear-gradient(135deg, #FF4081, #7986CB)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          lineHeight: 1,
          animation: "float404 6s ease-in-out infinite",
          filter: "drop-shadow(0 10px 20px rgba(255,64,129,0.3))"
        }}>
          404
        </div>
        
        <h2 style={{ fontSize: "32px", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>
          Lost in the Academic Hub?
        </h2>
        
        <p style={{ color: "var(--text-dim)", maxWidth: "450px", fontSize: "16px", lineHeight: 1.6, margin: "10px 0" }}>
          The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
        </p>

        <Link href="/" style={{ textDecoration: "none" }}>
          <button style={{
            background: "linear-gradient(135deg, #FF4081, #FF80AB)",
            border: "none",
            borderRadius: "16px",
            color: "white",
            fontSize: "16px",
            fontWeight: 800,
            padding: "16px 36px",
            marginTop: "15px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "12px",
            boxShadow: "0 8px 25px rgba(255, 64, 129, 0.4)",
            cursor: "pointer",
            transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = '0 12px 30px rgba(255, 64, 129, 0.5)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 8px 25px rgba(255, 64, 129, 0.4)';
          }}
          >
            <i className="fas fa-home"></i> Return to Dashboard
          </button>
        </Link>
      </div>
    </div>
  );
}
