'use client';

import { useState, useEffect } from 'react';

// API 서버 URL
const API_URL = process.env.NEXT_PUBLIC_EV0_API_URL || 'https://ev0-agent-production.up.railway.app';

interface ExecutionLog {
  botId: string;
  botName: string;
  status: string;
  startTime: string;
  endTime: string;
  duration: string;
  message: string;
  result?: {
    match?: boolean;
    clobeBalance?: number;
    ecountBalance?: number;
    difference?: number;
  };
}

// 봇 설정
const botConfigs = {
  ev1: {
    title: 'EV1 - 재고 관리',
    icon: '📦',
    color: '#10B981',
    bots: [] as any[],
    comingSoon: true,
    description: '재고 수불부, 발주 알림'
  },
  ev2: {
    title: 'EV2 - 생산성 봇',
    icon: '🔍',
    color: '#3B82F6',
    bots: [
      { id: 'oliveyoung', name: '올리브영 스크래퍼', schedule: '매주 월요일 09:00', hasManualRun: true, command: '/run 올리브영' },
      { id: 'page-analyzer', name: '상세페이지 분석', schedule: '수동 실행', hasManualRun: true, link: '/ev2' },
      { id: 'tiktok-analyzer', name: 'TikTok 광고 분석', schedule: '매일 10:00', hasManualRun: false, link: '/tiktok' }
    ],
    description: '데이터 수집 및 분석'
  },
  ev3: {
    title: 'EV3 - 백오피스',
    icon: '💼',
    color: '#8B5CF6',
    bots: [
      { id: 'accounting', name: '회계전표 업로드', schedule: '매주 수요일 12:00', hasManualRun: true, command: '/run 회계', link: '/ev3/accounting' },
      { id: 'cash-bot', name: '캐시 잔액 확인', schedule: '매일 08:00', hasManualRun: true, command: '/run 캐시' }
    ],
    description: '회계 및 재무 자동화'
  }
};

// 변경 이력 (수동 관리)
const changelog = [
  { date: '2/18', text: 'AI 채팅 이력 아카이빙 추가' },
  { date: '2/18', text: 'DB 백업 자동화 (Google Drive)' },
  { date: '2/18', text: 'AI 분석 프롬프트 hallucination 방지' },
  { date: '2/17', text: 'Daily Report 타임존 수정' },
  { date: '2/17', text: '분석 탭 + AI 채팅 기능 추가' },
  { date: '2/16', text: 'Daily Report + SadCaptcha 최적화' },
  { date: '2/14', text: 'SadCaptcha 캡차 자동 해결 연동' },
  { date: '2/12', text: '일반 Chrome 전환 · 캡차 완전 우회' },
  { date: '2/10', text: 'TikTok 봇 Task Queue 시스템 구축' },
];

// 상태 뱃지
function getStatusBadge(status: string | undefined) {
  if (status === 'SUCCESS') return { label: '정상', bg: 'bg-emerald-50', text: 'text-emerald-600', dot: 'bg-emerald-500' };
  if (status === 'ERROR') return { label: '오류', bg: 'bg-red-50', text: 'text-red-600', dot: 'bg-red-500' };
  return { label: '대기', bg: 'bg-slate-100', text: 'text-slate-500', dot: 'bg-slate-400' };
}

