'use client';

import { useState, useEffect, useCallback } from 'react';

const API_URL = process.env.NEXT_PUBLIC_EV3_MANAGEMENT_API_URL || 'https://ev3-management-calendar-production.up.railway.app';

// ============ 타입 ============
interface Schedule {
  id: number;
  title: string;
  category: string;
  repeat_type: string;
  month: number | null;
  day: number | null;
  specific_date: string | null;
  description: string | null;
  notify_day_before: boolean;
  notify_on_day: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  next_date?: string;
  days_left?: number;
}

interface NotificationLog {
  id: number;
  schedule_id: number | null;
  notification_type: string;
  title: string;
  category: string;
  sent_at: string;
  status: string;
  message: string | null;
  error_message: string | null;
}

interface FormData {
  title: string;
  category: string;
  repeat_type: string;
  month: number;
  day: number;
  specific_date: string;
  description: string;
  notify_day_before: boolean;
  notify_on_day: boolean;
}

// ============ 상수 ============
const CATEGORIES: Record<string, { icon: string; label: string; color: string }> = {
  tax: { icon: '💰', label: '세금', color: 'bg-amber-50 text-amber-700' },
  salary: { icon: '💵', label: '급여', color: 'bg-green-50 text-green-700' },
  insurance: { icon: '🛡️', label: '보험', color: 'bg-blue-50 text-blue-700' },
  contract: { icon: '📝', label: '계약', color: 'bg-purple-50 text-purple-700' },
  etc: { icon: '📋', label: '기타', color: 'bg-slate-50 text-slate-600' },
};

const DEFAULT_FORM: FormData = {
  title: '',
  category: 'etc',
  repeat_type: 'monthly',
  month: 1,
  day: 1,
  specific_date: '',
  description: '',
  notify_day_before: true,
  notify_on_day: true,
};

// ============ 유틸리티 ============
function formatScheduleDate(schedule: Schedule) {
  if (schedule.repeat_type === 'monthly') return `매월 ${schedule.day}일`;
  if (schedule.repeat_type === 'yearly') return `매년 ${schedule.month}/${schedule.day}`;
  if (schedule.repeat_type === 'once' && schedule.specific_date) return schedule.specific_date.slice(0, 10);
  return '-';
}

function formatTime(isoString: string | null) {
  if (!isoString) return '-';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '-';
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const h = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  return `${m}/${d} ${h}:${min}`;
}

