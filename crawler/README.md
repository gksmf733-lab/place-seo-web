# 네이버 플레이스 리뷰 크롤러 (Wi-Fi 핫스팟 + IP 회전 버전)

> 안드로이드 폰의 Wi-Fi 핫스팟으로 연결 → 가게마다 모바일 데이터 토글로 새 IP 할당 → Stealth 크롤러로 리뷰 수집

## 🎯 핵심 동작

```
[수집 버튼 클릭]
    ↓
[ADB로 모바일 데이터 OFF → 3초 → ON] (8~15초 소요)
    ↓
[새 모바일 IP 할당됨 (CGNAT 풀)]
    ↓
[Stealth Puppeteer로 크롤링] (IP 검증 후)
    ↓
[리뷰 100~500개 수집]
```

---

## 📋 사전 준비 (꼭 한번 세팅 필요)

### 1️⃣ 안드로이드 폰 준비

| 항목 | 설정 |
|---|---|
| 데이터 | 4G/5G 무제한 요금제 권장 (LTE도 OK) |
| Wi-Fi 핫스팟 | **ON** (설정 → 연결 → 모바일 핫스팟) |
| 개발자 옵션 | ON |
| USB 디버깅 | ON |
| USB 연결 | ADB 명령 전용 (테더링 불필요) |

> 💡 **안 쓰는 폰**을 전용으로 쓰는 걸 강력 권장합니다. 모바일 데이터가 자주 끊기면 본인 폰 사용에 불편하기 때문이에요.

### 2️⃣ PC에 ADB 설치

**Mac:**
```bash
brew install android-platform-tools
adb --version  # 설치 확인
```

**Windows:**
1. https://developer.android.com/studio/releases/platform-tools 에서 다운로드
2. 압축 해제 후 PATH에 등록
3. `cmd`에서 `adb --version` 확인

**Linux:**
```bash
sudo apt-get install android-tools-adb
```

### 3️⃣ 폰 연결 확인

USB로 연결 후:
```bash
adb devices
```

처음 연결 시 폰에 **"USB 디버깅 허용?"** 팝업이 떠요. **항상 허용** 체크 후 확인.

성공 시:
```
List of devices attached
R3CT9XXXXXX     device
```

⚠️ `unauthorized`로 뜨면 폰의 USB 디버깅 팝업을 다시 확인하세요.

### 4️⃣ PC에서 폰 핫스팟에 연결 (중요!)

PC의 Wi-Fi를 폰의 핫스팟에 연결하면, PC의 인터넷 트래픽이 자동으로 폰의 모바일 데이터를 경유합니다.

**Mac:**
1. Wi-Fi 아이콘 → 폰 핫스팟 이름 선택 → 비밀번호 입력
2. 유선 LAN이 연결되어 있다면 **일시적으로 분리**하거나 비활성화

**Windows:**
1. Wi-Fi 아이콘 → 폰 핫스팟 이름 선택 → 비밀번호 입력
2. 유선 이더넷이 연결되어 있다면 잠시 비활성화

**확인:**
```bash
curl https://api.ipify.org
# 폰 4G IP가 나와야 함 (유선 IP가 나오면 유선 연결 분리 필요)
```

---

## 📦 설치 및 실행

```bash
cd naver-review-crawler
npm install      # puppeteer + stealth + extra 자동 설치
npm start
```

브라우저에서 `http://localhost:3000` 접속.

상단의 **📱 폰 연결 상태**가 초록불이고 IP가 표시되면 준비 완료.

### 🎬 사용법

1. URL 입력란에 네이버 플레이스 URL 붙여넣기
2. 수집 개수 선택 (50~500)
3. ☑ "크롤링 전에 IP 자동 변경" 체크 확인
4. ▶ **리뷰 수집 시작** 클릭
5. 진행 단계 자동 표시: `IP 변경 → 페이지 진입 → 리뷰 로드 → 데이터 추출`
6. 완료 후 JSON / CSV 다운로드 가능

---

