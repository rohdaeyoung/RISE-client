// 백엔드 연동 스위치.
//
// VITE_API_BASE_URL이 설정돼 있으면 실제 백엔드(Spring)를 호출하고,
// 비어 있으면 기존 mock 구현이 그대로 동작한다 — 프론트만 단독으로 띄우거나
// (Netlify 정적 배포처럼) 백엔드 없이 데모할 때를 위해 분리해 둔 것.
//
// 사용법:
//   .env.local 에  VITE_API_BASE_URL=http://localhost:8080  → 백엔드 연동
//   해당 값이 없으면                                        → mock 모드

const BASE_URL = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '') || '';
const TOKEN_KEY = 'withu_token';

export const isBackendEnabled = Boolean(BASE_URL);

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

// 토큰이 만료됐을 때 알림을 받을 곳(AppContext). 여기서 직접 상태를 건드릴 수 없어 콜백으로 넘긴다.
let onSessionExpired = null;

export function setSessionExpiredHandler(handler) {
  onSessionExpired = handler;
}

// 다시 로그인해야 하는 서버 응답인가.
//
// 상태 코드만 봐서는 안 된다. 로그인 실패(AUTH_002)도 401이라, 401을 전부 만료로 처리하면
// 비밀번호를 한 번 틀렸을 때 "로그인이 만료됐어요"가 뜬다. 서버가 토큰 문제에만 붙이는
// AUTH_003으로 좁힌다 (JwtAuthenticationEntryPoint).
//
// AUTH_004(사용자를 찾을 수 없음)도 함께 본다. 토큰은 7일짜리라 서명은 멀쩡한데 그 안의
// userId가 가리키는 계정이 사라진 경우다. 이때 아무 처리도 하지 않으면 로그아웃도 안 되고
// 미션·그룹이 전부 빈 화면이 되어, 사용자는 앱이 고장 난 것으로 본다. 실제로 하루 지나
// 다시 들어갔을 때 이 상태가 나와서, 수동으로 로그아웃했다 로그인해야 미션이 보였다.
function isSessionExpired(status, code) {
  return (status === 401 && code === 'AUTH_003') || (status === 404 && code === 'AUTH_004');
}

// 백엔드는 사진을 "/api/files/{id}" 같은 상대 경로로 내려준다. 프론트는 다른 주소(개발 시 5173,
// 배포 시 정적 호스팅)에서 돌아가므로 그대로 <img src>에 넣으면 프론트 서버를 찾아가 깨진다.
// data:/http: 로 시작하는 값(업로드 직후 미리보기 등)은 이미 완전한 주소라 그대로 둔다.
export function fileUrl(path) {
  if (!path) return null;
  if (/^(data:|blob:|https?:)/.test(path)) return path;
  return `${BASE_URL}${path}`;
}

// 백엔드는 모든 응답을 { success, data, error } 로 감싸므로 여기서 벗겨내고,
// 실패 시에는 mock이 던지던 것과 같은 모양({ field, message })으로 맞춰 던진다.
async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok || payload?.success === false) {
    const error = payload?.error;

    // 토큰이 만료되면 남은 요청도 전부 거절된다. 여기서 정리하지 않으면 sync()가 첫 요청에서
    // 멈춰 화면을 갱신하지 못하고, localStorage에 남은 어제 화면이 그대로 붙박인다.
    // (서버에는 오늘 미션이 정상 생성돼 있는데도 "미션이 안 바뀐다"로 보이던 원인.)
    if (isSessionExpired(res.status, error?.code)) {
      clearToken();
      onSessionExpired?.();
    }
    // status와 code를 함께 실어 보낸다. "서버가 아니라고 답한 것"과 "연결이 안 된 것"을 호출부에서
    // 구분해야 하는 경우가 있다 — 예를 들어 그룹 조회가 403이면 정말 그룹이 없는 것이므로 로컬
    // 상태를 지워야 하지만, 네트워크 오류라면 지우면 안 된다(잠깐 끊겼다고 그룹이 사라지면 안 됨).
    throw {
      status: res.status,
      code: error?.code ?? null,
      field: error?.field ?? null,
      message: error?.message ?? '요청을 처리하지 못했어요',
    };
  }
  return payload?.data ?? null;
}

export const api = {
  get: (path) => request(path),
  post: (path, body) => request(path, { method: 'POST', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  postForm: (path, formData) => request(path, { method: 'POST', body: formData, isForm: true }),
};
