"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [imgError, setImgError] = useState(false);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  useEffect(() => { setMounted(true); }, []);

  // Lock body scroll when modals are open
  useEffect(() => {
    if (showNotificationsModal || showProfileModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showNotificationsModal, showProfileModal]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      let stored = sessionStorage.getItem("profile");
      if (!stored) {
        stored = localStorage.getItem("profile");
        if (stored) {
          sessionStorage.setItem("profile", stored);
        }
      }
      if (!stored) {
        router.push("/");
      } else {
        setProfile(JSON.parse(stored));
      }
    }
  }, [router]);

  const handleLogout = () => {
    sessionStorage.removeItem("profile");
    localStorage.removeItem("profile");
    router.push("/");
  };

  // Grade Distribution logic
  const getGradeDistribution = () => {
    const counts: any = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0 };
    if (profile?.courses) {
      profile.courses.forEach((c: any) => {
        const grade = c.grade?.toUpperCase();
        if (counts[grade] !== undefined) {
          counts[grade]++;
        }
      });
    }
    const maxVal = Math.max(...(Object.values(counts) as number[]), 1);
    return { counts, maxVal };
  };

  const { counts: gradeCounts, maxVal: maxGradeCount } = getGradeDistribution();

  const getDoughnutSegments = (coursesList: any[]) => {
    const total = coursesList?.length || 0;
    if (total === 0) return [];
    
    const radius = 45;
    const circumference = 2 * Math.PI * radius; // ~282.74
    
    let currentOffset = 0;
    const segments: any[] = [];
    
    const grades = ["S", "A", "B", "C", "D", "E"];
    const colors: any = {
      S: "#d946ef",
      A: "#10b981",
      B: "#3b82f6",
      C: "#f59e0b",
      D: "#f97316",
      E: "#ef4444"
    };

    grades.forEach((grade) => {
      const count = gradeCounts[grade] || 0;
      if (count > 0) {
        const pct = (count / total) * 100;
        const strokeLength = (pct / 100) * circumference;
        const angle = (currentOffset / circumference) * 360;
        
        segments.push({
          grade,
          count,
          pct,
          strokeLength,
          angle,
          color: colors[grade]
        });
        
        currentOffset += strokeLength;
      }
    });
    
    return segments;
  };

  const doughnutSegments = getDoughnutSegments(profile?.courses || []);

  if (!profile) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center" }}>
        <div>
          <div className="spinner"></div>
          <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "20px" }}>Loading Dashboard...</p>
        </div>
      </div>
    );
  }

  // Linkify helper for notifications
  const renderMessage = (text: string) => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    if (!urlPattern.test(text)) {
      return <p className="note-msg">{text}</p>;
    }

    const urls = text.match(urlPattern);
    const cleanText = text.replace(urlPattern, "").trim();

    return (
      <>
        {cleanText && <p className="note-msg" style={{ marginBottom: "5px" }}>{cleanText}</p>}
        {urls && urls.map((url, i) => (
          <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="notif-link-btn">
            <i className="fas fa-external-link-alt"></i> Open Resource
          </a>
        ))}
      </>
    );
  };

  const sortedCourses = [...(profile?.courses || [])];
  if (sortConfig !== null) {
    sortedCourses.sort((a, b) => {
      let aVal = (a as any)[sortConfig.key];
      let bVal = (b as any)[sortConfig.key];

      if (sortConfig.key === 'grade') {
        const gradeOrder: any = { 'S': 6, 'A': 5, 'B': 4, 'C': 3, 'D': 2, 'E': 1 };
        aVal = gradeOrder[a.grade?.toUpperCase()] || 0;
        bVal = gradeOrder[b.grade?.toUpperCase()] || 0;
      } else {
        if (typeof aVal === 'string') aVal = aVal.toLowerCase();
        if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      }

      if (aVal < bVal) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aVal > bVal) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });
  }

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div>
      <div className="dashboard-wrapper">
        {/* Sidebar / Profile Card */}
      <div className="sidebar">
        <div className="glass-panel profile-card-panel" style={{ padding: 0, overflow: "hidden" }}>
          {profile.profilePictureUrl && !imgError ? (
            <div
              className="profile-photo-wrapper"
              onClick={() => setShowProfileModal(true)}
              onTouchEnd={(e) => { e.preventDefault(); setShowProfileModal(true); }}
              style={{ width: "100%", height: "280px", position: "relative", cursor: "pointer" }}
            >
              <img
                src={`https://arms.sse.saveetha.com/Content/ProfilePicture/${profile.profilePictureUrl}`}
                alt={profile.name}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={() => setImgError(true)}
              />
              {/* Bottom Shadow Gradient Overlay for Name and Registration Number */}
              <div className="profile-overlay-info" style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: "50%",
                background: "linear-gradient(to top, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0) 100%)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                padding: "15px 20px",
                textAlign: "center"
              }}>
                <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0, color: "white", textShadow: "0 2px 4px rgba(0,0,0,0.6)" }}>{profile.name}</h2>
                <p style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "12px", margin: "4px 0 0 0", fontWeight: "600", textShadow: "0 1px 2px rgba(0,0,0,0.6)" }}>{profile.regno}</p>
                {/* Tap hint — mobile only */}
                <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "9px", margin: "4px 0 0 0", letterSpacing: "0.5px" }} className="profile-tap-hint">TAP FOR DETAILS</p>
              </div>
            </div>
          ) : (
            <div
              className="avatar-fallback-wrapper"
              onClick={() => setShowProfileModal(true)}
              onTouchEnd={(e) => { e.preventDefault(); setShowProfileModal(true); }}
              style={{ width: "100%", height: "200px", background: "var(--primary-gradient)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", cursor: "pointer" }}
            >
              <div className="avatar-large" style={{ transform: "none", marginBottom: "10px", width: "60px", height: "60px", fontSize: "24px" }}>
                {profile.name ? profile.name[0].toUpperCase() : "S"}
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0, color: "white", textAlign: "center" }}>{profile.name}</h2>
              <p style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "12px", margin: "4px 0 0 0", fontWeight: "600", textAlign: "center" }}>{profile.regno}</p>
              <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "9px", margin: "6px 0 0 0", letterSpacing: "0.5px" }} className="profile-tap-hint">TAP FOR DETAILS</p>
            </div>
          )}

          <div style={{ padding: "20px 25px 25px 25px" }}>

            <div className="info-list" style={{ marginTop: "0" }}>
              <div className="info-item">
                <i className="fas fa-graduation-cap"></i>
                <div className="info-content">
                  <label>Program</label>
                  <span>{profile.program}</span>
                </div>
              </div>
              <div className="info-item">
                <i className="fas fa-calendar-alt"></i>
                <div className="info-content">
                  <label>Date of Birth</label>
                  <span>{profile.dob}</span>
                </div>
              </div>
              <div className="info-item">
                <i className="fas fa-envelope"></i>
                <div className="info-content">
                  <label>Email</label>
                  <span style={{ fontSize: "11px" }}>{profile.email}</span>
                </div>
              </div>
              <div className="info-item">
                <i className="fas fa-phone"></i>
                <div className="info-content">
                  <label>Mobile</label>
                  <span>{profile.mobile}</span>
                </div>
              </div>
              <div className="info-item" style={{ background: "rgba(255, 64, 129, 0.1)", margin: "10px -10px", padding: "15px 10px", borderRadius: "15px", border: "1px solid rgba(255, 64, 129, 0.2)" }}>
                <i className="fas fa-chart-line" style={{ color: "#FF4081", background: "rgba(255, 64, 129, 0.2)" }}></i>
                <div className="info-content">
                  <label style={{ color: "#FF80AB", fontWeight: 700 }}>Current CGPA</label>
                  <span style={{ fontSize: "20px", fontWeight: 800, color: "white" }}>{profile.cgpa}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content">
        {/* Top Header Bar */}
        <div className="top-bar">
          <div className="welcome-text">
            <h1>Academic Hub</h1>
            <p>Welcome back, your portal is synced.</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button onClick={handleLogout} className="logout-btn" style={{
              width: "auto",
              margin: 0,
              padding: "10px 20px",
              borderRadius: "15px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap"
            }}>
              <i className="fas fa-sign-out-alt"></i> Logout
            </button>
          </div>
        </div>

        {/* Stats Summary Cards */}
        <div className="stats-grid">
          <button className="glass-panel stat-card" onClick={() => {
            document.getElementById('grade-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }} onTouchEnd={(e) => {
            e.preventDefault();
            document.getElementById('grade-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }} style={{ cursor: "pointer", background: "none", border: "none", color: "inherit", touchAction: "manipulation", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "6px", width: "100%", height: "100%" }}>
            <p className="stat-card-label" style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "rgba(255,255,255,0.5)", margin: 0, whiteSpace: "nowrap" }}>Courses Done</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div className="stat-icon" style={{ background: "rgba(255, 128, 171, 0.2)", color: "#FF80AB", margin: 0 }}>
                <i className="fas fa-book"></i>
              </div>
              <h4 style={{ fontSize: "16px", fontWeight: 800, margin: 0, lineHeight: 1 }}>{profile?.courses?.length || 0}</h4>
            </div>
          </button>
          <button className="glass-panel stat-card" onClick={() => {
            document.getElementById('attendance-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }} onTouchEnd={(e) => {
            e.preventDefault();
            document.getElementById('attendance-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }} style={{ cursor: "pointer", background: "none", border: "none", color: "inherit", touchAction: "manipulation", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "6px", width: "100%", height: "100%" }}>
            <p className="stat-card-label" style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "rgba(255,255,255,0.5)", margin: 0, whiteSpace: "nowrap" }}>Active Subjects</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div className="stat-icon" style={{ background: "rgba(77, 182, 172, 0.2)", color: "#4DB6AC", margin: 0 }}>
                <i className="fas fa-calendar-check"></i>
              </div>
              <h4 style={{ fontSize: "16px", fontWeight: 800, margin: 0, lineHeight: 1 }}>{profile?.attendance?.length || 0}</h4>
            </div>
          </button>
          <button className="glass-panel stat-card"
            onClick={() => setShowNotificationsModal(true)}
            onTouchEnd={(e) => { e.preventDefault(); setShowNotificationsModal(true); }}
            style={{ cursor: "pointer", background: "none", border: "none", color: "inherit", touchAction: "manipulation", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: "6px", width: "100%", height: "100%" }}>
            <p className="stat-card-label" style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.3px", color: "rgba(255,255,255,0.5)", margin: 0, whiteSpace: "nowrap" }}>New Alerts</p>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div className="stat-icon" style={{ background: "rgba(121, 134, 203, 0.2)", color: "#7986CB", margin: 0 }}>
                <i className="fas fa-bell"></i>
              </div>
              <h4 style={{ fontSize: "16px", fontWeight: 800, margin: 0, lineHeight: 1 }}>{profile?.notifications?.length || 0}</h4>
            </div>
          </button>
        </div>

        {/* Notifications Card */}
        <div className="glass-panel notifications-panel">
          <div className="section-header">
            <h3><i className="fas fa-bolt" style={{ color: "#FF80AB" }}></i> Recent Notifications</h3>
          </div>
          <div className="notification-list">
            {profile.notifications && profile.notifications.length > 0 ? (
              profile.notifications.map((note: any, idx: number) => (
                <div key={idx} className="notification-item">
                  <div className="note-header">
                    <span className="note-by">{note.by}</span>
                    <span className="note-date">{note.datetime}</span>
                  </div>
                  {renderMessage(note.message)}
                </div>
              ))
            ) : (
              <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "20px" }}>No new notifications</p>
            )}
          </div>
        </div>

        {(() => {
          const parseDateString = (dateStr: string) => {
            const parts = dateStr.split('/');
            if (parts.length !== 3) return new Date(0);
            return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
          };

          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(today.getDate() - 7);
          oneWeekAgo.setHours(0, 0, 0, 0);

          const recentNotifs = profile.notifications?.filter((n: any) => {
            const notifDate = parseDateString(n.datetime);
            return notifDate >= oneWeekAgo && notifDate <= today;
          }) || [];

          if (recentNotifs.length === 0) return null;

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%", marginBottom: "15px" }}>
              {recentNotifs.map((notif: any, idx: number) => (
                <div key={idx} className="glass-panel today-notification-alert" onClick={() => setShowNotificationsModal(true)} style={{
                  background: "rgba(255, 64, 129, 0.12)",
                  border: "1px solid rgba(255, 64, 129, 0.3)",
                  borderRadius: "20px",
                  padding: "16px 18px",
                  boxSizing: "border-box",
                  width: "100%",
                  cursor: "pointer"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <i className="fas fa-triangle-exclamation" style={{ color: "#FF4081" }}></i>
                    <span style={{ fontSize: "11px", fontWeight: "800", textTransform: "uppercase", color: "#FF80AB", letterSpacing: "0.5px" }}>Alert ({notif.datetime})</span>
                  </div>
                  <p style={{ fontSize: "13px", lineHeight: "1.4", margin: 0, fontWeight: 500, color: "white" }}>{notif.message}</p>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Attendance Insights Section */}
        <div className="glass-panel attendance-insights-panel" id="attendance-section">
          <div className="section-header">
            <h3><i className="fas fa-chart-pie" style={{ color: "#4DB6AC" }}></i> Attendance Insights</h3>
          </div>
          {profile.attendance && profile.attendance.length > 0 && !profile.attendance[0].error ? (
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Classes</th>
                    <th>Percentage</th>
                    <th>Smart Insights</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.attendance.map((subject: any) => {
                    const pctVal = parseFloat(subject.percentage.replace("%", ""));
                    const isSafe = pctVal >= 75;

                    // SVG Progress Ring calculations
                    const radius = 16;
                    const strokeWidth = 3;
                    const circumference = 2 * Math.PI * radius;
                    const strokeDashoffset = circumference - (pctVal / 100) * circumference;

                    return (
                      <tr key={subject.sno}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{subject.name}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-dim)" }}>{subject.code}</div>
                        </td>
                        <td>{subject.hours_attended} / {subject.total_class}</td>
                        <td>
                          <div className="circular-progress-wrapper" style={{ width: "40px", height: "40px" }}>
                            <svg width="40" height="40" style={{ transform: "rotate(-90deg)" }}>
                              <circle
                                cx="20"
                                cy="20"
                                r={radius}
                                fill="transparent"
                                stroke="rgba(255, 255, 255, 0.05)"
                                strokeWidth={strokeWidth}
                              />
                              <circle
                                cx="20"
                                cy="20"
                                r={radius}
                                fill="transparent"
                                stroke={pctVal >= 80 ? "#4DB6AC" : "#FF4081"}
                                strokeWidth={strokeWidth}
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                strokeLinecap="round"
                                style={{ transition: "stroke-dashoffset 0.5s ease" }}
                              />
                            </svg>
                            <span className="circular-progress-text" style={{ fontSize: "9px" }}>{Math.round(pctVal)}%</span>
                          </div>
                        </td>
                        <td>
                          {(() => {
                            const attended = Number(subject.hours_attended);
                            const total = Number(subject.total_class);
                            const pct = (attended / total) * 100;
                            if (pct >= 80) {
                              const maxBunk = Math.floor(attended - 0.8 * total);
                              return maxBunk > 0 ? (
                                <span className="smart-tag tag-safe">Can Bunk {maxBunk}</span>
                              ) : (
                                <span className="smart-tag tag-safe">Safe Zone</span>
                              );
                            } else {
                              const needClasses = Math.ceil((0.8 * total - attended) / 0.2);
                              return (
                                <span className="smart-tag tag-danger">Need {needClasses}+ Classes</span>
                              );
                            }
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "20px" }}>No attendance data available</p>
          )}
        </div>

        {/* Course History Section with Grade Distribution circular analytics */}
        <div className="glass-panel completed-courses-panel" id="grade-section">
          <div className="section-header">
            <h3><i className="fas fa-award" style={{ color: "#7986CB" }}></i> Completed Courses & Grade Distribution</h3>
          </div>
          {profile.courses && profile.courses.length > 0 && !profile.courses[0].error ? (
              <div className="bunk-planner-grid">
                {/* Left Column: Courses Table */}
                <div className="table-container">
                  <table>
                    <thead>
                      <tr>
                        <th onClick={() => handleSort('code')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Code <span style={{ marginLeft: "4px" }}>
                            {sortConfig?.key === 'code' ? (sortConfig.direction === 'asc' ? <i className="fas fa-sort-up"></i> : <i className="fas fa-sort-down"></i>) : <i className="fas fa-sort" style={{ opacity: 0.3 }}></i>}
                          </span>
                        </th>
                        <th onClick={() => handleSort('course')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Course <span style={{ marginLeft: "4px" }}>
                            {sortConfig?.key === 'course' ? (sortConfig.direction === 'asc' ? <i className="fas fa-sort-up"></i> : <i className="fas fa-sort-down"></i>) : <i className="fas fa-sort" style={{ opacity: 0.3 }}></i>}
                          </span>
                        </th>
                        <th onClick={() => handleSort('grade')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Grade <span style={{ marginLeft: "4px" }}>
                            {sortConfig?.key === 'grade' ? (sortConfig.direction === 'asc' ? <i className="fas fa-sort-up"></i> : <i className="fas fa-sort-down"></i>) : <i className="fas fa-sort" style={{ opacity: 0.3 }}></i>}
                          </span>
                        </th>
                        <th>Session</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCourses.map((course: any, idx: number) => {
                        const uppercaseGrade = course.grade?.toUpperCase();
                        let badgeBg = "rgba(255, 255, 255, 0.1)";
                        let badgeShadow = "none";
                        if (uppercaseGrade === "S") { badgeBg = "linear-gradient(135deg, #d946ef, #a855f7)"; badgeShadow = "0 0 10px rgba(168, 85, 247, 0.5)"; }
                        else if (uppercaseGrade === "A") { badgeBg = "linear-gradient(135deg, #10b981, #059669)"; badgeShadow = "0 0 10px rgba(16, 185, 129, 0.5)"; }
                        else if (uppercaseGrade === "B") { badgeBg = "linear-gradient(135deg, #3b82f6, #2563eb)"; badgeShadow = "0 0 10px rgba(59, 130, 246, 0.5)"; }
                        else if (uppercaseGrade === "C") { badgeBg = "linear-gradient(135deg, #f59e0b, #d97706)"; badgeShadow = "0 0 10px rgba(245, 158, 11, 0.5)"; }
                        else if (uppercaseGrade === "D") { badgeBg = "linear-gradient(135deg, #f97316, #ea580c)"; badgeShadow = "0 0 10px rgba(249, 115, 22, 0.5)"; }
                        else if (uppercaseGrade === "E") { badgeBg = "linear-gradient(135deg, #ef4444, #dc2626)"; badgeShadow = "0 0 10px rgba(239, 68, 68, 0.5)"; }

                        return (
                          <tr key={course.sno}>
                            <td style={{ color: "var(--text-dim)", fontSize: "12px", textTransform: "uppercase" }}>{course.code}</td>
                            <td style={{ fontWeight: 600, color: "white" }}>{course.name}</td>
                            <td>
                              <div style={{
                                display: "flex",
                                width: "30px",
                                height: "30px",
                                borderRadius: "50%",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: "800",
                                fontSize: "13px",
                                color: "white",
                                background: badgeBg,
                                boxShadow: badgeShadow
                              }}>
                                {course.grade}
                              </div>
                            </td>
                            <td style={{ color: "var(--text-dim)" }}>{course.month_year}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Right Column: Unified Circular Doughnut Analytics of Grades */}
                <div className="grade-chart-container" style={{ borderLeft: "1px solid var(--border-glass)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "15px", justifyContent: "center" }}>
                  <div style={{
                    background: "rgba(0, 0, 0, 0.15)",
                    border: "1px solid rgba(255, 255, 255, 0.03)",
                    borderRadius: "24px",
                    padding: "25px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "25px",
                    width: "100%"
                  }}>
                    {/* Single Circular Doughnut Chart */}
                    <div className="circular-progress-wrapper" style={{ width: "110px", height: "110px", flexShrink: 0, position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <svg width="110" height="110" style={{ position: "absolute", top: 0, left: 0 }}>
                        {/* Base background track */}
                        <circle
                          cx="55"
                          cy="55"
                          r="45"
                          fill="transparent"
                          stroke="rgba(255, 255, 255, 0.05)"
                          strokeWidth="8"
                        />
                        {/* Segment paths */}
                        {doughnutSegments.map((seg: any, idx: number) => (
                          <circle
                            key={idx}
                            cx="55"
                            cy="55"
                            r="45"
                            fill="transparent"
                            stroke={seg.color}
                            strokeWidth="8"
                            strokeDasharray={`${seg.strokeLength} ${2 * Math.PI * 45}`}
                            transform={`rotate(${-90 + seg.angle} 55 55)`}
                            style={{ transition: "stroke-dashoffset 0.5s ease" }}
                          />
                        ))}
                      </svg>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 10 }}>
                        <span style={{ fontSize: "28px", fontWeight: "800", color: "white", lineHeight: 1 }}>{profile.courses.length}</span>
                        <span style={{ fontSize: "9px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>Courses</span>
                      </div>
                    </div>

                    {/* Legend Grid: Dynamic columns based on list length to balance height and avoid empty spaces */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: profile.courses.length > 5 ? "1fr" : "1fr 1fr",
                      gap: "10px 15px",
                      width: "100%",
                      maxWidth: profile.courses.length > 5 ? "280px" : "100%",
                      margin: "0 auto"
                    }}>
                      {["S", "A", "B", "C", "D", "E"].map((grade) => {
                        const count = gradeCounts[grade] || 0;
                        const pct = profile.courses.length > 0 ? Math.round((count / profile.courses.length) * 100) : 0;
                        
                        let labelColor = "#FF80AB";
                        if (grade === "S") labelColor = "#d946ef";
                        else if (grade === "A") labelColor = "#10b981";
                        else if (grade === "B") labelColor = "#3b82f6";
                        else if (grade === "C") labelColor = "#f59e0b";
                        else if (grade === "D") labelColor = "#f97316";
                        else if (grade === "E") labelColor = "#ef4444";

                        return (
                          <div key={grade} className="legend-item-pill" style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            borderRadius: "30px",
                            padding: "8px 16px",
                            justifyContent: "space-between",
                            opacity: count > 0 ? 1 : 0.4
                          }}>
                            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: labelColor, display: "inline-block", boxShadow: `0 0 8px ${labelColor}` }}></span>
                            <span className="legend-text-full" style={{ fontSize: "11px", fontWeight: "700", color: count > 0 ? "white" : "var(--text-dim)" }}>
                              <span className="legend-grade-label">{grade}</span>
                              <span className="legend-colon-separator">: </span>
                              <span className="legend-pct-val" style={{ color: labelColor }}>{pct}%</span>
                              <span className="legend-count-val" style={{ fontSize: "9px", color: "var(--text-dim)" }}> ({count})</span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
          ) : (
            <p style={{ textAlign: "center", color: "var(--text-dim)", padding: "20px" }}>No course history available</p>
          )}
        </div>
      </div>
    </div>

      {/* Mobile Bottom Navigation */}
      <div className="mobile-bottom-nav">
        <div className="mobile-nav-item active">
          <i className="fas fa-table-cells"></i>
          <span>Dashboard</span>
        </div>
        <div className="mobile-nav-item">
          <i className="fas fa-book-open"></i>
          <span>Courses</span>
        </div>
        <div className="mobile-nav-item">
          <i className="fas fa-calendar-days"></i>
          <span>Attendance</span>
        </div>
        <div className="mobile-nav-item">
          <i className="fas fa-chart-line"></i>
          <span>Analytics</span>
        </div>
        <div className="mobile-nav-item">
          <i className="fas fa-gear"></i>
          <span>Settings</span>
        </div>
      </div>

      {/* Notifications Modal — rendered via portal directly into document.body */}
      {mounted && showNotificationsModal && createPortal(
        <div className="notif-modal-overlay" onClick={() => setShowNotificationsModal(false)}>
          <div className="notif-modal-content" onClick={(e) => e.stopPropagation()} style={{ animation: "slideUpModal 0.35s cubic-bezier(0.16,1,0.3,1)" }}>
            <div className="notif-modal-header">
              <h3>Recent Notifications</h3>
              <button className="close-modal-btn" onClick={() => setShowNotificationsModal(false)}>×</button>
            </div>
            <div className="notif-modal-body" style={{ overflowY: "auto", maxHeight: "65vh", overscrollBehavior: "contain", paddingBottom: "20px" }}>
              {profile.notifications && profile.notifications.map((note: any, idx: number) => (
                <div key={idx} className="notif-modal-item">
                  <div className="notif-modal-item-header">
                    <span className="notif-modal-by">{note.by}</span>
                    <span className="notif-modal-date">{note.datetime}</span>
                  </div>
                  <p className="notif-modal-message">{note.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Profile Detail Modal — portal into document.body */}
      {mounted && showProfileModal && createPortal(
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 99999, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
          onClick={() => setShowProfileModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "rgba(13,18,30,0.97)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: "24px 24px 0 0",
              width: "100%",
              maxWidth: "480px",
              maxHeight: "85vh",
              overflowY: "auto",
              overscrollBehavior: "contain",
              transform: "translateY(0)",
              animation: "slideUpModal 0.3s cubic-bezier(0.16,1,0.3,1)"
            }}
          >
            {/* Drag handle */}
            <div style={{ display: "flex", justifyContent: "center", padding: "12px 0 4px" }}>
              <div style={{ width: "36px", height: "4px", background: "rgba(255,255,255,0.15)", borderRadius: "4px" }} />
            </div>

            {/* Profile header */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px", padding: "16px 24px 20px" }}>
              {profile.profilePictureUrl && !imgError ? (
                <img
                  src={`https://arms.sse.saveetha.com/Content/ProfilePicture/${profile.profilePictureUrl}`}
                  alt={profile.name}
                  style={{ width: "64px", height: "64px", borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,128,171,0.4)", flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "var(--primary-gradient)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 800, color: "white", flexShrink: 0 }}>
                  {profile.name?.[0]?.toUpperCase() ?? "S"}
                </div>
              )}
              <div>
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 800, color: "white" }}>{profile.name}</h3>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "rgba(255,255,255,0.5)", fontWeight: 600 }}>{profile.regno}</p>
              </div>
            </div>

            {/* Divider */}
            <div style={{ height: "1px", background: "rgba(255,255,255,0.06)", margin: "0 24px" }} />

            {/* Info rows */}
            {[
              { icon: "fa-graduation-cap", label: "Program",       value: profile.program },
              { icon: "fa-calendar-alt",   label: "Date of Birth", value: profile.dob },
              { icon: "fa-envelope",        label: "Email",         value: profile.email },
              { icon: "fa-phone",           label: "Mobile",        value: profile.mobile },
              { icon: "fa-chart-line",      label: "CGPA",          value: profile.cgpa },
            ].map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 24px", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <div style={{ width: "36px", height: "36px", borderRadius: "10px", background: "rgba(255,128,171,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <i className={`fas ${row.icon}`} style={{ color: "#FF80AB", fontSize: "14px" }}></i>
                </div>
                <div>
                  <p style={{ margin: 0, fontSize: "10px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.5px", fontWeight: 700 }}>{row.label}</p>
                  <p style={{ margin: "2px 0 0", fontSize: "14px", color: "white", fontWeight: 600 }}>{row.value}</p>
                </div>
              </div>
            ))}

            {/* Logout button */}
            <div style={{ padding: "20px 24px 0" }}>
              <button
                onClick={handleLogout}
                onTouchEnd={(e) => { e.preventDefault(); handleLogout(); }}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "linear-gradient(135deg, #FF4081, #FF80AB)",
                  border: "none",
                  borderRadius: "16px",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  touchAction: "manipulation",
                  boxShadow: "0 8px 20px rgba(255,64,129,0.35)"
                }}
              >
                <i className="fas fa-sign-out-alt"></i> Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
