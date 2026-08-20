// 서버로 보낼 사진을 긴 변 기준으로 줄여서 다시 JPEG으로 굽는다.
//
// 폰 카메라 원본은 4032x3024·3MB 안팎이라 그대로 올리면 현장 네트워크 사정에 따라 업로드에만 몇 초가 걸리고,
// 서버의 multipart 상한(10MB)에 걸리는 기종도 있다. AI 판정도 저장도 1024px면 충분하다
// (서버 ImageDownscaler가 저장 전에 어차피 1024px로 줄인다).
//
// 캔버스로 다시 그리면 EXIF 회전값이 픽셀에 반영된 채로 저장되므로, 폰을 세워서 찍은 사진이
// 누워서 판정되는 일도 함께 없어진다.
//
// 브라우저가 사진을 디코딩하지 못하는 등 무슨 이유로든 실패하면 원본 File을 그대로 돌려준다 —
// 인증을 아예 못 하게 되는 것보다 크게 올리는 편이 낫다.
export function toUploadFile(file, maxSize = 1280, quality = 0.85) {
  return new Promise((resolve) => {
    const img = new Image();
    const reader = new FileReader();
    const fallback = () => resolve(file);

    reader.onerror = fallback;
    reader.onload = () => {
      img.onerror = fallback;
      img.onload = () => {
        try {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          canvas.toBlob(
            (blob) => {
              if (!blob) return fallback();
              resolve(new File([blob], 'photo.jpg', { type: 'image/jpeg' }));
            },
            'image/jpeg',
            quality,
          );
        } catch {
          fallback();
        }
      };
      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}

// localStorage 용량을 아끼기 위해 업로드한 사진을 작은 썸네일로 줄여서 저장한다.
export function resizeImageFile(file, maxSize = 400, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();

    reader.onerror = reject;
    reader.onload = () => {
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}