// 시간 포맷
function formatTime(isoString: string | undefined) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${minutes}`;
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'ev1' | 'ev2' | 'ev3' | null>(null);
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [botStatus, setBotStatus] = useState<Record<string, ExecutionLog>>({});
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error'>('all');
  const [logBotFilter, setLogBotFilter] = useState<string>('all');

  const fetchLogs = async () => {
    try {
      setApiError(null);
      const logsRes = await fetch(`${API_URL}/api/logs`);
      const logsData = await logsRes.json();
      setLogs(logsData);

      const statusRes = await fetch(`${API_URL}/api/status`);
      if (!statusRes.ok) throw new Error('상태 조회 실패');
      const statusData = await statusRes.json();
      setBotStatus(statusData);

      setLastUpdate(new Date());
      setLoading(false);
    } catch (e) {
      console.error('API 오류:', e);
      setApiError('API 서버에 연결할 수 없습니다.');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30000);
    return () => clearInterval(interval);
  }, []);

  // 봇별 최신 상태
  const getLatestBotLog = (botId: string) => {
    return logs.find(l => l.botId === botId);
  };

  // EV 모듈별 상태 판단
  const getModuleStatus = (key: string) => {
    const config = botConfigs[key as keyof typeof botConfigs];
    if ('comingSoon' in config && config.comingSoon) return { status: 'pending', label: '개발 중', color: 'text-slate-400' };
    const botIds = config.bots.map((b: any) => b.id);
    const latestLogs = botIds.map((id: string) => getLatestBotLog(id)).filter(Boolean);
    if (latestLogs.length === 0) return { status: 'pending', label: '대기', color: 'text-slate-400' };
    const hasError = latestLogs.some(l => l!.status === 'ERROR');
    if (hasError) return { status: 'error', label: '오류', color: 'text-red-500' };
    return { status: 'ok', label: '정상', color: 'text-emerald-500' };
  };

  // 필터된 로그
  const filteredLogs = logs.filter(log => {
    if (logFilter === 'success' && log.status !== 'SUCCESS') return false;
    if (logFilter === 'error' && log.status !== 'ERROR') return false;
    if (logBotFilter !== 'all' && log.botId !== logBotFilter) return false;
    return true;
  });

  return (
    <>
      <style jsx global>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">EV</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">EV System Dashboard</h1>
                  <p className="text-sm text-slate-500">ASCENDERZ Elevator Framework</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                {lastUpdate && (
                  <span className="text-xs text-slate-400">
                    마지막 업데이트: {lastUpdate.toLocaleTimeString('ko-KR')}
                  </span>
                )}
                <button
                  onClick={fetchLogs}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-sm font-medium text-slate-700 transition-all cursor-pointer active:scale-95"
                >
                  🔄 새로고침
                </button>
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-6 pt-6 pb-8">
          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 text-red-600">
                <span>⚠️</span>
                <span className="font-medium">{apiError}</span>
              </div>
            </div>
          )}

          {/* ============================================================ */}
          {/* EV0 - 중앙 관리 (항상 표시) */}
          {/* ============================================================ */}
          <div className="mb-8">
            {/* EV0 헤더 + 시스템 상태 */}
            <div className="bg-gradient-to-r from-[#0F172A] to-[#1E293B] rounded-2xl p-6 mb-4 text-white">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <h2 className="text-lg font-bold">EV0 - 중앙 관리</h2>
                    <p className="text-sm text-slate-400">시스템 모니터링 · 통합 로그 · 백업</p>
                  </div>
                </div>
              </div>

              {/* 시스템 상태 카드 */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white/10 backdrop-blur rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-300">📦 EV1</span>
                    <span className={`text-xs font-semibold ${getModuleStatus('ev1').color}`}>{getModuleStatus('ev1').label}</span>
                  </div>
                  <p className="text-xs text-slate-400">재고 관리</p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-300">🔍 EV2</span>
                    <span className={`text-xs font-semibold ${getModuleStatus('ev2').color}`}>{getModuleStatus('ev2').label}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {botStatus['tiktok-analyzer'] ? `TikTok ${formatTime(botStatus['tiktok-analyzer']?.endTime)}` : '생산성 봇'}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-300">💼 EV3</span>
                    <span className={`text-xs font-semibold ${getModuleStatus('ev3').color}`}>{getModuleStatus('ev3').label}</span>
                  </div>
                  <p className="text-xs text-slate-400">
                    {botStatus['cash-bot'] ? `캐시 ${formatTime(botStatus['cash-bot']?.endTime)}` : '백오피스'}
                  </p>
                </div>
                <div className="bg-white/10 backdrop-blur rounded-xl p-3.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-300">💾 백업</span>
                    <span className="text-xs font-semibold text-emerald-400">자동</span>
                  </div>
                  <p className="text-xs text-slate-400">매일 03:00 · Google Drive</p>
                </div>
              </div>
            </div>

            {/* 하위 모듈 탭 */}
            <div className="flex gap-2 mb-6">
              {Object.entries(botConfigs).map(([key, config]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(activeTab === key ? null : key as any)}
                  style={{
                    backgroundColor: activeTab === key ? config.color : 'white',
                    color: activeTab === key ? '#FFFFFF' : '#475569',
                    borderColor: activeTab === key ? config.color : '#E2E8F0',
                  }}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-[0.98] border whitespace-nowrap flex items-center justify-center gap-2 text-sm"
                >
                  <span>{config.icon}</span>
                  <span>{config.title.split(' - ')[0]}</span>
                  {'comingSoon' in config && config.comingSoon && (
                    <span className="text-[10px] bg-black/10 px-1.5 py-0.5 rounded">개발 중</span>
                  )}
                </button>
              ))}
            </div>

            {/* ============================================================ */}
            {/* 하위 모듈 상세 */}
            {/* ============================================================ */}

            {activeTab === 'ev1' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-10 shadow-sm text-center mb-6">
                <div className="text-5xl mb-3">📦</div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">EV1 - 재고 관리</h2>
                <p className="text-slate-500 mb-4 text-sm">재고 수불부, 발주 알림, 이벤트 관리 기능 개발 중입니다.</p>
                <div className="inline-block px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-600">🚧 Coming Soon</div>
              </div>
            )}

            {activeTab === 'ev2' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">🔍</span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">EV2 - 생산성 봇</h2>
                    <p className="text-xs text-slate-500">데이터 수집 및 분석 자동화</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {botConfigs.ev2.bots.map((bot) => {
                    const status = botStatus[bot.id];
                    const badge = getStatusBadge(status?.status);
                    return (
                      <div key={bot.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-slate-900 text-sm">{bot.name}</h3>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>⏰ {bot.schedule}</span>
                              {status?.endTime && <span>마지막: {formatTime(status.endTime)}</span>}
                            </div>
                          </div>
                          {'link' in bot && bot.link && (
                            <a href={bot.link} className="px-3.5 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-xs font-semibold rounded-lg transition-all active:scale-95">열기 →</a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === 'ev3' && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm mb-6">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl">💼</span>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">EV3 - 백오피스</h2>
                    <p className="text-xs text-slate-500">회계 및 재무 자동화</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {botConfigs.ev3.bots.map((bot) => {
                    const status = botStatus[bot.id];
                    const badge = getStatusBadge(status?.status);
                    return (
                      <div key={bot.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:shadow-sm transition-all">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-bold text-slate-900 text-sm">{bot.name}</h3>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400">
                              <span>⏰ {bot.schedule}</span>
                              {status?.endTime && <span>마지막: {formatTime(status.endTime)}</span>}
                            </div>
                            {bot.id === 'cash-bot' && status?.result?.difference !== undefined && (
                              <div className="mt-2 text-xs">
                                <span className={`font-bold ${status.result.difference === 0 ? 'text-emerald-600' : 'text-amber-600'}`}>
                                  차이: {status.result.difference.toLocaleString()}원
                                </span>
                              </div>
                            )}
                          </div>
                          {'link' in bot && bot.link && (
                            <a href={bot.link} className="px-3.5 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-xs font-semibold rounded-lg transition-all active:scale-95">열기 →</a>
                          )}
                        </div>
                        {status?.message && (
                          <div className="mt-2 p-2 bg-white rounded-lg">
                            <p className="text-[11px] text-slate-500 truncate">{status.message}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ============================================================ */}
            {/* 통합 로그 + 변경 이력 (2컬럼) */}
            {/* ============================================================ */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* 통합 로그 (2/3) */}
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-slate-900">📋 통합 실행 로그</h3>
                  <div className="flex gap-1.5">
                    {(['all', 'success', 'error'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => setLogFilter(f)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${logFilter === f ? 'bg-[#0F172A] text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                      >
                        {f === 'all' ? '전체' : f === 'success' ? '성공' : '실패'}
                      </button>
                    ))}
                    <select
                      value={logBotFilter}
                      onChange={e => setLogBotFilter(e.target.value)}
                      className="px-2 py-1 rounded-lg text-[11px] bg-slate-100 text-slate-600 border-0 outline-none"
                    >
                      <option value="all">모든 봇</option>
                      <option value="oliveyoung">올리브영</option>
                      <option value="tiktok-analyzer">TikTok</option>
                      <option value="accounting">회계전표</option>
                      <option value="cash-bot">캐시잔액</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-3 mb-3">
                  <div className="px-3 py-1.5 bg-slate-50 rounded-lg">
                    <span className="text-[11px] text-slate-400">전체</span>
                    <span className="text-sm font-bold text-slate-700 ml-1.5">{logs.length}</span>
                  </div>
                  <div className="px-3 py-1.5 bg-emerald-50 rounded-lg">
                    <span className="text-[11px] text-emerald-500">성공</span>
                    <span className="text-sm font-bold text-emerald-700 ml-1.5">{logs.filter(l => l.status === 'SUCCESS').length}</span>
                  </div>
                  <div className="px-3 py-1.5 bg-red-50 rounded-lg">
                    <span className="text-[11px] text-red-500">실패</span>
                    <span className="text-sm font-bold text-red-700 ml-1.5">{logs.filter(l => l.status === 'ERROR').length}</span>
                  </div>
                </div>

                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8 text-slate-400 text-sm">로딩 중...</div>
                  ) : filteredLogs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 text-sm">실행 기록이 없습니다</div>
                  ) : (
                    filteredLogs.slice(0, 30).map((log, i) => (
                      <div key={i} className="flex items-center gap-2.5 text-xs py-2 px-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                        <span className="text-slate-400 w-20 flex-shrink-0">{formatTime(log.endTime)}</span>
                        <span className={`font-semibold px-1.5 py-0.5 rounded ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {log.status === 'SUCCESS' ? '성공' : '실패'}
                        </span>
                        <span className="font-semibold text-[#3B82F6] flex-shrink-0">[{log.botName}]</span>
                        <span className="text-slate-600 truncate flex-1">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 사이드바 (1/3) */}
              <div className="space-y-4">
                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-3">🚀 최근 변경 이력</h3>
                  <div className="space-y-2">
                    {changelog.map((item, i) => (
                      <div key={i} className="flex items-start gap-2.5">
                        <span className="text-[11px] text-slate-400 w-10 flex-shrink-0 pt-0.5">{item.date}</span>
                        <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] mt-1.5 flex-shrink-0"></div>
                        <span className="text-xs text-slate-600 leading-relaxed">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 mb-3">🗄️ 데이터베이스</h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">호스팅</span>
                      <span className="text-slate-700 font-medium">Railway PostgreSQL</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">백업 주기</span>
                      <span className="text-slate-700 font-medium">매일 03:00</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-100">
                      <span className="text-slate-400">백업 위치</span>
                      <span className="text-slate-700 font-medium">Google Drive</span>
                    </div>
                    <div className="flex justify-between py-1.5">
                      <span className="text-slate-400">보관 정책</span>
                      <span className="text-slate-700 font-medium">무제한</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
