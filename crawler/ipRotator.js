/**
 * IP 로테이터 - 안드로이드 폰 모바일 데이터 토글로 IP 변경 (Wi-Fi 핫스팟 버전)
 *
 * 동작 원리:
 *   1. ADB로 폰의 모바일 데이터 OFF (svc data disable)
 *   2. 3초 대기 (통신사 세션 종료)
 *   3. 모바일 데이터 ON (svc data enable) → 새 IP 할당
 *   4. 외부 IP 조회로 변경 확인
 *
 * 요구사항:
 *   - PC에 adb 설치 (`brew install android-platform-tools` 또는 platform-tools 다운로드)
 *   - 폰 개발자 옵션 → USB 디버깅 ON
 *   - 폰의 Wi-Fi 핫스팟 ON, PC에서 핫스팟에 연결
 *   - USB 케이블은 ADB 명령 전용으로 연결
 *   - 폰의 데이터(4G/5G)가 켜져있어야 함
 */

const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

// ============= 설정 =============
const CONFIG = {
  adbPath: process.env.ADB_PATH || 'adb',  // adb 실행 파일 경로
  deviceId: process.env.ADB_DEVICE_ID || '', // 여러 기기 연결 시 특정 기기 선택 (adb devices로 확인)
  dataOffDuration: 3000,      // 모바일 데이터 OFF 유지 시간(ms)
  reconnectWaitTime: 7000,    // 모바일 데이터 ON 후 재연결 대기(ms)
  maxRetries: 3,              // IP 변경 실패 시 재시도 횟수
  ipCheckTimeout: 8000,
};

// ============= ADB 명령 헬퍼 =============
function adbCmd(command) {
  const deviceFlag = CONFIG.deviceId ? `-s ${CONFIG.deviceId}` : '';
  return `${CONFIG.adbPath} ${deviceFlag} ${command}`;
}

async function runAdb(command) {
  try {
    const { stdout, stderr } = await execAsync(adbCmd(command), { timeout: 10000 });
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// ============= 폰 연결 상태 확인 =============
async function checkDeviceConnected() {
  const result = await runAdb('devices');
  if (!result.ok) {
    throw new Error(
      'ADB 명령 실행 실패. adb가 설치되어 있고 PATH에 등록되어 있는지 확인하세요.\n' +
      '설치: brew install android-platform-tools (Mac)\n원본 오류: ' + result.error
    );
  }
  // "List of devices attached\n<id>\tdevice" 형태에서 device 라인 찾기
  const lines = result.stdout.split('\n').slice(1);
  const connectedDevices = lines
    .filter(l => l.includes('\tdevice'))
    .map(l => l.split('\t')[0]);

  if (connectedDevices.length === 0) {
    throw new Error(
      '연결된 안드로이드 기기가 없습니다.\n' +
      '확인 사항:\n' +
      '  1) USB 케이블로 폰 연결\n' +
      '  2) 폰의 [개발자 옵션 → USB 디버깅] 켜기\n' +
      '  3) 폰에 뜬 "USB 디버깅 허용" 팝업 승인\n' +
      '  4) `adb devices` 명령으로 직접 확인'
    );
  }

  return connectedDevices;
}

// ============= 모바일 데이터 제어 =============
/**
 * 모바일 데이터 ON/OFF (Wi-Fi 핫스팟은 유지됨)
 * @param {boolean} enable - true: 데이터 ON, false: 데이터 OFF
 */
async function setMobileData(enable) {
  const cmd = enable ? 'svc data enable' : 'svc data disable';
  const result = await runAdb(`shell ${cmd}`);
  if (!result.ok) {
    throw new Error(`모바일 데이터 ${enable ? 'ON' : 'OFF'} 실패: ${result.error}`);
  }
}

/**
 * 외부 IP 조회 (모바일 데이터 IP)
 * PC가 폰 핫스팟에 연결되어 있으므로 PC의 curl = 모바일 IP
 */
async function getDeviceExternalIp() {
  const services = [
    'https://api.ipify.org',
    'https://ifconfig.me/ip',
    'https://icanhazip.com',
  ];

  // 1) PC에서 직접 조회 (핫스팟 경유 → 모바일 IP)
  for (const url of services) {
    try {
      const { stdout } = await execAsync(
        `curl -s --max-time 5 ${url}`,
        { timeout: CONFIG.ipCheckTimeout }
      );
      const ip = stdout.trim();
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        return ip;
      }
    } catch (err) {
      continue;
    }
  }

  // 2) 폴백: 폰에서 직접 조회 (curl이 있는 경우)
  for (const url of services) {
    const result = await runAdb(
      `shell timeout 5 curl -s --max-time 5 ${url}`
    );
    if (result.ok && result.stdout) {
      const ip = result.stdout.trim();
      if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(ip)) {
        return ip;
      }
    }
  }

  return null;
}

// ============= 메인 IP 변경 함수 =============
/**
 * IP를 새 IP로 변경합니다.
 * @returns {Promise<{success: boolean, oldIp: string, newIp: string, attempts: number}>}
 */
async function rotateIp() {
  await checkDeviceConnected();

  console.log('[IP 회전] 시작...');
  const oldIp = await getDeviceExternalIp();
  console.log(`[IP 회전] 현재 IP: ${oldIp || '확인 불가'}`);

  for (let attempt = 1; attempt <= CONFIG.maxRetries; attempt++) {
    console.log(`[IP 회전] 시도 ${attempt}/${CONFIG.maxRetries}`);

    // 1. 모바일 데이터 OFF
    console.log('  → 모바일 데이터 OFF');
    await setMobileData(false);
    await sleep(CONFIG.dataOffDuration);

    // 2. 모바일 데이터 ON
    console.log('  → 모바일 데이터 ON');
    await setMobileData(true);

    // 3. 재연결 대기
    console.log(`  → 재연결 대기 ${CONFIG.reconnectWaitTime / 1000}초...`);
    await sleep(CONFIG.reconnectWaitTime);

    // 4. 새 IP 확인
    const newIp = await getDeviceExternalIp();
    console.log(`  → 새 IP: ${newIp || '확인 불가'}`);

    if (newIp && newIp !== oldIp) {
      console.log(`[IP 회전 성공] ${oldIp} → ${newIp}`);
      return { success: true, oldIp, newIp, attempts: attempt };
    }

    if (newIp === oldIp) {
      console.log('  ⚠️ IP가 동일함, 재시도...');
    } else {
      console.log('  ⚠️ IP 조회 실패, 재시도...');
    }
  }

  // 모든 재시도 실패
  return {
    success: false,
    oldIp,
    newIp: null,
    attempts: CONFIG.maxRetries,
    error: 'IP 변경에 실패했습니다. 폰이 4G/5G에 연결되어 있는지 확인하세요.',
  };
}

// ============= 유틸 =============
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = {
  rotateIp,
  getDeviceExternalIp,
  checkDeviceConnected,
  setMobileData,
};
