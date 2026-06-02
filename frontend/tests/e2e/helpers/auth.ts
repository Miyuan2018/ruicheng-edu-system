import { APIRequestContext, BrowserContext, Page } from '@playwright/test';

const API_BASE = 'http://localhost:8001/api/v1';

/** 从 SVG base64 中提取验证码 */
function extractCaptchaCode(svgBase64: string): string | null {
  try {
    const svg = Buffer.from(svgBase64.split(',')[1] || '', 'base64').toString();
    const m = svg.match(/>([A-Z0-9]+)</);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

/** 获取 captcha key + code */
async function fetchCaptcha(request: APIRequestContext) {
  const r = await request.get(`${API_BASE}/auth/captcha`);
  if (r.status() !== 200) return null;
  const body = await r.json();
  const data = body?.data || body;
  const key = data.captcha_key;
  const code = extractCaptchaCode(data.captcha_svg || '');
  return key && code ? { key, code } : null;
}

/**
 * 教师/管理员 2-step 登录
 */
async function adminLogin(
  request: APIRequestContext,
  username: string,
  password: string,
  adminType: number
): Promise<{ token: string; refresh: string } | null> {
  const cap = await fetchCaptcha(request);
  if (!cap) return null;

  // Step 1: verify identity
  const vResp = await request.post(`${API_BASE}/auth/admin/verify`, {
    data: { username, password, captcha_key: cap.key, captcha_code: cap.code, admin_type: adminType },
    headers: { 'Content-Type': 'application/json' },
  });
  if (vResp.status() !== 200) {
    console.log(`  [auth] admin verify failed for ${username}: ${vResp.status()}`);
    return null;
  }
  const vBody = await vResp.json();
  const vToken = vBody?.verify_token || vBody?.data?.verify_token;
  if (!vToken) return null;

  // Step 2: login
  const cap2 = await fetchCaptcha(request);
  if (!cap2) return null;

  const lResp = await request.post(`${API_BASE}/auth/admin/login`, {
    data: { username, password, verify_token: vToken, sms_code: '111111', captcha_key: cap2.key, captcha_code: cap2.code, admin_type: adminType },
    headers: { 'Content-Type': 'application/json' },
  });
  if (lResp.status() !== 200) {
    console.log(`  [auth] admin login failed for ${username}: ${lResp.status()}`);
    return null;
  }
  const lBody = await lResp.json();
  const token = lBody?.access_token || lBody?.data?.access_token;
  const refresh = lBody?.refresh_token || lBody?.data?.refresh_token;
  return token ? { token, refresh: refresh || '' } : null;
}

/**
 * 学生单步登录 (username/phone + captcha + sms_code=111111)
 */
async function studentLogin(
  request: APIRequestContext,
  username: string
): Promise<{ token: string; refresh: string; name: string } | null> {
  const cap = await fetchCaptcha(request);
  if (!cap) return null;

  const r = await request.post(`${API_BASE}/auth/student/login`, {
    data: { username, captcha_key: cap.key, captcha_code: cap.code, sms_code: '111111' },
    headers: { 'Content-Type': 'application/json' },
  });
  if (r.status() !== 200) {
    console.log(`  [auth] student login failed for ${username}: ${r.status()}`);
    return null;
  }
  const body = await r.json();
  const token = body?.access_token || body?.data?.access_token;
  const refresh = body?.refresh_token || body?.data?.refresh_token;
  const name = body?.full_name || body?.data?.full_name || 'Student';
  return token ? { token, refresh: refresh || '', name } : null;
}

/**
 * 登录并注入 token 到浏览器 localStorage
 */
export async function loginViaApi(
  context: BrowserContext,
  page: Page,
  credentials: { username: string; password?: string; userType?: string }
) {
  const { request } = context;
  const userType = credentials.userType || 'STUDENT';

  if (userType === 'STUDENT') {
    const result = await studentLogin(request, credentials.username);
    if (!result) return false;
    await page.goto('/');
    await page.evaluate(
      ({ token, refresh, name }) => {
        localStorage.setItem('access_token', token);
        localStorage.setItem('refresh_token', refresh || '');
        localStorage.setItem('user_type', 'STUDENT');
        localStorage.setItem('user_name', name);
      },
      { token: result.token, refresh: result.refresh, name: result.name }
    );
    await page.goto('/dashboard');
    return true;
  }

  // Admin/Teacher/SysAdmin
  let adminType = 0; // TEACHER
  if (userType === 'QUESTION_ADMIN' || userType === 'QUESTIONADMIN') adminType = 1;
  else if (userType === 'SYS_ADMIN' || userType === 'SYSADMIN') adminType = 2;

  const result = await adminLogin(request, credentials.username, credentials.password || '', adminType);
  if (!result) return false;

  await page.goto('/');
  await page.evaluate(
    ({ token, refresh, userType }) => {
      localStorage.setItem('access_token', token);
      localStorage.setItem('refresh_token', refresh || '');
      localStorage.setItem('user_type', userType);
      localStorage.setItem('user_name', 'TestUser');
    },
    { token: result.token, refresh: result.refresh, userType }
  );
  await page.goto('/dashboard');
  return true;
}

export async function apiHealth(request: APIRequestContext) {
  const r = await request.get(`${API_BASE.replace('/api/v1', '')}/health`);
  return { status: r.status(), body: await r.json() };
}

export async function apiGet(request: APIRequestContext, path: string) {
  const r = await request.get(`${API_BASE}${path}`);
  try { return { status: r.status(), body: await r.json() }; }
  catch { return { status: r.status(), body: null }; }
}
