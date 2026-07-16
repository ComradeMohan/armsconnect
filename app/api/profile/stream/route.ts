import { NextResponse } from 'next/server';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';

// Vercel: extend function timeout to 60s (default is 10s on Hobby plan).
// Login + scraping all ARMS data can take up to 10s total.
export const maxDuration = 60;

const ARMS_BASE_URL = (process.env.ARMS_BASE_URL || 'https://arms.sse.saveetha.com').replace(/\/+$/, '');

// Set once at module level — prevents repeated TLS warnings on every request.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

function parseMonthYear(my: string): Date {
  const parts = my.split('-');
  if (parts.length !== 2) return new Date(0);
  const monthName = parts[0].toLowerCase();
  const year = parseInt(parts[1], 10);
  const monthNames = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
  const monthIndex = monthNames.findIndex(m => monthName.startsWith(m));
  if (monthIndex === -1) return new Date(0);
  return new Date(year, monthIndex, 1);
}

export async function POST(request: Request) {
  const body = await request.json();
  const username = body.username?.trim();
  const password = body.password?.trim();

  if (!username || !password) {
    return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (type: string, message: string, progress: number, payload?: any) => {
        const data = JSON.stringify({ type, message, progress, payload: payload || null });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      };

      try {
        const jar = new CookieJar();
        const client = wrapper(axios.create({
          jar,
          withCredentials: true,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
          },
          timeout: 25000
        }));

        // Step 1: Connect to ARMS
        send('step', '🔗 Connecting to ARMS portal...', 5);
        const loginUrl = `${ARMS_BASE_URL}/Login.aspx`;
        const getRes = await client.get(loginUrl);

        if (getRes.status !== 200) {
          send('error', '❌ Failed to reach ARMS portal', 0);
          controller.close();
          return;
        }

        const $ = cheerio.load(getRes.data);
        const viewstate = $('#__VIEWSTATE').val() as string;
        const generator = $('#__VIEWSTATEGENERATOR').val() as string;
        const validation = $('#__EVENTVALIDATION').val() as string;

        if (!viewstate || !validation) {
          send('error', '❌ Portal structure changed — could not parse login form', 0);
          controller.close();
          return;
        }

        // Step 2: Authenticate
        send('step', `🔐 Authenticating as ${username}...`, 15);
        const loginPayload = new URLSearchParams({
          __VIEWSTATE: viewstate,
          __VIEWSTATEGENERATOR: generator || '',
          __EVENTVALIDATION: validation,
          txtusername: username,
          txtpassword: password,
          btnlogin: 'Login'
        });

        const postRes = await client.post(loginUrl, loginPayload.toString(), {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const finalUrl = postRes.request?.res?.responseUrl || postRes.config.url || '';
        if (finalUrl.includes('Login.aspx') || finalUrl.includes('unauth') || postRes.data.includes('txtusername')) {
          send('error', '❌ Invalid credentials — login rejected', 0);
          controller.close();
          return;
        }
        send('step', '✅ Login successful!', 25);

        const profileData: any = {};

        // Step 3: Student profile
        send('step', '📋 Fetching student profile details...', 35);
        const detailsUrl = `${ARMS_BASE_URL}/Handler/Administration.ashx?Page=DashInstitute&Mode=StudentDetailsById`;
        const detailsRes = await client.get(detailsUrl);

        if (detailsRes.status !== 200 || !Array.isArray(detailsRes.data) || detailsRes.data.length === 0) {
          send('error', '❌ Failed to retrieve student details', 0);
          controller.close();
          return;
        }

        const student = detailsRes.data[0];
        profileData.name = (student.FirstName || '').trim();
        profileData.regno = (student.RegNo || '').trim();
        profileData.dob = (student.DateOfBirth || '').trim();
        profileData.program = (student.Program || '').trim();
        profileData.email = (student.EmailId || '').trim();
        profileData.mobile = (student.MobileNumber || '').trim();
        profileData.profilePictureUrl = (student.ProfilePictureUrl || '').trim();

        send('step', `👤 Found: ${profileData.name} (${profileData.regno})`, 42);

        // Step 4: Notifications
        send('step', '🔔 Loading notifications...', 48);
        const notifUrl = `${ARMS_BASE_URL}/Handler/Administration.ashx?Page=DashInstitute&Mode=StudentNotificationPushData&CId=0`;
        const notifRes = await client.get(notifUrl);
        const notifications: any[] = [];
        if (notifRes.status === 200 && Array.isArray(notifRes.data)) {
          for (const note of notifRes.data) {
            notifications.push({
              by: (note.FirstName || 'Principal').trim(),
              datetime: (note.PublishDate || '').trim(),
              message: (note.NotifiContent || '').trim()
            });
          }
          send('step', `🔔 ${notifications.length} notification(s) loaded`, 54);
        }
        profileData.notifications = notifications;

        // Step 5: Course results & CGPA
        send('step', '📚 Fetching course results & grades...', 60);
        const resultsUrl = `${ARMS_BASE_URL}/Handler/Student.ashx?Page=CourseEnroll&Mode=GetResult&Id=0`;
        const resultsRes = await client.get(resultsUrl);

        const courses: any[] = [];
        const failedCourses: any[] = [];
        let totalPoints = 0;
        let totalCredits = 0;
        const gradePoints: any = { 'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5, 'O': 10, 'A+': 9, 'B+': 7 };

        if (resultsRes.status === 200 && resultsRes.data) {
          const tableData = resultsRes.data.Table || [];
          if (Array.isArray(tableData)) {
            const rawCourses: any[] = [];
            const rawFailed: any[] = [];

            for (const row of tableData) {
              const grade = (row.FinalGrade || '').trim().toUpperCase();
              const status = (row.FinalResult || '').trim().toUpperCase();
              const courseCode = (row.CourseCode || '').trim().toUpperCase();
              let credits = 4;
              if (courseCode === 'SPIC4') credits = 12;
              if (courseCode === 'SPIC7') credits = 8;
              if (courseCode === 'SPIC1') credits = 0;

              const courseItem = {
                sno: String(row.Sno || ''),
                code: (row.CourseCode || '').trim(),
                name: (row.CourseName || '').trim(),
                grade, status,
                month_year: (row.MonthYearValue || '').trim(),
                credits
              };

              const isFailed = (status === 'FAIL' || status === 'RA' || status === 'F' || grade === 'F' || grade === 'RA' || grade === 'U');
              if (isFailed) rawFailed.push(courseItem);
              else rawCourses.push(courseItem);
            }

            // Group passed courses
            const grouped: { [key: string]: any[] } = {};
            const groupKeys: string[] = [];
            for (const c of rawCourses) {
              const key = `${c.code.trim().toUpperCase()}||${c.name.trim().toUpperCase()}`;
              if (!grouped[key]) { grouped[key] = []; groupKeys.push(key); }
              grouped[key].push(c);
            }

            const buildClean = (vers: any[]) => vers.map(v => ({ sno: v.sno, code: v.code, name: v.name, grade: v.grade, status: v.status, month_year: v.month_year, credits: v.credits }));

            for (const key of groupKeys) {
              const versions = grouped[key];
              if (versions.length === 1) {
                const c = versions[0];
                c.duplicateType = null; c.selectedVersionIndex = 0;
                c.allVersions = [{ sno: c.sno, code: c.code, name: c.name, grade: c.grade, status: c.status, month_year: c.month_year, credits: c.credits }];
                courses.push(c);
              } else {
                const firstGrade = versions[0].grade;
                const allSame = versions.every(v => v.grade === firstGrade);
                if (allSame) {
                  const c = versions[0]; c.duplicateType = "same_grade"; c.selectedVersionIndex = 0; c.allVersions = buildClean(versions); courses.push(c);
                } else {
                  const sorted = [...versions].sort((a, b) => {
                    const vA = gradePoints[a.grade] || 0, vB = gradePoints[b.grade] || 0;
                    return vB !== vA ? vB - vA : String(b.month_year).localeCompare(String(a.month_year));
                  });
                  const c = sorted[0]; c.duplicateType = "different_grade"; c.selectedVersionIndex = 0; c.allVersions = buildClean(sorted); courses.push(c);
                }
              }
            }

            for (const fc of rawFailed) {
              const existing = failedCourses.find(x => String(x.code).toUpperCase() === String(fc.code).toUpperCase());
              if (!existing) failedCourses.push({ ...fc, duplicateType: null, selectedVersionIndex: 0, allVersions: [buildClean([fc])[0]] });
              else { existing.allVersions.push(buildClean([fc])[0]); existing.duplicateType = "different_grade"; }
            }

            for (const c of courses) {
              const grade = c.grade.trim().toUpperCase();
              if (gradePoints[grade] !== undefined && c.code.toUpperCase() !== 'SPIC1') {
                totalPoints += gradePoints[grade] * c.credits;
                totalCredits += c.credits;
              }
            }
          }
        }

        profileData.courses = courses;
        profileData.failedCourses = failedCourses;
        profileData.cgpa = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(3)) : 'N/A';

        const passCount = courses.length;
        const failCount = failedCourses.length;
        send('step', `📊 ${passCount} passed, ${failCount} arrear(s) — CGPA: ${profileData.cgpa}`, 75);

        // Step 6: Attendance
        send('step', '📅 Fetching attendance data...', 82);
        const attendanceUrl = `${ARMS_BASE_URL}/Handler/Administration.ashx?Page=StudentAttendance&Mode=ATTENDANCEPGMPERSENT&Id=0&Sid=0&Date=&ToDate=`;
        const attnRes = await client.get(attendanceUrl);

        const attendance: any[] = [];
        if (attnRes.status === 200 && attnRes.data) {
          const rows = Array.isArray(attnRes.data) ? attnRes.data : (attnRes.data.Table || []);
          let sno = 1;
          for (const row of rows) {
            const totalClass = parseInt(row.Totalclasscount || 0, 10);
            const absent = parseFloat(row.AbsentCount || 0);
            const attended = totalClass - absent;
            const pct = totalClass > 0 ? Number(((attended / totalClass) * 100).toFixed(2)) : 100;
            attendance.push({
              sno: String(sno++),
              code: (row.SubjectCode || '').trim(),
              name: (row.SubjectName || '').trim(),
              class_attended: String(attended),
              hours_attended: String(attended),
              total_class: String(totalClass),
              total_hours: String(totalClass),
              percentage: `${pct}%`,
              view: 'View'
            });
          }
          if (attendance.length > 0) {
            send('step', `📅 ${attendance.length} subject(s) attendance loaded`, 90);
          } else {
            send('step', '📅 No attendance data found (new admission?)', 90);
          }
        }
        profileData.attendance = attendance;

        // Extract session cookie
        const cookieString = await jar.getCookieString(ARMS_BASE_URL);
        const match = cookieString.match(/ASP\.NET_SessionId=([^;]+)/);
        profileData.sessionId = match ? match[1] : '';

        // Done — send the full profile payload
        send('step', '✅ All data synced! Launching dashboard...', 98);
        send('done', 'done', 100, profileData);

        // Terminal summary — visible in local dev and Vercel function logs
        console.log('[Stream] Profile fetched:', JSON.stringify({
          name: profileData.name,
          regno: profileData.regno,
          program: profileData.program,
          cgpa: profileData.cgpa,
          courses: profileData.courses?.length ?? 0,
          arrears: profileData.failedCourses?.length ?? 0,
          attendance: profileData.attendance?.length ?? 0,
          notifications: profileData.notifications?.length ?? 0,
          sessionId: profileData.sessionId ? `${profileData.sessionId.slice(0, 6)}…` : 'none'
        }, null, 2));

      } catch (err: any) {
        send('error', `❌ Error: ${err.message || 'Something went wrong'}`, 0);
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
