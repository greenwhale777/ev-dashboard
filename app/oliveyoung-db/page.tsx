'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ev2-page-analyzer-production.up.railway.app';

// ============================================================
// Types
// ============================================================
interface Category {
  categoryKey: string;
  bigCategory: string;
  midCategory: string;
  smallCategory: string;
  productCount: number;
  analyzedCount: number;
  lastAnalyzed: string | null;
  latestBatchStatus: string | null;
  latestBatchId: number | null;
}

interface BatchJob {
  id: number;
  category_key: string;
  small_category: string;
  status: string;
  total_products: number;
  collected_count: number;
  analyzed_count: number;
  failed_count: number;
  current_product: string | null;
  started_at: string;
  completed_at: string | null;
}

interface Product {
  id: number;
  category_key: string;
  small_category: string;
  big_category: string;
  product_name: string;
  brand_name: string;
  product_url: string;
  rank_in_category: number;
  analysis_status: string | null;
  total_blocks: number;
  image_count: number;
  analyzed_at: string | null;
}

interface ProductDetail extends Product {
  mid_category: string;
  volume: string;
  product_type: string;
  full_ingredients: string;
  product_essentials: any;
  block_analysis: any[];
  summary: string;
  efficacy_points: any[];
  key_ingredients: any[];
  safety_tests: any[];
  formula_info: any;
  how_to_use: any;
}

interface AiMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiChatHistory {
  id: number;
  title: string;
  updated_at: string;
}

