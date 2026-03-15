'use client';

import { useState, useEffect, useCallback } from 'react';

// ============ API ============
const API_URL = process.env.NEXT_PUBLIC_PAYROLL_API_URL || '';
const API_KEY = process.env.NEXT_PUBLIC_API_SECRET_KEY || '';
const PAYROLL_PASSWORD = process.env.NEXT_PUBLIC_PAYROLL_PASSWORD || '';

function apiHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (API_KEY) h['x-api-key'] = API_KEY;
  return h;
}

// ============ 타입 ============
interface Employee {
  id: number;
  employee_code: string;
  name: string;
  position: string;
  department: string | null;
  is_ceo: boolean;
  base_salary: number;
  meal_allowance: number;
  car_allowance: number;
  childcare_allowance: number;
  dependents: number;
  bank_name: string | null;
  bank_account: string | null;
  phone: string | null;
  is_active: boolean;
}

interface PayrollRow {
  employee_id: number;
  employee_code?: string;
  name: string;
  position?: string;
  is_ceo?: boolean;
  base_salary: number;
  meal_allowance: number;
  car_allowance: number;
  childcare_allowance: number;
  gross_pay: number;
  income_tax: number;
  local_income_tax: number;
  national_pension: number;
  health_insurance: number;
  long_term_care: number;
  employment_insurance: number;
  total_deductions: number;
  net_pay: number;
}

interface VoucherLine {
  line_no: number;
  division: string;
  account_code: string;
  account_name: string;
  partner_code: string;
  partner_name: string;
  debit: number;
  credit: number;
  description: string;
}

interface VoucherResponse {
  lines: VoucherLine[];
  summary: {
    total_debit: number;
    total_credit: number;
    balanced: boolean;
  };
}

interface ProcessingStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
}

interface LogEntry {
  id?: number;
  timestamp: string;
  step: string;
  status: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

interface InsuranceRates {
  year: number;
  national_pension: string;
  health_insurance: string;
  long_term_care: string;
  employment_worker: string;
  employment_employer: string;
  employment_stability: string;
  industrial_accident: string;
}

type TabType = 'payroll' | 'employees' | 'logs';
type PayrollStatus = 'draft' | 'confirmed' | 'voucher_created' | 'completed';

// ============ 상수 ============
const PAYROLL_COLUMNS = [
  { key: 'name', label: '성명', editable: false },
  { key: 'base_salary', label: '기본급', editable: false },
  { key: 'meal_allowance', label: '식대', editable: false },
  { key: 'car_allowance', label: '차량유지비', editable: false },
  { key: 'childcare_allowance', label: '보육수당', editable: false },
  { key: 'gross_pay', label: '지급총액', editable: false },
  { key: 'income_tax', label: '소득세', editable: false },
  { key: 'local_income_tax', label: '지방소득세', editable: false },
  { key: 'national_pension', label: '국민연금', editable: false },
  { key: 'health_insurance', label: '건강보험', editable: false },
  { key: 'long_term_care', label: '장기요양', editable: false },
  { key: 'employment_insurance', label: '고용보험', editable: false },
  { key: 'total_deductions', label: '공제합계', editable: false },
  { key: 'net_pay', label: '실수령액', editable: false },
] as const;

const STEP_LABELS: Record<string, string> = {
  calculate: '계산',
  confirm: '확정',
  compare: '비교',
  voucher: '전표',
  bank_excel: '은행엑셀',
  notify: '알림',
  clearing: '반제',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: '미처리', bg: 'bg-slate-800/50', text: 'text-slate-400', dot: 'bg-slate-500' },
  running: { label: '진행중', bg: 'bg-blue-900/30', text: 'text-blue-400', dot: 'bg-blue-400' },
  done: { label: '완료', bg: 'bg-emerald-900/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  error: { label: '오류', bg: 'bg-red-900/30', text: 'text-red-400', dot: 'bg-red-400' },
};

// ============ API 함수 ============
async function apiCalculate(yearMonth: string, paymentDate?: string) {
  const res = await fetch(`${API_URL}/api/payroll/calculate`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ yearMonth, paymentDate }),
  });
  if (!res.ok) throw new Error(`계산 실패: ${res.status}`);
  return res.json();
}

async function apiGetPayroll(yearMonth: string) {
  const res = await fetch(`${API_URL}/api/payroll/${yearMonth}`, { headers: apiHeaders(false) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`조회 실패: ${res.status}`);
  return res.json();
}

async function apiGetDetails(yearMonth: string) {
  const res = await fetch(`${API_URL}/api/payroll/${yearMonth}/details`, { headers: apiHeaders(false) });
  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`상세 조회 실패: ${res.status}`);
  return res.json();
}

