# EV Dashboard 프론트엔드 프로젝트

## 프로젝트 개요
ASCENDERZ의 EV System(자동화 봇 시스템) 통합 대시보드 프론트엔드.

## 기술 스택
- Next.js 15 + TypeScript + Tailwind CSS
- 배포: Vercel (git push 시 자동 배포)
- URL: https://ev-dashboard-vert.vercel.app

## 시스템 구조
```
[Vercel - 이 프로젝트]  →  [Railway - EV0 백엔드]  →  [Railway - PostgreSQL]
                        →  [Railway - TikTok 백엔드]  →  (같은 DB 공유)
```

## 주요 파일
| 파일 | 역할 |
|------|------|
| app/page.tsx | EV0 메인 대시보드 (탭 구조, 통합 로그, changelog) |
| app/changelog.json | 최근 변경 이력 데이터 (대시보드에 자동 표시) |
| app/tiktok/page.tsx | TikTok 광고 분석 봇 대시보드 |
| app/ev2/page.tsx | 상세페이지 분석 봇 |
| app/ev3/accounting/page.tsx | 회계전표 봇 |

## 환경변수 (Vercel에 설정됨)
| 변수 | 값 |
|------|-----|
| NEXT_PUBLIC_EV0_API_URL | https://ev0-agent-production.up.railway.app |
| NEXT_PUBLIC_TIKTOK_API_URL | https://ev2-tiktok-analyzer-production.up.railway.app |

## 브랜드 스타일
- 컬러: 흰색, 검정, 실버, #1E9EDE (파란색)
- 다크 헤더: #0F172A ~ #1E293B 그라데이션
- 폰트: Pretendard
- UI: 깔끔하고 프로덕션 레벨 품질 유지

## 배포 방법
```powershell
git add .
git commit -m "변경 설명"
git push
```
push 후 1~2분 내 Vercel 자동 배포 완료.

## 📋 changelog 규칙 (필수)
프론트엔드 코드를 변경한 경우, **반드시** `app/changelog.json` 배열 맨 앞에 항목을 추가할 것.
```json
{ "date": "M/DD", "text": "변경 내용 요약" }
```
- date 형식: `3/07`, `12/25` (앞에 0 붙이지 않음)
- 오타 수정, 코드 정리 등 사소한 변경은 추가하지 않아도 됨
- 기능 추가, UI 변경, 설정 변경 등 사용자에게 의미 있는 변경만 추가

## ⚠️ 절대 준수 규칙

### DB 안전
1. DROP TABLE, TRUNCATE, DELETE FROM 절대 금지. 필요하면 사용자에게 먼저 확인.
2. ALTER TABLE DROP COLUMN 금지.
3. DB 스키마 변경 시 ALTER TABLE ADD COLUMN만 허용.
4. 코드(쿼리)를 현재 DB에 맞춰 수정할 것. DB 구조를 바꾸지 마.
5. DB 변경 전 반드시 현재 행 수와 스키마를 출력하고 사용자에게 보고.
6. Railway 배포 중(분석 진행 중)에는 git push 금지. 분석이 중단될 수 있음.

### 파일 안전
7. 파일 삭제/덮어쓰기 전 반드시 백업 복사본 생성. 예: copy original.js original.js.bak
8. DB 테이블 DROP이 필요한 경우에도 SELECT COUNT(*)로 확인 후 백업 SQL 생성 → 사용자 승인.

### 코딩 규칙
9. 기존 코드 구조, 스타일, 들여쓰기를 유지할 것.
10. 이 프로젝트는 프론트엔드만 담당. 백엔드 코드는 수정하지 마.
11. 대화는 한글로 진행.
