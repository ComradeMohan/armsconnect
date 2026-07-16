import { NextResponse } from 'next/server';
import axios from 'axios';
import { wrapper } from 'axios-cookiejar-support';
import { CookieJar } from 'tough-cookie';

// Vercel: extend function timeout to 60s (default is 10s on Hobby plan).
// The ARMS roster lookup can take 15-25s for slow subjects.
export const maxDuration = 60;

// axios-cookiejar-support manages its own http(s) agent internally and does not
// allow a custom httpsAgent to be passed. Set the TLS bypass at module level
// (once at server startup) so the Node.js warning fires only once, not per-request.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const ARMS_BASE_URL = (process.env.ARMS_BASE_URL || 'https://arms.sse.saveetha.com').replace(/\/+$/, '');

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const staticCache = {
  monthYears: null as any[] | null,
  monthYearsFetchedAt: 0,
  courseByMonth: new Map<string, { data: any[]; fetchedAt: number }>(),
  rosterViewIds: new Map<string, { viewId: string; subjectId: string; fetchedAt: number }>()
};

async function getWithRetry(client: any, url: string, options: any = {}, retries = 2): Promise<any> {
  for (let i = 0; i <= retries; i++) {
    try {
      return await client.get(url, options);
    } catch (err: any) {
      if (i === retries) throw err;
      const delay = 1000 * (i + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function resolveCourse(client: any, username: string, courseCode: string, monthYear: string): Promise<any> {
  // 1. Fetch Month/Year registry (cached)
  let monthYears = staticCache.monthYears;
  if (!monthYears || (Date.now() - staticCache.monthYearsFetchedAt) > CACHE_TTL_MS) {
    const monthYearUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=MonthYear&Mode=MonthYearNew`;
    const monthYearRes = await getWithRetry(client, monthYearUrl);
    monthYears = monthYearRes.data?.Table || [];
    staticCache.monthYears = monthYears;
    staticCache.monthYearsFetchedAt = Date.now();
  }

  const monthMap = new Map<string, string>();
  for (const item of (monthYears || [])) {
    if (item.Value && item.Id) {
      monthMap.set(String(item.Value).trim(), String(item.Id).trim());
    }
  }

  const monthId = monthMap.get(monthYear);
  if (!monthId) {
    throw new Error(`Month mapping not found for ${monthYear}`);
  }

  // 2. Fetch courses published for this month (cached)
  let monthCourses = null;
  const cachedMonth = staticCache.courseByMonth.get(monthId);
  if (cachedMonth && (Date.now() - cachedMonth.fetchedAt) < CACHE_TTL_MS) {
    monthCourses = cachedMonth.data;
  } else {
    const monthCoursesUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=CoursebyMonth&Mode=PublishCoursebyMonthNew&Monthyear=${monthId}`;
    const monthCoursesRes = await getWithRetry(client, monthCoursesUrl);
    monthCourses = monthCoursesRes.data?.Table || [];
    staticCache.courseByMonth.set(monthId, { data: monthCourses, fetchedAt: Date.now() });
  }

  // Find matching subject sections
  const subjectIds = monthCourses
    .filter((sub: any) => String(sub.SubjectCode).trim().toLowerCase() === courseCode.toLowerCase())
    .map((sub: any) => String(sub.SubjectId).trim());

  if (subjectIds.length === 0) {
    throw new Error(`Subject ID not found for ${courseCode} in ${monthYear}`);
  }

  // 3. Search roster for ViewId (cached)
  const cacheKey = `${username.toLowerCase()}||${courseCode.toLowerCase()}||${monthYear.toLowerCase()}`;
  const cachedView = staticCache.rosterViewIds.get(cacheKey);

  let foundViewId = null;
  let foundSubjectId = null;

  if (cachedView && (Date.now() - cachedView.fetchedAt) < CACHE_TTL_MS) {
    foundViewId = cachedView.viewId;
    foundSubjectId = cachedView.subjectId;
  } else {
    const userClean = username.toLowerCase();

    for (const subjectId of subjectIds) {
      try {
        const studentListUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=ResultView&Mode=NewResultViewFaculty&Coursename=${subjectId}`;
        const studentListRes = await getWithRetry(client, studentListUrl, { timeout: 20000 });
        const students = studentListRes.data?.Table || [];

        const matchingStudent = students.find((stud: any) => {
          const regClean = String(stud.RegNo || '').trim().toLowerCase();
          return regClean === userClean || regClean.startsWith(userClean) || userClean.startsWith(regClean);
        });

        if (matchingStudent && matchingStudent.ViewId) {
          foundViewId = String(matchingStudent.ViewId).trim();
          foundSubjectId = subjectId;
          staticCache.rosterViewIds.set(cacheKey, {
            viewId: foundViewId,
            subjectId: foundSubjectId,
            fetchedAt: Date.now()
          });
          break;
        }
      } catch (err) {
        console.warn(`[MarksAPI] Error checking subject ${subjectId}:`, err);
      }
    }
  }

  if (!foundViewId || !foundSubjectId) {
    throw new Error('Student View ID not found in roster');
  }

  // 4. Fetch marks split
  const marksUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=ViewMarks&Mode=MarkSplitbyId&Id=${foundSubjectId}&Id2=${foundViewId}`;
  const marksRes = await getWithRetry(client, marksUrl, { timeout: 20000 });
  const marksTable = marksRes.data?.Table || [];

  return marksTable.map((m: any) => ({
    RubricCategory: m.RubricCategory,
    Type: m.Type,
    OrginalConvertedMark: m.OrginalConvertedMark !== undefined ? m.OrginalConvertedMark : (m.OriginalConvertedMark !== undefined ? m.OriginalConvertedMark : null),
    RubricsMaxMark: m.RubricsMaxMark,
    IsPassed: m.IsPassed
  }));
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const username = body.username?.trim();
    const sessionId = body.sessionId?.trim();

    if (!username) {
      return NextResponse.json({ error: 'username is required' }, { status: 400 });
    }

    // Create session client using the provided sessionId.
    // Use a per-client httpsAgent instead of the global env flag to avoid noisy TLS warnings.
    const jar = new CookieJar();
    if (sessionId) {
      await jar.setCookie(`ASP.NET_SessionId=${sessionId}; Domain=arms.sse.saveetha.com; Path=/`, ARMS_BASE_URL);
    }

    const client = wrapper(axios.create({
      jar,
      withCredentials: true,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
      },
      timeout: 25000
    }));

    // Check if bulk request
    if (body.courses && Array.isArray(body.courses)) {
      const encoder = new TextEncoder();
      let isClosed = false;

      const stream = new ReadableStream({
        async start(controller) {
          // Fire all course requests in parallel (matches Python asyncio.gather speed)
          const promises = body.courses.map(async (c: any) => {
            try {
              const marks = await resolveCourse(client, username, c.courseCode, c.monthYear);
              if (isClosed) return;
              const data = JSON.stringify({ sno: c.sno, marks, error: null });
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            } catch (err: any) {
              console.warn(`[MarksAPI] Bulk error for course ${c.courseCode}:`, err.message);
              if (isClosed) return;
              const data = JSON.stringify({ sno: c.sno, marks: null, error: err.message || 'Failed' });
              try {
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } catch (e) {}
            }
          });

          // Wait for all parallel fetches to finish
          await Promise.all(promises);

          if (!isClosed) {
            try {
              controller.close();
            } catch (e) {}
          }
        },
        cancel() {
          isClosed = true;
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

    // Single request flow
    const courseCode = body.courseCode?.trim();
    const monthYear = body.monthYear?.trim();

    if (!courseCode || !monthYear) {
      return NextResponse.json({ error: 'courseCode and monthYear are required for single mode' }, { status: 400 });
    }

    const marks = await resolveCourse(client, username, courseCode, monthYear);
    return NextResponse.json({ success: true, marks });

  } catch (error: any) {
    console.error('[MarksAPI] Error fetching marks:', error);
    return NextResponse.json({ error: error.message || 'Server error' }, { status: 500 });
  }
}
