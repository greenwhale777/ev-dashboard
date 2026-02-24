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
  ev0: {
    title: 'EV0 - 중앙 관리',
    icon: '🎯',
    color: '#1E9EDE',
    bots: []
  },
  ev1: {
    title: 'EV1 - 재고 관리',
    icon: '📦',
    color: '#10B981',
    bots: [],
    comingSoon: true
  },
  ev2: {
    title: 'EV2 - 생산성 봇',
    icon: '🔍',
    color: '#3B82F6',
    bots: [
      {
        id: 'oliveyoung',
        name: '올리브영 스크래퍼',
        schedule: '매주 월요일 09:00',
        hasManualRun: true,
        command: '/run 올리브영'
      },
      {
        id: 'page-analyzer',
        name: '상세페이지 분석',
        schedule: '수동 실행',
        hasManualRun: true,
        link: '/ev2'
      },
      {
        id: 'tiktok-analyzer',
        name: 'TikTok 광고 분석',
        schedule: '매일 10:00',
        hasManualRun: false,
        link: '/tiktok'
      }
    ]
  },
  ev3: {
    title: 'EV3 - 백오피스',
    icon: '💼',
    color: '#8B5CF6',
    bots: [
      {
        id: 'accounting',
        name: '회계전표 업로드',
        schedule: '매주 수요일 12:00',
        hasManualRun: true,
        command: '/run 회계',
        link: '/ev3/accounting'
      },
      {
        id: 'cash-bot',
        name: '캐시 잔액 확인',
        schedule: '매일 08:00',
        hasManualRun: true,
        command: '/run 캐시'
      }
    ]
  }
};

