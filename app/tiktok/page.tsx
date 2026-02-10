'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================
// Types
// ============================================================
interface TikTokVideo {
  id: number;
  rank: number;
  video_url: string;
  creator_id: string;
  creator_name: string;
  description: string;
  posted_date: string;
  likes: string;
  comments: string;
  bookmarks: string;
  shares: string;
  views: string;
}

interface TikTokSearch {
  id: number;
  keyword: string;
  status: 'pending' | 'scraping' | 'completed' | 'failed';
  video_count: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
}

interface Keyword {
  id: number;
  keyword: string;
  is_active: boolean;
  search_count: string;
  last_searched: string | null;
}

// ============================================================
// API URL
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_TIKTOK_API_URL || 'https://ev2-tiktok-analyzer-production.up.railway.app';

// ============================================================
// Component
// ============================================================
export default function TikTokAnalyzerPage() {
  const router = useRouter();

  // State
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedSearch, setSelectedSearch] = useState<TikTokSearch | null>(null);
  const [videos, setVideos] = useState<TikTokVideo[]>([]);

  const [newKeyword, setNewKeyword] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState('');

  // Run all state
  const [isRunning, setIsRunning] = useState(false);
  const [runMessage, setRunMessage] = useState('');

  // Keyword history
  const [expandedKeyword, setExpandedKeyword] = useState<number | null>(null);
  const [keywordSearches, setKeywordSearches] = useState<Record<number, TikTokSearch[]>>({});

  // Tab state
  const [activeTab, setActiveTab] = useState<'search' | 'keywords'>('search');

  // ============================================================
  // Data Fetching
  // ============================================================
  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/tiktok/keywords`);
      const data = await res.json();
      if (data.success) setKeywords(data.data || []);
    } catch (err) {
      console.error('Failed to fetch keywords:', err);
    }
  }, []);

  const fetchSearchDetail = useCallback(async (searchId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/tiktok/search/${searchId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedSearch(data.data.search);
        setVideos(data.data.videos || []);
        setActiveTab('search');
      }
    } catch (err) {
      console.error('Failed to fetch search detail:', err);
    }
  }, []);

  const fetchKeywordHistory = useCallback(async (keywordId: number, keyword: string) => {
    try {
      const res = await fetch(`${API_URL}/api/tiktok/searches?limit=50`);
      const data = await res.json();
      if (data.success) {
        const filtered = (data.data || []).filter((s: TikTokSearch) => s.keyword === keyword);
        setKeywordSearches(prev => ({ ...prev, [keywordId]: filtered }));
      }
    } catch (err) {
      console.error('Failed to fetch keyword history:', err);
    }
  }, []);

  useEffect(() => {
    fetchKeywords();
  }, [fetchKeywords]);

  // ============================================================
  // Run All Keywords (via task queue)
  // ============================================================
  const runAllKeywords = async () => {
    setIsRunning(true);
    setRunMessage('');
    setError('');

    try {
      const res = await fetch(`${API_URL}/api/tiktok/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'run_all', topN: 30 }),
      });
      const data = await res.json();

      if (data.success) {
        setRunMessage('✅ 실행 요청 완료! PC에서 곧 스크래핑이 시작됩니다.');
        setTimeout(() => setRunMessage(''), 8000);
      } else {
        setRunMessage(`⏳ ${data.error || '요청 실패'}`);
        setTimeout(() => setRunMessage(''), 5000);
      }
    } catch (err) {
      setError('서버 연결 실패');
    } finally {
      setIsRunning(false);
    }
  };

  // ============================================================
  // Search Execution (via task queue, 30 results)
  // ============================================================
  const startSearch = async (keyword: string) => {
    if (!keyword.trim()) return;
    setError('');
    setIsSearching(true);
    setRunMessage('');

    try {
      const res = await fetch(`${API_URL}/api/tiktok/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'search', keyword: keyword.trim(), topN: 30 }),
      });
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || '검색 요청 실패');
      }

      setRunMessage('✅ 검색 요청 완료! PC에서 곧 스크래핑이 시작됩니다.');
      setTimeout(() => setRunMessage(''), 8000);

    } catch (err: any) {
      setError(err.message || '검색 요청 오류');
    } finally {
      setIsSearching(false);
    }
  };

  // ============================================================
  // Keyword Management
  // ============================================================
  const addKeyword = async () => {
    if (!newKeyword.trim()) return;
    try {
      await fetch(`${API_URL}/api/tiktok/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: newKeyword.trim() }),
      });
      setNewKeyword('');
      fetchKeywords();
    } catch (err) {
      console.error('Failed to add keyword:', err);
    }
  };

  const deleteKeyword = async (id: number) => {
    if (!confirm('이 키워드를 삭제하시겠습니까?')) return;
    try {
      await fetch(`${API_URL}/api/tiktok/keywords/${id}`, { method: 'DELETE' });
      fetchKeywords();
    } catch (err) {
      console.error('Failed to delete keyword:', err);
    }
  };

  const toggleKeywordHistory = (kw: Keyword) => {
    if (expandedKeyword === kw.id) {
      setExpandedKeyword(null);
    } else {
      setExpandedKeyword(kw.id);
      if (!keywordSearches[kw.id]) {
        fetchKeywordHistory(kw.id, kw.keyword);
      }
    }
  };

  // ============================================================
  // Helpers
  // ============================================================
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatShortDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const formatNumber = (val: string) => {
    if (!val || val === 'N/A') return '-';
    const num = parseInt(val);
    if (isNaN(num)) return val;
    if (num >= 10000) return `${(num / 10000).toFixed(1)}만`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const statusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-600',
      scraping: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      pending: '대기',
      scraping: '수집 중',
      completed: '완료',
      failed: '실패',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* Header */}
      <div className="bg-[#0F172A] text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <a href="/" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition text-sm flex items-center gap-2">{"← 메인으로"}</a>
              <span className="text-white/30 hidden sm:inline">|</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎵</span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">TikTok 광고 분석</h1>
              </div>
            </div>
            <button
              onClick={runAllKeywords}
              disabled={isRunning}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 text-white rounded-xl font-semibold text-sm transition active:scale-95 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
            >
              {isRunning ? (
                <>
                  <span className="animate-spin">⏳</span>
                  요청 중...
                </>
              ) : (
                <>
                  <span>🚀</span>
                  전체 키워드 실행
                </>
              )}
            </button>
          </div>
          <p className="text-white/60 text-sm mt-2">키워드 기반 TikTok 인기 콘텐츠 수집 · 분석 (TOP 30)</p>

          {runMessage && (
            <div className="mt-3 px-4 py-2.5 bg-white/10 rounded-xl text-sm">
              {runMessage}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Search Bar */}
        <div className="bg-white rounded-2xl border shadow-sm p-4 sm:p-6 mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="검색 키워드 입력 (예: 메디큐브 PDRN)"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !isSearching && startSearch(searchKeyword)}
              className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1E9EDE]/30 focus:border-[#1E9EDE]"
              disabled={isSearching}
            />
            <button
              onClick={() => startSearch(searchKeyword)}
              disabled={isSearching || !searchKeyword.trim()}
              className="px-4 sm:px-6 py-3 bg-[#1E9EDE] text-white rounded-xl font-semibold text-sm hover:bg-[#1789c4] transition disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 whitespace-nowrap"
            >
              {isSearching ? '요청 중...' : '🔍 검색'}
            </button>
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              ❌ {error}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: 'search', label: '📊 검색 결과', count: videos.length },
            { key: 'keywords', label: '🏷️ 키워드 관리', count: keywords.length },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition whitespace-nowrap ${activeTab === tab.key
                ? 'bg-[#0F172A] text-white'
                : 'bg-white text-gray-600 border hover:bg-gray-50'
                }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Content: Search Results */}
        {activeTab === 'search' && (
          <div>
            {selectedSearch && (
              <div className="bg-white rounded-2xl border shadow-sm p-5 mb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      &quot;{selectedSearch.keyword}&quot; 검색 결과
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {formatDate(selectedSearch.started_at)} · {selectedSearch.video_count}개 영상
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(selectedSearch.status)}
                    <button
                      onClick={() => {
                        setSelectedSearch(null);
                        setVideos([]);
                      }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition"
                    >
                      ✕ 닫기
                    </button>
                  </div>
                </div>
              </div>
            )}

            {videos.length > 0 ? (
              <div className="space-y-3">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="bg-white rounded-2xl border shadow-sm p-4 sm:p-5 hover:shadow-md transition"
                  >
                    <div className="flex items-start gap-3 sm:gap-4">
                      <div className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 bg-[#0F172A] text-white rounded-xl flex items-center justify-center font-bold text-base sm:text-lg">
                        {video.rank}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-gray-900">{video.creator_name || '-'}</span>
                          <span className="text-gray-400 text-sm">@{video.creator_id || '-'}</span>
                          {video.posted_date && video.posted_date !== 'N/A' && (
                            <span className="text-gray-400 text-xs">· {video.posted_date}</span>
                          )}
                        </div>

                        {video.description && video.description !== 'N/A' && (
                          <p className="text-sm text-gray-600 mb-2 line-clamp-2">{video.description}</p>
                        )}

                        <div className="flex gap-3 sm:gap-4 text-xs sm:text-sm flex-wrap">
                          <span className="flex items-center gap-1 text-gray-500">❤️ {formatNumber(video.likes)}</span>
                          <span className="flex items-center gap-1 text-gray-500">💬 {formatNumber(video.comments)}</span>
                          <span className="flex items-center gap-1 text-gray-500">🔖 {formatNumber(video.bookmarks)}</span>
                          <span className="flex items-center gap-1 text-gray-500">🔗 {formatNumber(video.shares)}</span>
                          {video.views && video.views !== 'N/A' && (
                            <span className="flex items-center gap-1 text-gray-500">👁️ {formatNumber(video.views)}</span>
                          )}
                        </div>
                      </div>

                      <a
                        href={video.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition"
                      >
                        TikTok →
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !isSearching && (
                <div className="bg-white rounded-2xl border shadow-sm p-12 text-center">
                  <p className="text-4xl mb-3">🎵</p>
                  <p className="text-gray-500">키워드를 검색하거나, 키워드 관리에서 검색이력을 클릭하세요</p>
                </div>
              )
            )}
          </div>
        )}

        {/* Tab Content: Keywords with History */}
        {activeTab === 'keywords' && (
          <div>
            {/* Add Keyword */}
            <div className="bg-white rounded-2xl border shadow-sm p-5 mb-4">
              <h3 className="font-semibold text-gray-900 mb-3">키워드 추가</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="새 키워드 입력"
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
                  className="flex-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1E9EDE]/30"
                />
                <button
                  onClick={addKeyword}
                  className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-sm font-medium hover:bg-[#1e293b] transition"
                >
                  + 추가
                </button>
              </div>
            </div>

            {/* Keyword List with History */}
            <div className="space-y-2">
              {keywords.map((kw) => (
                <div key={kw.id} className="bg-white rounded-xl border overflow-hidden">
                  {/* Keyword Row */}
                  <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1">
                      <span className="font-medium text-gray-900">{kw.keyword}</span>
                      <span className="text-xs text-gray-400 ml-3">
                        검색 {kw.search_count}회
                        {kw.last_searched && ` · 마지막 ${formatShortDate(kw.last_searched)}`}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => toggleKeywordHistory(kw)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${expandedKeyword === kw.id
                          ? 'bg-[#0F172A] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                      >
                        📋 검색이력 {expandedKeyword === kw.id ? '▲' : '▼'}
                      </button>
                      <button
                        onClick={() => {
                          setSearchKeyword(kw.keyword);
                          startSearch(kw.keyword);
                        }}
                        className="px-3 py-1.5 bg-[#1E9EDE] text-white rounded-lg text-xs font-medium hover:bg-[#1789c4] transition"
                      >
                        ▶ 검색
                      </button>
                      <button
                        onClick={() => deleteKeyword(kw.id)}
                        className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {/* Expanded History */}
                  {expandedKeyword === kw.id && (
                    <div className="border-t bg-gray-50 px-4 py-3">
                      {keywordSearches[kw.id] ? (
                        keywordSearches[kw.id].length > 0 ? (
                          <div className="space-y-1.5">
                            {keywordSearches[kw.id].map((search) => (
                              <button
                                key={search.id}
                                onClick={() => fetchSearchDetail(search.id)}
                                className="w-full flex items-center justify-between p-3 bg-white rounded-lg border hover:shadow-sm hover:border-[#1E9EDE] transition text-left"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-xs text-gray-500 w-28">{formatShortDate(search.started_at)}</span>
                                  <span className="text-sm font-medium text-gray-700">{search.video_count}개 영상</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {statusBadge(search.status)}
                                  <span className="text-gray-300 text-sm">→</span>
                                </div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-400 text-center py-3">검색이력이 없습니다</p>
                        )
                      ) : (
                        <p className="text-sm text-gray-400 text-center py-3">로딩 중...</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {keywords.length === 0 && (
                <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">
                  등록된 키워드가 없습니다
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
