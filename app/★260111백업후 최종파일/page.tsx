'use client';

import { useState, useEffect } from 'react';

// API 서버 URL - Railway 배포 후 자동 전환
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://ev0-agent-production.up.railway.app';

// 봇 설정
const instantBots = [
  { id: 'oliveyoung', name: '올리브영 스크래퍼', command: '/run 올리브영' },
  { id: 'cash-bot', name: '캐시 잔액 확인', command: '/run 캐시' },
];

const scheduledBots = [
  { id: 'oliveyoung', name: '올리브영 스크래퍼', schedule: '매주 월요일 09:00' },
  { id: 'accounting', name: '회계전표 업로드', schedule: '매주 수요일 12:00' },
  { id: 'cash-bot', name: '캐시 잔액 확인', schedule: '매일 08:00' },
];

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

// 로그 타입
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
  error?: {
    type: string;
    message: string;
  };
}

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<'instant' | 'scheduled'>('scheduled');
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [botStatus, setBotStatus] = useState<Record<string, ExecutionLog>>({});
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const fetchLogs = async () => {
    try {
      setApiError(null);
      const logsRes = await fetch(`${API_URL}/api/logs`);
      if (!logsRes.ok) throw new Error('로그 조회 실패');
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

  return (
    <>
      <style jsx global>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
      `}</style>
      
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#0F172A] rounded-xl flex items-center justify-center">
                  <span className="text-white font-bold text-lg">EV</span>
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900">EV System Dashboard</h1>
                  <p className="text-sm text-slate-500">ASCENDERZ Automation</p>
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

        <main className="max-w-6xl mx-auto px-6 pt-20 pb-8">
          {apiError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 text-red-600">
                <span>⚠️</span>
                <span className="font-medium">{apiError}</span>
              </div>
            </div>
          )}

          {/* 탭 메뉴 - 두 개 모두 항상 표시 */}
          <div className="flex gap-6 mt-8 mb-8">
            <button
              onClick={() => setActiveTab('instant')}
              style={{
                backgroundColor: activeTab === 'instant' ? '#0F172A' : '#CBD5E1',
                color: activeTab === 'instant' ? '#FFFFFF' : '#334155',
              }}
              className="px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 cursor-pointer hover:opacity-80 active:scale-95"
            >
              ⚡ 바로 실행
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              style={{
                backgroundColor: activeTab === 'scheduled' ? '#0F172A' : '#CBD5E1',
                color: activeTab === 'scheduled' ? '#FFFFFF' : '#334155',
              }}
              className="px-5 py-2.5 rounded-lg font-semibold transition-all duration-200 cursor-pointer hover:opacity-80 active:scale-95"
            >
              📅 정기 모니터링
            </button>
          </div>

          {/* 바로 실행 탭 */}
          {activeTab === 'instant' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">⚡ 바로 실행</h3>
                <p className="text-sm text-slate-500 mb-4">텔레그램에서 명령어로 실행하세요</p>
                <div className="space-y-3">
                  {instantBots.map((bot) => {
                    const status = botStatus[bot.id];
                    const badge = getStatusBadge(status?.status);
                    return (
                      <div key={bot.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all duration-200 cursor-pointer">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-semibold text-slate-900">{bot.name}</div>
                            <div className="text-sm text-slate-500 mt-1">
                              명령어: <code className="bg-slate-200 px-2 py-0.5 rounded font-medium">{bot.command}</code>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${badge.bg} ${badge.text}`}>
                              {badge.label}
                            </span>
                            {status && (
                              <div className="text-xs text-slate-400 mt-1">{formatTime(status.endTime)}</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">📋 실행 로그</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8 text-slate-400">로딩 중...</div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">실행 로그가 없습니다</div>
                  ) : (
                    logs.filter(log => log.botId === 'oliveyoung' || log.botId === 'cash-bot').slice(0, 10).map((log, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-0">
                        <span className="text-slate-400 text-xs w-24 flex-shrink-0">{formatTime(log.endTime)}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {log.status === 'SUCCESS' ? '성공' : '실패'}
                        </span>
                        <span className="text-[#1E9EDE] font-semibold">[{log.botName}]</span>
                        <span className="text-slate-700 truncate">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 정기 모니터링 탭 */}
          {activeTab === 'scheduled' && (
            <div className="space-y-6">
              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">📅 정기 실행 봇</h3>
                <div className="space-y-3">
                  {scheduledBots.map((bot) => {
                    const status = botStatus[bot.id];
                    const badge = getStatusBadge(status?.status);
                    return (
                      <div key={bot.id} className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:bg-slate-100 transition-all duration-200 cursor-pointer">
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-semibold text-slate-900">{bot.name}</div>
                          <span className={`text-xs font-semibold px-2 py-1 rounded ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-slate-500"><span className="text-slate-400">스케줄:</span> {bot.schedule}</div>
                          <div className="text-slate-500"><span className="text-slate-400">마지막:</span> {formatTime(status?.endTime)}</div>
                        </div>
                        {status?.message && <div className="text-xs text-slate-500 mt-2 truncate">{status.message}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 mb-4">📋 실행 로그</h3>
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {loading ? (
                    <div className="text-center py-8 text-slate-400">로딩 중...</div>
                  ) : logs.length === 0 ? (
                    <div className="text-center py-8 text-slate-400">실행 로그가 없습니다</div>
                  ) : (
                    logs.slice(0, 20).map((log, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-slate-100 last:border-0">
                        <span className="text-slate-400 text-xs w-24 flex-shrink-0">{formatTime(log.endTime)}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded ${log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                          {log.status === 'SUCCESS' ? '성공' : '실패'}
                        </span>
                        <span className="text-[#1E9EDE] font-semibold">[{log.botName}]</span>
                        <span className="text-slate-700 truncate">{log.message}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-slate-400">ℹ️</span>
                  <div>
                    <div className="font-semibold text-slate-700">API 서버</div>
                    <p className="text-sm text-slate-500 mt-1 font-mono">{API_URL}</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}
