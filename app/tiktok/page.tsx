'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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

interface TaskStatus {
  id: number;
  type: string;
  keyword: string | null;
  status: string;
  progress: number | null;
  progress_message: string | null;
}

interface DailyReport {
  report_date: string;
  keyword_count: number;
  search_count: number;
  total_videos: number;
  first_started: string;
  last_completed: string;
}

interface DailyReportDetail {
  date: string;
  previous_date: string;
  has_previous: boolean;
  searches: DailyReportSearch[];
  total_keywords: number;
  total_videos: number;
}

interface DailyReportSearch {
  id: number;
  keyword: string;
  video_count: number;
  started_at: string;
  completed_at: string;
  analysis: any;
  has_previous: boolean;
  previous_video_count: number | null;
}

interface CompareData {
  keyword: string;
  date: string;
  previous_date: string;
  today_count: number;
  prev_count: number;
  new_entries: number;
  exited_count: number;
  insights: Insight[];
  videos: CompareVideo[];
  exited_videos: any[];
}

interface Insight {
  type: string;
  icon: string;
  label: string;
  desc: string;
  videos: any[];
}

interface CompareVideo {
  id: number;
  rank: number;
  video_url: string;
  creator_id: string;
  creator_name: string;
  description: string;
  views: string;
  likes: string;
  comments: string;
  is_new: boolean;
  prev_rank: number | null;
  rank_change: number | null;
  prev_views: string | null;
  prev_likes: string | null;
  views_num: number;
  prev_views_num: number;
  likes_num: number;
  prev_likes_num: number;
  views_change: number;
  likes_change: number;
  views_change_rate: number;
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

  // Active tasks tracking
  const [activeTasks, setActiveTasks] = useState<TaskStatus[]>([]);
  const [searchingKeywords, setSearchingKeywords] = useState<Set<string>>(new Set());
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const lastKeywordRefresh = useRef<number | null>(null);

  // Keyword history
  const [expandedKeyword, setExpandedKeyword] = useState<number | null>(null);
  const [keywordSearches, setKeywordSearches] = useState<Record<number, TikTokSearch[]>>({});

  // Tab state
  const [activeTab, setActiveTab] = useState<'search' | 'keywords' | 'daily'>('search');

