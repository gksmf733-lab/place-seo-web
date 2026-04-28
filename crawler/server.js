/**
 * Express 서버 (IP 회전 통합 버전)
 * - POST /api/crawl    : IP 변경 + 리뷰 크롤링 (가게당 1회 IP 변경)
 * - GET  /api/ip       : 현재 모바일 IP 조회
 * - POST /api/rotate-ip: IP만 수동으로 변경
 * - GET  /api/health   : 폰 연결 상태 확인
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { crawlReviews } = require('./crawler');
const {
  rotateIp,
  getDeviceExternalIp,
  checkDeviceConnected,
} = require('./ipRotator');

const app = express();
const PORT = process.env.PORT || 3003;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

let activeJobs = 0;
const MAX_CONCURRENT = 1; // IP 회전 사용 시 동시 1개만 (폰이 1대니까)

// ============= 메인 크롤링 엔드포인트 =============
app.post('/api/crawl', async (req, res) => {
  const { url, maxReviews = 100, rotateIpBefore = true } = req.body || {};

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ success: false, error: 'url 파라미터가 필요합니다.' });
  }
  if (!url.includes('naver')) {
    return res.status(400).json({ success: false, error: '네이버 플레이스 URL을 입력해주세요.' });
  }
  const limit = Math.min(Math.max(parseInt(maxReviews) || 100, 10), 500);

  if (activeJobs >= MAX_CONCURRENT) {
    return res.status(429).json({
      success: false,
      error: '현재 다른 작업이 실행 중입니다. (모바일 IP 회전 시 동시 작업 1개 제한)',
    });
  }

  activeJobs++;
  const startTime = Date.now();
  let ipInfo = null;

  try {
    // 1. IP 회전 (가게당 1회)
    if (rotateIpBefore) {
      console.log(`\n[${new Date().toISOString()}] === 새 작업 시작 ===`);
      console.log(`목표 URL: ${url}`);
      ipInfo = await rotateIp();

      if (!ipInfo.success) {
        return res.status(500).json({
          success: false,
          error: 'IP 회전 실패: ' + (ipInfo.error || '알 수 없는 오류'),
          ipInfo,
        });
      }
    }

    // 2. 크롤링 실행
    console.log(`[크롤링 시작] 목표 ${limit}개`);
    const result = await crawlReviews(url, limit);
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[크롤링 완료] ${result.totalCollected}개 수집 / 총 ${elapsed}초`);

    res.json({
      success: true,
      elapsedSec: parseFloat(elapsed),
      ipInfo,  // { oldIp, newIp, attempts } 포함
      ...result,
    });
  } catch (err) {
    console.error('[작업 실패]', err.message);
    res.status(500).json({
      success: false,
      error: err.message || '오류가 발생했습니다.',
      ipInfo,
    });
  } finally {
    activeJobs--;
  }
});

// ============= 현재 IP 조회 =============
app.get('/api/ip', async (req, res) => {
  try {
    await checkDeviceConnected();
    const ip = await getDeviceExternalIp();
    res.json({ success: true, ip });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============= IP만 회전 (테스트용) =============
app.post('/api/rotate-ip', async (req, res) => {
  if (activeJobs >= MAX_CONCURRENT) {
    return res.status(429).json({ success: false, error: '다른 작업이 실행 중입니다.' });
  }
  activeJobs++;
  try {
    const result = await rotateIp();
    res.json({ success: result.success, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  } finally {
    activeJobs--;
  }
});

// ============= 헬스 체크 (폰 연결 상태 포함) =============
app.get('/api/health', async (req, res) => {
  try {
    const devices = await checkDeviceConnected();
    res.json({
      status: 'ok',
      activeJobs,
      adbDevices: devices,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.json({
      status: 'phone_not_connected',
      error: err.message,
      activeJobs,
      timestamp: new Date().toISOString(),
    });
  }
});

app.listen(PORT, () => {
  console.log(`✓ 네이버 플레이스 리뷰 크롤러 (IP 회전 모드 - Wi-Fi 핫스팟)`);
  console.log(`  → http://localhost:${PORT}`);
  console.log(`\n[준비사항]`);
  console.log(`  1) 폰을 USB로 연결 (USB 디버깅 ON, ADB 전용)`);
  console.log(`  2) 폰의 Wi-Fi 핫스팟 ON → PC에서 핫스팟에 연결`);
  console.log(`  3) PC가 핫스팟을 통해 인터넷 연결 확인 (curl https://api.ipify.org)`);
  console.log(`  4) http://localhost:${PORT}/api/health 로 폰 연결 확인\n`);
});
