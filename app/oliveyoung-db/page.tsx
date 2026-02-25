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

  // DB \ud604\ud669
  const [categories, setCategories] = useState<Category[]>([]);
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([]);
  const [activeBatch, setActiveBatch] = useState<BatchJob | null>(null);
  const [batchPolling, setBatchPolling] = useState(false);

  // \uc81c\ud488 \ud0d0\uc0c9
  const [products, setProducts] = useState<Product[]>([]);
  const [productTotal, setProductTotal] = useState(0);
  const [productFilter, setProductFilter] = useState({ category: '', brand: '', search: '' });
  const [productLoading, setProductLoading] = useState(false);

  // \uc81c\ud488 \uc0c1\uc138
  const [selectedProduct, setSelectedProduct] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [essentialsExpanded, setEssentialsExpanded] = useState(true);

  // AI \ucc44\ud305
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
        alert(data.error || '\ubc30\uce58 \uc2dc\uc791 \uc2e4\ud328');
      }
    } catch (e) {
      alert('\ubc30\uce58 \uc2dc\uc791 \uc911 \uc624\ub958 \ubc1c\uc0dd');
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
        setAiMessages(prev => [...prev, { role: 'assistant', content: `\uc624\ub958: ${data.error}` }]);
      }
    } catch (e) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: '\ub124\ud2b8\uc6cc\ud06c \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.' }]);
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
    if (!confirm('\uc774 \ub300\ud654\ub97c \uc0ad\uc81c\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?')) return;
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
      completed: { bg: 'bg-emerald-100', text: 'text-emerald-700', label: '\uc644\ub8cc' },
      analyzing: { bg: 'bg-blue-100', text: 'text-blue-700', label: '\ubd84\uc11d \uc911' },
      collecting: { bg: 'bg-amber-100', text: 'text-amber-700', label: '\uc218\uc9d1 \uc911' },
      failed: { bg: 'bg-red-100', text: 'text-red-700', label: '\uc2e4\ud328' },
      pending: { bg: 'bg-gray-100', text: 'text-gray-600', label: '\ub300\uae30' },
    };
    const s = map[status || ''] || { bg: 'bg-gray-100', text: 'text-gray-500', label: status || '\ubbf8\uc218\uc9d1' };
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n/g, '<br/>');
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
  // Render
  // ============================================================
  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[#0F172A]">\ud83e\uded2 \uc62c\ub9ac\ube0c\uc601 \uc81c\ud488 DB</h1>
              <p className="text-xs text-gray-500">\uce74\ud14c\uace0\ub9ac\ubcc4 \uc0c1\uc138\ud398\uc774\uc9c0 \ubd84\uc11d + AI \uac80\uc0c9</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="px-2 py-1 bg-emerald-50 text-emerald-700 rounded-full font-medium">
                {categories.reduce((sum, c) => sum + c.analyzedCount, 0)}\uac1c \ubd84\uc11d\uc644\ub8cc
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-4">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {[
            { key: 'db', label: '\ud83d\udce6 DB \ud604\ud669', count: categories.length },
            { key: 'ai', label: '\ud83e\udd16 AI \ucc44\ud305', count: null },
            { key: 'products', label: '\ud83d\udd0d \uc81c\ud488 \ud0d0\uc0c9', count: productTotal },
            { key: 'detail', label: '\ud83d\udcc4 \uc81c\ud488 \uc0c1\uc138', count: null },
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
        {/* DB \ud604\ud669 \ud0ed */}
        {/* ============================================================ */}
        {activeTab === 'db' && (
          <div className="space-y-4">
            {/* \uc9c4\ud589 \uc911 \ubc30\uce58 */}
            {activeBatch && (activeBatch.status === 'collecting' || activeBatch.status === 'analyzing') && (
              <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-blue-900">\u23f3 \ubc30\uce58 \uc218\uc9d1 \uc9c4\ud589 \uc911</h3>
                  {statusBadge(activeBatch.status)}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-blue-700">\uce74\ud14c\uace0\ub9ac: {activeBatch.small_category}</span>
                    <span className="text-blue-600 font-mono">
                      {activeBatch.analyzed_count}/{activeBatch.total_products} \ubd84\uc11d
                      {activeBatch.failed_count > 0 && <span className="text-red-500 ml-1">({activeBatch.failed_count} \uc2e4\ud328)</span>}
                    </span>
                  </div>
                  {/* \ud504\ub85c\uadf8\ub808\uc2a4 \ubc14 */}
                  <div className="w-full bg-blue-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${activeBatch.total_products > 0 ? (activeBatch.analyzed_count / activeBatch.total_products) * 100 : 0}%` }}
                    />
                  </div>
                  {activeBatch.current_product && (
                    <p className="text-xs text-blue-600 truncate">\ud604\uc7ac: {activeBatch.current_product}</p>
                  )}
                </div>
              </div>
            )}

            {/* \uce74\ud14c\uace0\ub9ac \uadf8\ub9ac\ub4dc */}
            <div className="bg-white rounded-2xl border p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-900">\ud83d\udcc2 \uce74\ud14c\uace0\ub9ac\ubcc4 \uc218\uc9d1 \ud604\ud669</h3>
                <button
                  onClick={() => { fetchCategories(); fetchBatchJobs(); }}
                  className="px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-xs hover:bg-gray-200 transition"
                >
                  \ud83d\udd04 \uc0c8\ub85c\uace0\uce68
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
                        <span>\ud83d\udce6 {cat.productCount}\uac1c \uc81c\ud488</span>
                        <span>\u2705 {cat.analyzedCount}\uac1c \ubd84\uc11d</span>
                        {cat.lastAnalyzed && <span>\ud83d\udd50 {formatDate(cat.lastAnalyzed)}</span>}
                      </div>
                      <button
                        onClick={() => startBatch(cat.categoryKey, 24)}
                        disabled={batchPolling}
                        className="px-3 py-1 bg-[#0F172A] text-white rounded-lg text-xs font-medium hover:bg-[#1e293b] transition disabled:opacity-50"
                      >
                        \uc218\uc9d1 \uc2dc\uc791
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* \ucd5c\uadfc \ubc30\uce58 \uc791\uc5c5 */}
            {batchJobs.length > 0 && (
              <div className="bg-white rounded-2xl border p-4">
                <h3 className="font-bold text-gray-900 mb-3">\ud83d\udccb \ucd5c\uadfc \ubc30\uce58 \uc791\uc5c5</h3>
                <div className="space-y-2">
                  {batchJobs.slice(0, 10).map((job) => (
                    <div key={job.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm">
                      <div className="flex items-center gap-3">
                        {statusBadge(job.status)}
                        <span className="font-medium">{job.small_category}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span>\u2705 {job.analyzed_count}/{job.total_products}</span>
                        {job.failed_count > 0 && <span className="text-red-500">\u274c {job.failed_count}</span>}
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
        {/* AI \ucc44\ud305 \ud0ed */}
        {/* ============================================================ */}
        {activeTab === 'ai' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border p-4">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-bold text-gray-900">\ud83e\udd16 AI \uc81c\ud488 \ubd84\uc11d \ucc44\ud305</h3>
                <div className="flex gap-2">
                  <button onClick={startNewAiChat} className="px-3 py-1.5 bg-[#0F172A] text-white rounded-lg text-xs font-medium hover:bg-[#1e293b] transition">
                    + \uc0c8 \ub300\ud654
                  </button>
                  <button
                    onClick={() => { setShowAiHistory(!showAiHistory); if (!showAiHistory) fetchAiChatHistory(); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${showAiHistory ? 'bg-[#0F172A] text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                  >
                    \ud83d\udccb \ub300\ud654 \uc774\ub825
                  </button>
                </div>
              </div>
              <p className="text-xs text-gray-500">\uc218\uc9d1\ub41c \uc62c\ub9ac\ube0c\uc601 \uc81c\ud488 DB\ub97c AI\uac00 \uc790\ub3d9\uc73c\ub85c \uc870\ud68c\ud558\uace0 \ubd84\uc11d\ud569\ub2c8\ub2e4.</p>
            </div>

            {/* \ub300\ud654 \uc774\ub825 */}
            {showAiHistory && (
              <div className="bg-white rounded-2xl border p-4">
                <h4 className="font-bold text-gray-800 mb-3">\ud83d\udccb \ub300\ud654 \uc774\ub825</h4>
                {aiChatHistory.length > 0 ? (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto">
                    {aiChatHistory.map((chat) => (
                      <div key={chat.id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                        <button onClick={() => loadAiChat(chat.id)} className="flex-1 text-left">
                          <p className="text-sm font-medium text-gray-800 truncate">{chat.title}</p>
                          <p className="text-xs text-gray-400">{formatDate(chat.updated_at)}</p>
                        </button>
                        <button onClick={() => deleteAiChat(chat.id)} className="ml-2 px-2 py-1.5 text-sm text-red-500 hover:text-red-700 hover:bg-red-100 rounded-lg transition">\ud83d\uddd1</button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-3">\uc800\uc7a5\ub41c \ub300\ud654\uac00 \uc5c6\uc2b5\ub2c8\ub2e4</p>
                )}
              </div>
            )}

            {/* \ucc44\ud305 \uc601\uc5ed */}
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
                      <div className="bg-gray-100 p-3 rounded-xl text-sm text-gray-400">DB \uc870\ud68c \ubc0f \ubd84\uc11d \uc911...</div>
                    </div>
                  )}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* \ube60\ub978 \uc9c8\ubb38 */}
              {aiMessages.length === 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {[
                    '\ud074\ub80c\uc9d5\ubc00\ud06c \uce74\ud14c\uace0\ub9ac\uc5d0\uc11c \uc778\uae30 \uc131\ubd84 \ud2b8\ub80c\ub4dc\ub294?',
                    'pH 5.5 \uc774\ud558 \uc81c\ud488\uc744 \ucc3e\uc544\uc918',
                    '\uc138\ub77c\ub9c8\uc774\ub4dc \ud3ec\ud568 \uc81c\ud488 \uc804\uccb4 \uc870\ud68c',
                    '\uba54\uc774\ud06c\ud504\ub818 vs \ub77c\uc6b4\ub4dc\ub7a9 \ud074\ub80c\uc9d5 \ube44\uad50',
                    'DB \ud604\ud669 \uc694\uc57d\ud574\uc918',
                    '\ucf69\ub2e8\ubc31\uc9c8 \ud3ec\ud568 \uc81c\ud488\uc774 \uc788\uc5b4?',
                    '\ud074\ub80c\uc9d5\ubc00\ud06c TOP5 \ud575\uc2ec \uc131\ubd84 \ube44\uad50',
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

              {/* \uc785\ub825 */}
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-4 mt-4">
                <p className="text-xs font-semibold text-emerald-600 mb-2">\ud83d\udcac AI\uc5d0\uac8c \uc9c8\ubb38\ud558\uae30</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiQuestion}
                    onChange={(e) => setAiQuestion(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && aiQuestion.trim()) handleAiChat(); }}
                    placeholder="\ubb34\uc5c7\uc774\ub4e0 \uc9c8\ubb38\ud558\uc138\uc694... (\uc608: \ud074\ub80c\uc9d5\ubc00\ud06c \uce74\ud14c\uace0\ub9ac\uc5d0\uc11c \uac00\uc7a5 \ub9ce\uc774 \uc0ac\uc6a9\ub418\ub294 \uc131\ubd84\uc740?)"
                    className="flex-1 px-4 py-3 border-2 border-emerald-300 bg-white rounded-xl text-sm placeholder:text-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200"
                    disabled={aiLoading}
                  />
                  <button
                    onClick={() => aiQuestion.trim() && handleAiChat()}
                    disabled={aiLoading || !aiQuestion.trim()}
                    className="px-5 py-3 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    {aiLoading ? '\ubd84\uc11d \uc911...' : '\ud83d\ude80 \uc804\uc1a1'}
                  </button>
                  {aiMessages.length > 0 && (
                    <button onClick={startNewAiChat} className="px-3 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">\uc0c8 \ub300\ud654</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* \uc81c\ud488 \ud0d0\uc0c9 \ud0ed */}
        {/* ============================================================ */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* \ud544\ud130 */}
            <div className="bg-white rounded-2xl border p-4">
              <h3 className="font-bold text-gray-900 mb-3">\ud83d\udd0d \uc81c\ud488 \uac80\uc0c9</h3>
              <div className="flex flex-wrap gap-3">
                <select
                  value={productFilter.category}
                  onChange={(e) => setProductFilter(prev => ({ ...prev, category: e.target.value }))}
                  className="px-3 py-2 border rounded-lg text-sm bg-white"
                >
                  <option value="">\uc804\uccb4 \uce74\ud14c\uace0\ub9ac</option>
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
                  placeholder="\ube0c\ub79c\ub4dc\uba85..."
                  className="px-3 py-2 border rounded-lg text-sm w-40"
                />
                <input
                  type="text"
                  value={productFilter.search}
                  onChange={(e) => setProductFilter(prev => ({ ...prev, search: e.target.value }))}
                  placeholder="\uc0c1\ud488\uba85 \uac80\uc0c9..."
                  className="px-3 py-2 border rounded-lg text-sm flex-1 min-w-[200px]"
                />
                <button
                  onClick={fetchProducts}
                  className="px-4 py-2 bg-[#0F172A] text-white rounded-lg text-sm font-medium hover:bg-[#1e293b] transition"
                >
                  \uac80\uc0c9
                </button>
              </div>
            </div>

            {/* \uacb0\uacfc */}
            <div className="bg-white rounded-2xl border">
              <div className="p-4 border-b">
                <span className="text-sm text-gray-500">\ucd1d {productTotal}\uac1c \uc81c\ud488</span>
              </div>
              {productLoading ? (
                <div className="p-8 text-center text-gray-400">\ub85c\ub529 \uc911...</div>
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
                          <span className="text-xs text-emerald-600">\u2705 {p.total_blocks}\ube14\ub85d</span>
                        ) : (
                          <span className="text-xs text-gray-400">\ubbf8\ubd84\uc11d</span>
                        )}
                        <span className="text-gray-300">\u203a</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-gray-400">\uac80\uc0c9 \uacb0\uacfc\uac00 \uc5c6\uc2b5\ub2c8\ub2e4</div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* \uc81c\ud488 \uc0c1\uc138 \ud0ed */}
        {/* ============================================================ */}
        {activeTab === 'detail' && (
          <div className="space-y-4">
            {detailLoading ? (
              <div className="bg-white rounded-2xl border p-8 text-center text-gray-400">\ub85c\ub529 \uc911...</div>
            ) : selectedProduct ? (
              <>
                {/* \uae30\ubcf8\uc815\ubcf4 */}
                <div className="bg-white rounded-2xl border p-4">
                  <button onClick={() => setActiveTab('products')} className="text-xs text-gray-400 hover:text-gray-600 mb-2">\u2190 \ubaa9\ub85d\uc73c\ub85c</button>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs text-gray-400">{selectedProduct.big_category} &gt; {selectedProduct.mid_category} &gt; {selectedProduct.small_category} / {selectedProduct.rank_in_category}\uc704</p>
                      <p className="text-xs font-medium text-emerald-700 mt-1">{selectedProduct.brand_name}</p>
                      <h2 className="font-bold text-lg text-gray-900 mt-0.5">{selectedProduct.product_name}</h2>
                    </div>
                    <a
                      href={selectedProduct.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-medium hover:bg-emerald-200 transition flex-shrink-0"
                    >
                      \uc62c\ub9ac\ube0c\uc601 \u2192
                    </a>
                  </div>
                  {selectedProduct.summary && (
                    <p className="text-sm text-gray-600 mt-3 bg-gray-50 p-3 rounded-lg">{selectedProduct.summary}</p>
                  )}
                </div>

                {/* \ud575\uc2ec\uc815\ubcf4 \uc694\uc57d */}
                {selectedProduct.product_essentials && (
                  <div className="bg-white rounded-2xl border p-4">
                    <button
                      onClick={() => setEssentialsExpanded(!essentialsExpanded)}
                      className="w-full flex items-center justify-between"
                    >
                      <h3 className="font-bold text-gray-900">\u2b50 \ud575\uc2ec\uc815\ubcf4 \uc694\uc57d</h3>
                      <span className="text-gray-400">{essentialsExpanded ? '\u25b2' : '\u25bc'}</span>
                    </button>

                    {essentialsExpanded && (
                      <div className="mt-4 space-y-4">
                        {/* \ud6a8\ub2a5 \ud3ec\uc778\ud2b8 */}
                        {selectedProduct.efficacy_points?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">\ud83d\udcaa \ud6a8\ub2a5 \ud3ec\uc778\ud2b8</h4>
                            <div className="space-y-2">
                              {selectedProduct.efficacy_points.map((p: any, i: number) => (
                                <div key={i} className="bg-emerald-50 p-3 rounded-lg">
                                  <p className="font-medium text-sm text-emerald-800">Point {p.pointNumber}: {p.headline}</p>
                                  {p.subCopy && <p className="text-xs text-emerald-600 mt-0.5">{p.subCopy}</p>}
                                  {p.clinicalNote && <p className="text-xs text-gray-500 mt-1">\ud83d\udccb {p.clinicalNote}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* \uc8fc\uc694 \uc131\ubd84 */}
                        {selectedProduct.key_ingredients?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">\ud83e\uddea \uc8fc\uc694 \uc131\ubd84</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedProduct.key_ingredients.map((ing: any, i: number) => (
                                <span key={i} className="px-3 py-1.5 bg-amber-50 text-amber-800 rounded-full text-xs font-medium">
                                  {ing.name} {ing.benefit && `\u00b7 ${ing.benefit}`}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* \uc548\uc804\uc131 \ud14c\uc2a4\ud2b8 */}
                        {selectedProduct.safety_tests?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">\ud83d\udee1\ufe0f \uc548\uc804\uc131 \ud14c\uc2a4\ud2b8</h4>
                            <div className="space-y-2">
                              {selectedProduct.safety_tests.map((t: any, i: number) => (
                                <div key={i} className="bg-blue-50 p-3 rounded-lg">
                                  <p className="font-medium text-sm text-blue-800">{t.testName}</p>
                                  <p className="text-xs text-blue-600">{t.description}</p>
                                  {t.institution && <p className="text-xs text-gray-500 mt-1">\uae30\uad00: {t.institution} / \uae30\uac04: {t.period} / \uc778\uc6d0: {t.subjects}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* \uc81c\ud615 \uc815\ubcf4 */}
                        {selectedProduct.formula_info && (selectedProduct.formula_info.pH || selectedProduct.formula_info.texture) && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">\ud83e\uddf4 \uc81c\ud615 \uc815\ubcf4</h4>
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

                        {/* \uc0ac\uc6a9\ubc95 */}
                        {selectedProduct.how_to_use?.steps?.length > 0 && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">\ud83d\udcdd \uc0ac\uc6a9\ubc95</h4>
                            <div className="space-y-1.5">
                              {selectedProduct.how_to_use.steps.map((s: any, i: number) => (
                                <p key={i} className="text-xs text-gray-600 pl-3 border-l-2 border-gray-200">
                                  <span className="font-medium">Step {s.step}:</span> {s.description}
                                </p>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* \uc804\uc131\ubd84 */}
                        {selectedProduct.full_ingredients && (
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 mb-2">\ud83d\udcdc \uc804\uc131\ubd84</h4>
                            <p className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg leading-relaxed">{selectedProduct.full_ingredients}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* \ube14\ub85d \ubd84\uc11d */}
                {selectedProduct.block_analysis?.length > 0 && (
                  <div className="bg-white rounded-2xl border p-4">
                    <h3 className="font-bold text-gray-900 mb-3">\ud83e\uddf1 \uc0c1\uc138\ud398\uc774\uc9c0 \ube14\ub85d \ubd84\uc11d ({selectedProduct.block_analysis.length}\uac1c)</h3>
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
                \ud83d\udd0d \uc81c\ud488 \ud0d0\uc0c9 \ud0ed\uc5d0\uc11c \uc81c\ud488\uc744 \uc120\ud0dd\ud558\uc138\uc694
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
