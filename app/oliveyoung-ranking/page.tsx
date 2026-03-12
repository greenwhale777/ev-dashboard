'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ============================================================
// Types
// ============================================================
interface OYProduct {
  id: number;
  batch_id: number;
  collected_at: string;
  big_category: string;
  mid_category: string;
  small_category: string;
  rank: number;
  brand: string;
  product_name: string;
  price: string;
  original_price: string | null;
  product_url: string;
  manufacturer: string | null;
  ingredients: string | null;
}

interface OYBatch {
  id: number;
  collected_at: string;
  total_products: number;
  category_count: number;
  status: string;
  duration_minutes: number | null;
  actual_categories: number;
}

interface RankingChange {
  big_category: string;
  mid_category: string;
  small_category: string;
  current_rank: number;
  brand: string;
  product_name: string;
  price: string;
  original_price: string | null;
  product_url: string;
  previous_rank: number | null;
  change_type: 'NEW' | 'UP' | 'DOWN' | 'SAME';
  rank_change: number | null;
}

interface OYStats {
  date: string;
  totalProducts: number;
  totalBrands: number;
  bigCategoryStats: { big_category: string; count: string }[];
  categoryStats: { big_category: string; small_category: string; count: string; max_rank: number }[];
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ============================================================
// API
// ============================================================
const API_URL = process.env.NEXT_PUBLIC_OY_RANKING_API_URL || 'https://web-production-0d1c8.up.railway.app';

// ============================================================
// Constants
// ============================================================
const CATEGORY_MAP: Record<string, { emoji: string; color: string; bg: string; border: string }> = {
  '스킨케어': { emoji: '🧴', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  '클렌징': { emoji: '🧼', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  '선케어': { emoji: '☀️', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const SMALL_CATEGORIES: Record<string, string[]> = {
  '스킨케어': ['스킨/토너', '에센스/세럼/앰플', '크림', '로션', '미스트/픽서', '스킨케어세트'],
  '클렌징': ['클렌징오일', '클렌징밤', '클렌징워터', '클렌징밀크', '클렌징폼/젤', '팩클렌저'],
  '선케어': ['선크림', '선스틱', '선쿠션', '선파우더', '선스프레이', '선패치'],
};

// ============================================================
// Component
// ============================================================
export default function OliveyoungRankingPage() {
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<'ranking' | 'changes' | 'history'>('ranking');
  const [products, setProducts] = useState<OYProduct[]>([]);
  const [rankingChanges, setRankingChanges] = useState<RankingChange[]>([]);
  const [batches, setBatches] = useState<OYBatch[]>([]);
  const [stats, setStats] = useState<OYStats | null>(null);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 100, totalPages: 0 });

  // Filters
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedBigCategory, setSelectedBigCategory] = useState<string>('');
  const [selectedSmallCategory, setSelectedSmallCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchInput, setSearchInput] = useState<string>('');

  // UI State
  const [loading, setLoading] = useState(true);
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  // ============================================================
  // Data Fetching
  // ============================================================
  const fetchBatches = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/oy/batches`);
      const data = await res.json();
      if (data.success) {
        setBatches(data.data || []);
        // 최신 날짜 자동 선택
        if (data.data?.length > 0 && !selectedDate) {
          const latestDate = data.data[0].collected_at?.split('T')[0];
          setSelectedDate(latestDate);
        }
      }
    } catch (e) {
      console.error('배치 조회 실패:', e);
    }
  }, [selectedDate]);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      if (selectedBigCategory) params.set('bigCategory', selectedBigCategory);
      if (selectedSmallCategory) params.set('smallCategory', selectedSmallCategory);
      if (searchQuery) params.set('search', searchQuery);
      params.set('page', pagination.page.toString());
      params.set('limit', '100');

      const res = await fetch(`${API_URL}/api/oy/products?${params}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data || []);
        setPagination(data.pagination);
      }
    } catch (e) {
      console.error('제품 조회 실패:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedBigCategory, selectedSmallCategory, searchQuery, pagination.page]);

  const fetchStats = useCallback(async () => {
    try {
      const params = selectedDate ? `?date=${selectedDate}` : '';
      const res = await fetch(`${API_URL}/api/oy/stats${params}`);
      const data = await res.json();
      if (data.success) setStats(data);
    } catch (e) {
      console.error('통계 조회 실패:', e);
    }
  }, [selectedDate]);

  const fetchRankingChanges = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      if (selectedBigCategory) params.set('bigCategory', selectedBigCategory);
      if (selectedSmallCategory) params.set('smallCategory', selectedSmallCategory);

      const res = await fetch(`${API_URL}/api/oy/ranking-changes?${params}`);
      const data = await res.json();
      if (data.success) setRankingChanges(data.data || []);
    } catch (e) {
      console.error('순위 변동 조회 실패:', e);
    }
  }, [selectedDate, selectedBigCategory, selectedSmallCategory]);

  // ============================================================
  // Effects
  // ============================================================
  useEffect(() => { fetchBatches(); }, []);

  useEffect(() => {
    if (selectedDate) {
      fetchProducts();
      fetchStats();
    }
  }, [selectedDate, selectedBigCategory, selectedSmallCategory, searchQuery, pagination.page]);

  useEffect(() => {
    if (selectedDate && activeTab === 'changes') {
      fetchRankingChanges();
    }
  }, [selectedDate, selectedBigCategory, selectedSmallCategory, activeTab]);

  // ============================================================
  // Handlers
  // ============================================================
  const handleSearch = () => {
    setSearchQuery(searchInput);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleBigCategoryChange = (cat: string) => {
    setSelectedBigCategory(cat === selectedBigCategory ? '' : cat);
    setSelectedSmallCategory('');
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSmallCategoryChange = (cat: string) => {
    setSelectedSmallCategory(cat === selectedSmallCategory ? '' : cat);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const params = new URLSearchParams();
      if (selectedDate) params.set('date', selectedDate);
      if (selectedBigCategory) params.set('bigCategory', selectedBigCategory);
      if (selectedSmallCategory) params.set('smallCategory', selectedSmallCategory);

      const res = await fetch(`${API_URL}/api/oy/export?${params}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `올리브영_랭킹_${selectedDate || 'latest'}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.error('엑셀 다운로드 실패:', e);
      alert('엑셀 다운로드에 실패했습니다.');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return `${d.getFullYear()}.${(d.getMonth()+1).toString().padStart(2,'0')}.${d.getDate().toString().padStart(2,'0')}`;
  };

  const getRankChangeDisplay = (change: RankingChange) => {
    if (change.change_type === 'NEW') return { text: 'NEW', color: 'text-purple-600', bg: 'bg-purple-50' };
    if (change.change_type === 'UP') return { text: `▲${change.rank_change}`, color: 'text-red-500', bg: 'bg-red-50' };
    if (change.change_type === 'DOWN') return { text: `▼${Math.abs(change.rank_change || 0)}`, color: 'text-blue-500', bg: 'bg-blue-50' };
    return { text: '-', color: 'text-gray-400', bg: 'bg-gray-50' };
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition">
                <div className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">EV</span>
                </div>
              </button>
              <div>
                <h1 className="text-xl font-bold text-slate-900">올리브영 랭킹</h1>
                <p className="text-xs text-slate-500">18개 카테고리 · 카테고리별 100개 · 주간 수집</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* 날짜 선택 */}
              <select
                value={selectedDate}
                onChange={(e) => { setSelectedDate(e.target.value); setPagination(prev => ({ ...prev, page: 1 })); }}
                className="px-3 py-2 bg-slate-100 rounded-lg text-sm font-medium text-slate-700 border-0 outline-none"
              >
                <option value="">최신</option>
                {batches.map(b => (
                  <option key={b.id} value={b.collected_at?.split('T')[0]}>
                    {formatDate(b.collected_at)} ({b.total_products}개)
                  </option>
                ))}
              </select>
              {/* 엑셀 다운로드 */}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
              >
                {exporting ? '⏳ 생성중...' : '📥 엑셀'}
              </button>
              {/* 메인으로 */}
              <button onClick={() => router.push('/')} className="px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600 transition">← 메인</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 pt-5 pb-8">
        {/* 통계 카드 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 mb-1">수집일</p>
              <p className="text-lg font-bold text-slate-900">{formatDate(stats.date)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 mb-1">총 제품</p>
              <p className="text-lg font-bold text-slate-900">{stats.totalProducts?.toLocaleString()}개</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 mb-1">총 브랜드</p>
              <p className="text-lg font-bold text-slate-900">{stats.totalBrands}개</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs text-slate-400 mb-1">카테고리별</p>
              <div className="flex gap-2 mt-1">
                {stats.bigCategoryStats?.map(s => (
                  <span key={s.big_category} className={`text-xs font-medium px-2 py-0.5 rounded ${CATEGORY_MAP[s.big_category]?.bg} ${CATEGORY_MAP[s.big_category]?.color}`}>
                    {CATEGORY_MAP[s.big_category]?.emoji} {parseInt(s.count)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 탭 */}
        <div className="flex gap-2 mb-4">
          {([
            { key: 'ranking', label: '📊 랭킹', desc: '제품 목록' },
            { key: 'changes', label: '🔄 순위 변동', desc: '전주 대비' },
            { key: 'history', label: '📅 수집 이력', desc: '주간 기록' },
          ] as const).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                activeTab === tab.key
                  ? 'bg-[#0F172A] text-white shadow-lg'
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 대카테고리 필터 */}
        <div className="flex gap-2 mb-3">
          <button
            onClick={() => { setSelectedBigCategory(''); setSelectedSmallCategory(''); setPagination(prev => ({ ...prev, page: 1 })); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              !selectedBigCategory ? 'bg-[#0F172A] text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            전체
          </button>
          {Object.entries(CATEGORY_MAP).map(([cat, info]) => (
            <button
              key={cat}
              onClick={() => handleBigCategoryChange(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                selectedBigCategory === cat
                  ? `${info.bg} ${info.color} border ${info.border}`
                  : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {info.emoji} {cat}
            </button>
          ))}
        </div>

        {/* 소카테고리 필터 (대카테고리 선택 시) */}
        {selectedBigCategory && SMALL_CATEGORIES[selectedBigCategory] && (
          <div className="flex flex-wrap gap-1.5 mb-4">
            {SMALL_CATEGORIES[selectedBigCategory].map(cat => (
              <button
                key={cat}
                onClick={() => handleSmallCategoryChange(cat)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition ${
                  selectedSmallCategory === cat
                    ? 'bg-slate-700 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* ============================================================ */}
        {/* 랭킹 탭 */}
        {/* ============================================================ */}
        {activeTab === 'ranking' && (
          <div className="space-y-4">
            {/* 검색 */}
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                  placeholder="브랜드 또는 상품명 검색..."
                  className="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm placeholder:text-slate-400 focus:outline-none focus:border-slate-400"
                />
                <button onClick={handleSearch} className="px-5 py-2.5 bg-[#0F172A] text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition">검색</button>
                {searchQuery && (
                  <button onClick={() => { setSearchQuery(''); setSearchInput(''); }} className="px-3 py-2.5 bg-slate-100 text-slate-500 rounded-lg text-sm hover:bg-slate-200 transition">✕</button>
                )}
              </div>
              {searchQuery && <p className="text-xs text-slate-400 mt-2">&quot;{searchQuery}&quot; 검색 결과: {pagination.total}건</p>}
            </div>

            {/* 제품 리스트 */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {loading ? (
                <div className="text-center py-12 text-slate-400 text-sm">로딩 중...</div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">데이터가 없습니다</div>
              ) : (
                <>
                  {/* 테이블 헤더 */}
                  <div className="grid grid-cols-[60px_100px_1fr_90px_60px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase">
                    <span>순위</span>
                    <span>카테고리</span>
                    <span>브랜드 / 상품명</span>
                    <span className="text-right">정가/할인가</span>
                    <span className="text-center">상세</span>
                  </div>

                  {/* 제품 행 */}
                  {products.map((p) => {
                    const catInfo = CATEGORY_MAP[p.big_category] || { emoji: '', color: 'text-gray-600', bg: 'bg-gray-50' };
                    const isExpanded = expandedProduct === p.id;

                    return (
                      <div key={p.id} className="border-b border-slate-100 last:border-0">
                        <div className="grid grid-cols-[60px_100px_1fr_90px_60px] gap-2 px-4 py-3 items-center hover:bg-slate-50 transition-colors">
                          {/* 순위 */}
                          <span className={`text-sm font-bold ${p.rank <= 3 ? 'text-amber-500' : p.rank <= 10 ? 'text-slate-700' : 'text-slate-400'}`}>
                            {p.rank <= 3 ? ['🥇','🥈','🥉'][p.rank-1] : `#${p.rank}`}
                          </span>

                          {/* 카테고리 */}
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${catInfo.bg} ${catInfo.color} truncate`}>
                            {p.small_category}
                          </span>

                          {/* 브랜드/상품명 */}
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-700">{p.brand}</p>
                            <a href={p.product_url} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-500 truncate block hover:text-blue-600 transition">
                              {p.product_name}
                            </a>
                          </div>

                          {/* 가격 */}
                          <div className="text-right">
                            {p.original_price && <span className="text-xs text-slate-400 line-through block">{p.original_price}</span>}
                            <span className="text-sm font-semibold text-red-600">{p.price}</span>
                          </div>

                          {/* 상세 토글 */}
                          <button
                            onClick={() => setExpandedProduct(isExpanded ? null : p.id)}
                            className="text-center text-slate-400 hover:text-slate-700 transition text-sm"
                          >
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>

                        {/* 확장 영역 (제조업자/성분) */}
                        {isExpanded && (
                          <div className="px-4 pb-4 bg-slate-50">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="p-3 bg-white rounded-lg border border-slate-100">
                                <p className="text-[10px] font-semibold text-slate-400 mb-1">🏭 제조업자</p>
                                <p className="text-xs text-slate-700 leading-relaxed">{p.manufacturer || '정보 없음'}</p>
                              </div>
                              <div className="p-3 bg-white rounded-lg border border-slate-100">
                                <p className="text-[10px] font-semibold text-slate-400 mb-1">🧪 성분</p>
                                <p className="text-xs text-slate-600 leading-relaxed max-h-32 overflow-y-auto">{p.ingredients || '정보 없음'}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>

            {/* 페이지네이션 */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                  disabled={pagination.page === 1}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs disabled:opacity-30 hover:bg-slate-50 transition"
                >
                  ← 이전
                </button>
                <span className="text-xs text-slate-500">
                  {pagination.page} / {pagination.totalPages} ({pagination.total}건)
                </span>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: Math.min(prev.totalPages, prev.page + 1) }))}
                  disabled={pagination.page === pagination.totalPages}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs disabled:opacity-30 hover:bg-slate-50 transition"
                >
                  다음 →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* 순위 변동 탭 */}
        {/* ============================================================ */}
        {activeTab === 'changes' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {rankingChanges.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">
                  이전 수집 데이터가 없어 비교할 수 없습니다.<br/>
                  <span className="text-xs">2회 이상 수집 후 확인 가능합니다.</span>
                </div>
              ) : (
                <>
                  {/* 변동 요약 */}
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                    <div className="flex gap-4 text-xs">
                      <span className="font-medium text-purple-600">
                        🆕 NEW {rankingChanges.filter(r => r.change_type === 'NEW').length}개
                      </span>
                      <span className="font-medium text-red-500">
                        ▲ 상승 {rankingChanges.filter(r => r.change_type === 'UP').length}개
                      </span>
                      <span className="font-medium text-blue-500">
                        ▼ 하락 {rankingChanges.filter(r => r.change_type === 'DOWN').length}개
                      </span>
                      <span className="font-medium text-gray-400">
                        - 유지 {rankingChanges.filter(r => r.change_type === 'SAME').length}개
                      </span>
                    </div>
                  </div>

                  {/* 테이블 헤더 */}
                  <div className="grid grid-cols-[55px_55px_100px_1fr_80px] gap-2 px-4 py-2.5 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <span>변동</span>
                    <span>순위</span>
                    <span>카테고리</span>
                    <span>브랜드 / 상품명</span>
                    <span className="text-right">정가/할인가</span>
                  </div>

                  {/* 변동 행 (NEW, UP 먼저 표시) */}
                  <div className="max-h-[600px] overflow-y-auto">
                    {rankingChanges
                      .filter(r => r.change_type !== 'SAME')
                      .sort((a, b) => {
                        const order: Record<string, number> = { NEW: 0, UP: 1, DOWN: 2 };
                        return (order[a.change_type] ?? 3) - (order[b.change_type] ?? 3);
                      })
                      .map((r, i) => {
                        const display = getRankChangeDisplay(r);
                        const catInfo = CATEGORY_MAP[r.big_category] || { emoji: '', bg: 'bg-gray-50', color: 'text-gray-600' };

                        return (
                          <div key={i} className="grid grid-cols-[55px_55px_100px_1fr_80px] gap-2 px-4 py-2.5 items-center border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded text-center ${display.bg} ${display.color}`}>
                              {display.text}
                            </span>
                            <span className="text-sm font-bold text-slate-700">#{r.current_rank}</span>
                            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${catInfo.bg} ${catInfo.color} truncate`}>
                              {r.small_category}
                            </span>
                            <div className="min-w-0">
                              <span className="text-xs font-bold text-slate-700">{r.brand}</span>
                              <span className="text-xs text-slate-400 ml-1.5 truncate">{r.product_name}</span>
                            </div>
                            <div className="text-right">
                              {r.original_price && <span className="text-xs text-slate-400 line-through block">{r.original_price}</span>}
                              <span className="text-xs font-semibold text-red-600">{r.price}</span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 수집 이력 탭 */}
        {/* ============================================================ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              {batches.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-sm">수집 이력이 없습니다</div>
              ) : (
                <>
                  <div className="grid grid-cols-[1fr_100px_100px_100px_80px] gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                    <span>수집일</span>
                    <span className="text-center">제품 수</span>
                    <span className="text-center">카테고리</span>
                    <span className="text-center">소요시간</span>
                    <span className="text-center">상태</span>
                  </div>
                  {batches.map(b => (
                    <div
                      key={b.id}
                      onClick={() => { setSelectedDate(b.collected_at?.split('T')[0]); setActiveTab('ranking'); }}
                      className="grid grid-cols-[1fr_100px_100px_100px_80px] gap-2 px-4 py-3 items-center border-b border-slate-50 hover:bg-blue-50 transition-colors cursor-pointer"
                    >
                      <span className="text-sm font-semibold text-slate-800">{formatDate(b.collected_at)}</span>
                      <span className="text-sm font-bold text-slate-700 text-center">{b.total_products?.toLocaleString()}개</span>
                      <span className="text-xs text-slate-500 text-center">{b.actual_categories || b.category_count}개</span>
                      <span className="text-xs text-slate-500 text-center">{b.duration_minutes ? `${b.duration_minutes}분` : '-'}</span>
                      <span className={`text-[10px] font-semibold text-center px-2 py-0.5 rounded-full ${
                        b.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {b.status === 'completed' ? '완료' : '오류'}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
