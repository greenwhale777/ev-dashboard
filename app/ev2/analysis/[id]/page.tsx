'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { AnalysisResult } from '@/types/analysis';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ev2-page-analyzer-production.up.railway.app';

// 블록 분석 타입 정의 (새 구조)
interface BlockAnalysis {
  blockNumber: number;
  blockTitle: string;
  blockType: string;
  boundaryReason: string;
  sourceImageNumbers: number[];
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
    percentages?: string[];
    beforeAfter?: string;
  };
  visualElements: {
    layout?: string;
    background?: string;
    colorScheme?: string;
    icons?: string[];
    modelUsage?: string;
    productShot?: string;
    overallStyle?: string;
  };
}

// 분할 계획 타입
interface SegmentationPlan {
  blockNumber: number;
  shortTitle: string;
  boundaryReason: string;
  sourceImageNumbers: number[];
}

// 분석 메타데이터 타입
interface AnalysisMetadata {
  totalBlocks: number;
  blockTypeDistribution: Record<string, number>;
  excludedContent: string[] | string;
}

// 블록 타입별 색상 및 아이콘 매핑
const blockTypeConfig: Record<string, { color: string; bgColor: string; icon: string; label: string }> = {
  hero: { color: 'text-rose-700', bgColor: 'bg-rose-100', icon: '🎯', label: '히어로' },
  benefit: { color: 'text-emerald-700', bgColor: 'bg-emerald-100', icon: '✨', label: '베네핏' },
  ingredient: { color: 'text-amber-700', bgColor: 'bg-amber-100', icon: '🧪', label: '성분' },
  clinical: { color: 'text-blue-700', bgColor: 'bg-blue-100', icon: '📊', label: '임상' },
  social_proof: { color: 'text-purple-700', bgColor: 'bg-purple-100', icon: '🏆', label: '신뢰' },
  how_to: { color: 'text-cyan-700', bgColor: 'bg-cyan-100', icon: '📝', label: '사용법' },
  texture: { color: 'text-pink-700', bgColor: 'bg-pink-100', icon: '💧', label: '텍스처' },
  package: { color: 'text-indigo-700', bgColor: 'bg-indigo-100', icon: '📦', label: '패키지' },
  promotion: { color: 'text-orange-700', bgColor: 'bg-orange-100', icon: '🎁', label: '프로모션' },
  review: { color: 'text-teal-700', bgColor: 'bg-teal-100', icon: '💬', label: '리뷰' },
  cta: { color: 'text-red-700', bgColor: 'bg-red-100', icon: '🛒', label: 'CTA' },
  brand_story: { color: 'text-slate-700', bgColor: 'bg-slate-100', icon: '📖', label: '브랜드' },
};

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

  const getBlockTypeStyle = (blockType: string) => {
    return blockTypeConfig[blockType] || { 
      color: 'text-slate-700', 
      bgColor: 'bg-slate-100', 
      icon: '📄', 
      label: blockType 
    };
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
  const blockAnalysisList: BlockAnalysis[] = data.blockAnalysis || [];
  const segmentationPlan: SegmentationPlan[] = data.segmentationPlan || [];
  const metadata: AnalysisMetadata | null = data.analysisMetadata || null;

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

          {/* 요약 정보 */}
          {data.summary && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <span className="w-8 h-8 bg-[#1E9EDE] rounded-lg flex items-center justify-center text-white text-sm">📋</span>
                분석 요약
              </h3>
              <p className="text-slate-700 leading-relaxed">{data.summary}</p>
            </div>
          )}

          {/* 분석 메타데이터 */}
          {metadata && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white text-sm">📊</span>
                분석 개요
              </h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                <div className="bg-slate-50 rounded-xl p-4 text-center">
                  <div className="text-3xl font-bold text-[#1E9EDE]">{metadata.totalBlocks}</div>
                  <div className="text-sm text-slate-500 mt-1">총 블록 수</div>
                </div>
                {metadata.blockTypeDistribution && Object.entries(metadata.blockTypeDistribution)
                  .filter(([_, count]) => count > 0)
                  .slice(0, 3)
                  .map(([type, count]) => {
                    const style = getBlockTypeStyle(type);
                    return (
                      <div key={type} className={`${style.bgColor} rounded-xl p-4 text-center`}>
                        <div className={`text-3xl font-bold ${style.color}`}>{count}</div>
                        <div className="text-sm text-slate-500 mt-1">{style.icon} {style.label}</div>
                      </div>
                    );
                  })}
              </div>

              {/* 제외된 콘텐츠 */}
              {metadata.excludedContent && (
                <div className="bg-amber-50 rounded-xl p-4 mt-4">
                  <h4 className="text-sm font-bold text-amber-700 mb-2">⚠️ 제외된 콘텐츠 (타 브랜드/광고)</h4>
                  <p className="text-sm text-amber-600">
                    {Array.isArray(metadata.excludedContent) 
                      ? metadata.excludedContent.join(', ') 
                      : metadata.excludedContent}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 블록 타입 분포 */}
          {metadata?.blockTypeDistribution && (
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
              <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <span className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center text-white text-sm">🏷️</span>
                블록 타입 분포
              </h3>
              <div className="flex flex-wrap gap-2">
                {Object.entries(metadata.blockTypeDistribution)
                  .filter(([_, count]) => count > 0)
                  .map(([type, count]) => {
                    const style = getBlockTypeStyle(type);
                    return (
                      <span 
                        key={type} 
                        className={`px-4 py-2 ${style.bgColor} ${style.color} rounded-lg font-medium text-sm flex items-center gap-2`}
                      >
                        {style.icon} {style.label}
                        <span className="bg-white/50 px-2 py-0.5 rounded-full text-xs font-bold">{count}</span>
                      </span>
                    );
                  })}
              </div>
            </div>
          )}

          {/* 상세페이지 분석 - 블록별 */}
          {blockAnalysisList.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <span className="w-8 h-8 bg-[#1E9EDE] rounded-lg flex items-center justify-center text-white text-sm">📄</span>
                블록 분석 ({blockAnalysisList.length}개 블록)
              </h3>
              
              {blockAnalysisList.map((block, index) => {
                const typeStyle = getBlockTypeStyle(block.blockType);
                return (
                  <div 
                    key={index} 
                    className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
                  >
                    {/* 블록 헤더 */}
                    <div className={`${typeStyle.bgColor} px-6 py-4 border-b border-slate-200`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`w-10 h-10 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm`}>
                            {typeStyle.icon}
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-slate-400 font-bold text-sm">#{block.blockNumber}</span>
                              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${typeStyle.color} bg-white/70`}>
                                {typeStyle.label}
                              </span>
                            </div>
                            <h4 className="text-lg font-bold text-slate-900">{block.blockTitle}</h4>
                          </div>
                        </div>
                      </div>
                      {block.boundaryReason && (
                        <p className="text-sm text-slate-500 mt-2 ml-13">
                          💡 분할 근거: {block.boundaryReason}
                        </p>
                      )}
                    </div>

                    <div className="p-6 space-y-5">
                      {/* 핵심 요약 */}
                      {block.keySummary && block.keySummary.length > 0 && (
                        <div>
                          <h5 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">핵심 포인트</h5>
                          <ul className="space-y-2">
                            {block.keySummary.map((point, i) => (
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
                      {block.copywriting && (block.copywriting.headline || block.copywriting.subCopy || block.copywriting.emphasisPhrases?.length) && (
                        <div className="bg-slate-50 rounded-xl p-4">
                          <h5 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-3">카피라이팅</h5>
                          <div className="space-y-2">
                            {block.copywriting.headline && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-400 w-16">헤드라인</span>
                                <span className="font-bold text-slate-900">{block.copywriting.headline}</span>
                              </div>
                            )}
                            {block.copywriting.subCopy && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-400 w-16">서브카피</span>
                                <span className="text-slate-700">{block.copywriting.subCopy}</span>
                              </div>
                            )}
                            {block.copywriting.bodyText && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-slate-400 w-16 pt-1">본문</span>
                                <span className="text-slate-700">{block.copywriting.bodyText}</span>
                              </div>
                            )}
                            {block.copywriting.emphasisPhrases && block.copywriting.emphasisPhrases.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-slate-400 w-16 pt-1">강조문구</span>
                                <div className="flex flex-wrap gap-2">
                                  {block.copywriting.emphasisPhrases.map((phrase, i) => (
                                    <span key={i} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm font-medium">
                                      {phrase}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {block.copywriting.claimStatements && block.copywriting.claimStatements.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-slate-400 w-16 pt-1">클레임</span>
                                <div className="flex flex-wrap gap-2">
                                  {block.copywriting.claimStatements.map((claim, i) => (
                                    <span key={i} className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm font-medium">
                                      {claim}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {block.copywriting.cta && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-400 w-16">CTA</span>
                                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-bold">
                                  {block.copywriting.cta}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 데이터 & 인증 */}
                      {block.dataElements && (block.dataElements.statistics?.length || block.dataElements.certifications?.length || block.dataElements.testResults || block.dataElements.percentages?.length) && (
                        <div className="bg-blue-50 rounded-xl p-4">
                          <h5 className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-3">데이터 & 인증</h5>
                          <div className="space-y-2">
                            {block.dataElements.percentages && block.dataElements.percentages.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-blue-400 w-14 pt-1">퍼센트</span>
                                <div className="flex flex-wrap gap-2">
                                  {block.dataElements.percentages.map((pct, i) => (
                                    <span key={i} className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm font-bold">
                                      {pct}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {block.dataElements.statistics && block.dataElements.statistics.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-blue-400 w-14 pt-1">수치</span>
                                <div className="flex flex-wrap gap-2">
                                  {block.dataElements.statistics.map((stat, i) => (
                                    <span key={i} className="px-3 py-1 bg-white text-blue-700 rounded-lg text-sm font-bold border border-blue-200">
                                      {stat}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {block.dataElements.certifications && block.dataElements.certifications.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-blue-400 w-14 pt-1">인증</span>
                                <div className="flex flex-wrap gap-2">
                                  {block.dataElements.certifications.map((cert, i) => (
                                    <span key={i} className="px-3 py-1 bg-white text-blue-700 rounded-lg text-sm font-medium border border-blue-200">
                                      🏆 {cert}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {block.dataElements.testResults && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-blue-400 w-14">테스트</span>
                                <span className="text-blue-800">{block.dataElements.testResults}</span>
                              </div>
                            )}
                            {block.dataElements.comparisons && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-blue-400 w-14">비교</span>
                                <span className="text-blue-800">{block.dataElements.comparisons}</span>
                              </div>
                            )}
                            {block.dataElements.beforeAfter && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-blue-400 w-14">B/A</span>
                                <span className="text-blue-800">{block.dataElements.beforeAfter}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* 비주얼 요소 */}
                      {block.visualElements && (block.visualElements.layout || block.visualElements.colorScheme || block.visualElements.background || block.visualElements.productShot) && (
                        <div className="bg-purple-50 rounded-xl p-4">
                          <h5 className="text-sm font-bold text-purple-600 uppercase tracking-wider mb-3">비주얼 구성</h5>
                          <div className="space-y-2 text-sm">
                            {block.visualElements.layout && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-purple-400 w-14 pt-0.5">레이아웃</span>
                                <span className="text-purple-800">{block.visualElements.layout}</span>
                              </div>
                            )}
                            {block.visualElements.colorScheme && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-purple-400 w-14 pt-0.5">컬러</span>
                                <span className="text-purple-800">{block.visualElements.colorScheme}</span>
                              </div>
                            )}
                            {block.visualElements.background && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-purple-400 w-14 pt-0.5">배경</span>
                                <span className="text-purple-800">{block.visualElements.background}</span>
                              </div>
                            )}
                            {block.visualElements.productShot && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-purple-400 w-14 pt-0.5">제품샷</span>
                                <span className="text-purple-800">{block.visualElements.productShot}</span>
                              </div>
                            )}
                            {block.visualElements.overallStyle && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-purple-400 w-14 pt-0.5">스타일</span>
                                <span className="text-purple-800">{block.visualElements.overallStyle}</span>
                              </div>
                            )}
                            {block.visualElements.icons && block.visualElements.icons.length > 0 && (
                              <div className="flex items-start gap-2">
                                <span className="text-xs font-medium text-purple-400 w-14 pt-1">아이콘</span>
                                <div className="flex flex-wrap gap-1">
                                  {block.visualElements.icons.map((icon, i) => (
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
                );
              })}
            </div>
          )}

          {/* 데이터가 없을 때 */}
          {blockAnalysisList.length === 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm">
              <span className="text-6xl mb-4 block">📭</span>
              <h3 className="text-xl font-bold text-slate-900 mb-2">분석 데이터 없음</h3>
              <p className="text-slate-600">블록 분석 결과가 없습니다.</p>
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