// 상태 뱃지
function getStatusBadge(status: string | undefined) {
  if (status === 'SUCCESS') return { label: '성공', bg: 'bg-emerald-50', text: 'text-emerald-600' };
  if (status === 'ERROR') return { label: '실패', bg: 'bg-red-50', text: 'text-red-600' };
  return { label: '대기', bg: 'bg-slate-100', text: 'text-slate-500' };
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
  const [activeTab, setActiveTab] = useState<'ev0' | 'ev1' | 'ev2' | 'ev3'>('ev2');
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [botStatus, setBotStatus] = useState<Record<string, ExecutionLog>>({});
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

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

  const currentConfig = botConfigs[activeTab];

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

          {/* EV 모듈 탭 */}
          <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
            {Object.entries(botConfigs).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                style={{
                  backgroundColor: activeTab === key ? config.color : '#E2E8F0',
                  color: activeTab === key ? '#FFFFFF' : '#475569',
                  borderColor: activeTab === key ? config.color : 'transparent',
                }}
                className="px-5 py-3 rounded-xl font-semibold transition-all duration-200 cursor-pointer hover:opacity-90 active:scale-95 border-2 whitespace-nowrap flex items-center gap-2"
              >
                <span>{config.icon}</span>
                <span>{config.title.split(' - ')[0]}</span>
                {'comingSoon' in config && config.comingSoon && (
                  <span className="text-xs bg-white/30 px-2 py-0.5 rounded">개발 중</span>
                )}
              </button>
            ))}
          </div>

          {/* EV0 - 중앙 관리 */}
          {activeTab === 'ev0' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{currentConfig.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{currentConfig.title}</h2>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                    <div className="text-sm text-blue-600 font-medium">전체 실행</div>
                    <div className="text-2xl font-bold text-blue-900 mt-1">{logs.length}</div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl">
                    <div className="text-sm text-emerald-600 font-medium">성공</div>
                    <div className="text-2xl font-bold text-emerald-900 mt-1">
                      {logs.filter(l => l.status === 'SUCCESS').length}
                    </div>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-xl">
                    <div className="text-sm text-red-600 font-medium">실패</div>
                    <div className="text-2xl font-bold text-red-900 mt-1">
                      {logs.filter(l => l.status === 'ERROR').length}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {loading ? (
                      <div className="text-center py-8 text-slate-400">로딩 중...</div>
                    ) : logs.length === 0 ? (
                      <div className="text-center py-8 text-slate-400">실행 기록이 없습니다</div>
                    ) : (
                      logs.slice(0, 30).map((log, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm py-2 px-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                          <span className="text-slate-400 text-xs w-24 flex-shrink-0">{formatTime(log.endTime)}</span>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {log.status === 'SUCCESS' ? '성공' : '실패'}
                          </span>
                          <span className="font-semibold text-[#1E9EDE]">[{log.botName}]</span>
                          <span className="text-slate-700 truncate flex-1">{log.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* EV1 - 재고 관리 (개발 중) */}
          {activeTab === 'ev1' && (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 shadow-sm text-center">
              <div className="text-6xl mb-4">{currentConfig.icon}</div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">{currentConfig.title}</h2>
              <p className="text-slate-500 mb-6">재고 수불부, 발주 알림, 이벤트 관리 기능 개발 중입니다.</p>
              <div className="inline-block px-4 py-2 bg-slate-100 rounded-lg text-sm text-slate-600">
                🚧 Coming Soon
              </div>
            </div>
          )}

          {/* EV2 - 생산성 봇 */}
          {activeTab === 'ev2' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{currentConfig.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{currentConfig.title}</h2>
                    <p className="text-sm text-slate-500">데이터 수집 및 분석 자동화</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {currentConfig.bots.map((bot) => {
                    const status = botStatus[bot.id];
                    const badge = getStatusBadge(status?.status);
                    return (
                      <div key={bot.id} className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{bot.name}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                              ⏰ {bot.schedule}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="text-slate-400">마지막 실행:</span>
                            <span className="text-slate-700 font-medium ml-2">{formatTime(status?.endTime)}</span>
                          </div>
                          {'link' in bot && bot.link ? (
                            <a
                              href={bot.link}
                              className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-semibold rounded-lg transition-all active:scale-95 inline-block"
                            >
                              ▶ 실행
                            </a>
                          ) : bot.hasManualRun && (
                            <button
                              className="px-4 py-2 bg-[#3B82F6] hover:bg-[#2563EB] text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
                            >
                              ▶ 실행
                            </button>
                          )}
                        </div>

                        {status?.message && (
                          <div className="mt-3 p-3 bg-slate-100 rounded-lg">
                            <p className="text-xs text-slate-600">{status.message}</p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">📋 EV2 실행 로그</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {logs.filter(log => log.botId === 'oliveyoung' || log.botId === 'page-analyzer' || log.botId === 'tiktok-analyzer').slice(0, 15).map((log, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 text-xs w-24 flex-shrink-0">{formatTime(log.endTime)}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {log.status === 'SUCCESS' ? '성공' : '실패'}
                      </span>
                      <span className="font-semibold text-[#3B82F6]">[{log.botName}]</span>
                      <span className="text-slate-700 truncate flex-1">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* EV3 - 백오피스 */}
          {activeTab === 'ev3' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-3xl">{currentConfig.icon}</span>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{currentConfig.title}</h2>
                    <p className="text-sm text-slate-500">회계 및 재무 자동화</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {currentConfig.bots.map((bot) => {
                    const status = botStatus[bot.id];
                    const badge = getStatusBadge(status?.status);
                    return (
                      <div key={bot.id} className="p-5 bg-gradient-to-br from-slate-50 to-white rounded-xl border border-slate-200 hover:shadow-md transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">{bot.name}</h3>
                            <p className="text-sm text-slate-500 mt-1">
                              ⏰ {bot.schedule}
                            </p>
                          </div>
                          <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="text-sm">
                            <span className="text-slate-400">마지막 실행:</span>
                            <span className="text-slate-700 font-medium ml-2">{formatTime(status?.endTime)}</span>
                          </div>
                          {bot.hasManualRun && (
                            'link' in bot && bot.link ? (
                              <a
                                href={bot.link}
                                className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-semibold rounded-lg transition-all active:scale-95 inline-block cursor-pointer"
                              >
                                ▶ 실행
                              </a>
                            ) : (
                              <button className="px-4 py-2 bg-[#8B5CF6] hover:bg-[#7C3AED] text-white text-sm font-semibold rounded-lg transition-all active:scale-95 cursor-pointer">
                                ▶ 실행
                              </button>
                            )
                          )}
                        </div>

                        {status?.message && (
                          <div className="mt-3 p-3 bg-slate-100 rounded-lg">
                            <p className="text-xs text-slate-600">{status.message}</p>
                          </div>
                        )}

                        {/* 캐시 잔액 특별 표시 */}
                        {bot.id === 'cash-bot' && status?.result?.difference !== undefined && (
                          <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-amber-700 font-medium">차이 금액:</span>
                              <span className="text-amber-900 font-bold">
                                {status.result.difference.toLocaleString()}원
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">📋 EV3 실행 로그</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {logs.filter(log => log.botId === 'accounting' || log.botId === 'cash-bot').slice(0, 15).map((log, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-2 px-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-400 text-xs w-24 flex-shrink-0">{formatTime(log.endTime)}</span>
                      <span className={`text-xs font-semibold px-2 py-1 rounded ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                        {log.status === 'SUCCESS' ? '성공' : '실패'}
                      </span>
                      <span className="font-semibold text-[#8B5CF6]">[{log.botName}]</span>
                      <span className="text-slate-700 truncate flex-1">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 텔레그램 안내 */}
          <div className="bg-gradient-to-r from-[#1E9EDE]/10 to-[#3B82F6]/10 border border-[#1E9EDE]/20 rounded-xl p-5">
            <div className="flex items-start gap-4">
              <span className="text-3xl">💬</span>
              <div className="flex-1">
                <div className="font-bold text-slate-900 mb-2">텔레그램 명령어</div>
                <div className="space-y-1 text-sm text-slate-600">
                  <div><code className="bg-white px-2 py-1 rounded font-mono">/help</code> - 도움말</div>
                  <div><code className="bg-white px-2 py-1 rounded font-mono">/status</code> - 전체 상태 확인</div>
                  <div><code className="bg-white px-2 py-1 rounded font-mono">/run 올리브영</code> - 올리브영 스크래퍼 실행</div>
                  <div><code className="bg-white px-2 py-1 rounded font-mono">/run 회계</code> - 회계전표 업로드 실행</div>
                  <div><code className="bg-white px-2 py-1 rounded font-mono">/run 캐시</code> - 캐시 잔액 확인 실행</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
