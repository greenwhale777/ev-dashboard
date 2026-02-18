'use client';

import { useState, useEffect, useCallback } from 'react';

// EV3 Accounting API 서버
const API_URL = process.env.NEXT_PUBLIC_EV3_API_URL || 'https://ev3-accounting-production.up.railway.app';

// ============ 타입 ============
interface AccountMapping {
  id: number;
  priority: number;
  source_type: 'memo' | 'merchant' | 'trading_party';
  match_value: string;
  match_type: 'includes' | 'exact' | 'startsWith';
  case_sensitive: boolean;
  account_code: string;
  account_name: string;
  vendor_code: string;
  vendor_name: string;
  voucher_type: 'general' | 'purchase' | 'both';
  is_active: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface ExecutionLog {
  id: number;
  bot_id: string;
  bot_name: string;
  status: 'SUCCESS' | 'ERROR' | 'RUNNING';
  start_time: string;
  end_time: string;
  duration: string;
  message: string;
  result: Record<string, unknown>;
}

type TabType = 'logs' | 'mappings';
type ModalMode = 'add' | 'edit';

// ============ 유틸리티 ============
const SOURCE_LABELS: Record<string, string> = {
  memo: '메모',
  merchant: '거래처명',
  trading_party: '거래자 / 적요',
};

const VOUCHER_LABELS: Record<string, string> = {
  general: '일반전표',
  purchase: '매입전표',
  both: '공통',
};

function formatTime(iso: string | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${m}/${day} ${h}:${min}`;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    SUCCESS: { label: '성공', bg: 'bg-emerald-900/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
    ERROR: { label: '실패', bg: 'bg-red-900/30', text: 'text-red-400', dot: 'bg-red-400' },
    RUNNING: { label: '실행 중', bg: 'bg-amber-900/30', text: 'text-amber-400', dot: 'bg-amber-400' },
  };
  const c = config[status] || config.ERROR;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'RUNNING' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

// ============ 메인 컴포넌트 ============
export default function AccountingPage() {
  const [tab, setTab] = useState<TabType>('logs');
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [mappings, setMappings] = useState<AccountMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [triggering, setTriggering] = useState(false);
  const [triggerResult, setTriggerResult] = useState<string | null>(null);

  // 매핑 필터
  const [filterVoucherType, setFilterVoucherType] = useState<string>('all');
  const [filterSourceType, setFilterSourceType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // 모달
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>('add');
  const [editingMapping, setEditingMapping] = useState<AccountMapping | null>(null);
  const [formData, setFormData] = useState({
    priority: 2,
    source_type: 'merchant' as 'memo' | 'merchant' | 'trading_party',
    match_value: '',
    match_type: 'includes' as 'includes' | 'exact' | 'startsWith',
    case_sensitive: true,
    account_code: '',
    account_name: '',
    vendor_code: '',
    vendor_name: '',
    voucher_type: 'both' as 'general' | 'purchase' | 'both',
    notes: '',
  });

  // ============ 데이터 로드 ============
  const fetchData = useCallback(async () => {
    try {
      setApiError(null);
      const [logsRes, mappingsRes] = await Promise.all([
        fetch(`${API_URL}/api/logs?limit=50`),
        fetch(`${API_URL}/api/mappings`),
      ]);
      if (logsRes.ok) setLogs(await logsRes.json());
      if (mappingsRes.ok) setMappings(await mappingsRes.json());
      setLoading(false);
    } catch (e) {
      console.error('API 오류:', e);
      setApiError('EV3 API 서버에 연결할 수 없습니다.');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // ============ 수동 실행 ============
  const handleTrigger = async () => {
    setTriggering(true);
    setTriggerResult(null);
    try {
      const res = await fetch(`${API_URL}/api/trigger/accounting`, { method: 'POST' });
      const data = await res.json();
      setTriggerResult(data.triggered ? '✅ 실행 요청 전송 완료' : '⚠️ ' + data.message);
      setTimeout(() => fetchData(), 3000);
    } catch {
      setTriggerResult('❌ 실행 요청 실패');
    } finally {
      setTriggering(false);
      setTimeout(() => setTriggerResult(null), 5000);
    }
  };

  // ============ 매핑 CRUD ============
  const openAddModal = () => {
    setModalMode('add');
    setEditingMapping(null);
    setFormData({
      priority: 2, source_type: 'merchant', match_value: '', match_type: 'includes',
      case_sensitive: true, account_code: '', account_name: '', vendor_code: '',
      vendor_name: '', voucher_type: 'both', notes: '',
    });
    setShowModal(true);
  };

  const openEditModal = (m: AccountMapping) => {
    setModalMode('edit');
    setEditingMapping(m);
    setFormData({
      priority: m.priority,
      source_type: m.source_type,
      match_value: m.match_value,
      match_type: m.match_type,
      case_sensitive: m.case_sensitive,
      account_code: m.account_code,
      account_name: m.account_name,
      vendor_code: m.vendor_code,
      vendor_name: m.vendor_name,
      voucher_type: m.voucher_type,
      notes: m.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.match_value) {
      alert('입력값은 필수입니다.');
      return;
    }
    if (formData.priority === 1 && !formData.account_code) {
      alert('1순위 매핑은 계정코드가 필수입니다.');
      return;
    }
    if (!formData.account_code && !formData.vendor_code) {
      alert('계정코드 또는 거래처코드 중 하나는 입력해야 합니다.');
      return;
    }
    try {
      if (modalMode === 'add') {
        await fetch(`${API_URL}/api/mappings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      } else if (editingMapping) {
        await fetch(`${API_URL}/api/mappings/${editingMapping.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setShowModal(false);
      fetchData();
    } catch {
      alert('저장 실패');
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('삭제하시겠습니까?')) return;
    try {
      await fetch(`${API_URL}/api/mappings/${id}`, { method: 'DELETE' });
      fetchData();
    } catch {
      alert('삭제 실패');
    }
  };

  const handleToggleActive = async (m: AccountMapping) => {
    try {
      await fetch(`${API_URL}/api/mappings/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !m.is_active }),
      });
      fetchData();
    } catch {
      alert('상태 변경 실패');
    }
  };

  // ============ 필터링 ============
  const filteredMappings = mappings.filter(m => {
    if (filterVoucherType !== 'all' && m.voucher_type !== filterVoucherType && m.voucher_type !== 'both') return false;
    if (filterSourceType !== 'all' && m.source_type !== filterSourceType) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return m.match_value.toLowerCase().includes(q) ||
        m.account_code.includes(q) ||
        m.account_name.toLowerCase().includes(q) ||
        m.vendor_code.includes(q);
    }
    return true;
  });

  const memoMappings = filteredMappings.filter(m => m.source_type === 'memo');
  const merchantMappings = filteredMappings.filter(m => m.source_type !== 'memo');

  // ============ 렌더링 ============
  return (
    <>
      <style jsx global>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
        code, .font-mono { font-family: 'JetBrains Mono', monospace !important; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.3s ease-out; }
        
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-up { animation: slideUp 0.25s ease-out; }

        .scrollbar-thin::-webkit-scrollbar { width: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(139, 92, 246, 0.3); border-radius: 2px; }
      `}</style>

      <div className="min-h-screen bg-[#0B0D11] text-slate-200">
        {/* 헤더 */}
        <header className="bg-[#0F1117]/80 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <a href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  <span className="text-sm">대시보드</span>
                </a>
                <div className="w-px h-5 bg-white/10" />
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-violet-600 to-purple-800 rounded-lg flex items-center justify-center shadow-lg shadow-violet-900/30">
                    <span className="text-white text-sm font-bold">E3</span>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">회계전표 업로드</h1>
                    <p className="text-xs text-slate-500">EV3 · 백오피스 자동화</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {triggerResult && (
                  <span className="text-sm text-slate-300 animate-fade-in">{triggerResult}</span>
                )}
                <button
                  onClick={handleTrigger}
                  disabled={triggering}
                  className="group relative px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-500 hover:to-purple-600 text-white text-sm font-semibold rounded-xl transition-all duration-200 cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-900/40 hover:shadow-violet-800/50"
                >
                  {triggering ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      실행 중...
                    </span>
                  ) : '▶ 수동 실행'}
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 pt-6 pb-12">
          {apiError && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-800/40 rounded-xl animate-fade-in">
              <div className="flex items-center gap-2 text-red-400">
                <span>⚠️</span>
                <span className="font-medium text-sm">{apiError}</span>
              </div>
            </div>
          )}

          {/* 탭 */}
          <div className="flex gap-1 mb-6 bg-[#13151B] rounded-xl p-1 w-fit">
            {([
              { key: 'logs', label: '실행 로그', icon: '📋' },
              { key: 'mappings', label: '계정과목 매핑', icon: '🗂️' },
            ] as { key: TabType; label: string; icon: string }[]).map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 cursor-pointer flex items-center gap-2 ${
                  tab === t.key
                    ? 'bg-violet-600/20 text-violet-300 shadow-inner'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.03]'
                }`}
              >
                <span>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>

          {/* ============ 실행 로그 탭 ============ */}
          {tab === 'logs' && (
            <div className="space-y-4 animate-fade-in">
              {/* 요약 카드 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                  { label: '전체 실행', value: logs.length, color: 'from-slate-800 to-slate-900', border: 'border-slate-700/50' },
                  { label: '성공', value: logs.filter(l => l.status === 'SUCCESS').length, color: 'from-emerald-900/40 to-emerald-950/40', border: 'border-emerald-800/30' },
                  { label: '실패', value: logs.filter(l => l.status === 'ERROR').length, color: 'from-red-900/40 to-red-950/40', border: 'border-red-800/30' },
                  { label: '마지막 실행', value: logs[0] ? formatTime(logs[0].end_time || logs[0].start_time) : '-', color: 'from-violet-900/30 to-violet-950/30', border: 'border-violet-800/30', isText: true },
                ].map((card, i) => (
                  <div key={i} className={`p-4 bg-gradient-to-br ${card.color} rounded-xl border ${card.border}`}>
                    <div className="text-xs text-slate-400 mb-1">{card.label}</div>
                    <div className={`font-bold ${('isText' in card && card.isText) ? 'text-base text-slate-200' : 'text-2xl text-white'}`}>
                      {card.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* 로그 리스트 */}
              <div className="bg-[#13151B] rounded-2xl border border-white/[0.06] overflow-hidden">
                <div className="px-6 py-4 border-b border-white/[0.06]">
                  <h3 className="text-base font-bold text-white">실행 기록</h3>
                </div>
                <div className="max-h-[520px] overflow-y-auto scrollbar-thin">
                  {loading ? (
                    <div className="text-center py-12 text-slate-500">불러오는 중...</div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-12 text-slate-500">실행 기록이 없습니다</div>
                  ) : (
                    logs.map((log, i) => (
                      <div
                        key={log.id || i}
                        className="flex items-center gap-4 px-6 py-3.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors"
                        style={{ animationDelay: `${i * 30}ms` }}
                      >
                        <span className="text-xs text-slate-500 w-20 flex-shrink-0 font-mono">
                          {formatTime(log.end_time || log.start_time)}
                        </span>
                        <StatusBadge status={log.status} />
                        <span className="text-sm font-semibold text-violet-400 flex-shrink-0">[{log.bot_name}]</span>
                        <span className="text-sm text-slate-400 truncate flex-1">{log.message}</span>
                        {log.duration && (
                          <span className="text-xs text-slate-600 flex-shrink-0 font-mono">{log.duration}</span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ============ 계정과목 매핑 탭 ============ */}
          {tab === 'mappings' && (
            <div className="space-y-5 animate-fade-in">
              {/* 필터 바 */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[200px]">
                  <input
                    type="text"
                    placeholder="입력값, 계정코드, 계정명 검색..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#13151B] border border-white/[0.08] rounded-xl text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600/50 focus:ring-1 focus:ring-violet-600/20 transition-all"
                  />
                </div>
                <select
                  value={filterVoucherType}
                  onChange={e => setFilterVoucherType(e.target.value)}
                  className="px-4 py-2.5 bg-[#13151B] border border-white/[0.08] rounded-xl text-sm text-slate-300 focus:outline-none focus:border-violet-600/50 cursor-pointer"
                >
                  <option value="all">전표유형: 전체</option>
                  <option value="general">일반전표</option>
                  <option value="purchase">매입전표</option>
                </select>
                <select
                  value={filterSourceType}
                  onChange={e => setFilterSourceType(e.target.value)}
                  className="px-4 py-2.5 bg-[#13151B] border border-white/[0.08] rounded-xl text-sm text-slate-300 focus:outline-none focus:border-violet-600/50 cursor-pointer"
                >
                  <option value="all">매칭소스: 전체</option>
                  <option value="memo">메모</option>
                  <option value="merchant">거래처명</option>
                  <option value="trading_party">거래자 / 적요</option>
                </select>
                <button
                  onClick={openAddModal}
                  className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer active:scale-95 shadow-lg shadow-violet-900/30 flex items-center gap-2"
                >
                  <span className="text-lg leading-none">+</span> 매핑 추가
                </button>
              </div>

              {/* 안내 */}
              <div className="p-4 bg-violet-900/10 border border-violet-800/20 rounded-xl">
                <p className="text-xs text-violet-300/70 leading-relaxed">
                  <strong className="text-violet-300">매핑 우선순위:</strong> 1순위(메모 W/Q열) → 2순위(거래처명/거래자명) → 기본값(8489 잡비). 
                  여기서 수정한 매핑은 n8n 실행 시 자동으로 반영됩니다. 로컬 JS 파일 수정 불필요.
                </p>
              </div>

              {/* 1순위: 메모 기반 */}
              {memoMappings.length > 0 && (
                <MappingSection
                  title="1순위 — 메모 기반 매핑"
                  subtitle="카드: card_merged W열(메모) | 은행: clobe_labeling Q열(메모)에서 키워드 매칭"
                  mappings={memoMappings}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onToggle={handleToggleActive}
                />
              )}

              {/* 2순위: 거래처 기반 */}
              {merchantMappings.length > 0 && (
                <MappingSection
                  title="2순위 — 거래처/거래자 기반 매핑"
                  subtitle="카드: card_merged G열(가맹점명) | 은행: clobe_labeling K열(거래자명), J열(적요)에서 키워드 매칭"
                  mappings={merchantMappings}
                  onEdit={openEditModal}
                  onDelete={handleDelete}
                  onToggle={handleToggleActive}
                />
              )}

              {filteredMappings.length === 0 && !loading && (
                <div className="text-center py-16 text-slate-500">
                  {searchQuery ? `"${searchQuery}" 검색 결과 없음` : '매핑 데이터가 없습니다'}
                </div>
              )}
            </div>
          )}
        </main>

        {/* ============ 모달 ============ */}
        {showModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
            <div className="bg-[#1A1D25] border border-white/[0.08] rounded-2xl w-full max-w-xl shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/[0.06]">
                <h3 className="text-lg font-bold text-white">
                  {modalMode === 'add' ? '매핑 추가' : '매핑 수정'}
                </h3>
              </div>

              <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
                {/* 매칭 조건 */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">매칭 조건</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">매칭 소스</label>
                      <select value={formData.source_type} onChange={e => setFormData(f => ({ ...f, source_type: e.target.value as typeof f.source_type }))}
                        className="w-full px-3 py-2 bg-[#0F1117] border border-white/[0.08] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-600/50">
                        <option value="memo">메모</option>
                        <option value="merchant">거래처명</option>
                        <option value="trading_party">거래자 / 적요</option>
                      </select>
                      <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
                        {formData.source_type === 'memo' && '📂 카드: card_merged W열(메모) | 은행: clobe_labeling Q열(메모)'}
                        {formData.source_type === 'merchant' && '📂 카드: card_merged G열(가맹점명)'}
                        {formData.source_type === 'trading_party' && '📂 은행: clobe_labeling K열(거래자명), J열(적요)'}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">우선순위</label>
                      <select value={formData.priority} onChange={e => setFormData(f => ({ ...f, priority: parseInt(e.target.value) }))}
                        className="w-full px-3 py-2 bg-[#0F1117] border border-white/[0.08] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-600/50">
                        <option value={1}>1순위</option>
                        <option value={2}>2순위</option>
                        <option value={3}>3순위</option>
                      </select>
                      <p className="mt-1.5 text-[10px] text-slate-500 leading-relaxed">
                        {formData.priority === 1 && '가장 먼저 매칭. 메모 키워드로 계정코드를 확정할 때 사용'}
                        {formData.priority === 2 && '1순위에 매칭 안 된 경우 실행. 거래처/가맹점명으로 매칭'}
                        {formData.priority === 3 && '1~2순위 모두 매칭 안 된 경우 최후에 실행'}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">입력값 (매칭 키워드)</label>
                    <input type="text" value={formData.match_value} onChange={e => setFormData(f => ({ ...f, match_value: e.target.value }))}
                      placeholder="예: 패스트파이브 부가서비스"
                      className="w-full px-3 py-2 bg-[#0F1117] border border-white/[0.08] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600/50" />
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                      <input type="checkbox" checked={!formData.case_sensitive}
                        onChange={e => setFormData(f => ({ ...f, case_sensitive: !e.target.checked }))}
                        className="rounded border-white/20 bg-transparent text-violet-600 focus:ring-violet-600 cursor-pointer" />
                      대소문자 무시
                    </label>
                  </div>
                </div>

                <div className="h-px bg-white/[0.06]" />

                {/* 결과값 */}
                <div className="space-y-3">
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide">결과값</label>
                  {formData.priority >= 2 && (
                    <p className="text-[10px] text-amber-400/70">💡 2순위 이상은 거래처코드만 입력해도 됩니다. 계정코드가 비어있으면 1순위 매핑의 계정코드가 적용됩니다.</p>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">계정코드 {formData.priority === 1 ? '*' : ''}</label>
                      <input type="text" value={formData.account_code} onChange={e => setFormData(f => ({ ...f, account_code: e.target.value }))}
                        placeholder="예: 8319"
                        className="w-full px-3 py-2 bg-[#0F1117] border border-white/[0.08] rounded-lg text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-violet-600/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">계정명</label>
                      <input type="text" value={formData.account_name} onChange={e => setFormData(f => ({ ...f, account_name: e.target.value }))}
                        placeholder="예: 지급수수료"
                        className="w-full px-3 py-2 bg-[#0F1117] border border-white/[0.08] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">거래처코드</label>
                      <input type="text" value={formData.vendor_code} onChange={e => setFormData(f => ({ ...f, vendor_code: e.target.value }))}
                        placeholder="예: 11116"
                        className="w-full px-3 py-2 bg-[#0F1117] border border-white/[0.08] rounded-lg text-sm text-slate-200 font-mono placeholder-slate-600 focus:outline-none focus:border-violet-600/50" />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">전표유형</label>
                      <select value={formData.voucher_type} onChange={e => setFormData(f => ({ ...f, voucher_type: e.target.value as typeof f.voucher_type }))}
                        className="w-full px-3 py-2 bg-[#0F1117] border border-white/[0.08] rounded-lg text-sm text-slate-200 focus:outline-none focus:border-violet-600/50">
                        <option value="both">공통 (일반+매입)</option>
                        <option value="general">일반전표만</option>
                        <option value="purchase">매입전표만</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">메모</label>
                    <input type="text" value={formData.notes} onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                      placeholder="관리 메모 (선택)"
                      className="w-full px-3 py-2 bg-[#0F1117] border border-white/[0.08] rounded-lg text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-violet-600/50" />
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
                <button onClick={() => setShowModal(false)}
                  className="px-5 py-2.5 text-sm font-medium text-slate-400 hover:text-slate-200 rounded-lg hover:bg-white/[0.05] transition-all cursor-pointer">
                  취소
                </button>
                <button onClick={handleSave}
                  className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-lg transition-all cursor-pointer active:scale-95">
                  {modalMode === 'add' ? '추가' : '저장'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ============ 매핑 섹션 컴포넌트 ============
function MappingSection({
  title, subtitle, mappings, onEdit, onDelete, onToggle
}: {
  title: string;
  subtitle: string;
  mappings: AccountMapping[];
  onEdit: (m: AccountMapping) => void;
  onDelete: (id: number) => void;
  onToggle: (m: AccountMapping) => void;
}) {
  return (
    <div className="bg-[#13151B] rounded-2xl border border-white/[0.06] overflow-hidden">
      <div className="px-6 py-4 border-b border-white/[0.06]">
        <h3 className="text-sm font-bold text-white">{title}</h3>
        <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/[0.06]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 w-8">활성</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">입력값</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">매칭소스</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">계정코드</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">계정명</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">거래처코드</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500">전표유형</th>
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 w-24">관리</th>
            </tr>
          </thead>
          <tbody>
            {mappings.map((m) => (
              <tr key={m.id} className={`border-b border-white/[0.02] hover:bg-white/[0.02] transition-colors ${!m.is_active ? 'opacity-40' : ''}`}>
                <td className="px-4 py-2.5">
                  <button onClick={() => onToggle(m)} className="cursor-pointer">
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center text-xs transition-all ${m.is_active ? 'bg-violet-600/30 text-violet-400' : 'bg-slate-800 text-slate-600'}`}>
                      {m.is_active ? '✓' : ''}
                    </div>
                  </button>
                </td>
                <td className="px-4 py-2.5">
                  <code className="text-violet-300 text-xs bg-violet-900/20 px-2 py-0.5 rounded">{m.match_value}</code>
                  {!m.case_sensitive && <span className="ml-1.5 text-[10px] text-slate-600">Aa무시</span>}
                </td>
                <td className="px-4 py-2.5 text-xs text-slate-400">{SOURCE_LABELS[m.source_type] || m.source_type}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-emerald-400 font-semibold">{m.account_code}</td>
                <td className="px-4 py-2.5 text-xs text-slate-300">{m.account_name}</td>
                <td className="px-4 py-2.5 font-mono text-xs text-amber-400">{m.vendor_code || '-'}</td>
                <td className="px-4 py-2.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                    m.voucher_type === 'both' ? 'bg-slate-800 text-slate-400' :
                    m.voucher_type === 'general' ? 'bg-blue-900/30 text-blue-400' :
                    'bg-orange-900/30 text-orange-400'
                  }`}>{VOUCHER_LABELS[m.voucher_type]}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button onClick={() => onEdit(m)}
                      className="px-2 py-1 text-xs text-slate-400 hover:text-violet-400 hover:bg-violet-900/20 rounded transition-all cursor-pointer">
                      수정
                    </button>
                    <button onClick={() => onDelete(m.id)}
                      className="px-2 py-1 text-xs text-slate-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-all cursor-pointer">
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
