// Babel 설정 — Expo 기본 preset + production 빌드 시 console.log 제거
// - development/테스트: 로그 그대로 유지 (진단용 __DEV__ 로그 + ENV-2 디버그)
// - production/preview (EAS): console.log 제거 (console.warn/error는 유지)
// 사용자 식별 정보(uid, email, token) 등이 프로덕션 번들에 남지 않도록 안전장치.
module.exports = function (api) {
  api.cache(true);
  const isProd = process.env.NODE_ENV === 'production';
  return {
    presets: ['babel-preset-expo'],
    plugins: isProd
      ? [['transform-remove-console', { exclude: ['error', 'warn'] }]]
      : [],
  };
};