## 🔌 API 엔드포인트

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/crawl` | IP 변경 + 리뷰 크롤링 (메인) |
| GET | `/api/ip` | 현재 모바일 IP 조회 |
| POST | `/api/rotate-ip` | IP만 수동 변경 (테스트용) |
| GET | `/api/health` | 폰 연결 상태 확인 |

### `/api/crawl` 요청 예시

```javascript
const res = await fetch('/api/crawl', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    url: 'https://map.naver.com/p/entry/place/1234567890',
    maxReviews: 200,
    rotateIpBefore: true,   // false면 IP 변경 없이 바로 크롤링
  }),
});
```

### 응답 예시

```json
{
  "success": true,
  "elapsedSec": 47.3,
  "ipInfo": {
    "success": true,
    "oldIp": "211.234.56.78",
    "newIp": "175.223.12.45",
    "attempts": 1
  },
  "place": { "id": "1234567890", "name": "스타벅스 강남점" },
  "reviews": [
    { "content": "분위기 좋아요", "rating": 5, "date": "2025.10.15", "author": "리뷰어1" }
  ],
  "totalCollected": 200
}
```

---

## 🔧 운영 사이트(Express)에 통합

### 필요 파일만 복사
```
src/
├── crawler.js     # 그대로 복사
└── ipRotator.js   # 그대로 복사
```

### 라우터 등록
```js
const { crawlReviews } = require('./crawler');
const { rotateIp } = require('./ipRotator');

app.post('/api/crawl', async (req, res) => {
  try {
    const { url, maxReviews = 100 } = req.body;
    const ipInfo = await rotateIp();
    if (!ipInfo.success) return res.status(500).json({ error: 'IP 변경 실패' });
    const result = await crawlReviews(url, maxReviews);
    res.json({ success: true, ipInfo, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
```

---

## ⚠️ 트러블슈팅

### "연결된 안드로이드 기기가 없습니다"
- `adb devices` 직접 실행해서 확인
- USB 케이블 교체 (충전만 되는 케이블이 많음)
- 폰 재부팅 후 USB 디버깅 다시 허용

### IP가 변경되지 않음 (oldIp === newIp)
- 통신사가 같은 IP를 재할당한 경우 → 데이터 OFF 시간을 늘려보세요
  - `ipRotator.js`의 `dataOffDuration: 3000` → `5000` 또는 `10000`으로 변경

### IP는 바뀌는데 PC에서 보이는 IP는 그대로
- PC가 핫스팟이 아닌 유선/다른 Wi-Fi로 연결된 것. 다른 네트워크 분리 필요
- `curl https://api.ipify.org` 실행해서 모바일 IP가 나오는지 확인

### `svc data` 명령이 작동하지 않는 경우
- 일부 기기에서는 권한 필요 → `adb shell svc data disable` 수동 테스트
- 에러 시 폰 루팅이 필요할 수 있음

### 네이버에서 차단된 것 같음 (페이지 로드 안됨)
- 모바일 IP는 차단 거의 없지만, 동일 IP에서 짧은 시간 다수 요청 시 가능
- IP 회전 후 1~2분 대기 후 재시도

### `puppeteer-extra-plugin-stealth` 에러
```bash
npm install puppeteer-extra puppeteer-extra-plugin-stealth --save
```

---

## 📊 예상 성능

| 항목 | 시간 |
|---|---|
| IP 변경 (모바일 데이터 토글) | 8~15초 |
| 리뷰 100개 수집 | 30~60초 |
| 리뷰 500개 수집 | 2~4분 |
| **총 가게 1개당** | **약 1~5분** |

---

## ⚖️ 법적 / 운영 주의사항

- 네이버 이용약관상 **자동화된 대량 크롤링은 제한**될 수 있습니다.
- **본인 가게 모니터링** 또는 **소량 분석** 용도로만 사용하시기를 권장합니다.
- 수집 데이터를 **공개 배포 / 상업적 재판매**는 권장하지 않습니다.
- 모바일 IP를 사용해도 **하루에 수백 개 가게를 수집하는 등 과도한 사용**은 통신사 약관 위반 소지가 있습니다.

---

## 📁 프로젝트 구조

```
naver-review-crawler/
├── package.json
├── README.md
├── src/
│   ├── server.js     # Express 서버 (IP 회전 통합)
│   ├── crawler.js    # Puppeteer + Stealth 크롤링
│   └── ipRotator.js  # ADB 비행기모드 토글
└── public/
    └── index.html    # 데모 UI (IP 표시, 진행상태)
```

## 🛠️ 환경변수

```bash
PORT=3003              # 서버 포트
ADB_PATH=/usr/bin/adb  # adb 경로 (커스텀 시)
ADB_DEVICE_ID=R3CT9..  # 여러 폰 연결 시 특정 기기 지정
```