async function apiConfirm(payrollId: number) {
  const res = await fetch(`${API_URL}/api/payroll/${payrollId}/confirm`, { method: 'PUT', headers: apiHeaders(false) });
  if (!res.ok) throw new Error(`확정 실패: ${res.status}`);
  return res.json();
}

async function apiCreateVoucher(payrollId: number): Promise<VoucherResponse> {
  const res = await fetch(`${API_URL}/api/payroll/${payrollId}/voucher`, { method: 'POST', headers: apiHeaders(false) });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || `전표 생성 실패: ${res.status}`);
  }
  return res.json();
}

async function apiGetVoucher(payrollId: number): Promise<VoucherResponse | null> {
  const res = await fetch(`${API_URL}/api/payroll/${payrollId}/voucher`, { headers: apiHeaders(false) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`전표 조회 실패: ${res.status}`);
  return res.json();
}

async function apiDownloadBankExcel(payrollId: number) {
  const res = await fetch(`${API_URL}/api/payroll/${payrollId}/bank-excel`, { headers: apiHeaders(false) });
  if (!res.ok) throw new Error(`엑셀 다운로드 실패: ${res.status}`);
  const blob = await res.blob();
  const disposition = res.headers.get('content-disposition');
  const filename = disposition?.split("''")[1] || '급여이체.xls';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = decodeURIComponent(filename);
  a.click();
  URL.revokeObjectURL(url);
}

async function apiNotify(payrollId: number, type: string) {
  const res = await fetch(`${API_URL}/api/payroll/${payrollId}/notify`, {
    method: 'POST',
    headers: apiHeaders(),
    body: JSON.stringify({ type }),
  });
  if (!res.ok) throw new Error(`알림 전송 실패: ${res.status}`);
  return res.json();
}

async function apiGetLogs(payrollId: number) {
  const res = await fetch(`${API_URL}/api/payroll/${payrollId}/logs`, { headers: apiHeaders(false) });
  if (!res.ok) return [];
  return res.json();
}

async function apiGetEmployees() {
  const res = await fetch(`${API_URL}/api/employees`, { headers: apiHeaders(false) });
  if (!res.ok) throw new Error(`직원 조회 실패: ${res.status}`);
  return res.json();
}

async function apiGetRates(year: number) {
  const res = await fetch(`${API_URL}/api/rates/${year}`, { headers: apiHeaders(false) });
  if (!res.ok) return null;
  return res.json();
}

// ============ 유틸리티 ============
function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function formatTime(iso: string | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '-';
  const m = d.getMonth() + 1;
  const day = d.getDate();
  const h = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  const sec = d.getSeconds().toString().padStart(2, '0');
  return `${m}/${day} ${h}:${min}:${sec}`;
}

function getMonthOptions(): string[] {
  const options: string[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return options;
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === 'running' ? 'animate-pulse' : ''}`} />
      {c.label}
    </span>
  );
}

// ============ 메인 컴포넌트 ============
export default function PayrollPage() {
  // 비밀번호 인증
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // 세션 복원
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = sessionStorage.getItem('payroll_auth');
      if (saved === 'true') setIsAuthenticated(true);
    }
  }, []);

  const handleLogin = () => {
    if (passwordInput === PAYROLL_PASSWORD && PAYROLL_PASSWORD) {
      setIsAuthenticated(true);
      setPasswordError(false);
      sessionStorage.setItem('payroll_auth', 'true');
    } else {
      setPasswordError(true);
    }
  };

  const [tab, setTab] = useState<TabType>('payroll');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollId, setPayrollId] = useState<number | null>(null);
  const [payrollStatus, setPayrollStatus] = useState<PayrollStatus>('draft');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [rates, setRates] = useState<InsuranceRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState(true);

  // 진행 상태
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { key: 'calculate', label: '계산', status: 'pending' },
    { key: 'compare', label: '비교', status: 'pending' },
    { key: 'voucher', label: '전표', status: 'pending' },
    { key: 'bank_excel', label: '은행엑셀', status: 'pending' },
    { key: 'clearing', label: '반제', status: 'pending' },
  ]);

  // 전표 모달
  const [showVoucherModal, setShowVoucherModal] = useState(false);
  const [voucherData, setVoucherData] = useState<VoucherResponse | null>(null);

  // 로그
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 직원 편집
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editRates, setEditRates] = useState(false);

  // ============ API 연결 확인 ============
  useEffect(() => {
    if (!API_URL) {
      setApiConnected(false);
      setApiError('API 서버가 설정되지 않았습니다. NEXT_PUBLIC_PAYROLL_API_URL 환경변수를 설정해 주세요.');
      return;
    }
    fetch(`${API_URL}/health`)
      .then(res => { if (res.ok) setApiConnected(true); else throw new Error(); })
      .catch(() => {
        setApiConnected(false);
        setApiError('급여 API 서버에 연결할 수 없습니다.');
      });
  }, []);

  // ============ 데이터 로드 ============
  const fetchPayrollData = useCallback(async () => {
    if (!API_URL || !apiConnected) return;
    try {
      setLoading(true);
      setApiError(null);

      const payroll = await apiGetPayroll(selectedMonth);
      if (payroll) {
        setPayrollId(payroll.id);
        setPayrollStatus(payroll.status);
        const details = await apiGetDetails(selectedMonth);
        setPayrollRows(details);

        // 상태에 따라 step 업데이트
        const newSteps = [...steps];
        if (payroll.status !== 'draft' || details.length > 0) {
          newSteps[0] = { ...newSteps[0], status: 'done' };
        }
        if (payroll.status === 'confirmed' || payroll.status === 'voucher_created' || payroll.status === 'completed') {
          newSteps[1] = { ...newSteps[1], status: 'done' };
        }
        if (payroll.status === 'voucher_created' || payroll.status === 'completed') {
          newSteps[2] = { ...newSteps[2], status: 'done' };
        }
        setSteps(newSteps);

        // 로그 로드
        const serverLogs = await apiGetLogs(payroll.id);
        if (Array.isArray(serverLogs) && serverLogs.length > 0) {
          setLogs(serverLogs.map((l: any) => ({
            id: l.id,
            timestamp: l.created_at,
            step: l.step,
            status: l.status === 'success' ? 'success' : l.status === 'error' ? 'error' : 'info',
            message: l.message,
          })));
        }
      } else {
        setPayrollId(null);
        setPayrollStatus('draft');
        setPayrollRows([]);
        setSteps(steps.map(s => ({ ...s, status: 'pending' })));
      }
    } catch (e) {
      console.error('데이터 로드 실패:', e);
      setApiError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, apiConnected]);

  useEffect(() => {
    fetchPayrollData();
  }, [fetchPayrollData]);

  // 직원 목록 로드
  useEffect(() => {
    if (!API_URL || !apiConnected) return;
    apiGetEmployees().then(setEmployees).catch(() => {});
    const year = parseInt(selectedMonth.split('-')[0], 10);
    apiGetRates(year).then(r => { if (r) setRates(r); }).catch(() => {});
  }, [apiConnected, selectedMonth]);

  // ============ 액션 핸들러 ============
  const addLog = (step: string, status: LogEntry['status'], message: string) => {
    setLogs(prev => [{ timestamp: new Date().toISOString(), step, status, message }, ...prev]);
  };

  const handleCalculate = async () => {
    if (!apiConnected) return;
    addLog('calculate', 'info', '급여 계산을 시작합니다...');
    setSteps(prev => prev.map(s => s.key === 'calculate' ? { ...s, status: 'running' } : s));
    setLoading(true);

    try {
      const data = await apiCalculate(selectedMonth);
      setPayrollId(data.payroll.id);
      setPayrollStatus(data.payroll.status);

      // details 배열에서 PayrollRow 변환
      if (data.details) {
        setPayrollRows(data.details.map((d: any) => ({
          employee_id: d.employee_id || 0,
          employee_code: d.employee_code,
          name: d.name,
          base_salary: d.base_salary,
          meal_allowance: d.meal_allowance,
          car_allowance: d.car_allowance,
          childcare_allowance: d.childcare_allowance,
          gross_pay: d.gross_pay,
          income_tax: d.income_tax,
          local_income_tax: d.local_income_tax,
          national_pension: d.national_pension,
          health_insurance: d.health_insurance,
          long_term_care: d.long_term_care,
          employment_insurance: d.employment_insurance,
          total_deductions: d.total_deductions,
          net_pay: d.net_pay,
        })));
      }

      setSteps(prev => prev.map(s => s.key === 'calculate' ? { ...s, status: 'done' } : s));
      addLog('calculate', 'success', `${data.details?.length || 0}명 급여 계산 완료`);
    } catch (e) {
      setSteps(prev => prev.map(s => s.key === 'calculate' ? { ...s, status: 'error' } : s));
      addLog('calculate', 'error', `급여 계산 실패: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!apiConnected || !payrollId) return;
    try {
      setLoading(true);
      await apiConfirm(payrollId);
      setPayrollStatus('confirmed');
      setSteps(prev => prev.map(s => s.key === 'compare' ? { ...s, status: 'done' } : s));
      addLog('confirm', 'success', '급여 확정 완료');
    } catch (e) {
      addLog('confirm', 'error', `급여 확정 실패: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewVoucher = async () => {
    if (!apiConnected || !payrollId) return;
    try {
      // 먼저 기존 전표 조회 시도
      let data = await apiGetVoucher(payrollId);
      if (!data && payrollStatus === 'confirmed') {
        // 없으면 생성
        data = await apiCreateVoucher(payrollId);
        setPayrollStatus('voucher_created');
        setSteps(prev => prev.map(s => s.key === 'voucher' ? { ...s, status: 'done' } : s));
        addLog('voucher', 'success', '전표 12행 생성 완료');
      }
      if (data) {
        setVoucherData(data);
        setShowVoucherModal(true);
      }
    } catch (e) {
      addLog('voucher', 'error', `전표 조회/생성 실패: ${e}`);
    }
  };

  const handleCreateVoucher = async () => {
    if (!apiConnected || !payrollId || payrollStatus !== 'confirmed') return;
    setSteps(prev => prev.map(s => s.key === 'voucher' ? { ...s, status: 'running' } : s));
    addLog('voucher', 'info', '전표 생성 중...');
    try {
      const data = await apiCreateVoucher(payrollId);
      setVoucherData(data);
      setPayrollStatus('voucher_created');
      setSteps(prev => prev.map(s => s.key === 'voucher' ? { ...s, status: 'done' } : s));
      addLog('voucher', 'success', `전표 12행 생성 완료. 차변=${formatNumber(data.summary.total_debit)}, 대변=${formatNumber(data.summary.total_credit)}`);
    } catch (e) {
      setSteps(prev => prev.map(s => s.key === 'voucher' ? { ...s, status: 'error' } : s));
      addLog('voucher', 'error', `전표 생성 실패: ${e}`);
    }
  };

  const handleDownloadBankExcel = async () => {
    if (!apiConnected || !payrollId) return;
    try {
      setSteps(prev => prev.map(s => s.key === 'bank_excel' ? { ...s, status: 'running' } : s));
      addLog('bank_excel', 'info', '은행 엑셀 생성 중...');
      await apiDownloadBankExcel(payrollId);
      setSteps(prev => prev.map(s => s.key === 'bank_excel' ? { ...s, status: 'done' } : s));
      addLog('bank_excel', 'success', '하나은행 엑셀 다운로드 완료');
    } catch (e) {
      setSteps(prev => prev.map(s => s.key === 'bank_excel' ? { ...s, status: 'error' } : s));
      addLog('bank_excel', 'error', `엑셀 다운로드 실패: ${e}`);
    }
  };

  const handleTelegramNotify = async (type: 'calculate' | 'bank_excel') => {
    if (!apiConnected || !payrollId) return;
    addLog('notify', 'info', `텔레그램 알림 전송 중 (${type})...`);
    try {
      const result = await apiNotify(payrollId, type);
      if (result.success) {
        addLog('notify', 'success', `텔레그램 알림 전송 완료 (${type})`);
      } else {
        addLog('notify', 'warning', '텔레그램 알림 전송 실패 (봇 토큰 확인 필요)');
      }
    } catch (e) {
      addLog('notify', 'error', `텔레그램 알림 전송 실패: ${e}`);
    }
  };

  // 합계 계산
  const totals = payrollRows.reduce((acc, r) => {
    const keys = ['base_salary', 'meal_allowance', 'car_allowance', 'childcare_allowance', 'gross_pay', 'income_tax', 'local_income_tax', 'national_pension', 'health_insurance', 'long_term_care', 'employment_insurance', 'total_deductions', 'net_pay'] as const;
    keys.forEach(k => { acc[k] = (acc[k] || 0) + r[k]; });
    return acc;
  }, {} as Record<string, number>);

  // ============ 렌더링 ============

  // 비밀번호 입력 화면
  if (!isAuthenticated) {
    return (
      <>
        <style jsx global>{`
          @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
          * { font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, system-ui, sans-serif; }
        `}</style>
        <div className="min-h-screen bg-[#0B0D11] flex items-center justify-center">
          <div className="w-full max-w-sm mx-4">
            <div className="bg-[#13151B] border border-white/[0.06] rounded-2xl p-8 shadow-2xl">
              <div className="flex justify-center mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-[#1E9EDE] to-[#1476A6] rounded-xl flex items-center justify-center shadow-lg shadow-[#1E9EDE]/20">
                  <span className="text-white text-xl font-bold">P</span>
                </div>
              </div>
              <h1 className="text-lg font-bold text-white text-center mb-1">급여 관리</h1>
              <p className="text-xs text-slate-500 text-center mb-6">접속하려면 비밀번호를 입력하세요</p>
              <div className="space-y-4">
                <input
                  type="password"
                  value={passwordInput}
                  onChange={e => { setPasswordInput(e.target.value); setPasswordError(false); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }}
                  placeholder="비밀번호"
                  autoFocus
                  className="w-full bg-[#0B0D11] border border-white/[0.06] rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-[#1E9EDE]/50"
                />
                {passwordError && (
                  <p className="text-xs text-red-400">비밀번호가 올바르지 않습니다.</p>
                )}
                <button
                  onClick={handleLogin}
                  className="w-full bg-[#1E9EDE] hover:bg-[#1a8bc7] text-white py-3 rounded-lg text-sm font-semibold transition-all active:scale-95"
                >
                  접속
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

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

        .scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: rgba(30, 158, 222, 0.3); border-radius: 2px; }
      `}</style>

      <div className="min-h-screen bg-[#0B0D11] text-slate-200">
        {/* ===== 헤더 ===== */}
        <header className="bg-[#0F1117]/80 backdrop-blur-xl border-b border-white/[0.06] sticky top-0 z-30">
          <div className="max-w-[1400px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <a href="/" className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                  <span className="text-sm">대시보드</span>
                </a>
                <div className="w-px h-5 bg-white/10" />
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-gradient-to-br from-[#1E9EDE] to-[#1476A6] rounded-lg flex items-center justify-center shadow-lg shadow-[#1E9EDE]/20">
                    <span className="text-white text-sm font-bold">P</span>
                  </div>
                  <div>
                    <h1 className="text-lg font-bold text-white">급여 관리</h1>
                    <p className="text-xs text-slate-500">EV3 · 급여 봇 대시보드</p>
                  </div>
                </div>
              </div>

              {/* 탭 네비게이션 */}
              <div className="flex items-center gap-1 bg-[#13151B] rounded-lg p-1">
                {([['payroll', '급여 대장'], ['employees', '직원 관리'], ['logs', '처리 로그']] as [TabType, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
                      tab === key
                        ? 'bg-[#1E9EDE]/20 text-[#1E9EDE]'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* ===== 에러 알림 ===== */}
        {apiError && (
          <div className="max-w-[1400px] mx-auto px-6 pt-4">
            <div className="bg-amber-900/20 border border-amber-800/30 rounded-lg px-4 py-3 text-amber-400 text-sm flex items-center gap-2">
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
              {apiError}
            </div>
          </div>
        )}

        <main className="max-w-[1400px] mx-auto px-6 pt-6 pb-12">
          {/* ===== 급여 대장 탭 ===== */}
          {tab === 'payroll' && (
            <div className="space-y-6 animate-fade-in">
              {/* 상단 컨트롤 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <select
                    value={selectedMonth}
                    onChange={e => setSelectedMonth(e.target.value)}
                    className="bg-[#13151B] border border-white/[0.06] rounded-lg px-4 py-2 text-sm text-slate-200 focus:outline-none focus:border-[#1E9EDE]/50"
                  >
                    {getMonthOptions().map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    onClick={handleCalculate}
                    disabled={loading || !apiConnected}
                    className="bg-[#1E9EDE] hover:bg-[#1a8bc7] text-white px-5 py-2 rounded-lg text-sm font-semibold transition-all active:scale-95 disabled:opacity-50"
                  >
                    {loading ? '계산 중...' : '급여 계산'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-medium px-3 py-1 rounded-full ${
                    payrollStatus === 'draft' ? 'bg-slate-800 text-slate-400' :
                    payrollStatus === 'confirmed' ? 'bg-emerald-900/30 text-emerald-400' :
                    payrollStatus === 'completed' ? 'bg-blue-900/30 text-blue-400' :
                    'bg-amber-900/30 text-amber-400'
                  }`}>
                    {payrollStatus === 'draft' ? '초안' :
                     payrollStatus === 'confirmed' ? '확정' :
                     payrollStatus === 'voucher_created' ? '전표 생성됨' :
                     '처리 완료'}
                  </span>
                </div>
              </div>

              {/* 진행 상태바 */}
              <div className="bg-[#13151B] border border-white/[0.06] rounded-xl p-5">
                <div className="flex items-center justify-between">
                  {steps.map((step, i) => (
                    <div key={step.key} className="flex items-center flex-1">
                      <div className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                          step.status === 'done' ? 'bg-emerald-500/20 text-emerald-400 ring-2 ring-emerald-500/30' :
                          step.status === 'running' ? 'bg-[#1E9EDE]/20 text-[#1E9EDE] ring-2 ring-[#1E9EDE]/30 animate-pulse' :
                          step.status === 'error' ? 'bg-red-500/20 text-red-400 ring-2 ring-red-500/30' :
                          'bg-slate-800 text-slate-500 ring-2 ring-slate-700'
                        }`}>
                          {step.status === 'done' ? (
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          ) : step.status === 'error' ? (
                            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          ) : (
                            i + 1
                          )}
                        </div>
                        <span className={`text-xs font-medium ${
                          step.status === 'done' ? 'text-emerald-400' :
                          step.status === 'running' ? 'text-[#1E9EDE]' :
                          step.status === 'error' ? 'text-red-400' :
                          'text-slate-500'
                        }`}>{step.label}</span>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`flex-1 h-0.5 mx-3 mt-[-20px] ${
                          step.status === 'done' ? 'bg-emerald-500/40' : 'bg-slate-800'
                        }`} />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* 급여 대장 테이블 */}
              <div className="bg-[#13151B] border border-white/[0.06] rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
                  <h2 className="text-sm font-bold text-white">{selectedMonth} 급여 대장</h2>
                  <span className="text-xs text-slate-500">{payrollRows.length}명</span>
                </div>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        {PAYROLL_COLUMNS.map(col => (
                          <th key={col.key} className={`px-3 py-3 text-xs font-semibold uppercase tracking-wide whitespace-nowrap ${
                            col.key === 'name' ? 'text-left text-slate-400 sticky left-0 bg-[#13151B] z-10' :
                            col.key === 'gross_pay' || col.key === 'total_deductions' || col.key === 'net_pay'
                              ? 'text-right text-[#1E9EDE]'
                              : 'text-right text-slate-500'
                          }`}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payrollRows.map((row) => (
                        <tr key={row.employee_id || row.name} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          {PAYROLL_COLUMNS.map(col => {
                            const val = row[col.key as keyof PayrollRow];

                            if (col.key === 'name') {
                              return <td key={col.key} className="px-3 py-3 font-medium text-slate-200 whitespace-nowrap sticky left-0 bg-[#13151B] z-10">{val}</td>;
                            }

                            return (
                              <td
                                key={col.key}
                                className={`px-3 py-3 text-right font-mono text-xs whitespace-nowrap ${
                                  col.key === 'gross_pay' ? 'text-white font-semibold' :
                                  col.key === 'net_pay' ? 'text-emerald-400 font-semibold' :
                                  col.key === 'total_deductions' ? 'text-red-400' :
                                  'text-slate-400'
                                }`}
                              >
                                {formatNumber(val as number)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                      {/* 합계행 */}
                      {payrollRows.length > 0 && (
                        <tr className="bg-white/[0.03] font-semibold">
                          <td className="px-3 py-3 text-slate-300 sticky left-0 bg-[#161820] z-10">합계</td>
                          {PAYROLL_COLUMNS.slice(1).map(col => (
                            <td key={col.key} className={`px-3 py-3 text-right font-mono text-xs ${
                              col.key === 'gross_pay' ? 'text-white' :
                              col.key === 'net_pay' ? 'text-emerald-400' :
                              col.key === 'total_deductions' ? 'text-red-400' :
                              'text-slate-300'
                            }`}>
                              {formatNumber(totals[col.key] || 0)}
                            </td>
                          ))}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 액션 버튼 */}
              <div className="flex items-center gap-3 flex-wrap">
                <button
                  onClick={handleConfirm}
                  disabled={payrollRows.length === 0 || payrollStatus !== 'draft' || !apiConnected}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
                >
                  급여 확정
                </button>
                <button
                  onClick={handlePreviewVoucher}
                  disabled={payrollRows.length === 0 || !apiConnected}
                  className="bg-[#13151B] border border-white/[0.06] hover:border-[#1E9EDE]/30 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  전표 미리보기
                </button>
                <button
                  onClick={handleCreateVoucher}
                  disabled={payrollStatus !== 'confirmed' || !apiConnected}
                  className="bg-[#13151B] border border-white/[0.06] hover:border-[#1E9EDE]/30 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  전표 생성
                </button>
                <button
                  onClick={handleDownloadBankExcel}
                  disabled={!payrollId || (payrollStatus !== 'confirmed' && payrollStatus !== 'voucher_created') || !apiConnected}
                  className="bg-[#13151B] border border-white/[0.06] hover:border-[#1E9EDE]/30 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  은행 엑셀 다운로드
                </button>
                <button
                  onClick={() => handleTelegramNotify('calculate')}
                  disabled={payrollRows.length === 0 || !apiConnected}
                  className="bg-[#13151B] border border-white/[0.06] hover:border-[#1E9EDE]/30 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  텔레그램 알림
                </button>
              </div>
            </div>
          )}

          {/* ===== 직원 관리 탭 ===== */}
          {tab === 'employees' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">직원 목록</h2>
                <button
                  onClick={() => setEditRates(!editRates)}
                  className="bg-[#13151B] border border-white/[0.06] hover:border-[#1E9EDE]/30 text-slate-300 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                >
                  {editRates ? '목록 보기' : '보험 요율 설정'}
                </button>
              </div>

              {!apiConnected ? (
                <div className="bg-[#13151B] border border-white/[0.06] rounded-xl p-12 text-center">
                  <p className="text-slate-500 text-sm">API 서버에 연결되지 않았습니다.</p>
                </div>
              ) : editRates ? (
                /* 보험 요율 설정 */
                <div className="bg-[#13151B] border border-white/[0.06] rounded-xl p-6 max-w-lg">
                  <h3 className="text-sm font-bold text-white mb-4">{rates?.year || new Date().getFullYear()}년 보험 요율</h3>
                  {rates ? (
                    <div className="space-y-3">
                      {([
                        ['national_pension', '국민연금 (근로자)', rates.national_pension],
                        ['health_insurance', '건강보험 (근로자)', rates.health_insurance],
                        ['long_term_care', '장기요양보험 (건강보험 대비)', rates.long_term_care],
                        ['employment_worker', '고용보험 (근로자)', rates.employment_worker],
                        ['employment_employer', '고용보험 (사업자)', rates.employment_employer],
                        ['employment_stability', '고용안정부담금', rates.employment_stability],
                        ['industrial_accident', '산재보험', rates.industrial_accident],
                      ] as [string, string, string][]).map(([, label, value]) => (
                        <div key={label} className="flex items-center justify-between gap-4">
                          <label className="text-sm text-slate-400">{label}</label>
                          <span className="text-sm font-mono text-white">{(parseFloat(value) * 100).toFixed(2)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">요율 데이터를 불러오는 중...</p>
                  )}
                </div>
              ) : (
                /* 직원 목록 */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {employees.map(emp => (
                    <div
                      key={emp.id}
                      className={`bg-[#13151B] border rounded-xl p-5 transition-all ${
                        editingEmployee?.id === emp.id ? 'border-[#1E9EDE]/30' : 'border-white/[0.06] hover:border-white/[0.1]'
                      }`}
                    >
                      {editingEmployee?.id === emp.id ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-white">{emp.name}</span>
                            <div className="flex gap-2">
                              <button onClick={() => setEditingEmployee(null)} className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-md hover:bg-slate-700">닫기</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            {([
                              ['base_salary', '기본급'],
                              ['meal_allowance', '식대'],
                              ['car_allowance', '차량유지비'],
                              ['childcare_allowance', '보육수당'],
                            ] as [keyof Employee, string][]).map(([key, label]) => (
                              <div key={key}>
                                <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                                <span className="text-sm font-mono text-white">{formatNumber(editingEmployee[key] as number)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-white/[0.04]">
                            <div><span className="text-slate-500">은행</span><span className="text-slate-300 ml-2">{emp.bank_name || '-'}</span></div>
                            <div><span className="text-slate-500">계좌</span><span className="text-slate-300 ml-2 font-mono">{emp.bank_account || '-'}</span></div>
                            <div><span className="text-slate-500">전화</span><span className="text-slate-300 ml-2 font-mono">{emp.phone || '-'}</span></div>
                            <div><span className="text-slate-500">가족수</span><span className="text-slate-300 ml-2">{emp.dependents}명</span></div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-sm font-bold text-white">{emp.name}</span>
                              <span className="text-xs text-slate-500 ml-2">{emp.employee_code} · {emp.position}{emp.is_ceo ? ' (대표이사)' : ''}</span>
                            </div>
                            <button
                              onClick={() => setEditingEmployee({ ...emp })}
                              className="text-xs text-slate-400 hover:text-[#1E9EDE] transition-colors"
                            >
                              상세
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500">기본급</span><span className="text-slate-300 font-mono">{formatNumber(emp.base_salary)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">식대</span><span className="text-slate-300 font-mono">{formatNumber(emp.meal_allowance)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">차량유지비</span><span className="text-slate-300 font-mono">{formatNumber(emp.car_allowance)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">보육수당</span><span className="text-slate-300 font-mono">{formatNumber(emp.childcare_allowance)}</span></div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/[0.04] flex justify-between text-xs">
                            <span className="text-slate-500">은행</span>
                            <span className="text-slate-400">{emp.bank_name || '-'} {emp.bank_account || ''}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  {employees.length === 0 && (
                    <div className="col-span-2 bg-[#13151B] border border-white/[0.06] rounded-xl p-12 text-center">
                      <p className="text-slate-500 text-sm">직원 데이터를 불러오는 중...</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== 처리 로그 탭 ===== */}
          {tab === 'logs' && (
            <div className="space-y-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white">처리 로그</h2>
                {logs.length > 0 && (
                  <button
                    onClick={() => setLogs([])}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    로그 지우기
                  </button>
                )}
              </div>

              {logs.length === 0 ? (
                <div className="bg-[#13151B] border border-white/[0.06] rounded-xl p-12 text-center">
                  <p className="text-slate-500 text-sm">처리 로그가 없습니다. 급여 계산을 실행하면 로그가 표시됩니다.</p>
                </div>
              ) : (
                <div className="bg-[#13151B] border border-white/[0.06] rounded-xl overflow-hidden">
                  <div className="divide-y divide-white/[0.04]">
                    {logs.map((log, i) => (
                      <div key={i} className="px-5 py-3 flex items-start gap-4 hover:bg-white/[0.02] transition-colors">
                        <div className="flex-shrink-0 mt-0.5">
                          {log.status === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-400" />}
                          {log.status === 'error' && <div className="w-2 h-2 rounded-full bg-red-400" />}
                          {log.status === 'warning' && <div className="w-2 h-2 rounded-full bg-amber-400" />}
                          {log.status === 'info' && <div className="w-2 h-2 rounded-full bg-[#1E9EDE]" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-slate-300">{STEP_LABELS[log.step] || log.step}</span>
                            <StatusBadge status={
                              log.status === 'success' ? 'done' :
                              log.status === 'error' ? 'error' :
                              log.status === 'warning' ? 'error' : 'running'
                            } />
                          </div>
                          <p className="text-sm text-slate-400">{log.message}</p>
                        </div>
                        <span className="text-xs text-slate-600 font-mono flex-shrink-0">{formatTime(log.timestamp)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </main>

        {/* ===== 전표 미리보기 모달 (실제 12행) ===== */}
        {showVoucherModal && voucherData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowVoucherModal(false)}>
            <div className="bg-[#13151B] border border-white/[0.06] rounded-2xl w-full max-w-5xl mx-4 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">전표 미리보기 — {selectedMonth} ({voucherData.lines.length}행)</h3>
                <button onClick={() => setShowVoucherModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['행', '구분', '계정코드', '계정명', '거래처코드', '거래처명', '차변', '대변', '적요'].map(h => (
                        <th key={h} className={`px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap ${
                          h === '차변' || h === '대변' ? 'text-right' : 'text-left'
                        }`}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {voucherData.lines.map((v) => (
                      <tr key={v.line_no} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{v.line_no}</td>
                        <td className={`px-3 py-2.5 text-xs font-semibold ${v.division === '3차' ? 'text-blue-400' : 'text-rose-400'}`}>{v.division}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-400">{v.account_code}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-300">{v.account_name}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{v.partner_code}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">{v.partner_name}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-right text-blue-400">{v.debit ? formatNumber(v.debit) : ''}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-right text-rose-400">{v.credit ? formatNumber(v.credit) : ''}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{v.description}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white/[0.03] font-semibold">
                      <td colSpan={6} className="px-3 py-3 text-xs text-slate-400 text-right">합계</td>
                      <td className="px-3 py-3 text-xs font-mono text-right text-blue-400">
                        {formatNumber(voucherData.summary.total_debit)}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-right text-rose-400">
                        {formatNumber(voucherData.summary.total_credit)}
                      </td>
                      <td className="px-3 py-3">
                        {voucherData.summary.balanced ? (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            대차 일치
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-semibold">대차 불일치</span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
