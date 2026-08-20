// 식단 사진 AI 분석.
// 백엔드 연동 시 POST /api/meals/{slot}/analyze (multipart) — GPT-4o Vision이 실제로 분석한다.
// 기획 상 사용자에게는 "미션 달성/미달성"만 노출하고, 목표적합도(internalFit)는
// 다음 미션 생성 기준으로만 내부에서 쓰임 — UI에서 internalFit을 표시하지 말 것.

import { api, fileUrl, isBackendEnabled } from './client';

// 오늘 인증한 식단을 서버에서 받아온다.
// 인증 결과를 브라우저 상태로만 들고 있으면 새로고침하거나 다른 기기로 들어갔을 때 사라지고,
// 그룹원에게 보이는 서버 기록과도 어긋난다. 서버가 원본이므로 여기서 다시 맞춘다.
// output: { breakfast: {achieved, photo} | null, lunch: ..., dinner: ... }
export async function fetchTodayMeals() {
  if (!isBackendEnabled) return null;
  const data = await api.get('/api/meals/today');
  const meals = { breakfast: null, lunch: null, dinner: null };
  for (const m of data?.meals ?? []) {
    meals[m.slot.toLowerCase()] = { achieved: m.achieved, photo: fileUrl(m.photoUrl) };
  }
  return meals;
}

function pickInternalFit() {
  const r = Math.random();
  if (r < 0.6) return 'good';
  if (r < 0.85) return 'normal';
  return 'bad';
}

// input: (File, mealKey). output: { achieved: boolean, recognized?: string, internalFit?: 'good'|'normal'|'bad' }
// recognized는 AI가 사진에서 본 것("단백질 음료" 등). 백엔드 모드에서만 내려오고, 화면에 그대로 보여준다 —
// internalFit과 달리 감추는 값이 아니다. 판정이 사진을 실제로 읽은 결과임을 사용자가 확인할 수 있어야 한다.
export function analyzeMealPhoto(file, mealKey, { foodName, portion } = {}) {
  if (isBackendEnabled) {
    const form = new FormData();
    form.append('photo', file);
    if (foodName) form.append('foodName', foodName);
    if (portion) form.append('portion', portion);
    // 백엔드는 internalFit을 응답에 내려주지 않는다(내부 전용) — 프론트는 achieved만 쓴다.
    return api.postForm(`/api/meals/${mealKey.toUpperCase()}/analyze`, form);
  }

  return new Promise((resolve) => {
    setTimeout(() => {
      const internalFit = pickInternalFit();
      resolve({ achieved: internalFit !== 'bad', internalFit });
    }, 1200);
  });
}
