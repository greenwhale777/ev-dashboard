'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { AnalysisResult } from '@/types/analysis';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ev2-page-analyzer-production.up.railway.app';

// 이미지 분석 타입 정의
interface ImageAnalysis {
  imageNumber: number;
  topic: string;
  keySummary: string[];
  copywriting: {
    headline?: string;
    subCopy?: string;
    bodyText?: string;
    emphasisPhrases?: string[];
    claimStatements?: string[];
    cta?: string;
  };
  dataElements: {
    statistics?: string[];
    certifications?: string[];
    testResults?: string;
    comparisons?: string;
    percentages?: string;
    beforeAfter?: string;
  };
  visualElements: {
    layout?: string;
    background?: string;
    colorScheme?: string;
    icons?: string[];
    modelUsage?: string;
  };
}

export default function AnalysisDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (id) {
      fetchAnalysis();
    }
  }, [id]);

  const fetchAnalysis = async () => {
    if (!id) return;
    
    try {
      const response = await fetch(`${API_URL}/api/analyze/${id}`);
      const data = await response.json();

      if (data.success) {
        const analysisData = data.data || data.result;
        setAnalysis(analysisData);
      } else {
        setError('분석 결과를 찾을 수 없습니다.');
      }
      setLoading(false);
    } catch (err) {
      setError('분석 결과를 불러오는 중 오류가 발생했습니다.');
      setLoading(false);
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-slate-200 border-t-[#1E9EDE] rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">분석 결과를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-[#FAFAFA]">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="bg-white rounded-2xl border border-red-200 p-8 text-center shadow-sm">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">오류 발생</h2>
            <p className="text-slate-600 mb-6">{error}</p>
            <button
              onClick={() => router.push('/ev2')}
              className="px-6 py-3 bg-slate-900 text-white rounded-xl hover:bg-slate-800 transition-colors font-semibold"
            >
              ← 목록으로
            </button>
          </div>
        </div>
      </div>
    );
  }

  const data = analysis.analysisData;
  const imageAnalysisList: ImageAnalysis[] = data.imageAnalysis || [];

  return (
    <>
      <style jsx global>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
      `}</style>

      <div className="min-h-screen bg-[#FAFAFA]">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/ev2')}
                className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center hover:bg-[#1E293B] transition-colors"
              >
                <span className="text-white font-bold text-lg">←</span>
              </button>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-slate-900">상세페이지 분석</h1>
                <p className="text-sm text-slate-500">{formatTime(analysis.analyzedAt)}</p>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 pt-6 pb-16">
          {/* 제품 헤더 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
            <h2 className="text-2xl font-bold text-slate-900 mb-4">{data.productName}</h2>
            <div className="flex flex-wrap gap-2">
              <span className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm">
                {data.brand}
              </span>
              <span className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm">
                {data.category}
              </span>
              {data.priceRange && (
                <span className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium text-sm">
                  {data.priceRange}
                </span>
              )}
            </div>
          </div>

          {/* 상세페이지 분석 - 이미지별 */}
          {imageAnalysisList.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-[#1E9EDE] rounded-lg flex items-center justify-center text-white text-sm">📄</span>
                상세페이지 분석 ({imageAnalysisList.length}개 이미지)
              </h3>
              
              {imageAnalysisList.map((img, index) => (
                <div 
                  key={index} 
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                >
                  {/* 이미지 번호 & 토픽 헤더 */}
                  <div className="bg-[#0F172A] px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-[#1E9EDE] rounded-lg text-white font-bold text-sm">
                        #{img.imageNumber || index + 1}
                      </span>
                      <h4 className="text-white font-bold text-lg">{img.topic}</h4>
                    </div>
                  </div>

                  <div className="p-6 space-y-5">
                    {/* 핵심 요약 */}
                    {img.keySummary && img.keySummary.length > 0 && (
                      <div>
                        <h5 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">핵심 포인트</h5>
                        <ul className="space-y-2">
                          {img.keySummary.map((point, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <span className="w-5 h-5 bg-[#1E9EDE]/10 text-[#1E9EDE] rounded flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span className="text-slate-700">{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 카피라이팅 */}
                    {img.copywriting && (img.copywriting.headline || img.copywriting.subCopy || img.copywriting.emphasisPhrases?.length) && (
                      <div className="bg-slate-50 rounded-xl p-4">
                        <h5 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">카피라이팅</h5>
                        <div className="space-y-2">
                          {img.copywriting.headline && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-400 w-16">헤드라인</span>
                              <span className="font-bold text-slate-900">{img.copywriting.headline}</span>
                            </div>
                          )}
                          {img.copywriting.subCopy && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-slate-400 w-16">서브카피</span>
                              <span className="text-slate-700">{img.copywriting.subCopy}</span>
                            </div>
                          )}
                          {img.copywriting.emphasisPhrases && img.copywriting.emphasisPhrases.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-slate-400 w-16 pt-1">강조문구</span>
                              <div className="flex flex-wrap gap-2">
                                {img.copywriting.emphasisPhrases.map((phrase, i) => (
                                  <span key={i} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                                    {phrase}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {img.copywriting.claimStatements && img.copywriting.claimStatements.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-slate-400 w-16 pt-1">클레임</span>
                              <div className="flex flex-wrap gap-2">
                                {img.copywriting.claimStatements.map((claim, i) => (
                                  <span key={i} className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                                    {claim}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 데이터 & 인증 */}
                    {img.dataElements && (img.dataElements.statistics?.length || img.dataElements.certifications?.length || img.dataElements.testResults) && (
                      <div className="bg-blue-50 rounded-xl p-4">
                        <h5 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-3">데이터 & 인증</h5>
                        <div className="space-y-2">
                          {img.dataElements.statistics && img.dataElements.statistics.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-blue-400 w-14 pt-1">수치</span>
                              <div className="flex flex-wrap gap-2">
                                {img.dataElements.statistics.map((stat, i) => (
                                  <span key={i} className="px-3 py-1 bg-white text-blue-700 rounded-lg text-sm font-bold border border-blue-200">
                                    {stat}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {img.dataElements.certifications && img.dataElements.certifications.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-blue-400 w-14 pt-1">인증</span>
                              <div className="flex flex-wrap gap-2">
                                {img.dataElements.certifications.map((cert, i) => (
                                  <span key={i} className="px-3 py-1 bg-white text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
                                    🏆 {cert}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          {img.dataElements.testResults && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-blue-400 w-14">테스트</span>
                              <span className="text-blue-800">{img.dataElements.testResults}</span>
                            </div>
                          )}
                          {img.dataElements.comparisons && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium text-blue-400 w-14">비교</span>
                              <span className="text-blue-800">{img.dataElements.comparisons}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* 비주얼 요소 */}
                    {img.visualElements && (img.visualElements.layout || img.visualElements.colorScheme || img.visualElements.background) && (
                      <div className="bg-purple-50 rounded-xl p-4">
                        <h5 className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-3">비주얼 구성</h5>
                        <div className="space-y-2 text-sm">
                          {img.visualElements.layout && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-purple-400 w-14 pt-0.5">레이아웃</span>
                              <span className="text-purple-800">{img.visualElements.layout}</span>
                            </div>
                          )}
                          {img.visualElements.colorScheme && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-purple-400 w-14 pt-0.5">컬러</span>
                              <span className="text-purple-800">{img.visualElements.colorScheme}</span>
                            </div>
                          )}
                          {img.visualElements.background && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-purple-400 w-14 pt-0.5">배경</span>
                              <span className="text-purple-800">{img.visualElements.background}</span>
                            </div>
                          )}
                          {img.visualElements.icons && img.visualElements.icons.length > 0 && (
                            <div className="flex items-start gap-2">
                              <span className="text-xs font-medium text-purple-400 w-14 pt-1">아이콘</span>
                              <div className="flex flex-wrap gap-1">
                                {img.visualElements.icons.map((icon, i) => (
                                  <span key={i} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">
                                    {icon}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 원본 링크 */}
          <div className="mt-8 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 mb-1">🔗 원본 페이지</h3>
                <p className="text-sm text-slate-500">올리브영에서 확인하세요</p>
              </div>
              <a
                href={analysis.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-3 bg-[#1E9EDE] hover:bg-[#1789C7] text-white rounded-xl font-semibold transition-all"
              >
                올리브영 보기 →
              </a>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
