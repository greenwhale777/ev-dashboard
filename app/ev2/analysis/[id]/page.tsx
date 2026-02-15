'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import type { AnalysisResult, BlockAnalysis, SegmentationPlan, AnalysisMetadata } from '@/types/analysis';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ev2-page-analyzer-production.up.railway.app';

// 블록 타입별 색상 및 아이콘 매핑
const blockTypeConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: string; label: string }> = {
  hero: { color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-200', icon: '🎯', label: '히어로' },
  benefit: { color: 'text-emerald-700', bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200', icon: '✨', label: '베네핏' },
  ingredient: { color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200', icon: '🧪', label: '성분' },
  clinical: { color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', icon: '📊', label: '임상' },
  social_proof: { color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', icon: '🏆', label: '신뢰' },
  how_to: { color: 'text-cyan-700', bgColor: 'bg-cyan-50', borderColor: 'border-cyan-200', icon: '📝', label: '사용법' },
  texture: { color: 'text-pink-700', bgColor: 'bg-pink-50', borderColor: 'border-pink-200', icon: '💧', label: '텍스처' },
  package: { color: 'text-indigo-700', bgColor: 'bg-indigo-50', borderColor: 'border-indigo-200', icon: '📦', label: '패키지' },
  promotion: { color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', icon: '🎁', label: '프로모션' },
  review: { color: 'text-teal-700', bgColor: 'bg-teal-50', borderColor: 'border-teal-200', icon: '💬', label: '리뷰' },
  cta: { color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200', icon: '🛒', label: 'CTA' },
  brand_story: { color: 'text-slate-700', bgColor: 'bg-slate-50', borderColor: 'border-slate-200', icon: '📖', label: '브랜드' },
};

export default function AnalysisDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedBlocks, setExpandedBlocks] = useState<Set<number>>(new Set());

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
      bgColor: 'bg-slate-50', 
      borderColor: 'border-slate-200',
      icon: '📄', 
      label: blockType 
    };
  };

  const toggleBlock = (blockNumber: number) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(blockNumber)) {
        next.delete(blockNumber);
      } else {
        next.add(blockNumber);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (!analysis) return;
    const allNumbers = (analysis.analysisData.blockAnalysis || []).map((b: BlockAnalysis) => b.blockNumber);
    setExpandedBlocks(new Set(allNumbers));
  };

  const collapseAll = () => {
    setExpandedBlocks(new Set());
  };

  // 블록의 sourceImageNumbers로 해당하는 이미지 URL 찾기
  const getBlockImageUrl = (block: BlockAnalysis): string | null => {
    if (!analysis?.detailImages) return null;
    const imgNums = block.sourceImageNumbers;
    if (!imgNums || imgNums.length === 0) return null;
    // sourceImageNumbers는 1-based index
    const idx = imgNums[0] - 1;
    if (idx >= 0 && idx < analysis.detailImages.length) {
      return analysis.detailImages[idx];
    }
    return null;
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
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/ev2')}
                className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center hover:bg-[#1E293B] transition-colors"
              >
                <span className="text-white font-bold text-lg">←</span>
              </button>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-bold text-slate-900 truncate">{data.productName || '상세페이지 분석'}</h1>
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>{data.brand}</span>
                  {data.category && <><span>·</span><span>{data.category}</span></>}
                  <span>·</span>
                  <span>{formatTime(analysis.analyzedAt)}</span>
                </div>
              </div>
              <a
                href={analysis.url}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-[#1E9EDE] hover:bg-[#1789C7] text-white rounded-lg font-medium text-sm transition-colors whitespace-nowrap"
              >
                올리브영 보기 →
              </a>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 pt-6 pb-16">
          {/* 요약 카드 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* 제품 요약 */}
            <div className="md:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
              <p className="text-slate-700 leading-relaxed text-sm">{data.summary}</p>
              {data.uniqueSellingPoints && data.uniqueSellingPoints.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {data.uniqueSellingPoints.map((usp: string, i: number) => (
                    <span key={i} className="px-2.5 py-1 bg-[#1E9EDE]/10 text-[#1E9EDE] rounded-md text-xs font-medium">
                      {usp}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* 분석 통계 */}
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-center mb-3">
                <div className="text-3xl font-bold text-[#1E9EDE]">{metadata?.totalBlocks || blockAnalysisList.length}</div>
                <div className="text-xs text-slate-500 mt-0.5">총 블록 수</div>
              </div>
              {metadata?.blockTypeDistribution && (
                <div className="flex flex-wrap justify-center gap-1.5">
                  {Object.entries(metadata.blockTypeDistribution)
                    .filter(([_, count]) => (count as number) > 0)
                    .map(([type, count]) => {
                      const style = getBlockTypeStyle(type);
                      return (
                        <span key={type} className={`px-2 py-0.5 ${style.bgColor} ${style.color} rounded text-xs font-medium`}>
                          {style.icon} {style.label} {count as number}
                        </span>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* 접기/펼치기 컨트롤 */}
          {blockAnalysisList.length > 0 && (
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">
                블록 분석 ({blockAnalysisList.length}개)
              </h3>
              <div className="flex gap-2">
                <button onClick={expandAll} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  전체 펼치기
                </button>
                <button onClick={collapseAll} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                  전체 접기
                </button>
              </div>
            </div>
          )}

          {/* 블록 분석 목록 */}
          {blockAnalysisList.length > 0 && (
            <div className="space-y-3">
              {blockAnalysisList.map((block, index) => {
                const typeStyle = getBlockTypeStyle(block.blockType);
                const isExpanded = expandedBlocks.has(block.blockNumber);
                const imageUrl = getBlockImageUrl(block);
                
                return (
                  <div 
                    key={index} 
                    className={`bg-white rounded-xl border ${typeStyle.borderColor} overflow-hidden transition-all`}
                  >
                    {/* 블록 헤더 (항상 표시, 클릭으로 토글) */}
                    <button
                      onClick={() => toggleBlock(block.blockNumber)}
                      className={`w-full ${typeStyle.bgColor} px-5 py-3.5 flex items-center gap-3 text-left hover:brightness-95 transition-all`}
                    >
                      <span className="text-xl">{typeStyle.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 font-bold text-xs">#{block.blockNumber}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${typeStyle.color} bg-white/60`}>
                            {typeStyle.label}
                          </span>
                          <span className="font-bold text-slate-900 text-sm truncate">{block.blockTitle}</span>
                        </div>
                        {/* 접혀있을 때 keySummary 미리보기 */}
                        {!isExpanded && block.keySummary && block.keySummary.length > 0 && (
                          <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {block.keySummary.join(' · ')}
                          </p>
                        )}
                      </div>
                      <span className={`text-slate-400 text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </button>

                    {/* 블록 상세 (펼쳤을 때만) */}
                    {isExpanded && (
                      <div className="flex flex-col md:flex-row">
                        {/* 좌: 원본 이미지 */}
                        {imageUrl && (
                          <div className="md:w-2/5 p-4 bg-slate-50 border-r border-slate-100 flex items-start justify-center">
                            <img 
                              src={imageUrl} 
                              alt={block.blockTitle}
                              className="max-w-full rounded-lg shadow-sm border border-slate-200"
                              style={{ maxHeight: '500px', objectFit: 'contain' }}
                              loading="lazy"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}

                        {/* 우: 분석 내용 */}
                        <div className={`flex-1 p-5 space-y-4 ${imageUrl ? '' : 'w-full'}`}>
                          {/* 핵심 포인트 */}
                          {block.keySummary && block.keySummary.length > 0 && (
                            <div>
                              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">핵심 포인트</h5>
                              <ul className="space-y-1">
                                {block.keySummary.map((point, i) => (
                                  <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                                    <span className="w-4 h-4 bg-[#1E9EDE]/10 text-[#1E9EDE] rounded flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                                      {i + 1}
                                    </span>
                                    {point}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {/* 카피라이팅 */}
                          {block.copywriting && (block.copywriting.headline || block.copywriting.subCopy) && (
                            <div className="bg-slate-50 rounded-lg p-3">
                              <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">카피라이팅</h5>
                              <div className="space-y-1.5 text-sm">
                                {block.copywriting.headline && (
                                  <div className="flex gap-2">
                                    <span className="text-[10px] font-medium text-slate-400 w-12 pt-0.5 flex-shrink-0">헤드라인</span>
                                    <span className="font-bold text-slate-900">{block.copywriting.headline}</span>
                                  </div>
                                )}
                                {block.copywriting.subCopy && (
                                  <div className="flex gap-2">
                                    <span className="text-[10px] font-medium text-slate-400 w-12 pt-0.5 flex-shrink-0">서브카피</span>
                                    <span className="text-slate-700">{block.copywriting.subCopy}</span>
                                  </div>
                                )}
                                {block.copywriting.bodyText && (
                                  <div className="flex gap-2">
                                    <span className="text-[10px] font-medium text-slate-400 w-12 pt-0.5 flex-shrink-0">본문</span>
                                    <span className="text-slate-600">{block.copywriting.bodyText}</span>
                                  </div>
                                )}
                                {block.copywriting.emphasisPhrases && block.copywriting.emphasisPhrases.length > 0 && (
                                  <div className="flex gap-2 items-start">
                                    <span className="text-[10px] font-medium text-slate-400 w-12 pt-1 flex-shrink-0">강조</span>
                                    <div className="flex flex-wrap gap-1">
                                      {block.copywriting.emphasisPhrases.map((phrase, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded text-xs font-medium">
                                          {phrase}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {block.copywriting.claimStatements && block.copywriting.claimStatements.length > 0 && (
                                  <div className="flex gap-2 items-start">
                                    <span className="text-[10px] font-medium text-slate-400 w-12 pt-1 flex-shrink-0">클레임</span>
                                    <div className="flex flex-wrap gap-1">
                                      {block.copywriting.claimStatements.map((claim, i) => (
                                        <span key={i} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-xs font-medium">
                                          {claim}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {block.copywriting.cta && (
                                  <div className="flex gap-2">
                                    <span className="text-[10px] font-medium text-slate-400 w-12 flex-shrink-0">CTA</span>
                                    <span className="px-2 py-0.5 bg-red-100 text-red-800 rounded text-xs font-bold">
                                      {block.copywriting.cta}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 데이터 & 인증 */}
                          {block.dataElements && (
                            (block.dataElements.statistics?.length) || 
                            (block.dataElements.certifications?.length) || 
                            block.dataElements.testResults || 
                            (block.dataElements.percentages?.length) ||
                            block.dataElements.comparisons ||
                            block.dataElements.beforeAfter
                          ) && (
                            <div className="bg-blue-50 rounded-lg p-3">
                              <h5 className="text-xs font-bold text-blue-500 uppercase tracking-wider mb-2">데이터 & 인증</h5>
                              <div className="flex flex-wrap gap-1.5">
                                {block.dataElements.percentages && block.dataElements.percentages.map((pct, i) => (
                                  <span key={`pct-${i}`} className="px-2 py-0.5 bg-blue-500 text-white rounded text-xs font-bold">
                                    {pct}
                                  </span>
                                ))}
                                {block.dataElements.statistics && block.dataElements.statistics.map((stat, i) => (
                                  <span key={`stat-${i}`} className="px-2 py-0.5 bg-white text-blue-700 rounded text-xs font-bold border border-blue-200">
                                    {stat}
                                  </span>
                                ))}
                                {block.dataElements.certifications && block.dataElements.certifications.map((cert, i) => (
                                  <span key={`cert-${i}`} className="px-2 py-0.5 bg-white text-blue-700 rounded text-xs font-medium border border-blue-200">
                                    🏆 {cert}
                                  </span>
                                ))}
                                {block.dataElements.testResults && (
                                  <span className="text-xs text-blue-800">📋 {block.dataElements.testResults}</span>
                                )}
                                {block.dataElements.comparisons && (
                                  <span className="text-xs text-blue-800">⚖️ {block.dataElements.comparisons}</span>
                                )}
                                {block.dataElements.beforeAfter && (
                                  <span className="text-xs text-blue-800">🔄 {block.dataElements.beforeAfter}</span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 비주얼 구성 (간소화) */}
                          {block.visualElements && (block.visualElements.layout || block.visualElements.colorScheme) && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                              {block.visualElements.layout && (
                                <span>📐 {block.visualElements.layout}</span>
                              )}
                              {block.visualElements.colorScheme && (
                                <span>🎨 {block.visualElements.colorScheme}</span>
                              )}
                              {block.visualElements.overallStyle && (
                                <span>✦ {block.visualElements.overallStyle}</span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
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
        </main>
      </div>
    </>
  );
}
