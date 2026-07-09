import { NextResponse } from 'next/server';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';
import https from 'https';

const ARMS_BASE_URL = (process.env.ARMS_BASE_URL || 'https://arms.sse.saveetha.com').replace(/\/+$/, '');

function parseMonthYear(my: string): Date {
  const parts = my.split('-');
  if (parts.length !== 2) return new Date(0);
  const monthName = parts[0].toLowerCase();
  const year = parseInt(parts[1], 10);
  const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const monthIndex = monthNames.findIndex(m => monthName.startsWith(m));
  if (monthIndex === -1) return new Date(0);
  return new Date(year, monthIndex, 1);
}

async function fetchInBatches(tasks: (() => Promise<void>)[], batchSize: number) {
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map(t => t());
    await Promise.all(batch);
  }
}

async function fetchMarksForStudent(client: any, username: string, courses: any[]) {
  try {
    // Establish date window cutoff
    let latestDate = new Date(0);
    for (const c of courses) {
      if (c.month_year) {
        const d = parseMonthYear(c.month_year);
        if (d > latestDate) latestDate = d;
      }
    }

    let coursesToFetch = courses;
    if (latestDate.getTime() > 0) {
      const cutoffDate = new Date(latestDate);
      cutoffDate.setMonth(cutoffDate.getMonth() - 8); // 8 months window to cover current academic year
      coursesToFetch = courses.filter(c => {
        if (!c.month_year) return false;
        const d = parseMonthYear(c.month_year);
        return d >= cutoffDate;
      });
      console.log(`[NextAPI] Latest date: ${latestDate.toISOString()}. Cutoff: ${cutoffDate.toISOString()}. Filtering to ${coursesToFetch.length}/${courses.length} recent courses.`);
    }

    if (coursesToFetch.length === 0) return;

    // 1. Fetch Month/Year mapping
    const monthYearUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=MonthYear&Mode=MonthYearNew`;
    console.log(`[NextAPI] Fetching Month/Year: ${monthYearUrl}`);
    const monthYearRes = await client.get(monthYearUrl);
    const monthYears = monthYearRes.data?.Table || [];

    const monthMap = new Map<string, string>();
    for (const item of monthYears) {
      if (item.Value && item.Id) {
        monthMap.set(String(item.Value).trim(), String(item.Id).trim());
      }
    }

    // 2. Identify unique MonthYear values
    const uniqueMonths = new Set<string>();
    for (const c of coursesToFetch) {
      if (c.month_year && monthMap.has(c.month_year)) {
        uniqueMonths.add(monthMap.get(c.month_year)!);
      }
    }

    // 3. Fetch courses for each unique month
    const monthCoursesCache = new Map<string, any[]>();
    const monthPromises = Array.from(uniqueMonths).map(async (monthId) => {
      try {
        const monthCoursesUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=CoursebyMonth&Mode=PublishCoursebyMonthNew&Monthyear=${monthId}`;
        const monthCoursesRes = await client.get(monthCoursesUrl);
        const table = monthCoursesRes.data?.Table || [];
        monthCoursesCache.set(monthId, table);
      } catch (err) {
        console.error(`[NextAPI] Error fetching courses for month ${monthId}:`, err);
      }
    });
    await Promise.all(monthPromises);

    const userClean = username.trim().toLowerCase();
    
    // 4. Create tasks for the filtered courses
    const courseTasks = coursesToFetch.map((c) => async () => {
      try {
        const monthId = monthMap.get(c.month_year);
        if (!monthId) {
          c.marks = null;
          c.marksError = "Month mapping not found";
          return;
        }

        const monthCourses = monthCoursesCache.get(monthId) || [];
        const subjectIds = monthCourses
          .filter((sub: any) => String(sub.SubjectCode).trim().toLowerCase() === String(c.code).trim().toLowerCase())
          .map((sub: any) => String(sub.SubjectId).trim());

        if (subjectIds.length === 0) {
          c.marks = null;
          c.marksError = "Subject ID not found";
          return;
        }

        let foundViewId = null;
        let foundSubjectId = null;

        for (const subjectId of subjectIds) {
          try {
            const studentListUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=ResultView&Mode=NewResultViewFaculty&Coursename=${subjectId}`;
            const studentListRes = await client.get(studentListUrl, { timeout: 10000 });
            const students = studentListRes.data?.Table || [];

            const matchingStudent = students.find((stud: any) => {
              const regClean = String(stud.RegNo || '').trim().toLowerCase();
              return regClean === userClean || regClean.startsWith(userClean) || userClean.startsWith(regClean);
            });

            if (matchingStudent && matchingStudent.ViewId) {
              foundViewId = String(matchingStudent.ViewId).trim();
              foundSubjectId = subjectId;
              break;
            }
          } catch (err) {
            console.warn(`[NextAPI] Error checking subject ${subjectId}:`, err);
          }
        }

        if (!foundViewId || !foundSubjectId) {
          c.marks = null;
          c.marksError = "View ID not found";
          return;
        }

        const marksUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=ViewMarks&Mode=MarkSplitbyId&Id=${foundSubjectId}&Id2=${foundViewId}`;
        const marksRes = await client.get(marksUrl, { timeout: 10000 });
        const marksTable = marksRes.data?.Table || [];

        c.marks = marksTable;
        c.marksError = null;
      } catch (err: any) {
        console.error(`[NextAPI] Error fetching marks for ${c.code}:`, err);
        c.marks = null;
        c.marksError = err.message || "Failed to retrieve marks";
      }
    });

    // Run in smaller batches of 4 to prevent server congestion and timeouts
    await fetchInBatches(courseTasks, 4);

  } catch (err) {
    console.error("[NextAPI] Global error fetching marks:", err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body.username?.trim();
    const password = body.password?.trim();

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
    }

    console.log(`[NextAPI] Logging in to ARMS portal for user: ${username}`);

    // Bypasses SSL certificate issues globally to avoid conflict with axios-cookiejar-support's internal agent
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    // Create session equivalent client
    const jar = new CookieJar();
    const client = wrapper(axios.create({
      jar,
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 25000
    }));

    // Step 1: GET Login.aspx state variables
    const loginUrl = `${ARMS_BASE_URL}/Login.aspx`;
    console.log(`[NextAPI] Requesting GET: ${loginUrl}`);
    const getRes = await client.get(loginUrl);
    
    if (getRes.status !== 200) {
      console.error(`[NextAPI] Failed to fetch login page. Status: ${getRes.status}`);
      return NextResponse.json({ error: 'Unable to connect to ARMS portal.' }, { status: 500 });
    }

    const $ = cheerio.load(getRes.data);
    const viewstate = $('#__VIEWSTATE').val() as string;
    const generator = $('#__VIEWSTATEGENERATOR').val() as string;
    const validation = $('#__EVENTVALIDATION').val() as string;

    if (!viewstate || !validation) {
      console.error('[NextAPI] Failed to parse ASP.NET hidden fields');
      return NextResponse.json({ error: 'Portal structure changed. Please contact administrator.' }, { status: 500 });
    }

    // Step 2: POST Login credentials
    const loginPayload = new URLSearchParams({
      __VIEWSTATE: viewstate,
      __VIEWSTATEGENERATOR: generator || '',
      __EVENTVALIDATION: validation,
      txtusername: username,
      txtpassword: password,
      btnlogin: 'Login'
    });

    console.log(`[NextAPI] Submitting POST: ${loginUrl}`);
    const postRes = await client.post(loginUrl, loginPayload.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const finalUrl = postRes.request?.res?.responseUrl || postRes.config.url || '';
    console.log(`[NextAPI] POST Response URL: ${finalUrl} (Status: ${postRes.status})`);

    // Check if the final URL is still login or includes unauth
    if (finalUrl.includes('Login.aspx') || finalUrl.includes('unauth') || postRes.data.includes('txtusername')) {
      console.warn(`[NextAPI] Login failed for user ${username}`);
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    console.log(`[NextAPI] Login successful for user ${username}`);

    const profileData: any = {};

    // Step 3: Fetch Student Details
    const detailsUrl = `${ARMS_BASE_URL}/Handler/Administration.ashx?Page=DashInstitute&Mode=StudentDetailsById`;
    console.log(`[NextAPI] Requesting GET: ${detailsUrl}`);
    const detailsRes = await client.get(detailsUrl);
    console.log(`[NextAPI] GET Response Status: ${detailsRes.status}`);
    console.log(`[NextAPI] Raw Output: ${JSON.stringify(detailsRes.data).substring(0, 500)}`);

    if (detailsRes.status !== 200 || !Array.isArray(detailsRes.data) || detailsRes.data.length === 0) {
      console.warn('[NextAPI] Student details empty or failed');
      return NextResponse.json({ error: 'Failed to retrieve student details.' }, { status: 500 });
    }

    const student = detailsRes.data[0];
    profileData.name = (student.FirstName || '').trim();
    profileData.regno = (student.RegNo || '').trim();
    profileData.dob = (student.DateOfBirth || '').trim();
    profileData.program = (student.Program || '').trim();
    profileData.email = (student.EmailId || '').trim();
    profileData.mobile = (student.MobileNumber || '').trim();
    profileData.profilePictureUrl = (student.ProfilePictureUrl || '').trim();

    // Step 4: Fetch Notifications
    const notifUrl = `${ARMS_BASE_URL}/Handler/Administration.ashx?Page=DashInstitute&Mode=StudentNotificationPushData&CId=0`;
    console.log(`[NextAPI] Requesting GET: ${notifUrl}`);
    const notifRes = await client.get(notifUrl);
    console.log(`[NextAPI] GET Response Status: ${notifRes.status}`);
    console.log(`[NextAPI] Raw Output: ${JSON.stringify(notifRes.data).substring(0, 500)}`);

    const notifications: any[] = [];
    if (notifRes.status === 200 && Array.isArray(notifRes.data)) {
      for (const note of notifRes.data) {
        notifications.push({
          by: (note.FirstName || 'Principal').trim(),
          datetime: (note.PublishDate || '').trim(),
          message: (note.NotifiContent || '').trim()
        });
      }
    } else {
      console.warn('[NextAPI] Failed to fetch notifications or empty');
    }
    profileData.notifications = notifications;

    // Step 5: Fetch Course Results & Calculate CGPA
    const resultsUrl = `${ARMS_BASE_URL}/Handler/Student.ashx?Page=CourseEnroll&Mode=GetResult&Id=0`;
    console.log(`[NextAPI] Requesting GET: ${resultsUrl}`);
    const resultsRes = await client.get(resultsUrl);
    console.log(`[NextAPI] GET Response Status: ${resultsRes.status}`);
    console.log(`[NextAPI] Raw Output: ${JSON.stringify(resultsRes.data).substring(0, 500)}`);

    const courses: any[] = [];
    let totalPoints = 0;
    let totalCredits = 0;
    const gradePoints: any = {
      'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5,
      'O': 10, 'A+': 9, 'B+': 7
    };

    if (resultsRes.status === 200 && resultsRes.data) {
      const tableData = resultsRes.data.Table || [];
      if (Array.isArray(tableData)) {
        const rawCourses: any[] = [];
        const rawFailedCourses: any[] = [];
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
            grade,
            status,
            month_year: (row.MonthYearValue || '').trim(),
            credits
          };

          const isFailed = (status === 'FAIL' || status === 'RA' || status === 'F' || grade === 'F' || grade === 'RA' || grade === 'U');

          if (isFailed) {
            rawFailedCourses.push(courseItem);
          } else {
            rawCourses.push(courseItem);
          }
        }

        // Group by (CourseCode, CourseName) for passed courses
        const grouped: { [key: string]: any[] } = {};
        const groupKeys: string[] = []; // to preserve insertion order
        
        for (const c of rawCourses) {
          const key = `${c.code.trim().toUpperCase()}||${c.name.trim().toUpperCase()}`;
          if (!grouped[key]) {
            grouped[key] = [];
            groupKeys.push(key);
          }
          grouped[key].push(c);
        }

        const buildCleanVersions = (vers: any[]) => {
          return vers.map(v => ({
            sno: v.sno,
            code: v.code,
            name: v.name,
            grade: v.grade,
            status: v.status,
            month_year: v.month_year,
            credits: v.credits
          }));
        };

        for (const key of groupKeys) {
          const versions = grouped[key];
          if (versions.length === 1) {
            const c = versions[0];
            c.duplicateType = null;
            c.selectedVersionIndex = 0;
            c.allVersions = [{
              sno: c.sno,
              code: c.code,
              name: c.name,
              grade: c.grade,
              status: c.status,
              month_year: c.month_year,
              credits: c.credits
            }];
            courses.push(c);
          } else {
            const firstGrade = versions[0].grade;
            const allSameGrade = versions.every(v => v.grade === firstGrade);
            
            if (allSameGrade) {
              const c = versions[0];
              c.duplicateType = "same_grade";
              c.selectedVersionIndex = 0;
              c.allVersions = buildCleanVersions(versions);
              courses.push(c);
            } else {
              // Sort by grade value descending
              const sortedVersions = [...versions].sort((a, b) => {
                const valA = gradePoints[a.grade.trim().toUpperCase()] || 0;
                const valB = gradePoints[b.grade.trim().toUpperCase()] || 0;
                if (valB !== valA) return valB - valA;
                return String(b.month_year).localeCompare(String(a.month_year));
              });
              const c = sortedVersions[0];
              c.duplicateType = "different_grade";
              c.selectedVersionIndex = 0;
              c.allVersions = buildCleanVersions(sortedVersions);
              courses.push(c);
            }
          }
        }

        // Build failed courses (arrears) - include all failed attempts
        const failedCourses: any[] = [];
        for (const fc of rawFailedCourses) {
          const existing = failedCourses.find(x => String(x.code).toUpperCase() === String(fc.code).toUpperCase());
          if (!existing) {
            failedCourses.push({
              ...fc,
              duplicateType: null,
              selectedVersionIndex: 0,
              allVersions: [buildCleanVersions([fc])[0]]
            });
          } else {
            existing.allVersions.push(buildCleanVersions([fc])[0]);
            existing.duplicateType = "different_grade";
          }
        }
        profileData.failedCourses = failedCourses;

        // Calculate initial CGPA and total credits from active versions of passed courses only
        for (const c of courses) {
          const grade = c.grade.trim().toUpperCase();
          const courseCode = c.code.trim().toUpperCase();
          const credits = c.credits;

          if (gradePoints[grade] !== undefined && courseCode !== 'SPIC1') {
            totalPoints += (gradePoints[grade] * credits);
            totalCredits += credits;
          }
        }
      }
    } else {
      console.warn('[NextAPI] Failed to fetch course results');
    }
    profileData.courses = courses;
    profileData.cgpa = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(3)) : 'N/A';

    // Step 6: Fetch Attendance
    const attendanceUrl = `${ARMS_BASE_URL}/Handler/Administration.ashx?Page=StudentAttendance&Mode=ATTENDANCEPGMPERSENT&Id=0&Sid=0&Date=&ToDate=`;
    console.log(`[NextAPI] Requesting GET: ${attendanceUrl}`);
    const attnRes = await client.get(attendanceUrl);
    console.log(`[NextAPI] GET Response Status: ${attnRes.status}`);
    console.log(`[NextAPI] Raw Output: ${JSON.stringify(attnRes.data).substring(0, 500)}`);

    const attendance: any[] = [];
    if (attnRes.status === 200 && attnRes.data) {
      const rows = Array.isArray(attnRes.data) ? attnRes.data : (attnRes.data.Table || []);
      let sno = 1;
      for (const row of rows) {
        const code = (row.SubjectCode || '').trim();
        const name = (row.SubjectName || '').trim();
        const totalClass = parseInt(row.Totalclasscount || 0, 10);
        const absent = parseFloat(row.AbsentCount || 0);
        const attended = totalClass - absent;
        const pct = totalClass > 0 ? Number(((attended / totalClass) * 100).toFixed(2)) : 100;
        const percentage = `${pct}%`;

        attendance.push({
          sno: String(sno),
          code,
          name,
          class_attended: String(attended),
          hours_attended: String(attended),
          total_class: String(totalClass),
          total_hours: String(totalClass),
          percentage,
          view: 'View'
        });
        sno += 1;
      }
    } else {
      console.warn('[NextAPI] Failed to fetch attendance');
    }
    profileData.attendance = attendance;

    // Extract Session Cookie
    const cookieString = await jar.getCookieString(ARMS_BASE_URL);
    const match = cookieString.match(/ASP\.NET_SessionId=([^;]+)/);
    const sessionId = match ? match[1] : '';
    profileData.sessionId = sessionId;

    // Return the response
    return NextResponse.json(profileData);

  } catch (error: any) {
    console.error('[NextAPI] Unexpected error during scrap:', error);
    return NextResponse.json({ error: 'Something went wrong while fetching data.' }, { status: 500 });
  }
}
