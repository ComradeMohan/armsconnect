"use client";

import { useEffect, useState, Fragment } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [imgError, setImgError] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [loadingTimeout, setLoadingTimeout] = useState(false);
  const [expandedCourseSno, setExpandedCourseSno] = useState<string | null>(null);
  // courseMarks is intentionally empty at init — user-scoped marks are loaded
  // inside the profile useEffect after we know the regno.
  const [courseMarks, setCourseMarks] = useState<{
    [sno: string]: {
      loading: boolean;
      marks: any[] | null;
      error: string | null;
    }
  }>({});

  const parseMonthYearString = (my: string): Date => {
    const parts = my.split('-');
    if (parts.length !== 2) return new Date(0);
    const monthName = parts[0].toLowerCase();
    const year = parseInt(parts[1], 10);
    const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
    const monthIndex = monthNames.findIndex(m => monthName.startsWith(m));
    if (monthIndex === -1) return new Date(0);
    return new Date(year, monthIndex, 1);
  };

  const loadMarksForCourse = async (course: any) => {
    if (!profile || !profile.sessionId) return;
    
    // If already loading or loaded, do not fetch again
    if (courseMarks[course.sno]?.loading || courseMarks[course.sno]?.marks) return;

    setCourseMarks(prev => ({
      ...prev,
      [course.sno]: { loading: true, marks: null, error: null }
    }));

    try {
      const res = await fetch("/api/profile/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: profile.regno,
          sessionId: profile.sessionId,
          courseCode: course.code,
          monthYear: course.month_year
        })
      });

      const data = await res.json();
      if (res.status === 200 && data.success) {
        setCourseMarks(prev => ({
          ...prev,
          [course.sno]: { loading: false, marks: data.marks, error: null }
        }));
      } else {
        setCourseMarks(prev => ({
          ...prev,
          [course.sno]: { loading: false, marks: null, error: data.error || "Failed to load marks" }
        }));
      }
    } catch (err: any) {
      setCourseMarks(prev => ({
        ...prev,
        [course.sno]: { loading: false, marks: null, error: err.message || "Failed to load marks" }
      }));
    }
  };

  const getCourseMarksDetails = (course: any) => {
    const state = courseMarks[course.sno];
    return {
      loading: state?.loading ?? false,
      marks: state?.marks ?? course.marks ?? null,
      error: state?.error ?? course.marksError ?? null
    };
  };

  // Progressive background loading
  useEffect(() => {
    if (!profile || (!profile.courses && !profile.failedCourses)) return;

    const allCourses = [...(profile.courses || []), ...(profile.failedCourses || [])];

    const loadAllProgressively = async () => {
      // Avoid auto-fetching on mount if we already have marks loaded from cache.
      // This preserves permanently saved data and prevents dead session timeouts.
      const cachedKeys = Object.keys(courseMarks);
      const hasAnyCachedMarks = cachedKeys.some(key => courseMarks[key]?.marks);
      if (hasAnyCachedMarks) {
        return;
      }

      const coursesToFetch = allCourses.filter(c => {
        const cached = courseMarks[c.sno];
        return !cached || (!cached.marks && !cached.error);
      });

      if (coursesToFetch.length === 0) return;

      // Set loading: true for all courses to show they are in progress
      setCourseMarks(prev => {
        const next = { ...prev };
        coursesToFetch.forEach(c => {
          next[c.sno] = { loading: true, marks: null, error: null };
        });
        return next;
      });

      try {
        const res = await fetch("/api/profile/marks", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username: profile.regno,
            sessionId: profile.sessionId,
            courses: coursesToFetch.map(c => ({
              sno: c.sno,
              courseCode: c.code,
              monthYear: c.month_year
            }))
          })
        });

        if (res.status !== 200) {
          throw new Error(`Server returned status ${res.status}`);
        }

        if (!res.body) throw new Error("No stream body");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          
          // Normalize line endings to \n and split by double newline
          const normalized = buffer.replace(/\r\n/g, "\n");
          const lines = normalized.split("\n\n");
          buffer = lines.pop() || "";

          for (const chunk of lines) {
            // Find all lines starting with data: in the chunk
            const dataLines = chunk.split("\n").filter(l => l.startsWith("data:"));
            for (const dataLine of dataLines) {
              try {
                const json = JSON.parse(dataLine.slice(5).trim());
                if (json.sno) {
                  setCourseMarks(prev => ({
                    ...prev,
                    [json.sno]: {
                      loading: false,
                      marks: json.marks,
                      error: json.error
                    }
                  }));
                }
              } catch (e) {
                console.error("Failed to parse stream chunk:", e);
              }
            }
          }
        }
      } catch (err: any) {
        console.error("Progressive marks load error:", err);
        setCourseMarks(prev => {
          const next = { ...prev };
          coursesToFetch.forEach(c => {
            if (next[c.sno]?.loading) {
              next[c.sno] = { loading: false, marks: null, error: err.message || "Failed to load marks" };
            }
          });
          return next;
        });
      }

      setToastMessage("All marks fetched successfully!");
      setTimeout(() => {
        setToastMessage(null);
      }, 3500);
    };

    loadAllProgressively();
  }, [profile]);


  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    const timer = setTimeout(() => {
      const dismissed = sessionStorage.getItem("pwa_install_dismissed");
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone || document.referrer.includes('android-app://');
      if (!dismissed && !isStandalone) {
        setShowInstallBanner(true);
      }
    }, 10000); // 10 seconds

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      clearTimeout(timer);
    };
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`PWA install prompt outcome: ${outcome}`);
      setDeferredPrompt(null);
      setShowInstallBanner(false);
    } else {
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
      if (isIOS) {
        alert("To install, tap the Share icon at the bottom of Safari and select 'Add to Home Screen'.");
      } else {
        alert("PWA installation is not supported by your current browser. You can install it from your browser menu or use Chrome.");
      }
      setShowInstallBanner(false);
      sessionStorage.setItem("pwa_install_dismissed", "true");
    }
  };

  const handleDismissInstall = () => {
    setShowInstallBanner(false);
    sessionStorage.setItem("pwa_install_dismissed", "true");
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__PROFILE_DATA__ = profile;
      (window as any).__COURSE_MARKS__ = courseMarks;
    }
  }, [profile, courseMarks]);

  // Persist marks to a user-scoped key so different accounts never share cached marks.
  useEffect(() => {
    if (typeof window !== "undefined" && profile?.regno && Object.keys(courseMarks).length > 0) {
      try {
        const toSave: any = {};
        for (const key of Object.keys(courseMarks)) {
          if (courseMarks[key].marks) {
            toSave[key] = courseMarks[key];
          }
        }
        if (Object.keys(toSave).length > 0) {
          localStorage.setItem(`saveetha_course_marks_${profile.regno}`, JSON.stringify(toSave));
        }
      } catch (e) {
        console.warn("Failed to save course marks to localStorage:", e);
      }
    }
  }, [courseMarks, profile?.regno]);

  // Loading timeout detection
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!profile) {
        setLoadingTimeout(true);
      }
    }, 3000); // 3 seconds

    return () => clearTimeout(timeout);
  }, [profile]);

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
        const parsedProfile = JSON.parse(stored);
        setProfile(parsedProfile);

        // Load marks scoped to THIS user only — prevents cross-account contamination.
        // Old unscoped key (saveetha_course_marks) is intentionally ignored.
        try {
          const marksKey = `saveetha_course_marks_${parsedProfile.regno}`;
          const savedMarks = localStorage.getItem(marksKey);
          if (savedMarks) {
            const parsed = JSON.parse(savedMarks);
            const clean: any = {};
            for (const key of Object.keys(parsed)) {
              clean[key] = { ...parsed[key], loading: false };
            }
            setCourseMarks(clean);
          }
        } catch (e) {
          console.warn("Failed to load cached course marks:", e);
        }
      }
    }
  }, [router]);

  const handleDownloadHTML = () => {
    if (!profile) return;

    const regNo = profile.regno || "student";
    const name = profile.name || "Student Dashboard";
    const creditsEarned = (profile.courses || []).reduce((sum: number, c: any) => sum + (c.credits || 0), 0);

    // 1. Pre-render Attendance Section
    const attendanceHtml = (profile.attendance && profile.attendance.length > 0 && !profile.attendance[0].error)
      ? `
        <div class="glass-panel">
            <div class="section-header">
                <h3><i class="fas fa-chart-pie" style="color: #4DB6AC;"></i> Attendance Insights</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Subject</th>
                            <th>Classes</th>
                            <th>Percentage</th>
                            <th>Insights</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${profile.attendance.map((sub: any) => {
                            const pctVal = parseFloat(sub.percentage.replace("%", "")) || 0;
                            const targetRatio = 0.8;
                            const attended = Number(sub.hours_attended) || 0;
                            const total = Number(sub.total_class) || 0;
                            let tag = '';
                            if (pctVal >= 80) {
                              const maxBunk = Math.floor((attended - targetRatio * total) / targetRatio);
                              tag = maxBunk > 0 ? `<span class="smart-tag tag-safe">Can Bunk ${maxBunk}</span>` : `<span class="smart-tag tag-safe">Safe Zone</span>`;
                            } else {
                              const needClasses = Math.ceil((targetRatio * total - attended) / (1 - targetRatio));
                              tag = `<span class="smart-tag tag-danger">Need ${needClasses}+ Classes</span>`;
                            }
                            return `
                            <tr>
                                <td>
                                    <div style="font-weight: 600;">${sub.name}</div>
                                    <div style="font-size: 11px; color: var(--text-dim);">${sub.code}</div>
                                </td>
                                <td>${sub.hours_attended} / ${sub.total_class}</td>
                                <td>
                                    <div class="circular-progress" style="--progress: ${pctVal}%">
                                        <span class="circular-progress-text">${Math.round(pctVal)}%</span>
                                    </div>
                                </td>
                                <td>${tag}</td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
      `
      : '';

    // 2. Pre-render Completed Courses Section
    const completedCoursesHtml = (profile.courses || []).map((course: any) => {
      const uppercaseGrade = (course.grade || '').toUpperCase();
      let badgeBg = "rgba(255, 255, 255, 0.1)";
      if (uppercaseGrade === "S") badgeBg = "linear-gradient(135deg, #d946ef, #a855f7)";
      else if (uppercaseGrade === "A") badgeBg = "linear-gradient(135deg, #10b981, #059669)";
      else if (uppercaseGrade === "B") badgeBg = "linear-gradient(135deg, #3b82f6, #2563eb)";
      else if (uppercaseGrade === "C") badgeBg = "linear-gradient(135deg, #f59e0b, #d97706)";
      else if (uppercaseGrade === "D") badgeBg = "linear-gradient(135deg, #f97316, #ea580c)";
      else if (uppercaseGrade === "E") badgeBg = "linear-gradient(135deg, #ef4444, #dc2626)";

      const marksData = courseMarks[course.sno];
      let marksHtml = '';
      let totalObtained = 0;
      let hasMarks = false;

      if (marksData && marksData.marks && marksData.marks.length > 0) {
        hasMarks = true;
        const targetCategories = [
          "Class Test (IA)",
          "Research",
          "Class Practical",
          "University Theory",
          "University Practical"
        ];
        
        marksHtml = `<div class="marks-grid">`;
        targetCategories.forEach(cat => {
          const found = (marksData.marks || []).find((m: any) => m.RubricCategory === cat);
          if (found) {
            const mark = parseFloat(found.OrginalConvertedMark) || 0;
            totalObtained += mark;
            marksHtml += `
              <div class="mark-card">
                  <div class="mark-card-title">${cat}</div>
                  <div class="mark-card-value">${found.OrginalConvertedMark}</div>
              </div>
            `;
          }
        });
        marksHtml += `</div>`;
      } else {
        marksHtml = `<div style="color: var(--text-dim); font-size: 12px; padding: 10px 0;"><i class="fas fa-info-circle"></i> Marks detail not loaded during export.</div>`;
      }

      return `
      <tr class="course-row" onclick="toggleDetails('${course.sno}')">
          <td>
              <strong style="color: white; text-transform: uppercase;">${course.code}</strong>
          </td>
          <td>
              <div style="font-weight: 500;">${course.name}</div>
              ${hasMarks ? `<div style="margin-top: 4px;"><span class="score-pill">Total: ${totalObtained.toFixed(1)}/500</span></div>` : ''}
          </td>
          <td>
              <span class="grade-badge" style="background: ${badgeBg};">${course.grade || '-'}</span>
          </td>
          <td>${course.month_year || '-'}</td>
      </tr>
      <tr class="expanded-row" id="details-${course.sno}">
          <td colspan="4">
              <div style="font-weight: 700; font-size: 12px; color: #FF80AB; text-transform: uppercase; margin-bottom: 8px;">Detailed Rubric Breakdown</div>
              ${marksHtml}
          </td>
      </tr>
      `;
    }).join('');

    // 3. Pre-render Failed Courses Section
    const failedCoursesHtml = (profile.failedCourses && profile.failedCourses.length > 0)
      ? `
        <div class="glass-panel" style="border: 1px solid rgba(239, 68, 68, 0.2);">
            <div class="section-header">
                <h3><i class="fas fa-triangle-exclamation" style="color: #ef4444;"></i> Failed Subjects</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Course Name</th>
                            <th>Grade</th>
                            <th>Session</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${profile.failedCourses.map((course: any) => {
                            const marksData = courseMarks[course.sno];
                            let marksHtml = '';
                            let hasMarks = false;
                            let totalObtained = 0;

                            if (marksData && marksData.marks && marksData.marks.length > 0) {
                              hasMarks = true;
                              const targetCategories = [
                                "Class Test (IA)",
                                "Research",
                                "Class Practical",
                                "University Theory",
                                "University Practical"
                              ];
                              marksHtml = `<div class="marks-grid">`;
                              targetCategories.forEach(cat => {
                                const found = (marksData.marks || []).find((m: any) => m.RubricCategory === cat);
                                if (found) {
                                  const mark = parseFloat(found.OrginalConvertedMark) || 0;
                                  totalObtained += mark;
                                  marksHtml += `
                                    <div class="mark-card">
                                        <div class="mark-card-title">${cat}</div>
                                        <div class="mark-card-value">${found.OrginalConvertedMark}</div>
                                    </div>
                                  `;
                                }
                              });
                              marksHtml += `</div>`;
                            } else {
                              marksHtml = `<div style="color: var(--text-dim); font-size: 12px; padding: 10px 0;"><i class="fas fa-info-circle"></i> Marks detail not loaded during export.</div>`;
                            }

                            return `
                            <tr class="course-row" onclick="toggleDetails('failed-${course.sno}')">
                                <td><strong style="color: #ef4444;">${course.code}</strong></td>
                                <td>
                                    <div style="font-weight: 500;">${course.name}</div>
                                    ${hasMarks ? `<div style="margin-top: 4px;"><span class="score-pill">Total: ${totalObtained.toFixed(1)}/500</span></div>` : ''}
                                </td>
                                <td><span class="grade-badge" style="background: linear-gradient(135deg, #ef4444, #991b1b);">${course.grade || 'F'}</span></td>
                                <td>${course.month_year || '-'}</td>
                            </tr>
                            <tr class="expanded-row" id="details-failed-${course.sno}">
                                <td colspan="4">
                                    <div style="font-weight: 700; font-size: 12px; color: #ef4444; text-transform: uppercase; margin-bottom: 8px;">Detailed Rubric Breakdown</div>
                                    ${marksHtml}
                                </td>
                            </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
      `
      : '';

    // 4. Construct Final HTML Content
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ARMS Academic Report - ${name} (${regNo})</title>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" />
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" />
    <style>
        :root {
            --primary-gradient: linear-gradient(135deg, #FF80AB, #FF4081);
            --secondary-gradient: linear-gradient(135deg, #7986CB, #3F51B5);
            --success-gradient: linear-gradient(135deg, #4DB6AC, #009688);
            --dark-glass: rgba(0, 0, 0, 0.4);
            --light-glass: rgba(255, 255, 255, 0.05);
            --border-glass: rgba(255, 255, 255, 0.1);
            --text-main: #FFFFFF;
            --text-dim: rgba(255, 255, 255, 0.7);
        }
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
        }
        body {
            background: #090d16;
            min-height: 100vh;
            color: var(--text-main);
            padding: 24px;
            display: flex;
            flex-direction: column;
            align-items: center;
        }
        .container {
            width: 100%;
            max-width: 900px;
            display: flex;
            flex-direction: column;
            gap: 24px;
        }
        .header-panel {
            background: var(--dark-glass);
            border: 1px solid var(--border-glass);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            padding: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 16px;
        }
        .profile-info {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: var(--primary-gradient);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 800;
            color: white;
            box-shadow: 0 4px 15px rgba(255, 64, 129, 0.3);
        }
        .name-reg {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }
        .name-reg h1 {
            font-size: 20px;
            font-weight: 800;
        }
        .name-reg p {
            font-size: 13px;
            color: var(--text-dim);
        }
        .stats-badge-grid {
            display: flex;
            gap: 12px;
        }
        .stat-badge {
            background: var(--light-glass);
            border: 1px solid var(--border-glass);
            border-radius: 16px;
            padding: 12px 18px;
            text-align: center;
        }
        .stat-badge span {
            display: block;
            font-size: 10px;
            color: var(--text-dim);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 2px;
        }
        .stat-badge strong {
            font-size: 16px;
            color: #FF80AB;
        }
        .glass-panel {
            background: var(--dark-glass);
            border: 1px solid var(--border-glass);
            backdrop-filter: blur(20px);
            border-radius: 24px;
            overflow: hidden;
        }
        .section-header {
            padding: 20px 24px 15px;
            border-bottom: 1px solid var(--border-glass);
        }
        .section-header h3 {
            font-size: 16px;
            font-weight: 700;
            display: flex;
            align-items: center;
            gap: 10px;
        }
        .table-container {
            width: 100%;
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }
        th, td {
            padding: 14px 24px;
            border-bottom: 1px solid rgba(255,255,255,0.03);
            font-size: 13px;
        }
        th {
            font-weight: 700;
            color: var(--text-dim);
            text-transform: uppercase;
            font-size: 11px;
            letter-spacing: 0.5px;
        }
        .grade-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 32px;
            height: 32px;
            border-radius: 50%;
            font-size: 13px;
            font-weight: 800;
            color: white;
        }
        .course-row {
            cursor: pointer;
            transition: background 0.2s;
        }
        .expanded-row {
            display: none;
            background: rgba(0, 0, 0, 0.15);
        }
        .expanded-row td {
            padding: 16px 24px;
        }
        .marks-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 12px;
            padding: 10px 0;
        }
        .mark-card {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 12px;
            padding: 10px 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 12px;
        }
        .mark-card-title {
            font-size: 10px;
            color: var(--text-dim);
            text-transform: uppercase;
            font-weight: 500;
        }
        .mark-card-value {
            font-size: 13px;
            font-weight: 700;
            color: #FF80AB;
        }
        .score-pill {
            background: rgba(255,255,255,0.05);
            border: 1px solid rgba(255,255,255,0.1);
            border-radius: 12px;
            padding: 4px 10px;
            font-size: 11px;
            font-weight: 700;
            color: var(--text-dim);
        }
        .footer {
            text-align: center;
            font-size: 11px;
            color: var(--text-dim);
            margin-top: 24px;
            padding-bottom: 24px;
        }
        .smart-tag {
            padding: 4px 10px;
            border-radius: 12px;
            font-size: 10px;
            font-weight: 700;
            display: inline-block;
        }
        .tag-safe {
            background: rgba(77, 182, 172, 0.15);
            color: #4DB6AC;
            border: 1px solid rgba(77, 182, 172, 0.25);
        }
        .tag-danger {
            background: rgba(255, 64, 129, 0.15);
            color: #FF4081;
            border: 1px solid rgba(255, 64, 129, 0.25);
        }
        .circular-progress {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: conic-gradient(#4DB6AC var(--progress), rgba(255,255,255,0.05) 0);
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
        }
        .circular-progress::after {
            content: '';
            position: absolute;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: #090d16;
        }
        .circular-progress-text {
            font-size: 9px;
            font-weight: 700;
            color: white;
            z-index: 1;
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header-panel">
            <div class="profile-info">
                <div class="avatar">${name.charAt(0)}</div>
                <div class="name-reg">
                    <h1>${name}</h1>
                    <p><i class="fas fa-id-card"></i> Reg No: ${regNo} | ${profile.program || 'Student'}</p>
                </div>
            </div>
            <div class="stats-badge-grid">
                <div class="stat-badge">
                    <span>CGPA</span>
                    <strong>${profile.cgpa || '0.00'}</strong>
                </div>
                <div class="stat-badge">
                    <span>Credits</span>
                    <strong>${creditsEarned}</strong>
                </div>
            </div>
        </div>

        <!-- Attendance -->
        ${attendanceHtml}

        <!-- Completed Courses -->
        <div class="glass-panel">
            <div class="section-header">
                <h3><i class="fas fa-award" style="color: #7986CB;"></i> Completed Courses</h3>
            </div>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Code</th>
                            <th>Course Name</th>
                            <th>Grade</th>
                            <th>Session</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${completedCoursesHtml}
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Failed Courses (Arrears) -->
        ${failedCoursesHtml}

        <div class="footer">
            <p>Generated by ARMS Connect on ${new Date().toLocaleDateString()}</p>
            <p style="margin-top: 4px; color: rgba(255,255,255,0.3)">Offline Access Enabled. Keep this file to view your dashboard anytime without login.</p>
        </div>
    </div>

    <script>
        function toggleDetails(sno) {
            const row = document.getElementById('details-' + sno);
            if (row) {
                const current = row.style.display;
                if (current === 'table-row') {
                    row.style.display = 'none';
                } else {
                    row.style.display = 'table-row';
                }
            }
        }
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arms_academic_report_${regNo}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleLogout = () => {
    const regno = profile?.regno;
    sessionStorage.removeItem("profile");
    localStorage.removeItem("profile");
    localStorage.removeItem("saved_username");
    localStorage.removeItem("saved_password");
    // Remove user-scoped marks for this account
    if (regno) {
      localStorage.removeItem(`saveetha_course_marks_${regno}`);
    }
    // Also clean up any legacy unscoped key left from older versions
    localStorage.removeItem("saveetha_course_marks");
    router.push("/");
  };

  const handleClearCache = () => {
    sessionStorage.clear();
    localStorage.clear();
    router.push("/");
  };

  const handleSync = async () => {
    const savedUser = localStorage.getItem("saved_username");
    const savedPass = localStorage.getItem("saved_password");
    if (!savedUser || !savedPass) {
      alert("No saved credentials found. Please logout and check 'Keep me logged in' to enable sync.");
      return;
    }
    
    setIsSyncing(true);
    try {
      // Clear user-scoped course marks from localStorage so they are re-fetched fresh on sync/reload
      if (profile?.regno) {
        localStorage.removeItem(`saveetha_course_marks_${profile.regno}`);
      }
      // Also clear legacy cache
      localStorage.removeItem("saveetha_course_marks");

      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: savedUser, password: savedPass })
      });
      const data = await res.json();
      if (res.status === 200) {
        sessionStorage.setItem("profile", JSON.stringify(data));
        localStorage.setItem("profile", JSON.stringify(data));
        window.location.reload();
      } else {
        alert("Sync failed: " + (data.error || "Unknown error"));
      }
    } catch (e) {
      alert("Network error during sync.");
    }
    setIsSyncing(false);
  };

  const toggleCourseVersion = (originalSno: string) => {
    if (!profile || !profile.courses) return;

    const updatedCourses = profile.courses.map((c: any) => {
      if (c.sno === originalSno && c.allVersions && c.allVersions.length > 1) {
        const nextIndex = (c.selectedVersionIndex + 1) % c.allVersions.length;
        const nextV = c.allVersions[nextIndex];
        return {
          ...c,
          selectedVersionIndex: nextIndex,
          grade: nextV.grade,
          month_year: nextV.month_year,
          status: nextV.status,
        };
      }
      return c;
    });

    // Recalculate CGPA
    const gradePoints: any = {
      'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5,
      'O': 10, 'A+': 9, 'B+': 7
    };
    let totalPoints = 0;
    let totalCredits = 0;
    updatedCourses.forEach((c: any) => {
      const grade = c.grade?.toUpperCase();
      const code = c.code?.toUpperCase();
      if (gradePoints[grade] !== undefined && code !== 'SPIC1') {
        totalPoints += (gradePoints[grade] * c.credits);
        totalCredits += c.credits;
      }
    });

    const newCgpa = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(3)) : 'N/A';

    setProfile({
      ...profile,
      courses: updatedCourses,
      cgpa: newCgpa
    });
  };

  // Grade Distribution logic
  const getGradeDistribution = () => {
    const counts: any = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0 };
    if (profile?.courses) {
      profile.courses.forEach((c: any) => {
        const grade = c.grade?.toUpperCase();
        if (counts[grade] !== undefined && c.code?.toUpperCase() !== 'SPIC1') {
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
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "20px" }}>
        <div>
          <div className="spinner"></div>
          <p style={{ color: "var(--text-dim)", textAlign: "center", marginTop: "20px" }}>Loading Dashboard...</p>
        </div>
        {loadingTimeout && (
          <button
            onClick={handleClearCache}
            style={{
              background: "linear-gradient(135deg, #FF4081, #FF80AB)",
              border: "none",
              borderRadius: "12px",
              color: "white",
              padding: "12px 24px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 4px 12px rgba(255, 64, 129, 0.3)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 64, 129, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 64, 129, 0.3)';
            }}
          >
            <i className="fas fa-trash-alt" style={{ marginRight: "8px" }}></i>
            Clear Cache & Login
          </button>
        )}
      </div>
    );
  }

  // Linkify helper for notifications
  const renderMessage = (text: string) => {
    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const urls = text.match(urlPattern);

    return (
      <>
        <p className="note-msg" style={{ marginBottom: "8px", wordBreak: "break-word" }}>{text}</p>
        {urls && urls.map((url, i) => (
          <button 
            key={i} 
            onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
            className="notif-link-btn"
            style={{
              background: "linear-gradient(135deg, #FF4081, #FF80AB)",
              border: "none",
              borderRadius: "10px",
              color: "white",
              padding: "10px 16px",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              width: "fit-content",
              marginTop: "5px",
              boxShadow: "0 4px 12px rgba(255, 64, 129, 0.3)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(255, 64, 129, 0.4)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(255, 64, 129, 0.3)';
            }}
          >
            <i className="fas fa-external-link-alt"></i> Open Link
          </button>
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
              className="profile-photo-wrapper desktop-profile-wrapper"
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
              </div>
            </div>
          ) : (
            <div
              className="avatar-fallback-wrapper desktop-avatar-wrapper"
              onClick={() => setShowProfileModal(true)}
              onTouchEnd={(e) => { e.preventDefault(); setShowProfileModal(true); }}
              style={{ width: "100%", height: "200px", background: "var(--primary-gradient)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", cursor: "pointer" }}
            >
              <div className="avatar-large" style={{ transform: "none", marginBottom: "10px", width: "60px", height: "60px", fontSize: "24px" }}>
                {profile.name ? profile.name[0].toUpperCase() : "S"}
              </div>
              <h2 style={{ fontSize: "18px", fontWeight: "700", margin: 0, color: "white", textAlign: "center" }}>{profile.name}</h2>
              <p style={{ color: "rgba(255, 255, 255, 0.8)", fontSize: "12px", margin: "4px 0 0 0", fontWeight: "600", textAlign: "center" }}>{profile.regno}</p>
            </div>
          )}

          <div style={{ padding: "20px 25px 25px 25px" }}>

            <div className="info-list" style={{ marginTop: "0" }}>
              <div className="info-item">
                <i className="fas fa-graduation-cap"></i>
                <div className="info-content" style={{ gap: "2px" }}>
                  <label>Program</label>
                  <span>{profile.program}</span>
                </div>
              </div>
              <div className="info-item">
                <i className="fas fa-calendar-alt"></i>
                <div className="info-content" style={{ gap: "2px" }}>
                  <label>Date of Birth</label>
                  <span>{profile.dob}</span>
                </div>
              </div>
              <div className="info-item">
                <i className="fas fa-envelope"></i>
                <div className="info-content" style={{ gap: "2px" }}>
                  <label>Email</label>
                  <span style={{ fontSize: "11px" }}>{profile.email}</span>
                </div>
              </div>
              <div className="info-item">
                <i className="fas fa-phone"></i>
                <div className="info-content" style={{ gap: "2px" }}>
                  <label>Mobile</label>
                  <span>{profile.mobile}</span>
                </div>
              </div>
              <div className="info-item" style={{ background: "rgba(255, 64, 129, 0.1)", margin: "10px -10px", padding: "15px 10px", borderRadius: "15px", border: "1px solid rgba(255, 64, 129, 0.2)" }}>
                <i className="fas fa-chart-line" style={{ color: "#FF4081", background: "rgba(255, 64, 129, 0.2)" }}></i>
                <div className="info-content" style={{ display: 'flex', flexDirection: 'row', gap: 0, justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div>
                    <label style={{ color: "#FF80AB", fontWeight: 700 }}>Current CGPA</label>
                    <span style={{ fontSize: "20px", fontWeight: 800, color: "white" }}>{profile.cgpa}</span>
                  </div>
                  <div className="desktop-only-credits" style={{ textAlign: "right" }}>
                    <label style={{ color: "rgba(255,255,255,0.6)", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Credits Earned</label>
                    <span style={{ fontSize: "16px", fontWeight: 800, color: "white", display: "block" }}>
                      {profile.courses?.reduce((sum: number, c: any) => sum + (c.credits || 0), 0) || 0}
                    </span>
                  </div>
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
            <button onClick={handleDownloadHTML} style={{
              width: "auto",
              margin: 0,
              padding: "10px 18px",
              borderRadius: "15px",
              fontSize: "14px",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              whiteSpace: "nowrap",
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.1)",
              color: "white",
              cursor: "pointer",
              transition: "background 0.2s"
            }}>
              <i className="fas fa-file-download" style={{ color: "#4DB6AC" }}></i> Save Offline Report
            </button>
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
        {profile.attendance && profile.attendance.length > 0 && !profile.attendance[0].error && (
          <div className="glass-panel attendance-insights-panel" id="attendance-section">
            <div className="section-header">
              <h3><i className="fas fa-chart-pie" style={{ color: "#4DB6AC" }}></i> Attendance Insights</h3>
            </div>
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
                    const targetRatio = 0.8;

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
                              const maxBunk = Math.floor((attended - targetRatio * total) / targetRatio);
                              return maxBunk > 0 ? (
                                <span className="smart-tag tag-safe">Can Bunk {maxBunk}</span>
                              ) : (
                                <span className="smart-tag tag-safe">Safe Zone</span>
                              );
                            } else {
                              const needClasses = Math.ceil((targetRatio * total - attended) / (1 - targetRatio));
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
          </div>
        )}

        {/* Failed Subjects (Arrears) Section */}
        {profile.failedCourses && profile.failedCourses.length > 0 && (
          <div className="glass-panel completed-courses-panel" id="arrears-section" style={{ border: "1px solid rgba(239, 68, 68, 0.25)", marginBottom: "20px" }}>
            <div className="section-header">
              <h3><i className="fas fa-triangle-exclamation" style={{ color: "#ef4444" }}></i> Failed Subjects (Arrears)</h3>
            </div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Course Name</th>
                    <th>Grade</th>
                    <th>Session</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.failedCourses.map((course: any) => {
                    const isExpanded = expandedCourseSno === course.sno;
                    const { loading, marks, error } = getCourseMarksDetails(course);
                    
                    const targetCategories = [
                      "Class Test (IA)",
                      "Research",
                      "Class Practical",
                      "University Theory",
                      "University Practical"
                    ];

                    let totalObtained = 0;
                    let hasTargetMarks = false;

                    if (marks && Array.isArray(marks)) {
                      marks.forEach((m: any) => {
                        const category = m.RubricCategory ? m.RubricCategory.trim() : "";
                        if (targetCategories.includes(category)) {
                          const val = parseFloat(m.OrginalConvertedMark);
                          if (!isNaN(val)) {
                            totalObtained += val;
                            hasTargetMarks = true;
                          }
                        }
                      });
                    }
                    totalObtained = Math.round(totalObtained * 100) / 100;

                    return (
                      <Fragment key={course.sno}>
                        <tr className={isExpanded ? "expanded-row-parent" : ""} style={{ transition: "background 0.2s" }}>
                          <td 
                            onClick={() => {
                              setExpandedCourseSno(isExpanded ? null : course.sno);
                              if (!isExpanded) {
                                loadMarksForCourse(course);
                              }
                            }}
                            style={{ color: "var(--text-dim)", fontSize: "12px", textTransform: "uppercase", cursor: "pointer", userSelect: "none" }}
                          >
                            <i 
                              className="fas fa-chevron-right" 
                              style={{ 
                                marginRight: "8px", 
                                transition: "transform 0.2s ease", 
                                transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                color: "#ef4444"
                              }}
                            />
                            {course.code}
                          </td>
                          <td style={{ fontWeight: 600, color: "white" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span>{course.name}</span>
                              {loading ? (
                                <i className="fas fa-spinner fa-spin mobile-only-score-pill" style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}></i>
                              ) : hasTargetMarks ? (
                                <span className="mobile-only-score-pill" style={{ 
                                  fontSize: "10px", 
                                  fontWeight: "800", 
                                  color: "#ef4444", 
                                  background: "rgba(239, 68, 68, 0.08)",
                                  border: "1px solid rgba(239, 68, 68, 0.15)",
                                  padding: "2px 6px",
                                  borderRadius: "8px",
                                  whiteSpace: "nowrap"
                                }}>
                                  {totalObtained}/500
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                                background: "linear-gradient(135deg, #ef4444, #dc2626)",
                                boxShadow: "0 0 10px rgba(239, 68, 68, 0.5)",
                                flexShrink: 0
                              }}>
                                {course.grade}
                              </div>
                              {loading ? (
                                <i className="fas fa-spinner fa-spin desktop-only-score-pill" style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}></i>
                              ) : hasTargetMarks ? (
                                <span className="desktop-only-score-pill" style={{ 
                                  fontSize: "11px", 
                                  fontWeight: "800", 
                                  color: "#ef4444", 
                                  background: "rgba(239, 68, 68, 0.08)",
                                  border: "1px solid rgba(239, 68, 68, 0.15)",
                                  padding: "3px 8px",
                                  borderRadius: "10px",
                                  whiteSpace: "nowrap"
                                }}>
                                  {totalObtained}/500
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td style={{ color: "var(--text-dim)" }}>{course.month_year}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="expanded-row-details" style={{ background: "rgba(0, 0, 0, 0.25)" }}>
                            <td colSpan={4} style={{ padding: "20px 24px" }} onClick={(e) => e.stopPropagation()}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px" }}>
                                  <span style={{ fontSize: "12px", fontWeight: "800", color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                                    <i className="fas fa-chart-bar" style={{ marginRight: "6px" }}></i>
                                    Detailed Score Card (Arrear)
                                  </span>
                                  {hasTargetMarks && (
                                    <span style={{ 
                                      background: "linear-gradient(135deg, #ef4444, #dc2626)", 
                                      padding: "4px 12px", 
                                      borderRadius: "30px", 
                                      fontSize: "12px", 
                                      fontWeight: "800", 
                                      color: "white",
                                      boxShadow: "0 4px 12px rgba(239, 68, 68, 0.3)"
                                    }}>
                                      Total Obtained: {totalObtained} / 500
                                    </span>
                                  )}
                                </div>

                                {loading ? (
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "15px 0", color: "var(--text-dim)", fontSize: "13px" }}>
                                    <i className="fas fa-spinner fa-spin"></i>
                                    <span>Syncing detailed marks splits...</span>
                                  </div>
                                ) : error ? (
                                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", flexWrap: "wrap", gap: "10px", width: "100%" }}>
                                    <div style={{ color: "#ef4444", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                                      <i className="fas fa-circle-exclamation"></i>
                                      <span>{error}</span>
                                    </div>
                                    <button 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        loadMarksForCourse(course);
                                      }}
                                      style={{
                                        background: "rgba(239, 68, 68, 0.12)",
                                        border: "1px solid rgba(239, 68, 68, 0.25)",
                                        borderRadius: "8px",
                                        color: "#ef4444",
                                        padding: "6px 12px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "6px",
                                        transition: "background 0.2s"
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
                                      onMouseOut={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)"}
                                    >
                                      <i className="fas fa-redo-alt"></i> Retry
                                    </button>
                                  </div>
                                ) : marks && Array.isArray(marks) && marks.length > 0 ? (
                                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                                    {marks.map((m: any, mIdx: number) => {
                                      const isPass = m.IsPassed === true || String(m.IsPassed).toLowerCase() === "true" || m.IsPassed === 1 || String(m.IsPassed).toUpperCase() === "PASS";
                                      const scoreVal = parseFloat(m.OrginalConvertedMark);
                                      const maxVal = parseFloat(m.RubricsMaxMark) || 100;
                                      const percentage = maxVal > 0 && !isNaN(scoreVal) ? (scoreVal / maxVal) * 100 : 0;
                                      const barColor = isPass ? "linear-gradient(90deg, #10b981, #059669)" : "linear-gradient(90deg, #ef4444, #dc2626)";

                                      return (
                                        <div key={mIdx} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px" }}>
                                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                              <span style={{ fontWeight: "700", color: "white" }}>{m.RubricCategory}</span>
                                              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "11px" }}>({m.Type})</span>
                                            </div>
                                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                              <span style={{ fontWeight: "800", color: "white" }}>
                                                {m.OrginalConvertedMark} <span style={{ opacity: 0.4, fontSize: "11px" }}>/ {m.RubricsMaxMark}</span>
                                              </span>
                                              <span style={{
                                                fontSize: "10px",
                                                fontWeight: "800",
                                                padding: "2px 8px",
                                                borderRadius: "8px",
                                                background: isPass ? "rgba(16, 185, 129, 0.12)" : "rgba(239, 68, 68, 0.12)",
                                                color: isPass ? "#10b981" : "#ef4444",
                                                border: isPass ? "1px solid rgba(16, 185, 129, 0.25)" : "1px solid rgba(239, 68, 68, 0.25)"
                                              }}>
                                                {isPass ? "PASS" : "FAIL"}
                                              </span>
                                            </div>
                                          </div>
                                          <div style={{ height: "6px", background: "rgba(255, 255, 255, 0.05)", borderRadius: "10px", overflow: "hidden" }}>
                                            <div style={{ height: "100%", width: `${percentage}%`, background: barColor, borderRadius: "10px", transition: "width 0.5s cubic-bezier(0.4, 0, 0.2, 1)" }}></div>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", textAlign: "center", padding: "15px 0" }}>
                                    No rubric/mark split details published for this course.
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}



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
                        <th onClick={() => handleSort('name')} style={{ cursor: 'pointer', userSelect: 'none' }}>
                          Course <span style={{ marginLeft: "4px" }}>
                            {sortConfig?.key === 'name' ? (sortConfig.direction === 'asc' ? <i className="fas fa-sort-up"></i> : <i className="fas fa-sort-down"></i>) : <i className="fas fa-sort" style={{ opacity: 0.3 }}></i>}
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

                        const isExpanded = expandedCourseSno === course.sno;
                        const { loading, marks, error } = getCourseMarksDetails(course);

                        // Calculate total marks from target categories
                        const targetCategories = [
                          "Class Test (IA)",
                          "Research",
                          "Class Practical",
                          "University Theory",
                          "University Practical"
                        ];

                        let totalObtained = 0;
                        let hasTargetMarks = false;

                        if (marks && Array.isArray(marks)) {
                          marks.forEach((m: any) => {
                            const category = m.RubricCategory ? m.RubricCategory.trim() : "";
                            if (targetCategories.includes(category)) {
                              const val = parseFloat(m.OrginalConvertedMark);
                              if (!isNaN(val)) {
                                totalObtained += val;
                                hasTargetMarks = true;
                              }
                            }
                          });
                        }
                        totalObtained = Math.round(totalObtained * 100) / 100;

                        return (
                           <Fragment key={course.sno}>
                             <tr 
                               className={isExpanded ? "expanded-row-parent" : ""}
                               style={{ transition: "background 0.2s" }}
                             >
                               <td 
                                 onClick={() => {
                                   setExpandedCourseSno(isExpanded ? null : course.sno);
                                   if (!isExpanded) {
                                     loadMarksForCourse(course);
                                   }
                                 }}
                                 style={{ color: "var(--text-dim)", fontSize: "12px", textTransform: "uppercase", cursor: "pointer", userSelect: "none" }}
                                 title="Click to view detailed marks breakdown"
                               >
                                 <i 
                                   className="fas fa-chevron-right" 
                                   style={{ 
                                     marginRight: "8px", 
                                     transition: "transform 0.2s ease", 
                                     transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                                     color: "#FF80AB"
                                   }}
                                 />
                                 {course.code}
                               </td>
                               <td style={{ fontWeight: 600, color: "white" }}>
                                 <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                   <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                     <span>{course.name}</span>
                                     {course.credits !== undefined && course.credits !== 4 && (
                                       <span style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.15)", padding: "2px 6px", borderRadius: "6px", fontSize: "9px", color: "rgba(255,255,255,0.4)", textTransform: "uppercase" }}>
                                         {course.credits} Cr
                                       </span>
                                     )}
                                     {course.code?.toUpperCase() === "SPIC1" && (
                                       <span style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)", padding: "3px 8px", borderRadius: "12px", fontSize: "10px", color: "#ffffff", fontWeight: "bold", boxShadow: "0 0 12px rgba(245, 158, 11, 0.4)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                         Not Graded
                                       </span>
                                     )}
                                     {loading ? (
                                       <i className="fas fa-spinner fa-spin mobile-only-score-pill" style={{ color: "rgba(255,255,255,0.3)", fontSize: "10px" }}></i>
                                     ) : hasTargetMarks ? (
                                       <span className="mobile-only-score-pill" style={{ 
                                         fontSize: "10px", 
                                         fontWeight: "800", 
                                         color: "#FF80AB", 
                                         background: "rgba(255, 64, 129, 0.08)",
                                         border: "1px solid rgba(255, 64, 129, 0.15)",
                                         padding: "2px 6px",
                                         borderRadius: "8px",
                                         whiteSpace: "nowrap"
                                       }}>
                                         {totalObtained}/500
                                       </span>
                                     ) : null}
                                   </div>
                                   <div className="duplicate-tag-container" style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                     {course.duplicateType === 'same_grade' && (
                                       <span className="dup-tag dup-tag-same" style={{ background: "rgba(255, 255, 255, 0.04)", border: "1px solid rgba(255,255,255,0.08)", padding: "2px 6px", borderRadius: "6px", fontSize: "9px", color: "var(--text-dim)", fontWeight: 500 }}>
                                         <i className="fas fa-copy"></i> Duplicate course found
                                       </span>
                                     )}
                                     {course.duplicateType === 'different_grade' && (
                                       <>
                                         {course.selectedVersionIndex === 0 ? (
                                           <span className="dup-tag dup-tag-diff" style={{ background: "rgba(77, 182, 172, 0.08)", border: "1px solid rgba(77, 182, 172, 0.15)", padding: "2px 6px", borderRadius: "6px", fontSize: "9px", color: "#4DB6AC", fontWeight: 500 }}>
                                             <i className="fas fa-check-double"></i> Duplicate found - higher grade selected
                                           </span>
                                         ) : (
                                           <span className="dup-tag dup-tag-diff" style={{ background: "rgba(245, 158, 11, 0.08)", border: "1px solid rgba(245, 158, 11, 0.15)", padding: "2px 6px", borderRadius: "6px", fontSize: "9px", color: "#f59e0b", fontWeight: 500 }}>
                                             <i className="fas fa-exclamation-circle"></i> Duplicate found - lower grade selected
                                           </span>
                                         )}
                                         {(() => {
                                           const btnIndex = (course.selectedVersionIndex + 1) % course.allVersions.length;
                                           const nextBtnVersion = course.allVersions[btnIndex];
                                           return (
                                             <button className="switch-grade-btn" 
                                                     onClick={(e) => { e.stopPropagation(); toggleCourseVersion(course.sno); }} 
                                                     style={{ cursor: "pointer", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", padding: "2px 6px", borderRadius: "6px", fontSize: "9px", color: "white", display: "inline-flex", alignItems: "center", gap: "4px", transition: "all 0.2s", fontWeight: 600, outline: "none", margin: "1px 0" }}>
                                               <i className="fas fa-exchange-alt"></i> Switch to {nextBtnVersion.grade} ({nextBtnVersion.month_year})
                                             </button>
                                           );
                                         })()}
                                       </>
                                     )}
                                   </div>
                                 </div>
                               </td>
                               <td>
                                 <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
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
                                     boxShadow: badgeShadow,
                                     flexShrink: 0
                                   }}>
                                     {course.grade}
                                   </div>
                                    {loading ? (
                                      <i className="fas fa-spinner fa-spin desktop-only-score-pill" style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px" }}></i>
                                    ) : hasTargetMarks ? (
                                      <span className="desktop-only-score-pill" style={{ 
                                        fontSize: "11px", 
                                        fontWeight: "800", 
                                        color: "#FF80AB", 
                                        background: "rgba(255, 64, 129, 0.08)",
                                        border: "1px solid rgba(255, 64, 129, 0.15)",
                                        padding: "3px 8px",
                                        borderRadius: "10px",
                                        whiteSpace: "nowrap"
                                      }}>
                                        {totalObtained}/500
                                      </span>
                                    ) : null}
                                 </div>
                               </td>
                               <td style={{ color: "var(--text-dim)" }}>{course.month_year}</td>
                             </tr>
                             {isExpanded && (
                               <tr className="expanded-row-details" style={{ background: "rgba(0, 0, 0, 0.25)" }}>
                                 <td colSpan={4} style={{ padding: "20px 24px" }} onClick={(e) => e.stopPropagation()}>
                                   <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                                     <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", paddingBottom: "10px" }}>
                                       <span style={{ fontSize: "12px", fontWeight: "800", color: "#FF80AB", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                                         <i className="fas fa-chart-bar" style={{ marginRight: "6px" }}></i>
                                         Detailed Score Card
                                       </span>
                                       {hasTargetMarks && (
                                         <span style={{ 
                                           background: "linear-gradient(135deg, #FF4081, #FF80AB)", 
                                           padding: "4px 12px", 
                                           borderRadius: "30px", 
                                           fontSize: "12px", 
                                           fontWeight: "800", 
                                           color: "white",
                                           boxShadow: "0 4px 12px rgba(255, 64, 129, 0.3)"
                                         }}>
                                           Total Obtained: {totalObtained} / 500
                                         </span>
                                       )}
                                     </div>

                                      {loading ? (
                                        <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "15px 0", color: "var(--text-dim)", fontSize: "13px" }}>
                                          <i className="fas fa-spinner fa-spin"></i>
                                          <span>Syncing detailed marks splits...</span>
                                        </div>
                                      ) : error ? (
                                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", flexWrap: "wrap", gap: "10px", width: "100%" }}>
                                          <div style={{ color: "#ef4444", fontSize: "13px", display: "flex", alignItems: "center", gap: "8px" }}>
                                            <i className="fas fa-circle-exclamation"></i>
                                            <span>{error}</span>
                                          </div>
                                          <button 
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              loadMarksForCourse(course);
                                            }}
                                            style={{
                                              background: "rgba(239, 68, 68, 0.12)",
                                              border: "1px solid rgba(239, 68, 68, 0.25)",
                                              borderRadius: "8px",
                                              color: "#ef4444",
                                              padding: "6px 12px",
                                              fontSize: "11px",
                                              fontWeight: 600,
                                              cursor: "pointer",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: "6px",
                                              transition: "background 0.2s"
                                            }}
                                            onMouseOver={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.2)"}
                                            onMouseOut={(e) => e.currentTarget.style.background = "rgba(239, 68, 68, 0.12)"}
                                          >
                                            <i className="fas fa-redo-alt"></i> Retry
                                          </button>
                                        </div>
                                      ) : marks && Array.isArray(marks) && marks.length > 0 ? (() => {
                                          return (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "space-evenly" }}>
                                              {marks.map((m: any, mIdx: number) => {
                                                const isPass = m.IsPassed === true || String(m.IsPassed).toLowerCase() === "true" || m.IsPassed === 1 || String(m.IsPassed).toUpperCase() === "PASS";
                                                const scoreVal = parseFloat(m.OrginalConvertedMark);
                                                const maxVal = parseFloat(m.RubricsMaxMark) || 100;
                                                const pct = maxVal > 0 && !isNaN(scoreVal) ? Math.round((scoreVal / maxVal) * 100) : 0;
                                                const c = isPass ? "#10b981" : "#ef4444";
                                                const r = 20; const circ = 2 * Math.PI * r; const dash = (pct / 100) * circ;
                                                const isFA = String(m.Type).toLowerCase().includes('formative');

                                                return (
                                                  <div key={mIdx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", minWidth: "68px" }}>
                                                    <div style={{ position: "relative", width: "50px", height: "50px" }}>
                                                      <svg width="50" height="50" style={{ transform: "rotate(-90deg)" }}>
                                                        <circle cx="25" cy="25" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
                                                        <circle cx="25" cy="25" r={r} fill="none" stroke={c} strokeWidth="5" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" style={{ filter: `drop-shadow(0 0 3px ${c})` }} />
                                                      </svg>
                                                      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, color: "white" }}>
                                                        {m.OrginalConvertedMark}
                                                      </span>
                                                    </div>
                                                    <span style={{ fontSize: "10px", fontWeight: 700, color: "rgba(255,255,255,0.7)", textAlign: "center", lineHeight: 1.2 }}>
                                                      {m.RubricCategory}
                                                    </span>
                                                    <span style={{ fontSize: "9px", fontWeight: 800, color: isFA ? "#60a5fa" : "#f59e0b", background: isFA ? "rgba(96,165,250,0.12)" : "rgba(245,158,11,0.12)", padding: "1px 5px", borderRadius: "4px" }}>
                                                      {isFA ? "FA" : "SA"}
                                                    </span>
                                                  </div>
                                                );
                                              })}
                                            </div>
                                          );
                                        })() : (
                                         <div style={{ color: "rgba(255,255,255,0.4)", fontSize: "13px", textAlign: "center", padding: "15px 0" }}>
                                           No rubric/mark split details published for this course.
                                         </div>
                                      )}
                                   </div>
                                 </td>
                               </tr>
                             )}
                           </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Right Column: Unified Circular Doughnut Analytics of Grades */}
                <div className="grade-chart-container" style={{ borderLeft: "1px solid var(--border-glass)", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "15px", justifyContent: "flex-start" }}>
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
                        {/* Desktop: Courses Count */}
                        <div className="desktop-doughnut-text" style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: "28px", fontWeight: "800", color: "white", lineHeight: 1 }}>{profile.courses.length}</span>
                          <span style={{ fontSize: "9px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>Courses</span>
                        </div>
                        {/* Mobile: Credits Count */}
                        <div className="mobile-doughnut-text" style={{ display: "none", flexDirection: "column", alignItems: "center" }}>
                          <span style={{ fontSize: "28px", fontWeight: "800", color: "white", lineHeight: 1 }}>
                            {profile.courses.reduce((sum: number, c: any) => sum + (c.credits || 0), 0)}
                          </span>
                          <span style={{ fontSize: "9px", color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "1px", marginTop: "4px" }}>Credits</span>
                        </div>
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
                  {renderMessage(note.message)}
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

            {/* Actions buttons */}
            <div style={{ padding: "20px 24px 20px", display: "flex", gap: "10px", flexDirection: "column" }}>
              <button
                onClick={handleSync}
                disabled={isSyncing}
                onTouchEnd={(e) => { e.preventDefault(); if (!isSyncing) handleSync(); }}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: "16px",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: isSyncing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  touchAction: "manipulation",
                  transition: "background 0.2s"
                }}
              >
                <i className={`fas fa-sync-alt ${isSyncing ? "fa-spin" : ""}`}></i> 
                {isSyncing ? "Syncing..." : "Sync Latest Data"}
              </button>

              <button
                onClick={handleDownloadHTML}
                onTouchEnd={(e) => { e.preventDefault(); handleDownloadHTML(); }}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
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
                  transition: "background 0.2s"
                }}
              >
                <i className="fas fa-file-download" style={{ color: "#4DB6AC" }}></i> Save Offline Report
              </button>

              <button
                onClick={handleLogout}
                disabled={isSyncing}
                onTouchEnd={(e) => { e.preventDefault(); if (!isSyncing) handleLogout(); }}
                style={{
                  width: "100%",
                  padding: "14px",
                  background: "linear-gradient(135deg, #FF4081, #FF80AB)",
                  border: "none",
                  borderRadius: "16px",
                  color: "white",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: isSyncing ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  touchAction: "manipulation",
                  boxShadow: "0 8px 20px rgba(255,64,129,0.35)",
                  opacity: isSyncing ? 0.6 : 1
                }}
              >
                <i className="fas fa-sign-out-alt"></i> Logout
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* PWA bottom install banner */}
      <div className={`pwa-install-banner ${showInstallBanner ? 'show' : ''}`}>
        <div className="pwa-install-header">
          <div className="pwa-install-title">
            <i className="fas fa-mobile-alt" style={{ color: "#FF4081" }}></i>
            <span>Install ARMS Connect</span>
          </div>
          <button className="pwa-install-close" onClick={handleDismissInstall}>
            <i className="fas fa-times"></i>
          </button>
        </div>
        <p className="pwa-install-text">
          Add ARMS Connect to your home screen for a faster, full-screen, native student portal experience!
        </p>
        <div className="pwa-install-actions">
          <button className="btn-install" onClick={handleInstall}>Install App</button>
          <button className="btn-continue" onClick={handleDismissInstall}>Continue with browser</button>
        </div>
      </div>

      {/* Toast Notification */}
      <div className={`toast-notification ${toastMessage ? 'show' : ''}`}>
        <i className="fas fa-check-circle" style={{ color: "#4DB6AC" }}></i>
        <span>{toastMessage}</span>
      </div>
    </div>
  );
}
