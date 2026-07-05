import { NextResponse } from 'next/server';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';
import * as cheerio from 'cheerio';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body.username?.trim();
    const password = body.password?.trim();

    if (!username || !password) {
      return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
    }

    console.log(`[NextAPI] Logging in to ARMS portal for user: ${username}`);

    // Create session equivalent client
    const jar = new CookieJar();
    const client = wrapper(axios.create({
      jar,
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 20000
    }));

    // Step 1: GET Login.aspx state variables
    const loginUrl = 'https://arms.sse.saveetha.com/Login.aspx';
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
    const detailsUrl = 'https://arms.sse.saveetha.com/Handler/Administration.ashx?Page=DashInstitute&Mode=StudentDetailsById';
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
    const notifUrl = 'https://arms.sse.saveetha.com/Handler/Administration.ashx?Page=DashInstitute&Mode=StudentNotificationPushData&CId=0';
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
    const resultsUrl = 'https://arms.sse.saveetha.com/Handler/Student.ashx?Page=CourseEnroll&Mode=GetResult&Id=0';
    console.log(`[NextAPI] Requesting GET: ${resultsUrl}`);
    const resultsRes = await client.get(resultsUrl);
    console.log(`[NextAPI] GET Response Status: ${resultsRes.status}`);
    console.log(`[NextAPI] Raw Output: ${JSON.stringify(resultsRes.data).substring(0, 500)}`);

    const courses: any[] = [];
    let totalPoints = 0;
    let totalCredits = 0;
    const gradePoints: any = { 'S': 10, 'A': 9, 'B': 8, 'C': 7, 'D': 6, 'E': 5 };

    if (resultsRes.status === 200 && resultsRes.data) {
      const tableData = resultsRes.data.Table || [];
      if (Array.isArray(tableData)) {
        for (const row of tableData) {
          const grade = (row.FinalGrade || '').trim().toUpperCase();
          const status = (row.FinalResult || '').trim().toUpperCase();
          if (status === 'FAIL') continue;

          const courseCode = (row.CourseCode || '').trim();
          
          if (gradePoints[grade] !== undefined && courseCode.toUpperCase() !== 'SPIC1') {
            totalPoints += gradePoints[grade];
            totalCredits += 1;
          }
          courses.push({
            sno: String(row.Sno || ''),
            code: (row.CourseCode || '').trim(),
            name: (row.CourseName || '').trim(),
            grade,
            status,
            month_year: (row.MonthYearValue || '').trim()
          });
        }
      }
    } else {
      console.warn('[NextAPI] Failed to fetch course results');
    }
    profileData.courses = courses;
    profileData.cgpa = totalCredits > 0 ? Number((totalPoints / totalCredits).toFixed(2)) : 'N/A';

    // Step 6: Fetch Attendance
    const attendanceUrl = 'https://arms.sse.saveetha.com/Handler/Administration.ashx?Page=StudentAttendance&Mode=ATTENDANCEPGMPERSENT&Id=0&Sid=0&Date=&ToDate=';
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

    // Return the response
    return NextResponse.json(profileData);

  } catch (error: any) {
    console.error('[NextAPI] Unexpected error during scrap:', error);
    return NextResponse.json({ error: 'Something went wrong while fetching data.' }, { status: 500 });
  }
}
