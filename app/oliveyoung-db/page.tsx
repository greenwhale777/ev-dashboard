'use client';
import React, { useState, useEffect } from 'react';

export default function EVDashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // 실제 운영 중인 봇 3개
  const [bots, setBots] = useState([
    { id: 'oliveyoung', name: '올리브영 스크래퍼', category: 'EV2', status: 'success', lastRun: '월요일 09:00', nextRun: '월요일 09:00', duration: '12분', successRate: 98, schedule: '매주 월요일 09:00' },
    { id: 'accounting', name: '회계전표 업로드', category: 'EV3', status: 'idle', lastRun: '수요일 12:00', nextRun: '수요일 12:00', duration: '15분', successRate: 100, schedule: '매주 수요일 12:00' },
    { id: 'cash', name: '캐시 잔액 확인', category: 'EV3', status: 'success', lastRun: '08:00', nextRun: '내일 08:00', duration: '2분', successRate: 100, schedule: '매일 08:00' },
  ]);

  const [logs, setLogs] = useState([
    { time: '09:18:45', level: 'SUCCESS', bot: '회계', msg: '일반전표 38건 생성 완료' },
    { time: '09:18:15', level: 'WARN', bot: '회계', msg: '중복 거래 1건 발견, 스킵' },
    { time: '09:17:30', level: 'SUCCESS', bot: '회계', msg: '카드 데이터 23건 수집 완료' },
    { time: '09:16:42', level: 'SUCCESS', bot: '회계', msg: '은행 데이터 45건 수집 완료' },
    { time: '09:15:32', level: 'INFO', bot: '회계', msg: '회계전표 자동화 시작' },
    { time: '08:12:05', level: 'SUCCESS', bot: '올리브영', msg: 'TOP24 스크래핑 완료, 24개 상품 수집' },
    { time: '08:00:01', level: 'INFO', bot: '올리브영', msg: '올리브영 스크래퍼 시작' },
    { time: '08:02:15', level: 'SUCCESS', bot: '캐시', msg: '잔액 일치 확인: ₩12,345,678' },
  ]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 실행 중인 봇 프로그레스 시뮬레이션
  useEffect(() => {
    const interval = setInterval(() => {
      setBots(prev => prev.map(b => {
        if (b.status === 'running' && b.progress !== undefined) {
          const newProgress = Math.min(b.progress + Math.random() * 3, 100);
          if (newProgress >= 100) {
            return { ...b, status: 'success', progress: undefined, duration: '15분' };
          }
          return { ...b, progress: newProgress };
        }
        return b;
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const stats = {
    total: bots.length,
    success: bots.filter(b => b.status === 'success').length,
    running: bots.filter(b => b.status === 'running').length,
    error: bots.filter(b => b.status === 'error').length,
    idle: bots.filter(b => b.status === 'idle').length,
  };

  const getStatusColor = (status) => {
    const colors = { success: 'bg-emerald-500', running: 'bg-blue-500', error: 'bg-red-500', idle: 'bg-slate-400' };
    return colors[status] || 'bg-slate-400';
  };

  const getStatusText = (status) => {
    const texts = { success: '완료', running: '실행중', error: '오류', idle: '대기' };
    return texts[status] || '대기';
  };

  const getCategoryStyle = (category) => {
    const styles = {
      EV0: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
      EV1: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
      EV2: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      EV3: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
    };
    return styles[category] || 'bg-slate-500/20 text-slate-400';
  };

  const runBot = (id) => {
    setBots(bots.map(b => b.id === id ? { ...b, status: 'running', progress: 0 } : b));
    setLogs([{ time: currentTime.toLocaleTimeString('ko-KR').slice(0, 8), level: 'INFO', bot: bots.find(b => b.id === id)?.name.split(' ')[0], msg: '수동 실행 시작...' }, ...logs]);
  };

  const stopBot = (id) => {
    setBots(bots.map(b => b.id === id ? { ...b, status: 'idle', progress: undefined } : b));
  };

  const weeklyData = [
    { day: '월', success: 8, error: 0, total: 8 },
    { day: '화', success: 8, error: 0, total: 8 },
    { day: '수', success: 9, error: 0, total: 9 },
    { day: '목', success: 8, error: 1, total: 9 },
    { day: '금', success: 8, error: 0, total: 8 },
    { day: '토', success: 4, error: 0, total: 4 },
    { day: '일', success: 4, error: 0, total: 4 },
  ];

  // 실제 스케줄에 맞게 수정
  const scheduleData = [
    { time: '08:00', bots: [{ name: '캐시', color: 'emerald' }] },
    { time: '09:00', bots: [{ name: '올리브영(월)', color: 'amber' }] },
    { time: '12:00', bots: [{ name: '회계(수)', color: 'cyan' }] },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      {/* 헤더 */}
      <header className="bg-slate-800/50 backdrop-blur-sm border-b border-slate-700/50 px-6 py-4 sticky top-0 z-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl">
                🚀
              </div>
              <div>
                <div className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                  ASCENDERZ EV System
                </div>
                <div className="text-xs text-slate-400">THE AUDIT Control Center</div>
              </div>
            </div>
            <div className="flex items-center gap-2 ml-4">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-emerald-400 text-sm font-medium">시스템 정상</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <div className="text-2xl font-mono font-bold text-white">
                {currentTime.toLocaleTimeString('ko-KR')}
              </div>
              <div className="text-xs text-slate-400">
                {currentTime.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* 네비게이션 */}
      <nav className="bg-slate-800/30 border-b border-slate-700/50 px-6">
        <div className="flex gap-1">
          {[
            { id: 'dashboard', label: '대시보드', icon: '📊' },
            { id: 'bots', label: '봇 관리', icon: '🤖' },
            { id: 'schedule', label: '스케줄', icon: '📅' },
            { id: 'logs', label: '로그', icon: '📋' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-blue-400 border-blue-400 bg-blue-500/10'
                  : 'text-slate-400 border-transparent hover:text-white hover:bg-slate-700/30'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 메인 컨텐츠 */}
      <main className="p-6">
        {/* ==================== 대시보드 탭 ==================== */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* 통계 카드 */}
            <div className="grid grid-cols-5 gap-4">
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-2xl">
                    🤖
                  </div>
                  <div>
                    <div className="text-3xl font-bold">{stats.total}</div>
                    <div className="text-slate-400 text-sm">전체 봇</div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-2xl">
                    ✅
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-emerald-400">{stats.success}</div>
                    <div className="text-slate-400 text-sm">성공</div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-2xl">
                    ⚡
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-blue-400">{stats.running}</div>
                    <div className="text-slate-400 text-sm">실행중</div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 flex items-center justify-center text-2xl">
                    💤
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-slate-400">{stats.idle}</div>
                    <div className="text-slate-400 text-sm">대기</div>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center text-2xl">
                    ⚠️
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-red-400">{stats.error}</div>
                    <div className="text-slate-400 text-sm">오류</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-6">
              {/* 봇 현황 */}
              <div className="col-span-2 bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <span>🤖</span> 봇 현황
                  </h3>
                  <div className="flex gap-2 text-xs">
                    <span className="px-2 py-1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">EV2 Boosting</span>
                    <span className="px-2 py-1 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">EV3 Managing</span>
                  </div>
                </div>
                <div className="space-y-3">
                  {bots.map(bot => (
                    <div key={bot.id} className="flex items-center gap-4 p-4 bg-slate-700/30 rounded-xl hover:bg-slate-700/50 transition group">
                      <div className={`w-3 h-3 rounded-full ${getStatusColor(bot.status)} ${bot.status === 'running' ? 'animate-pulse' : ''}`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{bot.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded border ${getCategoryStyle(bot.category)}`}>
                            {bot.category}
                          </span>
                        </div>
                        <div className="text-sm text-slate-400 mt-1">
                          스케줄: {bot.schedule}
                        </div>
                        {bot.status === 'running' && bot.progress !== undefined && (
                          <div className="mt-2">
                            <div className="h-1.5 bg-slate-600 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-gradient-to-r from-blue-500 to-cyan-500 transition-all duration-300"
                                style={{ width: `${bot.progress}%` }}
                              />
                            </div>
                            <div className="text-xs text-slate-500 mt-1">{Math.round(bot.progress)}% 완료</div>
                          </div>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <div className="text-slate-400">마지막: {bot.lastRun}</div>
                        <div className="text-slate-500">소요: {bot.duration}</div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition">
                        {bot.status === 'running' ? (
                          <button
                            onClick={() => stopBot(bot.id)}
                            className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm transition"
                          >
                            중지
                          </button>
                        ) : (
                          <button
                            onClick={() => runBot(bot.id)}
                            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition"
                          >
                            실행
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 오늘의 실행 로그 */}
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>📋</span> 오늘의 로그
                </h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.map((log, i) => (
                    <div key={i} className="flex gap-3 text-sm p-2 rounded-lg hover:bg-slate-700/30 transition">
                      <span className="text-slate-500 font-mono text-xs whitespace-nowrap">{log.time}</span>
                      <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                        log.level === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' :
                        log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                        log.level === 'WARN' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-500/20 text-slate-400'
                      }`}>
                        {log.level}
                      </span>
                      <span className="text-slate-400">[{log.bot}]</span>
                      <span className="text-slate-300 truncate">{log.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 주간 실행 통계 */}
            <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <span>📈</span> 주간 실행 통계
              </h3>
              <div className="flex items-end justify-between h-40 gap-4">
                {weeklyData.map((day, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex flex-col gap-1" style={{ height: '120px' }}>
                      <div
                        className="w-full bg-red-500/50 rounded-t transition-all"
                        style={{ height: `${(day.error / Math.max(...weeklyData.map(d => d.total))) * 100}%` }}
                      />
                      <div
                        className="w-full bg-gradient-to-t from-emerald-600 to-emerald-400 rounded-b transition-all"
                        style={{ height: `${(day.success / Math.max(...weeklyData.map(d => d.total))) * 100}%` }}
                      />
                    </div>
                    <div className="text-sm text-slate-400">{day.day}</div>
                    <div className="text-xs text-slate-500">{day.total}회</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 봇 관리 탭 ==================== */}
        {activeTab === 'bots' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>🤖</span> 봇 관리
                </h2>
                <p className="text-slate-400 text-sm mt-1">EV System에 등록된 모든 봇 관리</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* EV2 Boosting */}
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                    <span className="text-xl">⚡</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-amber-400">EV2 - Boosting</h3>
                    <p className="text-xs text-slate-400">업무 효율화 봇</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {bots.filter(b => b.category === 'EV2').map(bot => (
                    <div key={bot.id} className="p-4 bg-slate-700/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(bot.status)}`}></div>
                          <span className="font-medium">{bot.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          bot.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                          bot.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                          bot.status === 'error' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {getStatusText(bot.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        <div>스케줄: {bot.schedule}</div>
                        <div>성공률: {bot.successRate}%</div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => runBot(bot.id)}
                          disabled={bot.status === 'running'}
                          className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition disabled:opacity-50"
                        >
                          실행
                        </button>
                        <button className="flex-1 py-2 bg-slate-600/50 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition">
                          로그
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* EV3 Managing */}
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <span className="text-xl">📊</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-cyan-400">EV3 - Managing</h3>
                    <p className="text-xs text-slate-400">백오피스 자동화 봇</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {bots.filter(b => b.category === 'EV3').map(bot => (
                    <div key={bot.id} className="p-4 bg-slate-700/30 rounded-xl">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(bot.status)}`}></div>
                          <span className="font-medium">{bot.name}</span>
                        </div>
                        <span className={`text-xs px-2 py-1 rounded ${
                          bot.status === 'success' ? 'bg-emerald-500/20 text-emerald-400' :
                          bot.status === 'running' ? 'bg-blue-500/20 text-blue-400' :
                          bot.status === 'error' ? 'bg-red-500/20 text-red-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>
                          {getStatusText(bot.status)}
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-slate-400">
                        <div>스케줄: {bot.schedule}</div>
                        <div>성공률: {bot.successRate}%</div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => runBot(bot.id)}
                          disabled={bot.status === 'running'}
                          className="flex-1 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg text-sm transition disabled:opacity-50"
                        >
                          실행
                        </button>
                        <button className="flex-1 py-2 bg-slate-600/50 hover:bg-slate-600 text-slate-300 rounded-lg text-sm transition">
                          로그
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 개발 예정 */}
            <div className="bg-slate-800/30 backdrop-blur rounded-2xl border border-dashed border-slate-600 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-violet-500/20 flex items-center justify-center">
                  <span className="text-xl">🔮</span>
                </div>
                <div>
                  <h3 className="font-semibold text-violet-400">EV1 - Tracking (개발 예정)</h3>
                  <p className="text-xs text-slate-400">데이터 수집 봇</p>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-4">
                {[
                  { name: '매출 Tracker', desc: '실시간 매출 모니터링' },
                  { name: '광고효율 Tracker', desc: '광고 ROAS 추적' },
                  { name: 'CS Tracker', desc: 'CS 문의 분석' },
                  { name: '재고 Tracker', desc: '재고 현황 추적' },
                ].map((item, i) => (
                  <div key={i} className="p-4 bg-slate-700/20 rounded-xl border border-slate-700/50">
                    <div className="font-medium text-slate-400">{item.name}</div>
                    <div className="text-xs text-slate-500 mt-1">{item.desc}</div>
                    <div className="mt-2 text-xs text-violet-400">🚧 개발 예정</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== 스케줄 탭 ==================== */}
        {activeTab === 'schedule' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <span>📅</span> 스케줄 관리
                </h2>
                <p className="text-slate-400 text-sm mt-1">봇 실행 스케줄 설정 및 관리 (n8n 연동)</p>
              </div>
            </div>

            {/* 현재 스케줄 요약 */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
                <div className="text-amber-400 text-sm font-medium mb-2">매주 월요일</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">올리브영 스크래퍼</span>
                    <span className="text-slate-400">09:00</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
                <div className="text-cyan-400 text-sm font-medium mb-2">매주 수요일</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">회계전표 업로드</span>
                    <span className="text-slate-400">12:00</span>
                  </div>
                </div>
              </div>
              <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-5">
                <div className="text-emerald-400 text-sm font-medium mb-2">매일 실행</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">캐시 잔액 확인</span>
                    <span className="text-slate-400">08:00</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 overflow-hidden">
              <div className="grid grid-cols-8 bg-slate-700/30">
                {['시간', '월', '화', '수', '목', '금', '토', '일'].map((day, i) => (
                  <div key={i} className={`p-4 text-center font-medium ${i === 0 ? 'bg-slate-800/50' : ''}`}>
                    {day}
                  </div>
                ))}
              </div>
              {scheduleData.map((row, i) => (
                <div key={i} className="grid grid-cols-8 border-t border-slate-700/50">
                  <div className="p-4 text-slate-400 text-center bg-slate-800/30 font-mono">{row.time}</div>
                  {[0, 1, 2, 3, 4, 5, 6].map((d) => (
                    <div key={d} className="p-2 min-h-16 border-l border-slate-700/50 hover:bg-slate-700/20 transition">
                      {row.bots.map((bot, bi) => {
                        // 올리브영(월)은 월요일(d===0)에만 표시
                        if (bot.name === '올리브영(월)' && d !== 0) return null;
                        // 회계(수)는 수요일(d===2)에만 표시
                        if (bot.name === '회계(수)' && d !== 2) return null;
                        // 캐시는 매일 표시
                        
                        return (
                          <div
                            key={bi}
                            className={`text-xs p-1.5 rounded mb-1 cursor-pointer transition hover:opacity-80
                              ${bot.color === 'amber' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                bot.color === 'emerald' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                              }`}
                          >
                            {bot.name.replace('(월)', '').replace('(수)', '')}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-blue-400">💡</span>
                <div>
                  <div className="font-medium text-blue-300">스케줄 관리 안내</div>
                  <p className="text-sm text-slate-400 mt-1">
                    실제 스케줄은 n8n 워크플로우에서 관리됩니다. 텔레그램에서 /run 명령어로 수동 실행도 가능합니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==================== 로그 탭 ==================== */}
        {activeTab === 'logs' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <span>📋</span> 실행 로그
              </h2>
              <p className="text-slate-400 text-sm mt-1">봇 실행 기록 및 상세 로그</p>
            </div>

            <div className="bg-slate-800/50 backdrop-blur rounded-2xl border border-slate-700/50 p-6">
              <div className="space-y-2">
                {logs.map((log, i) => (
                  <div key={i} className="flex gap-4 text-sm p-3 rounded-lg hover:bg-slate-700/30 transition border-b border-slate-700/30">
                    <span className="text-slate-500 font-mono whitespace-nowrap">{log.time}</span>
                    <span className={`font-medium px-2 py-0.5 rounded text-xs ${
                      log.level === 'SUCCESS' ? 'bg-emerald-500/20 text-emerald-400' :
                      log.level === 'ERROR' ? 'bg-red-500/20 text-red-400' :
                      log.level === 'WARN' ? 'bg-amber-500/20 text-amber-400' :
                      'bg-slate-500/20 text-slate-400'
                    }`}>
                      {log.level}
                    </span>
                    <span className="text-cyan-400 font-medium">[{log.bot}]</span>
                    <span className="text-slate-300">{log.msg}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-700/30 border border-slate-600/50 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-slate-400">ℹ️</span>
                <div>
                  <div className="font-medium text-slate-300">로그 저장 위치</div>
                  <p className="text-sm text-slate-400 mt-1 font-mono">
                    C:\EV-System\data\logs\
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
