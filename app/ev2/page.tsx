'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { AnalysisStartResponse, AnalysisStatusResponse, AnalysisListItem } from '@/types/analysis';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ev2-page-analyzer-production.up.railway.app';

export default function EV2Page() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [results, setResults] = useState<AnalysisListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchResults();
  }, []);

  const fetchResults = async () => {
    try {
      const response = await fetch(`${API_URL}/api/analyze/results?limit=20`);
      const data = await response.json();

      if (data.success) {
        setResults(data.results || data.data);
      }
      setLoading(false);
    } catch (err) {
      console.error('결과 목록 조회 실패:', err);
      setLoading(false);
    }
  };

  const startAnalysis = async () => {
    if (!url) {
      setError('URL을 입력해주세요.');
      return;
    }

    if (!url.includes('oliveyoung.co.kr')) {
      setError('올리브영 상품 URL을 입력해주세요.');
      return;
    }

    setAnalyzing(true);
    setError(null);
    setProgress(0);
    setProgressMessage('분석 시작 중...');

    try {
      const startRes = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });

      const startData: AnalysisStartResponse = await startRes.json();

      if (!startData.success) {
        throw new Error(startData.message || '분석 시작 실패');
      }

      const analysisId = startData.analysisId;

      const pollStatus = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/api/analyze/${analysisId}/status`);
          const statusData: any = await statusRes.json();

          const progressValue = typeof statusData.progress === 'object'
            ? (statusData.progress?.percent || 0)
            : (statusData.progress || 0);

          const progressMsg = typeof statusData.progress === 'object'
            ? (statusData.progress?.currentStep || '처리 중...')
            : (statusData.progressMessage || '처리 중...');

          setProgress(progressValue);
          setProgressMessage(progressMsg);

          if (statusData.status === 'completed') {
            clearInterval(pollStatus);
            setAnalyzing(false);
            setUrl('');
            fetchResults();

            setTimeout(() => {
              router.push(`/ev2/analysis/${analysisId}`);
            }, 1000);
          } else if (statusData.status === 'failed') {
            clearInterval(pollStatus);
            setAnalyzing(false);
            setError(statusData.error || '분석에 실패했습니다.');
          }
        } catch (err) {
          console.error('상태 조회 오류:', err);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollStatus);
        if (analyzing) {
          setAnalyzing(false);
          setError('분석 시간이 초과했습니다.');
        }
      }, 180000);

    } catch (err: any) {
      console.error('분석 시작 오류:', err);
      setAnalyzing(false);
      setError(err.message || '분석 시작 중 오류가 발생했습니다.');
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  return (
    <>
      <style jsx global>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center hover:bg-[#1E293B] transition-all cursor-pointer active:scale-90 hover:scale-105"
              >
                <span className="text-white font-bold text-lg">EV</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">EV2 - 부스팅 분석</h1>
                <p className="text-sm text-slate-500">올리브영 상품 & TikTok 광고 분석</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 pt-6 pb-8">
          {/* 봇 선택 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-2xl border-2 border-blue-200 p-5 shadow-sm">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🔍</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">봇 #2 상세페이지 분석</h3>
                  <p className="text-xs text-slate-500">올리브영 상품 AI 분석</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-3">상품 URL을 입력하면 AI가 상세페이지를 분석하여 마케팅 인사이트를 제공합니다.</p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full font-medium">현재 페이지</span>
                <span className="text-xs text-slate-400">분석 {results?.length || 0}건</span>
              </div>
            </div>

            <button
              onClick={() => router.push('/ev2/tiktok')}
              className="bg-white rounded-2xl border-2 border-slate-200 p-5 shadow-sm hover:border-purple-300 hover:shadow-md transition-all text-left cursor-pointer active:scale-[0.99]"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">🎵</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">봇 #3 TikTok 광고 분석</h3>
                  <p className="text-xs text-slate-500">키워드 기반 인기 콘텐츠 수집</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 mb-3">키워드별 TikTok 상위 영상을 자동 수집하고 트렌드 변동을 분석합니다.</p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-full font-medium">바로가기 →</span>
                <span className="text-xs text-slate-400">매일 10시 자동 수집</span>
              </div>
            </button>
          </div>

          {/* 상품 분석 섹션 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
            <div className="flex items-center gap-3 mb-6">
              <span className="text-3xl">🔍</span>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">상품 분석 시작</h2>
                <p className="text-sm text-slate-500">올리브영 상품 URL을 입력하세요</p>
              </div>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-center gap-2 text-red-600">
                  <span>❌</span>
                  <span className="font-medium">{error}</span>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <input
                type="url"
                placeholder="https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={analyzing}
                className="w-full p-4 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-[#3B82F6] focus:border-[#3B82F6] outline-none text-lg disabled:bg-slate-100"
                onKeyDown={(e) => e.key === 'Enter' && !analyzing && startAnalysis()}
              />

              <button
                onClick={startAnalysis}
                disabled={analyzing || !url}
                className={`w-full px-6 py-4 rounded-xl font-bold text-lg transition-all ${analyzing || !url
                    ? 'bg-slate-300 cursor-not-allowed text-slate-500'
                    : 'bg-[#3B82F6] hover:bg-[#2563EB] text-white active:scale-[0.98] cursor-pointer'
                  }`}
              >
                {analyzing ? '분석 중...' : '🚀 분석 시작'}
              </button>
            </div>

            {analyzing && (
              <div className="mt-6 p-6 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="animate-spin h-6 w-6 border-3 border-blue-500 border-t-transparent rounded-full"></div>
                  <span className="font-bold text-blue-900 text-lg">{progressMessage}</span>
                </div>

                <div className="w-full bg-blue-200 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  ></div>
                </div>

                <div className="mt-2 text-sm text-blue-700 text-right font-semibold">{progress}%</div>

                <div className="mt-4 text-sm text-blue-600">
                  <p>⏱️ 예상 소요 시간: 1-2분</p>
                  <p className="mt-1">📌 완료되면 자동으로 결과 페이지로 이동합니다</p>
                </div>
              </div>
            )}

            {!analyzing && (
              <div className="mt-6 p-4 bg-slate-50 rounded-xl border border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-2">📌 테스트 URL:</p>
                <div className="space-y-1 text-xs">
                  <button
                    onClick={() => setUrl('https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000243074')}
                    className="block hover:text-blue-600 text-slate-600 cursor-pointer"
                  >
                    → 라네즈 립슬리핑마스크
                  </button>
                  <button
                    onClick={() => setUrl('https://www.oliveyoung.co.kr/store/goods/getGoodsDetail.do?goodsNo=A000000162054')}
                    className="block hover:text-blue-600 text-slate-600 cursor-pointer"
                  >
                    → 라운드랩 자작나무 수분토너
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 분석 결과 목록 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-slate-900">📋 분석 결과 ({results?.length || 0})</h3>
              <button
                onClick={fetchResults}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium transition-all cursor-pointer active:scale-95"
              >
                🔄 새로고침
              </button>
            </div>

            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-3 border-slate-300 border-t-slate-600 rounded-full mx-auto mb-4"></div>
                <p className="text-slate-500">로딩 중...</p>
              </div>
            ) : !results || results.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-400 text-lg">분석 결과가 없습니다</p>
                <p className="text-slate-400 text-sm mt-2">URL을 입력하여 분석을 시작하세요</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {results.map((result) => (
                  <button
                    key={result.id}
                    onClick={() => router.push(`/ev2/analysis/${result.id}`)}
                    className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all text-left cursor-pointer active:scale-[0.99]"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h4 className="text-lg font-bold text-slate-900 mb-1">{result.productName}</h4>
                        <div className="flex items-center gap-3 text-sm text-slate-500">
                          <span>🏷️ {result.brand}</span>
                          <span>·</span>
                          <span>📂 {result.category}</span>
                        </div>
                      </div>
                      <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                        완료
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mb-3 line-clamp-2">{result.summary}</p>
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>{formatTime(result.analyzedAt)}</span>
                      <span className="text-blue-500 font-medium">자세히 보기 →</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
