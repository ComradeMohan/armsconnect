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
  courseByMonth: new Map<string, { data: any[]; fetchedAt: number }>(),
  rosterViewIds: new Map<string, { viewId: string; subjectId: string; fetchedAt: number }>()
};

// Computes the MonthYear system ID deterministically from values like "June-2025".
// ARMS IDs follow a predictable concatenation: numericMonth + 4-digitYear (e.g. June-2025 -> 6 + 2025 -> "62025").
function getMonthIdFromValue(value: string): string | null {
  const parts = value.split('-');
  if (parts.length !== 2) return null;
  const monthName = parts[0].trim().toLowerCase();
  const year = parts[1].trim();

  const monthNames = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
  const shortMonthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

  let monthVal = monthNames.indexOf(monthName) + 1;
  if (monthVal === 0) {
    monthVal = shortMonthNames.indexOf(monthName.substring(0, 3)) + 1;
  }

  if (monthVal === 0) return null;
  return `${monthVal}${year}`;
}

async function getWithRetry(client: any, url: string, options: any = {}, retries = 0): Promise<any> {
  const mergedOptions = {
    timeout: 6000, // 6 seconds default timeout for Saveetha API requests
    ...options
  };

  for (let i = 0; i <= retries; i++) {
    try {
      return await client.get(url, mergedOptions);
    } catch (err: any) {
      if (i === retries) throw err;
      const delay = 1000 * (i + 1);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

async function resolveCourse(client: any, username: string, courseCode: string, monthYear: string): Promise<any> {
  // Deterministically compute the MonthYear ID directly from value - avoids 1 external HTTP request
  const monthId = getMonthIdFromValue(monthYear);
  if (!monthId) {
    throw new Error(`Invalid monthYear format: ${monthYear}`);
  }

  // 2. Fetch courses published for this month (cached)
  let monthCourses = null;
  const cachedMonth = staticCache.courseByMonth.get(monthId);
  if (cachedMonth && (Date.now() - cachedMonth.fetchedAt) < CACHE_TTL_MS) {
    monthCourses = cachedMonth.data;
  } else {
    const monthCoursesUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=CoursebyMonth&Mode=PublishCoursebyMonthNew&Monthyear=${monthId}`;
    const monthCoursesRes = await getWithRetry(client, monthCoursesUrl, {}, 0);
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
    const sectionBatchSize = 5; // Query 5 rosters in parallel at a time to prevent socket exhaustion

    for (let i = 0; i < subjectIds.length; i += sectionBatchSize) {
      const batch = subjectIds.slice(i, i + sectionBatchSize);
      
      const rosterPromises = batch.map(async (subjectId: any) => {
        try {
          const studentListUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=ResultView&Mode=NewResultViewFaculty&Coursename=${subjectId}`;
          const studentListRes = await getWithRetry(client, studentListUrl, { timeout: 5000 }, 0);
          const students = studentListRes.data?.Table || [];

          const matchingStudent = students.find((stud: any) => {
            const regClean = String(stud.RegNo || '').trim().toLowerCase();
            return regClean === userClean || regClean.startsWith(userClean) || userClean.startsWith(regClean);
          });

          if (matchingStudent && matchingStudent.ViewId) {
            return {
              viewId: String(matchingStudent.ViewId).trim(),
              subjectId
            };
          }
        } catch (err: any) {
          // Quietly ignore section errors during search
        }
        return null;
      });

      const results = await Promise.all(rosterPromises);
      const successfulResult = results.find(r => r !== null);

      if (successfulResult) {
        foundViewId = successfulResult.viewId;
        foundSubjectId = successfulResult.subjectId;
        staticCache.rosterViewIds.set(cacheKey, {
          viewId: foundViewId,
          subjectId: foundSubjectId,
          fetchedAt: Date.now()
        });
        break; // Found the student! Stop searching subsequent batches.
      }
    }
  }

  if (!foundViewId || !foundSubjectId) {
    throw new Error('Student View ID not found in roster');
  }

  // 4. Fetch marks split
  const marksUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=ViewMarks&Mode=MarkSplitbyId&Id=${foundSubjectId}&Id2=${foundViewId}`;
  const marksRes = await getWithRetry(client, marksUrl, { timeout: 6000 }, 0);
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
      // 1. Extract all unique sessions (monthIds) needed for the requested courses using local logic
      const uniqueMonthIds = new Set<string>();
      for (const c of body.courses) {
        const monthId = getMonthIdFromValue(c.monthYear);
        if (monthId) uniqueMonthIds.add(monthId);
      }

      // 3. Pre-fetch all course registries for these unique sessions in parallel
      const monthIdArray = Array.from(uniqueMonthIds);
      await Promise.all(monthIdArray.map(async (monthId) => {
        const cached = staticCache.courseByMonth.get(monthId);
        if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS) return;

        try {
          const monthCoursesUrl = `${ARMS_BASE_URL}/Handler/Controller.ashx?Page=CoursebyMonth&Mode=PublishCoursebyMonthNew&Monthyear=${monthId}`;
          const monthCoursesRes = await getWithRetry(client, monthCoursesUrl);
          const data = monthCoursesRes.data?.Table || [];
          staticCache.courseByMonth.set(monthId, { data, fetchedAt: Date.now() });
        } catch (err: any) {
          console.warn(`[MarksAPI] Pre-fetch CoursebyMonth failed for ${monthId}:`, err.message);
        }
      }));

      const encoder = new TextEncoder();
      let isClosed = false;

      const stream = new ReadableStream({
        async start(controller) {
          const concurrency = 8; // Fetch 8 courses in parallel at a time to prevent server overloading
          const batches: any[][] = [];
          
          for (let i = 0; i < body.courses.length; i += concurrency) {
            batches.push(body.courses.slice(i, i + concurrency));
          }

          for (const batch of batches) {
            if (isClosed) break;
            
            const promises = batch.map(async (c: any) => {
              const startTime = performance.now();
              console.log(`[MarksAPI] [START] Fetching marks for ${c.courseCode} (${c.monthYear})`);
              try {
                const marks = await resolveCourse(client, username, c.courseCode, c.monthYear);
                const duration = Math.round(performance.now() - startTime);
                console.log(`[MarksAPI] [SUCCESS] ${c.courseCode} resolved in ${duration}ms (${marks?.length || 0} rubrics)`);
                
                if (isClosed) return;
                const data = JSON.stringify({ sno: c.sno, marks, error: null });
                controller.enqueue(encoder.encode(`data: ${data}\n\n`));
              } catch (err: any) {
                const duration = Math.round(performance.now() - startTime);
                console.error(`[MarksAPI] [FAIL] ${c.courseCode} failed in ${duration}ms: ${err.message}`);
                
                if (isClosed) return;
                const data = JSON.stringify({ sno: c.sno, marks: null, error: err.message || 'Failed' });
                try {
                  controller.enqueue(encoder.encode(`data: ${data}\n\n`));
                } catch (e) {}
              }
            });

            // Wait for the current batch of 8 to complete before starting the next
            await Promise.all(promises);
          }

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