// ============ 컴포넌트 ============
export default function ManagementCalendarPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [upcoming, setUpcoming] = useState<Schedule[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
  const [formData, setFormData] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [testingNotify, setTestingNotify] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // 토스트 표시
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 데이터 로드
  const fetchData = useCallback(async () => {
    try {
      const [schedulesRes, upcomingRes, logsRes] = await Promise.all([
        fetch(`${API_URL}/api/management-calendar`),
        fetch(`${API_URL}/api/management-calendar/upcoming`),
        fetch(`${API_URL}/api/management-calendar/logs?limit=20`),
      ]);

      const schedulesData = await schedulesRes.json();
      const upcomingData = await upcomingRes.json();
      const logsData = await logsRes.json();

      if (schedulesData.success) setSchedules(schedulesData.data);
      if (upcomingData.success) setUpcoming(upcomingData.data);
      if (logsData.success) setLogs(logsData.data);
    } catch (e) {
      console.error('데이터 로드 실패:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // 일정 저장 (추가/수정)
  const handleSave = async () => {
    if (!formData.title.trim()) {
      showToast('제목을 입력해주세요', 'error');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        title: formData.title,
        category: formData.category,
        repeat_type: formData.repeat_type,
        description: formData.description || null,
        notify_day_before: formData.notify_day_before,
        notify_on_day: formData.notify_on_day,
      };

      if (formData.repeat_type === 'monthly') {
        body.day = formData.day;
        body.month = null;
        body.specific_date = null;
      } else if (formData.repeat_type === 'yearly') {
        body.month = formData.month;
        body.day = formData.day;
        body.specific_date = null;
      } else if (formData.repeat_type === 'once') {
        body.specific_date = formData.specific_date;
        body.month = null;
        body.day = null;
      }

      const url = editingSchedule
        ? `${API_URL}/api/management-calendar/${editingSchedule.id}`
        : `${API_URL}/api/management-calendar`;
      const method = editingSchedule ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        showToast(editingSchedule ? '일정이 수정되었습니다' : '일정이 추가되었습니다');
        setShowModal(false);
        setEditingSchedule(null);
        setFormData(DEFAULT_FORM);
        fetchData();
      } else {
        showToast(data.error || '저장 실패', 'error');
      }
    } catch (e) {
      showToast('저장 중 오류가 발생했습니다', 'error');
    } finally {
      setSaving(false);
    }
  };

  // 일정 삭제
  const handleDelete = async (schedule: Schedule) => {
    if (!confirm(`'${schedule.title}' 일정을 삭제하시겠습니까?`)) return;

    try {
      const res = await fetch(`${API_URL}/api/management-calendar/${schedule.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('일정이 삭제되었습니다');
        fetchData();
      } else {
        showToast(data.error || '삭제 실패', 'error');
      }
    } catch (e) {
      showToast('삭제 중 오류가 발생했습니다', 'error');
    }
  };

  // 활성/비활성 토글
  const handleToggle = async (schedule: Schedule) => {
    try {
      const res = await fetch(`${API_URL}/api/management-calendar/${schedule.id}/toggle`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        showToast(`${schedule.title}: ${data.data.is_active ? '활성화' : '비활성화'}`);
        fetchData();
      }
    } catch (e) {
      showToast('상태 변경 실패', 'error');
    }
  };

  // 수정 모달 열기
  const openEditModal = (schedule: Schedule) => {
    setEditingSchedule(schedule);
    setFormData({
      title: schedule.title,
      category: schedule.category,
      repeat_type: schedule.repeat_type,
      month: schedule.month || 1,
      day: schedule.day || 1,
      specific_date: schedule.specific_date ? schedule.specific_date.slice(0, 10) : '',
      description: schedule.description || '',
      notify_day_before: schedule.notify_day_before,
      notify_on_day: schedule.notify_on_day,
    });
    setShowModal(true);
  };

  // 추가 모달 열기
  const openAddModal = () => {
    setEditingSchedule(null);
    setFormData(DEFAULT_FORM);
    setShowModal(true);
  };

  // 알림 테스트
  const handleTestNotify = async () => {
    setTestingNotify(true);
    try {
      const res = await fetch(`${API_URL}/api/management-calendar/test-notify`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        showToast(`테스트 알림 발송 완료 (D-1: ${data.dayBefore}건, 당일: ${data.onDay}건)`);
        fetchData();
      } else {
        showToast(data.error || '테스트 실패', 'error');
      }
    } catch (e) {
      showToast('테스트 알림 발송 실패', 'error');
    } finally {
      setTestingNotify(false);
    }
  };

  // 필터링된 일정
  const filteredSchedules = schedules.filter(s => {
    if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
    if (activeFilter === 'active' && !s.is_active) return false;
    if (activeFilter === 'inactive' && s.is_active) return false;
    return true;
  });

  return (
    <>
      <style jsx global>{`
        @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        {/* 헤더 */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <a href="/ev3/accounting" onClick={(e) => { e.preventDefault(); window.location.href = '/'; }}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs text-slate-600 transition">← EV3</a>
                <h1 className="text-lg font-bold text-slate-900">📅 관리 일정 알림</h1>
              </div>
              <button
                onClick={handleTestNotify}
                disabled={testingNotify}
                className="px-4 py-2 bg-violet-100 hover:bg-violet-200 text-violet-700 rounded-lg text-sm font-medium transition disabled:opacity-50 cursor-pointer"
              >
                {testingNotify ? '발송 중...' : '🔔 알림 테스트'}
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
          {/* 토스트 */}
          {toast && (
            <div className={`fixed top-20 right-6 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium animate-slideUp ${
              toast.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
            }`}>
              {toast.message}
            </div>
          )}

          {/* 섹션 1: 다가오는 일정 */}
          <div className="animate-fadeIn">
            <h2 className="text-sm font-bold text-slate-700 mb-3">📆 다가오는 일정 (7일 이내)</h2>
            {loading ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">로딩 중...</div>
            ) : upcoming.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400 text-sm">
                7일 내 다가오는 일정이 없습니다
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {upcoming.map((s) => {
                  const cat = CATEGORIES[s.category] || CATEGORIES.etc;
                  const isToday = s.days_left === 0;
                  const isTomorrow = s.days_left === 1;
                  return (
                    <div key={s.id} className={`flex-shrink-0 w-52 bg-white rounded-2xl border p-4 shadow-sm transition-all hover:shadow-md ${
                      isToday ? 'border-orange-300 bg-orange-50' : isTomorrow ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
                          {cat.icon} {cat.label}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                          isToday ? 'bg-orange-500 text-white' : isTomorrow ? 'bg-red-500 text-white' : 'bg-violet-100 text-violet-700'
                        }`}>
                          {isToday ? 'D-Day' : `D-${s.days_left}`}
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm mb-1 truncate">{s.title}</h3>
                      <p className="text-xs text-slate-400">{s.next_date}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 섹션 2: 일정 관리 */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm animate-fadeIn">
            <div className="p-5 border-b border-slate-100">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">📋 일정 관리</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {/* 카테고리 필터 */}
                  <div className="flex gap-1">
                    {[{ key: 'all', label: '전체' }, ...Object.entries(CATEGORIES).map(([k, v]) => ({ key: k, label: v.label }))].map(f => (
                      <button key={f.key} onClick={() => setCategoryFilter(f.key)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition cursor-pointer ${
                          categoryFilter === f.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }`}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  {/* 활성 필터 */}
                  <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)}
                    className="px-2 py-1 rounded-lg text-[11px] bg-slate-100 text-slate-600 border-0 outline-none">
                    <option value="all">전체 상태</option>
                    <option value="active">활성</option>
                    <option value="inactive">비활성</option>
                  </select>
                  {/* 추가 버튼 */}
                  <button onClick={openAddModal}
                    className="px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-xs font-medium transition cursor-pointer">
                    + 일정 추가
                  </button>
                </div>
              </div>
            </div>

            {/* 일정 목록 */}
            <div className="overflow-x-auto">
              {filteredSchedules.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-slate-400 text-sm mb-3">등록된 일정이 없습니다</p>
                  <button onClick={openAddModal}
                    className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition cursor-pointer">
                    + 첫 일정 추가하기
                  </button>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-400 border-b border-slate-100">
                      <th className="text-left px-5 py-3 font-medium">카테고리</th>
                      <th className="text-left px-3 py-3 font-medium">제목</th>
                      <th className="text-left px-3 py-3 font-medium">반복</th>
                      <th className="text-left px-3 py-3 font-medium">일정일</th>
                      <th className="text-center px-3 py-3 font-medium">D-1</th>
                      <th className="text-center px-3 py-3 font-medium">당일</th>
                      <th className="text-center px-3 py-3 font-medium">상태</th>
                      <th className="text-center px-3 py-3 font-medium">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSchedules.map((s) => {
                      const cat = CATEGORIES[s.category] || CATEGORIES.etc;
                      return (
                        <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cat.color}`}>
                              {cat.icon} {cat.label}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <span className={`font-medium ${s.is_active ? 'text-slate-900' : 'text-slate-400'}`}>{s.title}</span>
                            {s.description && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-[200px]">{s.description}</p>}
                          </td>
                          <td className="px-3 py-3 text-slate-500 text-xs">
                            {s.repeat_type === 'monthly' ? '매월' : s.repeat_type === 'yearly' ? '매년' : '1회'}
                          </td>
                          <td className="px-3 py-3 text-slate-600 text-xs font-medium">{formatScheduleDate(s)}</td>
                          <td className="px-3 py-3 text-center">{s.notify_day_before ? '✓' : '✗'}</td>
                          <td className="px-3 py-3 text-center">{s.notify_on_day ? '✓' : '✗'}</td>
                          <td className="px-3 py-3 text-center">
                            <button onClick={() => handleToggle(s)} className="cursor-pointer">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                s.is_active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'
                              }`}>
                                {s.is_active ? '활성' : '비활성'}
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <button onClick={() => openEditModal(s)}
                                className="p-1.5 hover:bg-slate-100 rounded-lg transition cursor-pointer" title="수정">✏️</button>
                              <button onClick={() => handleDelete(s)}
                                className="p-1.5 hover:bg-red-50 rounded-lg transition cursor-pointer" title="삭제">🗑️</button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* 섹션 3: 알림 로그 */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm animate-fadeIn">
            <h2 className="font-bold text-slate-900 mb-4">📬 알림 발송 로그</h2>
            <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-sm">발송 기록이 없습니다</div>
              ) : (
                logs.map((log) => {
                  const cat = CATEGORIES[log.category] || CATEGORIES.etc;
                  return (
                    <div key={log.id} className="flex items-center gap-2.5 text-xs py-2 px-3 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <span className="text-slate-400 w-20 flex-shrink-0">{formatTime(log.sent_at)}</span>
                      <span className={`font-semibold px-1.5 py-0.5 rounded ${
                        log.notification_type === 'day_before' ? 'bg-blue-50 text-blue-600' : 'bg-orange-50 text-orange-600'
                      }`}>
                        {log.notification_type === 'day_before' ? 'D-1' : '당일'}
                      </span>
                      <span className="font-medium text-slate-700 flex-shrink-0">{cat.icon} {log.title}</span>
                      <span className={`font-semibold px-1.5 py-0.5 rounded ${
                        log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {log.status === 'SUCCESS' ? '성공' : '실패'}
                      </span>
                      {log.error_message && <span className="text-red-400 truncate">{log.error_message}</span>}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </main>

        {/* 모달 */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-slideUp">
              <div className="p-6">
                <h3 className="text-lg font-bold text-slate-900 mb-5">
                  {editingSchedule ? '📝 일정 수정' : '📅 일정 추가'}
                </h3>

                <div className="space-y-4">
                  {/* 제목 */}
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">제목 *</label>
                    <input type="text" value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                      placeholder="예: 부가가치세 신고"
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent" />
                  </div>

                  {/* 카테고리 */}
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">카테고리</label>
                    <select value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <option key={k} value={k}>{v.icon} {v.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* 반복 유형 */}
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-2 block">반복 유형</label>
                    <div className="flex gap-2">
                      {[
                        { value: 'monthly', label: '매월' },
                        { value: 'yearly', label: '매년' },
                        { value: 'once', label: '일회성' },
                      ].map(opt => (
                        <button key={opt.value}
                          onClick={() => setFormData({ ...formData, repeat_type: opt.value })}
                          className={`flex-1 py-2 rounded-lg text-sm font-medium transition cursor-pointer ${
                            formData.repeat_type === opt.value
                              ? 'bg-violet-600 text-white'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 날짜 입력 (반복 유형에 따라) */}
                  {formData.repeat_type === 'monthly' && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">날짜 (일)</label>
                      <input type="number" min={1} max={31} value={formData.day}
                        onChange={e => setFormData({ ...formData, day: parseInt(e.target.value) || 1 })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                  )}

                  {formData.repeat_type === 'yearly' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">월</label>
                        <input type="number" min={1} max={12} value={formData.month}
                          onChange={e => setFormData({ ...formData, month: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-500 mb-1 block">일</label>
                        <input type="number" min={1} max={31} value={formData.day}
                          onChange={e => setFormData({ ...formData, day: parseInt(e.target.value) || 1 })}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                      </div>
                    </div>
                  )}

                  {formData.repeat_type === 'once' && (
                    <div>
                      <label className="text-xs font-medium text-slate-500 mb-1 block">날짜</label>
                      <input type="date" value={formData.specific_date}
                        onChange={e => setFormData({ ...formData, specific_date: e.target.value })}
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                    </div>
                  )}

                  {/* 메모 */}
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">메모 (선택)</label>
                    <textarea value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      placeholder="추가 설명..."
                      rows={2}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none" />
                  </div>

                  {/* 알림 설정 */}
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.notify_day_before}
                        onChange={e => setFormData({ ...formData, notify_day_before: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                      <span className="text-sm text-slate-600">D-1 알림</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={formData.notify_on_day}
                        onChange={e => setFormData({ ...formData, notify_on_day: e.target.checked })}
                        className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                      <span className="text-sm text-slate-600">당일 알림</span>
                    </label>
                  </div>
                </div>

                {/* 버튼 */}
                <div className="flex gap-3 mt-6">
                  <button onClick={() => { setShowModal(false); setEditingSchedule(null); }}
                    className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition cursor-pointer">
                    취소
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg text-sm font-medium transition disabled:opacity-50 cursor-pointer">
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