  // Daily Report state
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);
  const [selectedReport, setSelectedReport] = useState<DailyReportDetail | null>(null);
  const [compareData, setCompareData] = useState<CompareData | null>(null);
  const [compareViewMode, setCompareViewMode] = useState<'insights' | 'today' | 'previous'>('insights');
  const [loadingReport, setLoadingReport] = useState(false);

  // ============================================================
  // Data Fetching
  // ============================================================
  const fetchKeywords = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/tiktok/keywords`);
      const data = await res.json();
      if (data.success) {
        // 최근 수집된 키워드가 위로 오도록 정렬
        const sorted = (data.data || []).sort((a: Keyword, b: Keyword) => {
          if (!a.last_searched && !b.last_searched) return 0;
          if (!a.last_searched) return 1;
          if (!b.last_searched) return -1;
          return new Date(b.last_searched).getTime() - new Date(a.last_searched).getTime();
        });
        setKeywords(sorted);
      }
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

  // ============================================================
  // Task Status Polling
  // ============================================================
  const pollTaskStatus = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/tiktok/tasks/active`);
      const data = await res.json();
      if (data.success) {
        const tasks: TaskStatus[] = data.data || [];
        setActiveTasks(tasks);

        // Update searching keywords set
        const activeKeywords = new Set<string>();
        let hasRunAll = false;
        tasks.forEach((task: TaskStatus) => {
          if (task.status === 'pending' || task.status === 'running') {
            if (task.type === 'run_all') {
              hasRunAll = true;
            }
            if (task.keyword) {
              activeKeywords.add(task.keyword.toLowerCase());
            }
          }
        });
        setSearchingKeywords(activeKeywords);
        setIsRunning(hasRunAll);

        // Stop polling if no active tasks
        if (tasks.length === 0 && pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
          // 완료 시 키워드 목록 갱신 (정렬 업데이트)
          fetchKeywords();
        }

        // 진행 중일 때도 키워드 목록 갱신 (30초마다)
        if (tasks.length > 0) {
          const now = Date.now();
          if (!lastKeywordRefresh.current || now - lastKeywordRefresh.current > 30000) {
            lastKeywordRefresh.current = now;
            fetchKeywords();
          }
        }
      }
    } catch (err) {
      console.error('Failed to poll task status:', err);
    }
  }, [fetchKeywords]);

  const startPolling = useCallback(() => {
    if (pollingRef.current) return;
    pollTaskStatus(); // immediate first call
    pollingRef.current = setInterval(pollTaskStatus, 5000);
  }, [pollTaskStatus]);

  useEffect(() => {
    // Initial check for active tasks
    pollTaskStatus();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, [pollTaskStatus]);

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
        setRunMessage('✅ 실행 요청 완료! PC에서 순차 스크래핑이 시작됩니다.');
        startPolling();
        setTimeout(() => setRunMessage(''), 8000);
      } else {
        setRunMessage(`❌ ${data.error || '요청 실패'}`);
        setIsRunning(false);
        setTimeout(() => setRunMessage(''), 5000);
      }
    } catch (err) {
      setError('서버 연결 실패');
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

      setRunMessage('✅ 검색 요청 완료! PC에서 순차 스크래핑이 시작됩니다.');
      setSearchingKeywords(prev => new Set(prev).add(keyword.trim().toLowerCase()));
      startPolling();
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
  const toggleKeywordActive = async (id: number) => {
    try {
      await fetch(`${API_URL}/api/tiktok/keywords/${id}/toggle`, { method: 'PATCH' });
      fetchKeywords();
    } catch (err) {
      console.error('Failed to toggle keyword:', err);
    }
  };

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
  // Daily Report
  // ============================================================
  const fetchDailyReports = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/tiktok/daily-reports`);
      const data = await res.json();
      if (data.success) setDailyReports(data.data || []);
    } catch (err) {
      console.error('Failed to fetch daily reports:', err);
    }
  }, []);

  const fetchReportDetail = async (date: string) => {
    setLoadingReport(true);
    setCompareData(null);
    try {
      const res = await fetch(`${API_URL}/api/tiktok/daily-reports/${date}`);
      const data = await res.json();
      if (data.success) setSelectedReport(data.data);
    } catch (err) {
      console.error('Failed to fetch report detail:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const fetchCompare = async (date: string, keyword: string) => {
    setLoadingReport(true);
    try {
      const res = await fetch(`${API_URL}/api/tiktok/daily-reports/${date}/compare/${encodeURIComponent(keyword)}`);
      const data = await res.json();
      if (data.success) setCompareData(data.data);
    } catch (err) {
      console.error('Failed to fetch comparison:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyReports();
    }
  }, [activeTab, fetchDailyReports]);

  // ============================================================
  // Helpers
  // ============================================================
  const isKeywordSearching = (keyword: string) => {
    return searchingKeywords.has(keyword.toLowerCase());
  };

  const getKeywordTask = (keyword: string): TaskStatus | undefined => {
    return activeTasks.find(
      t => t.keyword?.toLowerCase() === keyword.toLowerCase() && 
      (t.status === 'pending' || t.status === 'running')
    );
  };

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

  const formatReportDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
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
      running: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      pending: '대기',
      scraping: '수집 중',
      running: '수집 중',
      completed: '완료',
      failed: '실패',
    };
    return (
      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${styles[status] || styles.pending}`}>
        {labels[status] || status}
      </span>
    );
  };

  // Count active tasks for the run-all progress
  const completedInBatch = activeTasks.filter(t => t.status === 'completed').length;
  const totalInBatch = activeTasks.length;

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
              <a href="/" className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white font-semibold transition text-sm flex items-center gap-2">← 메인으로</a>
              <span className="text-white/30 hidden sm:inline">|</span>
              <div className="flex items-center gap-2">
                <span className="text-2xl">🎵</span>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">TikTok 광고 분석</h1>
              </div>
            </div>
            <button
              onClick={runAllKeywords}
              disabled={isRunning}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-400 text-white rounded-xl font-semibold text-sm transition active:scale-95 disabled:cursor-not-allowed flex items-center gap-2 justify-center min-w-[180px]"
            >
              {isRunning ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  실행 중...
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

          {/* Active Tasks Progress Bar */}
          {activeTasks.length > 0 && activeTasks.some(t => t.status === 'pending' || t.status === 'running') && (
            <div className="mt-3 px-4 py-3 bg-white/10 rounded-xl">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  스크래핑 진행 중
                </span>
                <span className="text-white/70">
                  {activeTasks.filter(t => t.status === 'running').length > 0 && (
                    <>현재: {activeTasks.find(t => t.status === 'running')?.keyword || '처리 중'}</>
                  )}
                </span>
              </div>
              <div className="w-full bg-white/20 rounded-full h-1.5">
                <div 
                  className="bg-emerald-400 h-1.5 rounded-full transition-all duration-500"
                  style={{ 
                    width: `${totalInBatch > 0 ? Math.max((activeTasks.filter(t => t.status === 'completed' || t.status === 'failed').length / totalInBatch) * 100, 5) : 0}%` 
                  }}
                />
              </div>
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
            { key: 'daily', label: '📅 Daily Report', count: dailyReports.length },
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
                            <span className="flex items-center gap-1 text-gray-500">👀 {formatNumber(video.views)}</span>
                          )}
                        </div>
                      </div>

                      <a
                        href={video.video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-shrink-0 px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition"
                      >
                        TikTok ↗
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
              {keywords.map((kw) => {
                const kwSearching = isKeywordSearching(kw.keyword);
                const kwTask = getKeywordTask(kw.keyword);

                return (
                  <div key={kw.id} className={`rounded-xl border overflow-hidden ${kwSearching ? 'border-yellow-300 bg-yellow-50/30' : !kw.is_active ? 'bg-gray-50 opacity-60' : 'bg-white'}`}>
                    {/* Keyword Row */}
                    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`font-medium ${kw.is_active ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{kw.keyword}</span>
                          {!kw.is_active && (
                            <span className="px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full text-xs font-medium">제외</span>
                          )}
                          {kwSearching && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                              <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              {kwTask?.status === 'running' ? '🔄 수집중...' : '⏳ 대기중'}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-gray-400">
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
                          disabled={kwSearching}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${kwSearching
                            ? 'bg-yellow-100 text-yellow-600 cursor-not-allowed'
                            : 'bg-[#1E9EDE] text-white hover:bg-[#1789c4]'
                            }`}
                        >
                          {kwSearching ? '🔄 수집중...' : '▶ 검색'}
                        </button>
                        <button
                          onClick={() => toggleKeywordActive(kw.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${kw.is_active
                            ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                            : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                            }`}
                        >
                          {kw.is_active ? '검색 제외' : '검색 포함'}
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
                );
              })}
              {keywords.length === 0 && (
                <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">
                  등록된 키워드가 없습니다
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content: Daily Report */}
        {activeTab === 'daily' && (
          <div>
            {/* Compare Detail View */}
            {compareData && (
              <div>
                {/* Header */}
                <div className="bg-white rounded-2xl border shadow-sm p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">
                        &quot;{compareData.keyword}&quot; 분석
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {formatReportDate(compareData.previous_date)} → {formatReportDate(compareData.date)}
                      </p>
                    </div>
                    <button
                      onClick={() => { setCompareData(null); setCompareViewMode('insights'); }}
                      className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition"
                    >
                      ✕ 키워드 목록으로
                    </button>
                  </div>
                  {/* Summary badges */}
                  <div className="flex gap-2 flex-wrap text-xs">
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full">당일 {compareData.today_count}개</span>
                    <span className="px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">전일 {compareData.prev_count}개</span>
                    <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full">🆕 신규 {compareData.new_entries}개</span>
                    <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full">📤 이탈 {compareData.exited_count}개</span>
                  </div>
                  {/* View mode toggle */}
                  <div className="flex gap-2 mt-4">
                    {[
                      { key: 'insights', label: '💡 특이사항' },
                      { key: 'today', label: `📅 ${formatReportDate(compareData.date)}` },
                      { key: 'previous', label: `📅 ${formatReportDate(compareData.previous_date)}` },
                    ].map((mode) => (
                      <button
                        key={mode.key}
                        onClick={() => setCompareViewMode(mode.key as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${compareViewMode === mode.key
                          ? 'bg-[#0F172A] text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {mode.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Insights View */}
                {compareViewMode === 'insights' && (
                  <div className="space-y-4">
                    {compareData.insights && compareData.insights.length > 0 ? (
                      compareData.insights.map((insight, idx) => (
                        <div key={idx} className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${
                          insight.type === 'hot_new' || insight.type === 'rank_up' || insight.type === 'views_spike' 
                            ? 'border-l-4 border-l-green-400' 
                            : 'border-l-4 border-l-red-400'
                        }`}>
                          <div className="p-4">
                            <div className="flex items-center gap-2 mb-3">
                              <span className="text-xl">{insight.icon}</span>
                              <h4 className="font-bold text-gray-900">{insight.label}</h4>
                              <span className="text-xs text-gray-500">— {insight.desc}</span>
                              <span className="ml-auto px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-medium">{insight.videos.length}개</span>
                            </div>
                            <div className="space-y-2">
                              {insight.videos.map((video: any) => (
                                <div key={video.id || video.video_url} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                                  <span className="text-sm font-mono font-bold text-gray-400 w-8">#{video.rank}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline">
                                        @{video.creator_id}
                                      </a>
                                      {video.is_new && <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium">NEW</span>}
                                      {video.rank_change !== null && video.rank_change !== undefined && video.rank_change !== 0 && !video.is_new && (
                                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${video.rank_change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                          {video.rank_change > 0 ? `▲${video.rank_change}` : `▼${Math.abs(video.rank_change)}`}
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 truncate mt-0.5">{video.description}</p>
                                  </div>
                                  <div className="text-right text-xs whitespace-nowrap">
                                    <div className="text-gray-700">{formatNumber(video.views || video.views_num?.toString())} views</div>
                                    {video.views_change_rate > 0 && (
                                      <div className="text-green-600 font-medium">+{video.views_change_rate}%</div>
                                    )}
                                    {video.prev_views && (
                                      <div className="text-gray-400">전일 {formatNumber(video.prev_views)}</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">
                        <p className="text-lg mb-2">✅</p>
                        <p>특이사항 없음</p>
                        <p className="text-xs mt-1">전일 대비 큰 변동이 없습니다</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Today / Previous Data View */}
                {(compareViewMode === 'today' || compareViewMode === 'previous') && (
                  <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-gray-50">
                            <th className="p-3 text-left font-medium text-gray-500 w-12">#</th>
                            <th className="p-3 text-left font-medium text-gray-500">크리에이터</th>
                            <th className="p-3 text-left font-medium text-gray-500 max-w-[250px]">설명</th>
                            <th className="p-3 text-right font-medium text-gray-500">조회수</th>
                            <th className="p-3 text-right font-medium text-gray-500">좋아요</th>
                            <th className="p-3 text-right font-medium text-gray-500">댓글</th>
                            <th className="p-3 text-center font-medium text-gray-500">변동</th>
                          </tr>
                        </thead>
                        <tbody>
                          {compareViewMode === 'today' ? (
                            compareData.videos.map((video) => (
                              <tr key={video.id} className={`border-b hover:bg-gray-50 ${video.is_new ? 'bg-green-50/50' : ''}`}>
                                <td className="p-3 font-mono text-gray-500 font-bold">{video.rank}</td>
                                <td className="p-3">
                                  <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium">
                                    @{video.creator_id}
                                  </a>
                                </td>
                                <td className="p-3 text-xs text-gray-600 max-w-[250px] truncate">{video.description}</td>
                                <td className="p-3 text-right text-xs">
                                  <div>{formatNumber(video.views)}</div>
                                  {video.prev_views && video.prev_views !== video.views && (
                                    <div className={`text-xs ${video.views_change > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                      {video.views_change > 0 ? '+' : ''}{formatNumber(video.views_change.toString())}
                                    </div>
                                  )}
                                </td>
                                <td className="p-3 text-right text-xs">{formatNumber(video.likes)}</td>
                                <td className="p-3 text-right text-xs">{formatNumber(video.comments)}</td>
                                <td className="p-3 text-center">
                                  {video.is_new ? (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-medium">🆕</span>
                                  ) : video.rank_change !== null && video.rank_change !== 0 ? (
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${video.rank_change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                      {video.rank_change > 0 ? `▲${video.rank_change}` : `▼${Math.abs(video.rank_change)}`}
                                    </span>
                                  ) : (
                                    <span className="text-gray-300 text-xs">—</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            compareData.exited_videos.concat(
                              compareData.videos.filter(v => !v.is_new).sort((a, b) => (a.prev_rank || 99) - (b.prev_rank || 99))
                            ).length > 0 ? (
                              // 전일 데이터: 전일 순위 기준으로 정렬
                              [...compareData.videos.filter(v => !v.is_new).map(v => ({
                                ...v,
                                display_rank: v.prev_rank,
                                display_views: v.prev_views || v.views,
                                display_likes: v.prev_likes || v.likes,
                                still_in: true,
                              })), ...compareData.exited_videos.map((v: any) => ({
                                ...v,
                                display_rank: v.rank,
                                display_views: v.views,
                                display_likes: v.likes,
                                still_in: false,
                              }))].sort((a, b) => (a.display_rank || 99) - (b.display_rank || 99)).map((video: any) => (
                                <tr key={video.id || video.video_url} className={`border-b hover:bg-gray-50 ${!video.still_in ? 'bg-red-50/50' : ''}`}>
                                  <td className="p-3 font-mono text-gray-500 font-bold">{video.display_rank}</td>
                                  <td className="p-3">
                                    <a href={video.video_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs font-medium">
                                      @{video.creator_id}
                                    </a>
                                  </td>
                                  <td className="p-3 text-xs text-gray-600 max-w-[250px] truncate">{video.description}</td>
                                  <td className="p-3 text-right text-xs">{formatNumber(video.display_views)}</td>
                                  <td className="p-3 text-right text-xs">{formatNumber(video.display_likes)}</td>
                                  <td className="p-3 text-right text-xs">—</td>
                                  <td className="p-3 text-center">
                                    {!video.still_in ? (
                                      <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">📤 이탈</span>
                                    ) : (
                                      <span className="text-gray-300 text-xs">유지</span>
                                    )}
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr><td colSpan={7} className="p-8 text-center text-gray-400">전일 데이터가 없습니다</td></tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Report Detail View */}
            {selectedReport && !compareData && (
              <div className="bg-white rounded-2xl border shadow-sm p-5 mb-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-lg text-gray-900">
                      📅 {formatReportDate(selectedReport.date)} 리포트
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {selectedReport.total_keywords}개 키워드 · {selectedReport.total_videos}개 영상
                      {selectedReport.has_previous && ' · 전일 비교 가능'}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedReport(null)}
                    className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-medium text-gray-600 transition"
                  >
                    ✕ 목록으로
                  </button>
                </div>

                <div className="space-y-2">
                  {selectedReport.searches.map((search) => (
                    <div key={search.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{search.keyword}</span>
                          <span className="text-xs text-gray-500">{search.video_count}개 영상</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {search.has_previous ? (
                          <button
                            onClick={() => { fetchCompare(selectedReport.date, search.keyword); setCompareViewMode('insights'); }}
                            className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-xs font-medium hover:bg-[#1e293b] transition"
                          >
                            💡 분석 보기
                          </button>
                        ) : (
                          <span className="px-3 py-1.5 bg-gray-200 text-gray-500 rounded-lg text-xs">전일 데이터 없음</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Report List */}
            {!selectedReport && !compareData && (
              <div>
                {loadingReport ? (
                  <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">로딩 중...</div>
                ) : dailyReports.length > 0 ? (
                  <div className="space-y-2">
                    {dailyReports.map((report) => (
                      <button
                        key={report.report_date}
                        onClick={() => fetchReportDetail(report.report_date)}
                        className="w-full flex items-center justify-between p-4 bg-white rounded-xl border hover:shadow-md hover:border-[#1E9EDE] transition text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-[#0F172A] text-white rounded-xl flex flex-col items-center justify-center">
                            <span className="text-xs font-bold">{new Date(report.report_date).getMonth() + 1}월</span>
                            <span className="text-lg font-bold leading-none">{new Date(report.report_date).getDate()}</span>
                          </div>
                          <div>
                            <span className="font-medium text-gray-900">{formatReportDate(report.report_date)}</span>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {report.keyword_count}개 키워드 · {report.total_videos}개 영상
                            </p>
                          </div>
                        </div>
                        <span className="text-gray-300 text-sm">→</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">
                    <p className="text-lg mb-2">📅</p>
                    <p>Daily Report가 없습니다</p>
                    <p className="text-xs mt-1">n8n 스케줄러로 정기 실행하면 자동으로 생성됩니다</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