// ============================================================
// Main Component
// ============================================================
export default function OliveyoungDBPage() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'db' | 'ai' | 'products' | 'detail'>('db');

  // DB 현황
  const [categories, setCategories] = useState<Category[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [activeBatch, setActiveBatch] = useState<BatchJob | null>(null);
  const [batchPolling, setBatchPolling] = useState(false);

  // 제품 탐색
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productFilter, setProductFilter] = useState({ category: '', brand: '', search: '' });
  const [productLoading, setProductLoading] = useState(false);

  // 제품 상세
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [essentialsExpanded, setEssentialsExpanded] = useState(true);

  // AI 채팅
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatId, setAiChatId] = useState<number | null>(null);
  const [aiChatHistory, setAiChatHistory] = useState<AiChatHistory[]>([]);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // Data Fetching
  // ============================================================
  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/oy/categories`);
      const data = await res.json();
      if (data.success) setCategories(data.data);
    } catch (e) {
      console.error('Failed to fetch categories:', e);
    }
  }, []);

  const fetchBatchJobs = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/api/oy/batch`);
      const data = await res.json();
      if (data.success) setBatchJobs(data.data);
    } catch (e) {
      console.error('Failed to fetch batch jobs:', e);
    }
  }, []);

  const pollBatchStatus = useCallback(async (jobId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/oy/batch/${jobId}`);
      const data = await res.json();
      if (data.success) {
        setActiveBatch(data.data);
        if (data.data.status === 'completed' || data.data.status === 'failed') {
          setBatchPolling(false);
          fetchCategories();
          fetchBatchJobs();
        }
      }
    } catch (e) {
      console.error('Polling error:', e);
    }
  }, [fetchCategories, fetchBatchJobs]);

  const fetchProducts = useCallback(async () => {
    setProductLoading(true);
    try {
      const params = new URLSearchParams();
      if (productFilter.category) params.set('category', productFilter.category);
      if (productFilter.brand) params.set('brand', productFilter.brand);
      if (productFilter.search) params.set('search', productFilter.search);
      params.set('limit', '50');

      const res = await fetch(`${API_URL}/api/oy/products?${params}`);
      const data = await res.json();
      if (data.success) {
        setProducts(data.data);
        setProductTotal(data.total);
      }
    } catch (e) {
      console.error('Failed to fetch products:', e);
    }
    setProductLoading(false);
  }, [productFilter]);

  const fetchProductDetail = useCallback(async (productId: number) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/oy/products/${productId}`);
      const data = await res.json();
      if (data.success) {
        setSelectedProduct(data.data);
        setActiveTab('detail');
      }
    } catch (e) {
      console.error('Failed to fetch product detail:', e);
    }
    setDetailLoading(false);
  }, []);

  // ============================================================
  // Batch Actions
  // ============================================================
  const startBatch = async (categoryKey: string, maxProducts: number = 24) => {
    try {
      const res = await fetch(`${API_URL}/api/oy/batch/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryKey, maxProducts })
      });
      const data = await res.json();
      if (data.success) {
        setActiveBatch({ ...data.data, small_category: categories.find(c => c.categoryKey === categoryKey)?.smallCategory || '' } as any);
        setBatchPolling(true);
      } else {
        alert(data.error || '배치 시작 실패');
      }
    } catch (e) {
      alert('배치 시작 중 오류 발생');
    }
  };

  // ============================================================
  // AI Chat
  // ============================================================
  const handleAiChat = async (question?: string) => {
    const q = question || aiQuestion;
    if (!q.trim()) return;

    setAiMessages(prev => [...prev, { role: 'user', content: q }]);
    setAiQuestion('');
    setAiLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/oy/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, chatId: aiChatId })
      });
      const data = await res.json();
      if (data.success) {
        setAiMessages(prev => [...prev, { role: 'assistant', content: data.data.answer }]);
        if (data.data.chatId) setAiChatId(data.data.chatId);
      } else {
        setAiMessages(prev => [...prev, { role: 'assistant', content: `오류: ${data.error}` }]);
      }
    } catch (e) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: '네트워크 오류가 발생했습니다.' }]);
    }
    setAiLoading(false);
  };

  const startNewAiChat = () => {
    setAiMessages([]);
    setAiChatId(null);
    setAiQuestion('');
  };

  const fetchAiChatHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/oy/ai-chats`);
      const data = await res.json();
      if (data.success) setAiChatHistory(data.data);
    } catch (e) {}
  };

  const loadAiChat = async (chatId: number) => {
    try {
      const res = await fetch(`${API_URL}/api/oy/ai-chats/${chatId}`);
      const data = await res.json();
      if (data.success) {
        setAiMessages(data.data.map((m: any) => ({ role: m.role, content: m.content })));
        setAiChatId(chatId);
        setShowAiHistory(false);
      }
    } catch (e) {}
  };

  const deleteAiChat = async (chatId: number) => {
    if (!confirm('이 대화를 삭제하시겠습니까?')) return;
    try {
      await fetch(`${API_URL}/api/oy/ai-chats/${chatId}`, { method: 'DELETE' });
      fetchAiChatHistory();
    } catch (e) {}
  };

  // ============================================================
  // Effects
  // ============================================================
  useEffect(() => {
    fetchCategories();
    fetchBatchJobs();
  }, []);

  useEffect(() => {
    if (activeTab === 'products') fetchProducts();
  }, [activeTab, productFilter]);

  useEffect(() => {
    if (!batchPolling || !activeBatch) return;
    const interval = setInterval(() => pollBatchStatus(activeBatch.id), 5000);
    return () => clearInterval(interval);
  }, [batchPolling, activeBatch]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [aiMessages]);

  // ============================================================
  // Helpers
  // ============================================================
  const formatDate = (iso: string | null) => {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const statusBadge = (status: string | null) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '완료' },
      analyzing: { bg: 'bg-blue-100', text: 'text-blue-700', label: '분석 중' },
      collecting: { bg: 'bg-amber-100', text: 'text-amber-700', label: '수집 중' },
      failed: { bg: 'bg-red-100', text: 'text-red-700', label: '실패' },
      pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: '대기' },
    };
    const s = map[status || ''] || { bg: 'bg-gray-100', text: 'text-gray-500', label: status || '미수집' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">🫒 올리브영 제품 DB</h1>
              <p className="text-xs text-gray-500">카테고리별 상세페이지 분석 + AI 검색</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                {categories.reduce((sum, c) => sum + c.analyzedCount, 0)}개 분석완료
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: 'db', label: '📦 DB 현황', count: categories.length },
            { key: 'ai', label: '🤖 AI 채팅', count: null },
            { key: 'products', label: '🔍 제품 탐색', count: productTotal },
            { key: 'detail', label: '📄 제품 상세', count: null },
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
              {tab.count != null && tab.count > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-white/20 rounded text-xs">{tab.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ============================================================ */}
        {/* DB 현황 탭 */}
        {/* ============================================================ */}
        {activeTab === 'db' && (
          <div className="space-y-4">
            {/* 진행 중 배치 */}
            {activeBatch && (activeBatch.status === 'collecting' || activeBatch.status === 'analyzing') && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-blue-900">⏳ 배치 수집 진행 중</h3>
                  {statusBadge(activeBatch.status)}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">카테고리: {activeBatch.small_category}</span>
                    <span className="text-blue-600 font-mono">
                      {activeBatch.analyzed_count}/{activeBatch.total_products} 분석
                      {activeBatch.failed_count > 0 && <span className="text-red-500 ml-1">({activeBatch.failed_count} 실패)</span>}
                    </span>
                  </div>
                  {/* 프로그레스 바 */}
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${activeBatch.total_products > 0 ? (activeBatch.analyzed_count / activeBatch.total_products) * 100 : 0}%` }}
                    />
                  </div>
                  {activeBatch.current_product && (
                    <p className="text-xs text-blue-600 truncate">현재: {activeBatch.current_product}</p>
                  )}
                </div>
              </div>
            )}

            {/* 카테고리 그리드 */}
            <div className="bg-white rounded-2xl border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">📂 카테고리별 수집 현황</h3>
                <button
                  onClick={() => { fetchCategories(); fetchBatchJobs(); }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition"
                >
                  🔄 새로고침
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {categories.map((cat) => (
                  <div key={cat.categoryKey} className="border rounded-xl p-3 hover:border-gray-300 transition">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium text-sm text-gray-900">{cat.smallCategory}</p>
                        <p className="text-xs text-gray-400">{cat.bigCategory} &gt; {cat.midCategory}</p>
                      </div>
                      {statusBadge(cat.latestBatchStatus)}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex gap-3 text-xs text-gray-500">
                        <span>📦 {cat.productCount}개 제품</span>
                        <span>✅ {cat.analyzedCount}개 분석</span>
                        {cat.lastAnalyzed && <span>🕐 {formatDate(cat.lastAnalyzed)}</span>}
                      </div>
                      <button
                        onClick={() => startBatch(cat.categoryKey, 24)}
                        disabled={batchPolling}
                        className="px-3 py-1 bg-[#0F172A] text-white rounded-lg text-xs font-medium hover:bg-[#1e293b] transition disabled:opacity-50"
                      >
                        수집 시작
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 최근 배치 작업 */}
            {batchJobs.length > 0 && (
              <div className="bg-white rounded-2xl border p-4">
                <h3 className="font-bold text-gray-900 mb-3">📋 최근 배치 작업</h3>
                <div className="space-y-2">
                  {batchJobs.slice(0, 10).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-3">
                        {statusBadge(job.status)}
                        <span className="font-medium">{job.small_category}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>✅ {job.analyzed_count}/{job.total_products}</span>
                        {job.failed_count > 0 && <span className="text-red-500">❌ {job.failed_count}</span>}
                        <span>{formatDate(job.started_at)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ============================================================ */}
        {/* AI 채팅 탭 */}
        {/* ============================================================ */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900">🤖 AI 제품 분석 채팅</h3>
                <div className="flex gap-2">
                  <button onClick={startNewAiChat} className="px-3 py-1.5 bg-[#0F172A] text-white rounded-lg text-xs font-medium hover:bg-[#1e293b] transition">
                    + 새 대화
                  </button>
                  <button
                    onClick={() => { setShowAiHistory(!showAiHistory); if (!showAiHistory) fetchAiChatHistory(); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${showAiHistory ? 'bg-[#0F172A] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    📋 대화 이력
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">수집된 올리브영 제품 DB를 AI가 자동으로 조회하고 분석합니다.</p>
            </div>

            {/* 대화 이력 */}
            {showAiHistory && (
              <div className="bg-white rounded-2xl border p-4">
                <h4 className="font-bold text-gray-800 mb-3">📋 대화 이력</h4>
                {aiChatHistory.length > 0 ? (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {aiChatHistory.map((chat) => (
                      <div key={chat.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                        <button onClick={() => loadAiChat(chat.id)} className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-800 truncate">{chat.title}</p>
                          <p className="text-xs text-gray-400">{formatDate(chat.updated_at)}</p>
                        </button>
                        <button onClick={() => deleteAiChat(chat.id)} className="ml-2 px-2 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition">🗑</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-3">저장된 대화가 없습니다</p>
                )}
              </div>
            )}

            {/* 채팅 영역 */}
            <div className="bg-white rounded-2xl border p-4">
              {aiMessages.length > 0 && (
                <div className="space-y-3 mb-4 max-h-[500px] overflow-y-auto">
                  {aiMessages.map((msg, i) => (
                    <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[85%] p-3 rounded-xl text-sm whitespace-pre-wrap ${
                        msg.role === 'user' ? 'bg-[#0F172A] text-white' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {msg.role === 'user' ? msg.content : (
                          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                        )}
                      </div>
                    </div>
                  ))}
                  {aiLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 p-3 rounded-xl text-sm text-gray-400">DB 조회 및 분석 중...</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* 빠른 질문 */}
              {aiMessages.length === 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    '클렌징밀크 카테고리에서 인기 성분 트렌드는?',
                    'pH 5.5 이하 제품을 찾아줘',
                    '세라마이드 포함 제품 전체 조회',
                    '메이크프렘 vs 라운드랩 클렌징 비교',
                    'DB 현황 요약해줘',
                    '콩단백질 포함 제품이 있어?',
                    '클렌징밀크 TOP5 핵심 성분 비교',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => { setAiQuestion(q); handleAiChat(q); }}
                      className="px-3 py-2 bg-gray-50 hover:bg-gray-100 border rounded-lg text-xs text-gray-700 transition"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              )}

              {/* 입력 */}
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 mt-4">
                <p className="text-xs font-semibold text-emerald-600 mb-2">💬 AI에게 질문하기</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && aiQuestion.trim()) handleAiChat(); }}
                    placeholder="무엇이든 질문하세요... (예: 클렌징밀크 카테고리에서 가장 많이 사용되는 성분은?)"
                    className="flex-1 px-4 py-3 border-2 border-emerald-300 bg-white rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    disabled={aiLoading}
                  />
                  <button
                    onClick={() => aiQuestion.trim() && handleAiChat()}
                    disabled={aiLoading || !aiQuestion.trim()}
                    className="px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {aiLoading ? '분석 중...' : '🚀 전송'}
                  </button>
                  {aiMessages.length > 0 && (
                    <button onClick={startNewAiChat} className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">새 대화</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 제품 탐색 탭 */}
        {/* ============================================================ */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* 필터 */}
            <div className="bg-white rounded-2xl border p-4">
              <h3 className="font-bold text-gray-900 mb-3">🔍 제품 검색</h3>
              <div className="flex flex-wrap gap-3">
                <select
                  value={productFilter.category}
                  onChange={(e) => setProductFilter(prev => ({ ...prev, category: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="">전체 카테고리</option>
                  {categories.map(c => (
                    <option key={c.categoryKey} value={c.categoryKey}>
                      {c.smallCategory} ({c.analyzedCount})
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={productFilter.brand}
                  onChange={(e) => setProductFilter(prev => ({ ...prev, brand: e.target.value }))}
                  placeholder="브랜드명..."
                  className="px-3 py-2 border rounded-lg text-sm w-40"
                />
                <input
                  type="text"
                  value={productFilter.search}
                  onChange={(e) => setProductFilter(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="상품명 검색..."
                  className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
                />
                <button
                  onClick={fetchProducts}
                  className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-sm font-medium hover:bg-[#1e293b] transition"
                >
                  검색
                </button>
              </div>
            </div>

            {/* 결과 */}
            <div className="bg-white rounded-2xl border">
              <div className="p-4 border-b">
                <span className="text-sm text-gray-500">총 {productTotal}개 제품</span>
              </div>
              {productLoading ? (
                <div className="p-8 text-center text-gray-400">로딩 중...</div>
              ) : products.length > 0 ? (
                <div className="divide-y">
                  {products.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => fetchProductDetail(p.id)}
                      className="p-3 hover:bg-gray-50 cursor-pointer transition flex items-center justify-between"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-mono text-gray-400 w-8">#{p.rank_in_category}</span>
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{p.small_category}</span>
                          <span className="text-xs font-medium text-emerald-700">{p.brand_name}</span>
                        </div>
                        <p className="text-sm text-gray-900 truncate ml-10">{p.product_name}</p>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                        {p.analysis_status === 'completed' ? (
                          <span className="text-xs text-emerald-600">✅ {p.total_blocks}블록</span>
                        ) : (
                          <span className="text-xs text-gray-400">미분석</span>
                        )}
                        <span className="text-gray-300">›</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">검색 결과가 없습니다</div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* 제품 상세 탭 */}
        {/* ============================================================ */}
        {activeTab === 'detail' && (
          <div className="space-y-4">
            {detailLoading ? (
              <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">로딩 중...</div>
            ) : selectedProduct ? (
              <>
                {/* 기본정보 */}
                <div className="bg-white rounded-2xl border p-4">
                  <button onClick={() => setActiveTab('products')} className="text-xs text-gray-400 hover:text-gray-600 mb-2">← 목록으로</button>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400">{selectedProduct.big_category} &gt; {selectedProduct.mid_category} &gt; {selectedProduct.small_category} / {selectedProduct.rank_in_category}위</p>
                      <p className="text-xs font-medium text-emerald-700 mt-1">{selectedProduct.brand_name}</p>
                      <h2 className="font-bold text-lg text-gray-900 mt-0.5">{selectedProduct.product_name}</h2>
                    </div>
                    <a
                      href={selectedProduct.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 transition flex-shrink-0"
                    >
                      올리브영 →
                    </a>
                  </div>
                  {selectedProduct.summary && (
                    <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg">{selectedProduct.summary}</p>
                  )}
                </div>

                {/* 핵심정보 요약 */}
                {selectedProduct.product_essentials && (
                  <div className="bg-white rounded-2xl border p-4">
                    <button
                      onClick={() => setEssentialsExpanded(!essentialsExpanded)}
                      className="w-full flex items-center justify-between"
                    >
                      <h3 className="font-bold text-gray-900">⭐ 핵심정보 요약</h3>
                      <span className="text-gray-400">{essentialsExpanded ? '▲' : '▼'}</span>
                    </button>

                    {essentialsExpanded && (
                      <div className="mt-4 space-y-4">
                        {/* 효능 포인트 */}
                        {selectedProduct.efficacy_points?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">💪 효능 포인트</h4>
                            <div className="space-y-2">
                              {selectedProduct.efficacy_points.map((p: any, i: number) => (
                                <div key={i} className="bg-emerald-50 p-3 rounded-lg">
                                  <p className="font-medium text-sm text-emerald-800">Point {p.pointNumber}: {p.headline}</p>
                                  {p.subCopy && <p className="text-xs text-emerald-600 mt-0.5">{p.subCopy}</p>}
                                  {p.clinicalNote && <p className="text-xs text-gray-500 mt-1">📋 {p.clinicalNote}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 주요 성분 */}
                        {selectedProduct.key_ingredients?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">🧪 주요 성분</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedProduct.key_ingredients.map((ing: any, i: number) => (
                                <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded-full text-xs font-medium">
                                  {ing.name} {ing.benefit && `· ${ing.benefit}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 안전성 테스트 */}
                        {selectedProduct.safety_tests?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">🛡️ 안전성 테스트</h4>
                            <div className="space-y-2">
                              {selectedProduct.safety_tests.map((t: any, i: number) => (
                                <div key={i} className="bg-blue-50 p-3 rounded-lg">
                                  <p className="font-medium text-sm text-blue-800">{t.testName}</p>
                                  <p className="text-xs text-blue-600">{t.description}</p>
                                  {t.institution && <p className="text-xs text-gray-500 mt-1">기관: {t.institution} / 기간: {t.period} / 인원: {t.subjects}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 제형 정보 */}
                        {selectedProduct.formula_info && (selectedProduct.formula_info.pH || selectedProduct.formula_info.texture) && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">🧴 제형 정보</h4>
                            <div className="flex gap-3">
                              {selectedProduct.formula_info.pH && (
                                <span className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                                  pH: {selectedProduct.formula_info.pH}
                                </span>
                              )}
                              {selectedProduct.formula_info.texture && (
                                <span className="px-3 py-1.5 bg-pink-50 text-pink-700 rounded-lg text-xs font-medium">
                                  {selectedProduct.formula_info.texture}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 사용법 */}
                        {selectedProduct.how_to_use?.steps?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">📝 사용법</h4>
                            <div className="space-y-1.5">
                              {selectedProduct.how_to_use.steps.map((s: any, i: number) => (
                                <p key={i} className="text-xs text-gray-600 pl-3 border-l-2 border-gray-200">
                                  <span className="font-medium">Step {s.step}:</span> {s.description}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* 전성분 */}
                        {selectedProduct.full_ingredients && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">📜 전성분</h4>
                            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg leading-relaxed">{selectedProduct.full_ingredients}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 블록 분석 */}
                {selectedProduct.block_analysis?.length > 0 && (
                  <div className="bg-white rounded-2xl border p-4">
                    <h3 className="font-bold text-gray-900 mb-3">🧱 상세페이지 블록 분석 ({selectedProduct.block_analysis.length}개)</h3>
                    <div className="space-y-2">
                      {selectedProduct.block_analysis.map((block: any, i: number) => (
                        <div key={i} className="border rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-gray-400">#{block.blockNumber || i+1}</span>
                            <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded">{block.blockType}</span>
                          </div>
                          {block.headline && <p className="text-sm font-medium text-gray-800">{block.headline}</p>}
                          {block.copywriting && <p className="text-xs text-gray-500 mt-1">{block.copywriting}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">
                🔍 제품 탐색 탭에서 제품을 선택하세요
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
