import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Bot, Camera, CheckCircle2 } from 'lucide-react';
import { resolveHomeRoute, useAppDispatch, useAppState, useAppSync } from '../context/AppContext';
import { analyzeMissionPhoto, completeMission } from '../api/missionApi';
import { isBackendEnabled } from '../api/client';
import { resizeImageFile, toUploadFile } from '../utils/resizeImage';

export default function MissionVerifyPage() {
  const { missionId } = useParams();
  const state = useAppState();
  const dispatch = useAppDispatch();
  const sync = useAppSync();
  const navigate = useNavigate();

  const mission = state.missions.find((m) => m.id === missionId);

  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('idle'); // idle | loading | done
  // AI가 인증 사진에서 무엇을 봤는지(서버 recognized).
  const [recognized, setRecognized] = useState(null);
  const [error, setError] = useState('');

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file || !mission) return;

    setStatus('loading');
    setError('');

    // 백엔드 모드에서는 미션 완료/코인 지급을 서버가 처리한다 — 사진을 반드시 함께 보내야
    // 서버가 미션과 맞는지 AI로 판정한다. 맞지 않으면 MISSION_004로 거절된다.
    // 카메라 원본 그대로가 아니라 줄여서 올린다 (toUploadFile 주석 참고).
    const verify = toUploadFile(file).then((upload) =>
      isBackendEnabled ? completeMission(mission.id, upload) : analyzeMissionPhoto(upload),
    );

    Promise.all([resizeImageFile(file), verify])
      .then(([thumbnail, result]) => {
        setPreview(thumbnail);
        setRecognized(result?.recognized ?? null);
        setStatus('done');
        dispatch({ type: 'COMPLETE_MISSION', missionId: mission.id, photo: thumbnail });
        sync();
      })
      .catch((err) => {
        // 거절됐을 때 완료로 표시하면 안 된다 — 서버가 준 사유를 그대로 보여준다.
        setPreview(null);
        setRecognized(null);
        setStatus('idle');
        // 서버가 준 사유에는 AI가 사진을 무엇으로 봤는지가 함께 담겨 온다 (MISSION_004).
        setError(err?.message || '인증에 실패했어요. 잠시 후 다시 시도해주세요');
        // 같은 파일을 다시 고를 수 있도록 입력값을 비운다(안 비우면 onChange가 안 걸린다).
        e.target.value = '';
      });
  }

  if (!mission) {
    return (
      <div className="min-h-svh flex flex-col items-center justify-center px-6 text-center">
        <p className="text-sm text-sub mb-4">미션 정보를 찾을 수 없어요</p>
        <button onClick={() => navigate(resolveHomeRoute(state))} className="text-sm text-brand font-semibold">
          돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-svh px-5 pt-8 pb-10 flex flex-col">
      <button onClick={() => navigate(-1)} className="text-sub text-sm mb-4 text-left w-fit">
        ← 뒤로
      </button>

      <p className="text-xs font-bold tracking-wide text-brand-dark uppercase mb-1">Mission Check</p>
      <h1 className="text-lg font-bold text-ink mb-1">{mission.title}</h1>
      <p className="text-sm text-sub mb-6">인증 사진을 올리면 AI가 확인해요</p>

      <label className="block rounded-2xl border-2 border-dashed border-brand/20 aspect-square flex items-center justify-center overflow-hidden mb-6 cursor-pointer bg-brand-soft/40">
        <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFile} />
        {preview ? (
          <img src={preview} alt="미션 인증 사진" className="w-full h-full object-cover" />
        ) : (
          <span className="text-sub text-sm flex flex-col items-center gap-2">
            <Camera size={30} />
            인증 사진을 선택해주세요
          </span>
        )}
      </label>

      {error && <p className="text-xs text-warn text-center mb-4">{error}</p>}

      {status === 'loading' && (
        <div className="text-center text-sub text-sm py-4">
          <Bot size={26} className="mx-auto mb-2 animate-pulse" />
          AI가 인증 사진을 확인하고 있어요...
        </div>
      )}

      {status === 'done' && (
        <div className="bg-card rounded-2xl border border-gray-300 shadow-card p-5 text-center">
          <p className="text-sm font-semibold text-brand-dark mb-2 flex items-center justify-center gap-1.5">
            <CheckCircle2 size={18} /> 미션 인증 완료!
          </p>
          {/* AI가 사진을 무엇으로 읽었는지. 백엔드가 안 내려주면(구버전) 아무것도 그리지 않는다. */}
          {recognized && <p className="text-xs text-sub mb-6">AI가 사진에서 본 것: {recognized}</p>}
          {!recognized && <div className="mb-6" />}
          <button
            onClick={() => navigate(resolveHomeRoute(state))}
            className="w-full bg-brand text-white rounded-full py-3.5 text-sm font-semibold"
          >
            돌아가기
          </button>
        </div>
      )}
    </div>
  );
}
