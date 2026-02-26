'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { AnalysisStartResponse, AnalysisListItem } from '@/types/analysis';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ev2-page-analyzer-production.up.railway.app';

// ============================================================
// Types (from oliveyoung-db)
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
  original_price: string | null;
  sale_price: string | null;
  manufacturer: string | null;
  full_ingredients: string | null;
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
export default function EV2Page() {
  const router = useRouter();

  // Tab state - 5 tabs
  const [activeTab, setActiveTab] = useState<'db' | 'ai' | 'products' | 'detail' | 'analyze'>('db');

  // ── DB 현황 ──
  const [categories, setCategories] = useState<Category[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [activeBatch, setActiveBatch] = useState<BatchJob | null>(null);
  const [batchPolling, setBatchPolling] = useState(false);

  // ── 제품 탐색 ──
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productFilter, setProductFilter] = useState({ category: '', brand: '', search: '' });
  const [productLoading, setProductLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedProductId, setExpandedProductId] = useState<number | null>(null);
  const [ingredientsExpanded, setIngredientsExpanded] = useState(false);
  const pageSize = 20;

  // ── 제품 상세 ──
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [essentialsExpanded, setEssentialsExpanded] = useState(true);

  // ── AI 채팅 ──
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiChatId, setAiChatId] = useState<number | null>(null);
  const [aiChatHistory, setAiChatHistory] = useState<AiChatHistory[]>([]);
  const [showAiHistory, setShowAiHistory] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── 제품 탐색 내 개별 분석 ──
  const [analyzingProductId, setAnalyzingProductId] = useState<number | null>(null);

  // ── 개별 분석 ──
  const [url, setUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState('');
  const [analyzeResults, setAnalyzeResults] = useState<AnalysisListItem[]>([]);
  const [analyzeLoading, setAnalyzeLoading] = useState(true);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  // ============================================================
  // Data Fetching - DB
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
      params.set('limit', String(pageSize));
      params.set('offset', String((currentPage - 1) * pageSize));

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
  }, [productFilter, currentPage]);

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
  // 제품 탐색 내 개별 분석
  // ============================================================
  const analyzeProduct = async (product: Product) => {
    setAnalyzingProductId(product.id);
    try {
      const startRes = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: product.product_url })
      });
      const startData = await startRes.json();
      if (!startData.success) throw new Error(startData.message || '분석 시작 실패');

      const analysisId = startData.analysisId;

      const poll = setInterval(async () => {
        try {
          const statusRes = await fetch(`${API_URL}/api/analyze/${analysisId}/status`);
          const statusData = await statusRes.json();

          if (statusData.status === 'completed') {
            clearInterval(poll);
            setAnalyzingProductId(null);
            fetchProducts();
          } else if (statusData.status === 'failed') {
            clearInterval(poll);
            setAnalyzingProductId(null);
            alert(`분석 실패: ${statusData.error || '알 수 없는 오류'}`);
          }
        } catch (e) {
          console.error('분석 상태 조회 오류:', e);
        }
      }, 3000);

      setTimeout(() => {
        clearInterval(poll);
        if (analyzingProductId === product.id) {
          setAnalyzingProductId(null);
          alert('분석 시간이 초과했습니다.');
        }
      }, 180000);
    } catch (err: any) {
      setAnalyzingProductId(null);
      alert(err.message || '분석 시작 실패');
    }
  };

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
  // 개별 분석
  // ============================================================
  const fetchAnalyzeResults = async () => {
    try {
      const response = await fetch(`${API_URL}/api/analyze/results?limit=20`);
      const data = await response.json();
      if (data.success) {
        setAnalyzeResults(data.results || data.data);
      }
      setAnalyzeLoading(false);
    } catch (err) {
      console.error('결과 목록 조회 실패:', err);
      setAnalyzeLoading(false);
    }
  };

  const startAnalysis = async () => {
    if (!url) {
      setAnalyzeError('URL을 입력해주세요.');
      return;
    }
    if (!url.includes('oliveyoung.co.kr')) {
      setAnalyzeError('올리브영 상품 URL을 입력해주세요.');
      return;
    }

    setAnalyzing(true);
    setAnalyzeError(null);
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
            fetchAnalyzeResults();
            setTimeout(() => {
              router.push(`/ev2/analysis/${analysisId}`);
            }, 1000);
          } else if (statusData.status === 'failed') {
            clearInterval(pollStatus);
            setAnalyzing(false);
            setAnalyzeError(statusData.error || '분석에 실패했습니다.');
          }
        } catch (err) {
          console.error('상태 조회 오류:', err);
        }
      }, 2000);

      setTimeout(() => {
        clearInterval(pollStatus);
        if (analyzing) {
          setAnalyzing(false);
          setAnalyzeError('분석 시간이 초과했습니다.');
        }
      }, 180000);

    } catch (err: any) {
      console.error('분석 시작 오류:', err);
      setAnalyzing(false);
      setAnalyzeError(err.message || '분석 시작 중 오류가 발생했습니다.');
    }
  };

  // ============================================================
  // Effects
  // ============================================================
  useEffect(() => {
    fetchCategories();
    fetchBatchJobs();
  }, []);

  useEffect(() => {
    if (activeTab === 'db') { fetchCategories(); fetchBatchJobs(); }
    if (activeTab === 'products') fetchProducts();
    if (activeTab === 'analyze') fetchAnalyzeResults();
  }, [activeTab, productFilter, currentPage]);

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

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    return `${month}/${day} ${hours}:${minutes}`;
  };

  const statusBadge = (status: string | null) => {
    const map: Record<string, { bg: string; text: string; label: string }> = {
      completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '완료' },
      analyzing: { bg: 'bg-blue-100', text: 'text-blue-700', label: '분석 중' },
      collecting: { bg: 'bg-amber-100', text: 'text-amber-700', label: '수집 중' },
      failed: { bg: 'bg-red-100', text: 'text-red-700', label: '실패' },
      stopped: { bg: 'bg-orange-100', text: 'text-orange-700', label: '중지됨' },
      pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: '대기' },
      unanalyzed: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: '미분석' },
    };
    const s = map[status || ''] || { bg: 'bg-gray-100', text: 'text-gray-500', label: status || '미수집' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
  };

  const formatPrice = (price: string | null) => {
    if (!price) return null;
    const num = parseInt(price);
    if (isNaN(num)) return null;
    return num.toLocaleString() + '원';
  };

  const calcDiscountRate = (original: string | null, sale: string | null) => {
    if (!original || !sale) return null;
    const o = parseInt(original);
    const s = parseInt(sale);
    if (isNaN(o) || isNaN(s) || o <= s || o === 0) return null;
    return Math.round((1 - s / o) * 100);
  };

  const safeString = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (typeof val === 'number' || typeof val === 'boolean') return String(val);
    if (typeof val === 'object') {
      const parts: string[] = [];
      if (val.headline) parts.push(String(val.headline));
      if (val.subCopy) parts.push(String(val.subCopy));
      if (val.bodyText) parts.push(String(val.bodyText));
      if (val.cta) parts.push(String(val.cta));
      if (val.claimStatements) {
        parts.push(Array.isArray(val.claimStatements) ? val.claimStatements.map(String).join(', ') : String(val.claimStatements));
      }
      if (parts.length > 0) return parts.join(' | ');
      try { return JSON.stringify(val); } catch { return '[object]'; }
    }
    return String(val);
  };

  // ============================================================
  // Tab Config
  // ============================================================
  const tabs = [
    { key: 'db', label: '📦 DB 현황', count: categories.length },
    { key: 'ai', label: '🤖 AI 채팅', count: null },
    { key: 'products', label: '🔍 제품 탐색', count: productTotal },
    { key: 'detail', label: '📄 제품 상세', count: null },
    { key: 'analyze', label: '🔬 개별 분석', count: analyzeResults?.length || null },
  ];

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header + Tabs (sticky block) */}
      <div className="sticky top-0 z-10">
        <div className="bg-white border-b">
          <div className="max-w-6xl mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push('/')}
                  className="w-9 h-9 bg-[#0F172A] rounded-xl flex items-center justify-center hover:bg-[#1E293B] transition-all cursor-pointer active:scale-90 hover:scale-105"
                >
                  <span className="text-white font-bold text-sm">EV</span>
                </button>
                <div>
                  <h1 className="text-lg font-bold text-[#0F172A]">EV2 - 올리브영 분석</h1>
                  <p className="text-xs text-gray-500">카테고리별 상세페이지 분석 + AI 검색 + 개별 분석</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                  {categories.reduce((sum, c) => sum + c.analyzedCount, 0)}개 분석완료
                </span>
              </div>
            </div>
          </div>
        </div>
        <div className="bg-[#F8FAFC] border-b border-slate-200">
          <div className="max-w-6xl mx-auto px-4 pt-3 pb-2">
            <div className="flex gap-2 overflow-x-auto">
          {tabs.map((tab) => (
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
          </div>
        </div>

        {/* 제품 탐색 탭: 검색 박스 */}
        {activeTab === 'products' && (
          <div className="bg-[#F8FAFC] pb-4">
            <div className="max-w-6xl mx-auto px-4 pt-3">
              <div className="bg-white rounded-2xl border p-4">
                <h3 className="font-bold text-gray-900 mb-3">🔍 제품 검색</h3>
                <div className="flex flex-wrap gap-3">
                  <select
                    value={productFilter.category}
                    onChange={(e) => { setProductFilter(prev => ({ ...prev, category: e.target.value })); setCurrentPage(1); }}
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
                    onChange={(e) => { setProductFilter(prev => ({ ...prev, brand: e.target.value })); setCurrentPage(1); }}
                    placeholder="브랜드명..."
                    className="px-3 py-2 border rounded-lg text-sm w-40"
                  />
                  <input
                    type="text"
                    value={productFilter.search}
                    onChange={(e) => { setProductFilter(prev => ({ ...prev, search: e.target.value })); setCurrentPage(1); }}
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
            </div>
          </div>
        )}

        {/* 개별 분석 탭: 분석 입력 박스 */}
        {activeTab === 'analyze' && (
          <div className="bg-[#F8FAFC] pb-4">
            <div className="max-w-6xl mx-auto px-4 pt-3">
              <div className="bg-white rounded-2xl border p-6">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">🔬</span>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">개별 상품 분석</h2>
                    <p className="text-sm text-gray-500">올리브영 상품 URL을 입력하여 상세페이지를 AI 분석합니다</p>
                  </div>
                </div>

                {analyzeError && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <div className="flex items-center gap-2 text-red-600">
                      <span>❌</span>
                      <span className="font-medium">{analyzeError}</span>
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

              </div>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* ============================================================ */}
        {/* DB 현황 탭 */}
        {/* ============================================================ */}
        {activeTab === 'db' && (
          <div className="space-y-4">
            {activeBatch && (activeBatch.status === 'collecting' || activeBatch.status === 'analyzing') && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-blue-900">⏳ 배치 수집 진행 중</h3>
                  <div className="flex items-center gap-2">
                    {statusBadge(activeBatch.status)}
                    <button
                      onClick={async () => {
                        if (!confirm('배치 수집을 중지하시겠습니까?')) return;
                        try {
                          await fetch(`${API_URL}/api/oy/batch/${activeBatch.id}/stop`, { method: 'POST' });
                          setBatchPolling(false);
                          setActiveBatch(prev => prev ? { ...prev, status: 'stopped' } : null);
                          fetchCategories();
                          fetchBatchJobs();
                        } catch (e) {
                          alert('중지 요청 실패');
                        }
                      }}
                      className="px-3 py-1 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition"
                    >
                      ⏹ 중지
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">카테고리: {activeBatch.small_category}</span>
                    <span className="text-blue-600 font-mono">
                      {activeBatch.analyzed_count}/{activeBatch.total_products} 분석
                      {activeBatch.failed_count > 0 && <span className="text-red-500 ml-1">({activeBatch.failed_count} 실패)</span>}
                    </span>
                  </div>
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
                      {statusBadge(
                        cat.latestBatchStatus
                          ? cat.latestBatchStatus
                          : cat.analyzedCount > 0
                            ? 'completed'
                            : cat.productCount > 0
                              ? 'unanalyzed'
                              : null
                      )}
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

              {aiMessages.length === 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    '클렌징밀크 카테고리에서 인기 성분 트렌드는?',
                    'pH 5.5 이하 제품을 찾아줘',
                    '세라마이드 포함 제품 전체 조회',
                    '메이크프렘 vs 라운드랩 클렌징 비교',
                    'DB 현황 요약해줘',
                    '비건 인증 제품 찾아줘',
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
            <div className="bg-white rounded-2xl border">
              <div className="p-4 border-b flex items-center justify-between">
                <span className="text-sm text-gray-500">
                  총 {productTotal}개 제품 ({Math.ceil(productTotal / pageSize)}페이지)
                </span>
                {productTotal > 0 && (
                  <span className="text-xs text-gray-400">
                    {(currentPage - 1) * pageSize + 1}-{Math.min(currentPage * pageSize, productTotal)}번째
                  </span>
                )}
              </div>
              {productLoading ? (
                <div className="p-8 text-center text-gray-400">로딩 중...</div>
              ) : products.length > 0 ? (
                <div className="divide-y">
                  {products.map((p, index) => {
                    const isExpanded = expandedProductId === p.id;
                    const discountRate = calcDiscountRate(p.original_price, p.sale_price);
                    const saleFormatted = formatPrice(p.sale_price);
                    const originalFormatted = formatPrice(p.original_price);

                    return (
                      <div key={p.id}>
                        {/* 제품 행 */}
                        <div
                          onClick={() => {
                            setExpandedProductId(isExpanded ? null : p.id);
                            setIngredientsExpanded(false);
                          }}
                          className={`p-3 hover:bg-gray-50 cursor-pointer transition ${isExpanded ? 'bg-gray-50' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-xs font-mono text-gray-400 w-8">#{(currentPage - 1) * pageSize + index + 1}</span>
                                <span className="text-xs px-2 py-0.5 bg-gray-100 rounded text-gray-600">{p.small_category} #{p.rank_in_category}위</span>
                                <span className="text-xs font-medium text-emerald-700">{p.brand_name}</span>
                              </div>
                              <div className="flex items-center gap-2 ml-10">
                                <p className="text-sm text-gray-900 truncate">{p.product_name}</p>
                                {saleFormatted && (
                                  <span className="text-sm font-bold text-gray-900 whitespace-nowrap">{saleFormatted}</span>
                                )}
                                {discountRate && (
                                  <span className="text-xs font-bold text-red-500 whitespace-nowrap">{discountRate}%</span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                              {p.analysis_status === 'completed' ? (
                                <span className="text-xs text-emerald-600">✅ {p.total_blocks}블록</span>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); analyzeProduct(p); }}
                                    disabled={analyzingProductId !== null}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition ${
                                      analyzingProductId === p.id
                                        ? 'bg-blue-100 text-blue-600'
                                        : analyzingProductId !== null
                                          ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                          : 'bg-blue-500 text-white hover:bg-blue-600 cursor-pointer'
                                    }`}
                                  >
                                    {analyzingProductId === p.id ? (
                                      <span className="flex items-center gap-1">
                                        <span className="inline-block w-3 h-3 border-2 border-blue-400 border-t-transparent rounded-full animate-spin"></span>
                                        분석 중...
                                      </span>
                                    ) : '분석'}
                                  </button>
                                  <span className="text-xs text-gray-400">미분석</span>
                                </div>
                              )}
                              <span className={`text-gray-300 transition-transform ${isExpanded ? 'rotate-90' : ''}`}>›</span>
                            </div>
                          </div>
                        </div>

                        {/* 펼침 상세 패널 */}
                        {isExpanded && (
                          <div className="px-4 pb-4 bg-gray-50 border-t border-gray-100">
                            <div className="pl-10 pt-3 space-y-2">
                              {/* 가격 정보 */}
                              <div className="flex items-center gap-3 text-sm">
                                <span className="text-gray-500 w-14">가격</span>
                                {saleFormatted ? (
                                  <div className="flex items-center gap-2">
                                    {originalFormatted && discountRate ? (
                                      <span className="text-gray-400 line-through text-xs">{originalFormatted}</span>
                                    ) : null}
                                    <span className="font-bold text-gray-900">{saleFormatted}</span>
                                    {discountRate ? (
                                      <span className="text-xs font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{discountRate}% 할인</span>
                                    ) : null}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs">가격 정보 없음</span>
                                )}
                              </div>

                              {/* 제조사 */}
                              <div className="flex items-start gap-3 text-sm">
                                <span className="text-gray-500 w-14">제조사</span>
                                <span className="text-gray-800">
                                  {p.manufacturer || <span className="text-gray-400 text-xs">정보 없음</span>}
                                </span>
                              </div>

                              {/* 전성분 */}
                              <div className="flex items-start gap-3 text-sm">
                                <span className="text-gray-500 w-14 flex-shrink-0">전성분</span>
                                {p.full_ingredients ? (
                                  <div className="flex-1 min-w-0">
                                    <p className="text-gray-700 text-xs leading-relaxed">
                                      {ingredientsExpanded
                                        ? p.full_ingredients
                                        : p.full_ingredients.length > 100
                                          ? p.full_ingredients.substring(0, 100) + '...'
                                          : p.full_ingredients}
                                    </p>
                                    {p.full_ingredients.length > 100 && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); setIngredientsExpanded(!ingredientsExpanded); }}
                                        className="text-xs text-blue-500 hover:text-blue-700 mt-1 cursor-pointer"
                                      >
                                        {ingredientsExpanded ? '접기' : '더보기'}
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400 text-xs">정보 없음</span>
                                )}
                              </div>

                              {/* 상세보기 버튼 */}
                              <div className="flex gap-2 pt-1">
                                <button
                                  onClick={(e) => { e.stopPropagation(); fetchProductDetail(p.id); }}
                                  className="px-3 py-1.5 text-xs font-medium bg-[#0F172A] text-white rounded-lg hover:bg-[#1E293B] transition cursor-pointer"
                                >
                                  상세 분석 보기
                                </button>
                                <a
                                  href={p.product_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border rounded-lg hover:bg-gray-50 transition"
                                >
                                  올리브영 페이지 →
                                </a>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">검색 결과가 없습니다</div>
              )}
            </div>

            {/* Pagination */}
            {productTotal > pageSize && (() => {
              const totalPages = Math.ceil(productTotal / pageSize);
              const getPageNumbers = () => {
                const pages: (number | string)[] = [];
                if (totalPages <= 11) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (currentPage > 6) pages.push('...');
                  const start = Math.max(2, currentPage - 4);
                  const end = Math.min(totalPages - 1, currentPage + 4);
                  for (let i = start; i <= end; i++) pages.push(i);
                  if (currentPage < totalPages - 5) pages.push('...');
                  pages.push(totalPages);
                }
                return pages;
              };
              return (
                <div className="flex items-center justify-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    ← 이전
                  </button>
                  {getPageNumbers().map((page, idx) =>
                    typeof page === 'string' ? (
                      <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-gray-400">...</span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition cursor-pointer ${
                          page === currentPage
                            ? 'bg-[#0F172A] text-white'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-600 hover:bg-gray-100 cursor-pointer'
                    }`}
                  >
                    다음 →
                  </button>
                </div>
              );
            })()}
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
                        {selectedProduct.product_essentials?.mainCopy && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">🎯 메인 카피</h4>
                            <p className="text-sm font-bold text-gray-900 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 rounded-lg border border-emerald-200">
                              &ldquo;{selectedProduct.product_essentials.mainCopy}&rdquo;
                            </p>
                          </div>
                        )}

                        {selectedProduct.efficacy_points?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">💪 핵심 포인트</h4>
                            <div className="space-y-2">
                              {selectedProduct.efficacy_points.map((p: any, i: number) => (
                                <div key={i} className="bg-emerald-50 p-3 rounded-lg">
                                  <p className="font-medium text-sm text-emerald-800">핵심 {p.pointNumber || i+1}: {p.headline}</p>
                                  {p.subCopy && <p className="text-xs text-emerald-600 mt-0.5">{p.subCopy}</p>}
                                  {p.details?.length > 0 && (
                                    <div className="mt-1 space-y-0.5">
                                      {p.details.map((d: string, j: number) => (
                                        <p key={j} className="text-xs text-gray-500">• {d}</p>
                                      ))}
                                    </div>
                                  )}
                                  {p.clinicalNote && <p className="text-xs text-gray-500 mt-1">📋 {p.clinicalNote}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

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

                        {selectedProduct.safety_tests?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">🛡️ 임상/안전성 테스트</h4>
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

                        {selectedProduct.formula_info && (selectedProduct.formula_info.pH || selectedProduct.formula_info.texture || selectedProduct.formula_info.keyFeature) && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">🧴 제형 정보</h4>
                            <div className="flex gap-3 flex-wrap">
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
                              {selectedProduct.formula_info.keyFeature && (
                                <span className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-medium">
                                  {selectedProduct.formula_info.keyFeature}
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {selectedProduct.how_to_use && typeof selectedProduct.how_to_use === 'object' && !selectedProduct.how_to_use.steps && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">🏆 제품 하이라이트</h4>
                            <div className="space-y-2">
                              {[
                                { key: 'salesRecord', label: '📊 판매 실적', color: 'bg-orange-50 text-orange-700' },
                                { key: 'rankings', label: '🥇 랭킹/어워즈', color: 'bg-yellow-50 text-yellow-700' },
                                { key: 'certifications', label: '✅ 인증', color: 'bg-green-50 text-green-700' },
                                { key: 'formulaFeatures', label: '⚗️ 제형 특장점', color: 'bg-violet-50 text-violet-700' },
                                { key: 'targetAudience', label: '👤 추천 대상', color: 'bg-cyan-50 text-cyan-700' },
                                { key: 'others', label: '💎 기타', color: 'bg-gray-50 text-gray-600' },
                              ].map(({ key, label, color }) => {
                                const items = (selectedProduct.how_to_use as any)?.[key];
                                if (!items || !Array.isArray(items) || items.length === 0) return null;
                                return (
                                  <div key={key}>
                                    <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
                                    <div className="flex flex-wrap gap-1.5">
                                      {items.map((item: string, j: number) => (
                                        <span key={j} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${color}`}>
                                          {item}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

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
                          {block.headline && <p className="text-sm font-medium text-gray-800">{safeString(block.headline)}</p>}
                          {block.copywriting && (
                            typeof block.copywriting === 'object' ? (
                              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                                {block.copywriting.headline && <p className="font-medium">{block.copywriting.headline}</p>}
                                {block.copywriting.subCopy && <p>{block.copywriting.subCopy}</p>}
                                {block.copywriting.bodyText && <p>{block.copywriting.bodyText}</p>}
                                {block.copywriting.cta && <p className="text-emerald-600">{block.copywriting.cta}</p>}
                                {block.copywriting.claimStatements && (
                                  <p className="italic">{Array.isArray(block.copywriting.claimStatements) ? block.copywriting.claimStatements.join(' · ') : String(block.copywriting.claimStatements)}</p>
                                )}
                                {block.copywriting.emphasisPhrases && (
                                  <p className="font-medium text-gray-600">{Array.isArray(block.copywriting.emphasisPhrases) ? block.copywriting.emphasisPhrases.join(' · ') : String(block.copywriting.emphasisPhrases)}</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-500 mt-1">{String(block.copywriting)}</p>
                            )
                          )}
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

        {/* ============================================================ */}
        {/* 개별 분석 탭 */}
        {/* ============================================================ */}
        {activeTab === 'analyze' && (
          <div className="space-y-4">
            {/* 분석 결과 목록 */}
            <div className="bg-white rounded-2xl border p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">📋 분석 결과 ({analyzeResults?.length || 0})</h3>
                <button
                  onClick={fetchAnalyzeResults}
                  className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition cursor-pointer active:scale-95"
                >
                  🔄 새로고침
                </button>
              </div>

              {analyzeLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin h-8 w-8 border-3 border-slate-300 border-t-slate-600 rounded-full mx-auto mb-4"></div>
                  <p className="text-gray-500">로딩 중...</p>
                </div>
              ) : !analyzeResults || analyzeResults.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 text-lg">분석 결과가 없습니다</p>
                  <p className="text-gray-400 text-sm mt-2">URL을 입력하여 분석을 시작하세요</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {analyzeResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => router.push(`/ev2/analysis/${result.id}`)}
                      className="p-4 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 hover:shadow-lg hover:border-blue-300 transition-all text-left cursor-pointer active:scale-[0.99]"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-gray-900 mb-1">{result.productName}</h4>
                          <div className="flex items-center gap-3 text-sm text-gray-500">
                            <span>🏷️ {result.brand}</span>
                            <span>·</span>
                            <span>📂 {result.category}</span>
                          </div>
                        </div>
                        <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600">
                          완료
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mb-2 line-clamp-2">{result.summary}</p>
                      <div className="flex items-center justify-between text-xs text-gray-400">
                        <span>{formatTime(result.analyzedAt)}</span>
                        <span className="text-blue-500 font-medium">자세히 보기 →</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
