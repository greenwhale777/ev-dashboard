'use client';

import { useState, useEffect, useCallback } from 'react';

// ============ API ============
const API_URL = process.env.NEXT_PUBLIC_PAYROLL_API_URL || '';

// ============ 타입 ============
interface Employee {
  id: number;
  name: string;
  department: string;
  position: string;
  base_salary: number;
  meal_allowance: number;
  car_allowance: number;
  childcare_allowance: number;
  join_date: string;
}

interface PayrollRow {
  employee_id: number;
  name: string;
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

interface VoucherRow {
  type: '차변' | '대변';
  account_code: string;
  account_name: string;
  vendor_code: string;
  vendor_name: string;
  debit: number;
  credit: number;
  description: string;
}

interface ProcessingStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  message?: string;
}

interface LogEntry {
  timestamp: string;
  step: string;
  status: 'info' | 'success' | 'error' | 'warning';
  message: string;
}

interface InsuranceRates {
  year: number;
  national_pension: number;
  health_insurance: number;
  long_term_care: number;
  employment_insurance: number;
}

type TabType = 'payroll' | 'employees' | 'logs';
type PayrollStatus = 'draft' | 'confirmed' | 'voucher_uploaded' | 'bank_exported' | 'completed';

// ============ 상수 ============
const PAYROLL_COLUMNS = [
  { key: 'name', label: '성명', editable: false },
  { key: 'base_salary', label: '기본급', editable: true },
  { key: 'meal_allowance', label: '식대', editable: true },
  { key: 'car_allowance', label: '차량유지비', editable: true },
  { key: 'childcare_allowance', label: '보육수당', editable: true },
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
  compare: '비교',
  voucher: '전표',
  bank_excel: '은행엑셀',
  clearing: '반제',
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  pending: { label: '미처리', bg: 'bg-slate-800/50', text: 'text-slate-400', dot: 'bg-slate-500' },
  running: { label: '진행중', bg: 'bg-blue-900/30', text: 'text-blue-400', dot: 'bg-blue-400' },
  done: { label: '완료', bg: 'bg-emerald-900/30', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  error: { label: '오류', bg: 'bg-red-900/30', text: 'text-red-400', dot: 'bg-red-400' },
};

// ============ 유틸리티 ============
function formatNumber(n: number): string {
  return n.toLocaleString('ko-KR');
}

function formatTime(iso: string | undefined) {
  if (!iso) return '-';
  const d = new Date(iso);
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

// ============ 기본 데이터 (API 연결 전 데모용) ============
const DEFAULT_RATES: InsuranceRates = {
  year: 2026,
  national_pension: 4.5,
  health_insurance: 3.545,
  long_term_care: 12.95,
  employment_insurance: 0.9,
};

const DEFAULT_EMPLOYEES: Employee[] = [
  { id: 1, name: '홍길동', department: '경영지원', position: '대리', base_salary: 3000000, meal_allowance: 200000, car_allowance: 200000, childcare_allowance: 100000, join_date: '2020-03-02' },
  { id: 2, name: '김철수', department: '마케팅', position: '사원', base_salary: 2500000, meal_allowance: 200000, car_allowance: 0, childcare_allowance: 0, join_date: '2022-09-01' },
  { id: 3, name: '이영희', department: '개발', position: '과장', base_salary: 3500000, meal_allowance: 200000, car_allowance: 200000, childcare_allowance: 200000, join_date: '2019-01-15' },
  { id: 4, name: '박민수', department: '디자인', position: '사원', base_salary: 2800000, meal_allowance: 200000, car_allowance: 0, childcare_allowance: 0, join_date: '2023-06-01' },
];

function calculatePayroll(employees: Employee[], rates: InsuranceRates): PayrollRow[] {
  return employees.map(emp => {
    const gross = emp.base_salary + emp.meal_allowance + emp.car_allowance + emp.childcare_allowance;
    // 비과세 제외 과세대상: 식대 20만 비과세, 차량유지비 20만 비과세, 보육수당 10만 비과세
    const taxableBase = emp.base_salary;
    const nationalPension = Math.round(taxableBase * rates.national_pension / 100);
    const healthInsurance = Math.round(taxableBase * rates.health_insurance / 100);
    const longTermCare = Math.round(healthInsurance * rates.long_term_care / 100);
    const employmentInsurance = Math.round(taxableBase * rates.employment_insurance / 100);
    // 간이세액표 간략 적용 (실제는 국세청 간이세액표 참조)
    const incomeTax = Math.round(taxableBase * 0.03);
    const localIncomeTax = Math.round(incomeTax * 0.1);
    const totalDeductions = incomeTax + localIncomeTax + nationalPension + healthInsurance + longTermCare + employmentInsurance;
    return {
      employee_id: emp.id,
      name: emp.name,
      base_salary: emp.base_salary,
      meal_allowance: emp.meal_allowance,
      car_allowance: emp.car_allowance,
      childcare_allowance: emp.childcare_allowance,
      gross_pay: gross,
      income_tax: incomeTax,
      local_income_tax: localIncomeTax,
      national_pension: nationalPension,
      health_insurance: healthInsurance,
      long_term_care: longTermCare,
      employment_insurance: employmentInsurance,
      total_deductions: totalDeductions,
      net_pay: gross - totalDeductions,
    };
  });
}

function generateVoucher(rows: PayrollRow[]): VoucherRow[] {
  const totals = rows.reduce((acc, r) => ({
    gross: acc.gross + r.gross_pay,
    incomeTax: acc.incomeTax + r.income_tax,
    localIncomeTax: acc.localIncomeTax + r.local_income_tax,
    nationalPension: acc.nationalPension + r.national_pension,
    healthInsurance: acc.healthInsurance + r.health_insurance,
    longTermCare: acc.longTermCare + r.long_term_care,
    employmentInsurance: acc.employmentInsurance + r.employment_insurance,
    netPay: acc.netPay + r.net_pay,
  }), { gross: 0, incomeTax: 0, localIncomeTax: 0, nationalPension: 0, healthInsurance: 0, longTermCare: 0, employmentInsurance: 0, netPay: 0 });

  return [
    { type: '차변', account_code: '52100', account_name: '급여', vendor_code: '', vendor_name: '', debit: totals.gross, credit: 0, description: '급여 지급' },
    { type: '대변', account_code: '25300', account_name: '예수금-소득세', vendor_code: 'TAX01', vendor_name: '세무서', debit: 0, credit: totals.incomeTax, description: '소득세 원천징수' },
    { type: '대변', account_code: '25301', account_name: '예수금-지방소득세', vendor_code: 'TAX02', vendor_name: '지자체', debit: 0, credit: totals.localIncomeTax, description: '지방소득세 원천징수' },
    { type: '대변', account_code: '25310', account_name: '예수금-국민연금', vendor_code: 'INS01', vendor_name: '국민연금공단', debit: 0, credit: totals.nationalPension, description: '국민연금 원천공제' },
    { type: '대변', account_code: '25320', account_name: '예수금-건강보험', vendor_code: 'INS02', vendor_name: '건강보험공단', debit: 0, credit: totals.healthInsurance, description: '건강보험 원천공제' },
    { type: '대변', account_code: '25321', account_name: '예수금-장기요양', vendor_code: 'INS02', vendor_name: '건강보험공단', debit: 0, credit: totals.longTermCare, description: '장기요양보험 원천공제' },
    { type: '대변', account_code: '25330', account_name: '예수금-고용보험', vendor_code: 'INS03', vendor_name: '근로복지공단', debit: 0, credit: totals.employmentInsurance, description: '고용보험 원천공제' },
    { type: '대변', account_code: '11010', account_name: '보통예금', vendor_code: 'BNK01', vendor_name: '기업은행', debit: 0, credit: totals.netPay, description: '급여 이체' },
  ];
}

// ============ 메인 컴포넌트 ============
export default function PayrollPage() {
  const [tab, setTab] = useState<TabType>('payroll');
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [payrollStatus, setPayrollStatus] = useState<PayrollStatus>('draft');
  const [employees, setEmployees] = useState<Employee[]>(DEFAULT_EMPLOYEES);
  const [payrollRows, setPayrollRows] = useState<PayrollRow[]>([]);
  const [rates, setRates] = useState<InsuranceRates>(DEFAULT_RATES);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

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
  const [voucherRows, setVoucherRows] = useState<VoucherRow[]>([]);

  // 로그
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // 직원 편집
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [editRates, setEditRates] = useState(false);

  // 인라인 편집
  const [editingCell, setEditingCell] = useState<{ rowIdx: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  // ============ 데이터 로드 ============
  const fetchPayrollData = useCallback(async () => {
    if (!API_URL) {
      // API 미설정 시 로컬 계산
      const rows = calculatePayroll(employees, rates);
      setPayrollRows(rows);
      return;
    }
    try {
      setLoading(true);
      setApiError(null);
      const res = await fetch(`${API_URL}/api/payroll/${selectedMonth}`);
      if (res.ok) {
        const data = await res.json();
        if (data.rows) setPayrollRows(data.rows);
        if (data.status) setPayrollStatus(data.status);
        if (data.steps) setSteps(data.steps);
        if (data.employees) setEmployees(data.employees);
      } else {
        // 데이터 없으면 로컬 계산
        const rows = calculatePayroll(employees, rates);
        setPayrollRows(rows);
      }
    } catch (e) {
      console.error('API 오류:', e);
      setApiError('급여 API 서버에 연결할 수 없습니다. 로컬 데이터를 사용합니다.');
      const rows = calculatePayroll(employees, rates);
      setPayrollRows(rows);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, employees, rates]);

  useEffect(() => {
    fetchPayrollData();
  }, [fetchPayrollData]);

  // ============ 액션 핸들러 ============
  const handleCalculate = async () => {
    addLog('calculate', 'info', '급여 계산을 시작합니다...');
    setSteps(prev => prev.map(s => s.key === 'calculate' ? { ...s, status: 'running' } : s));

    if (API_URL) {
      try {
        const res = await fetch(`${API_URL}/api/payroll/${selectedMonth}/calculate`, { method: 'POST' });
        const data = await res.json();
        if (data.rows) setPayrollRows(data.rows);
        setSteps(prev => prev.map(s => s.key === 'calculate' ? { ...s, status: 'done' } : s));
        addLog('calculate', 'success', `${data.rows?.length || 0}명 급여 계산 완료`);
      } catch {
        setSteps(prev => prev.map(s => s.key === 'calculate' ? { ...s, status: 'error' } : s));
        addLog('calculate', 'error', 'API 오류: 로컬에서 계산합니다.');
        const rows = calculatePayroll(employees, rates);
        setPayrollRows(rows);
        setSteps(prev => prev.map(s => s.key === 'calculate' ? { ...s, status: 'done' } : s));
        addLog('calculate', 'success', `${rows.length}명 급여 계산 완료 (로컬)`);
      }
    } else {
      await new Promise(r => setTimeout(r, 500));
      const rows = calculatePayroll(employees, rates);
      setPayrollRows(rows);
      setSteps(prev => prev.map(s => s.key === 'calculate' ? { ...s, status: 'done' } : s));
      addLog('calculate', 'success', `${rows.length}명 급여 계산 완료`);
    }
    setPayrollStatus('draft');
  };

  const handleConfirm = () => {
    setPayrollStatus('confirmed');
    setSteps(prev => prev.map(s => s.key === 'compare' ? { ...s, status: 'done' } : s));
    addLog('compare', 'success', '급여 확정 완료');
  };

  const handlePreviewVoucher = () => {
    const voucher = generateVoucher(payrollRows);
    setVoucherRows(voucher);
    setShowVoucherModal(true);
  };

  const handleUploadVoucher = async () => {
    setSteps(prev => prev.map(s => s.key === 'voucher' ? { ...s, status: 'running' } : s));
    addLog('voucher', 'info', '전표 업로드 중...');
    if (API_URL) {
      try {
        await fetch(`${API_URL}/api/payroll/${selectedMonth}/voucher`, { method: 'POST' });
        setSteps(prev => prev.map(s => s.key === 'voucher' ? { ...s, status: 'done' } : s));
        addLog('voucher', 'success', '전표 업로드 완료');
        setPayrollStatus('voucher_uploaded');
      } catch {
        setSteps(prev => prev.map(s => s.key === 'voucher' ? { ...s, status: 'error' } : s));
        addLog('voucher', 'error', '전표 업로드 실패');
      }
    } else {
      await new Promise(r => setTimeout(r, 800));
      setSteps(prev => prev.map(s => s.key === 'voucher' ? { ...s, status: 'done' } : s));
      addLog('voucher', 'success', '전표 업로드 완료 (시뮬레이션)');
      setPayrollStatus('voucher_uploaded');
    }
  };

  const handleDownloadBankExcel = () => {
    setSteps(prev => prev.map(s => s.key === 'bank_excel' ? { ...s, status: 'done' } : s));
    addLog('bank_excel', 'success', '은행 엑셀 다운로드 완료');
    setPayrollStatus('bank_exported');
    // 실제로는 API에서 파일을 받아 다운로드
    const csvContent = '수취인명,계좌번호,금액\n' + payrollRows.map(r => `${r.name},,${r.net_pay}`).join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `급여이체_${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleTelegramNotify = async () => {
    addLog('clearing', 'info', '텔레그램 알림 전송 중...');
    if (API_URL) {
      try {
        await fetch(`${API_URL}/api/payroll/${selectedMonth}/notify`, { method: 'POST' });
        addLog('clearing', 'success', '텔레그램 알림 전송 완료');
      } catch {
        addLog('clearing', 'error', '텔레그램 알림 전송 실패');
      }
    } else {
      await new Promise(r => setTimeout(r, 500));
      addLog('clearing', 'success', '텔레그램 알림 전송 완료 (시뮬레이션)');
    }
    setSteps(prev => prev.map(s => s.key === 'clearing' ? { ...s, status: 'done' } : s));
    setPayrollStatus('completed');
  };

  // 인라인 편집
  const startEdit = (rowIdx: number, col: string, value: number) => {
    if (payrollStatus !== 'draft') return;
    setEditingCell({ rowIdx, col });
    setEditValue(String(value));
  };

  const saveEdit = () => {
    if (!editingCell) return;
    const { rowIdx, col } = editingCell;
    const val = parseInt(editValue.replace(/,/g, ''), 10);
    if (isNaN(val)) { setEditingCell(null); return; }

    const updated = [...employees];
    const emp = { ...updated[rowIdx] };
    (emp as Record<string, unknown>)[col] = val;
    updated[rowIdx] = emp;
    setEmployees(updated);
    setPayrollRows(calculatePayroll(updated, rates));
    setEditingCell(null);
  };

  // 로그 추가
  const addLog = (step: string, status: LogEntry['status'], message: string) => {
    setLogs(prev => [{ timestamp: new Date().toISOString(), step, status, message }, ...prev]);
  };

  // 직원 편집 저장
  const saveEmployee = () => {
    if (!editingEmployee) return;
    setEmployees(prev => prev.map(e => e.id === editingEmployee.id ? editingEmployee : e));
    setPayrollRows(calculatePayroll(
      employees.map(e => e.id === editingEmployee.id ? editingEmployee : e),
      rates
    ));
    setEditingEmployee(null);
  };

  // 합계 계산
  const totals = payrollRows.reduce((acc, r) => {
    const keys = ['base_salary', 'meal_allowance', 'car_allowance', 'childcare_allowance', 'gross_pay', 'income_tax', 'local_income_tax', 'national_pension', 'health_insurance', 'long_term_care', 'employment_insurance', 'total_deductions', 'net_pay'] as const;
    keys.forEach(k => { acc[k] = (acc[k] || 0) + r[k]; });
    return acc;
  }, {} as Record<string, number>);

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
                    disabled={loading}
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
                     payrollStatus === 'voucher_uploaded' ? '전표 업로드됨' :
                     payrollStatus === 'bank_exported' ? '은행 엑셀 완료' :
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
                      {payrollRows.map((row, rowIdx) => (
                        <tr key={row.employee_id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors">
                          {PAYROLL_COLUMNS.map(col => {
                            const val = row[col.key as keyof PayrollRow];
                            const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.col === col.key;
                            const isEditableNow = col.editable && payrollStatus === 'draft';

                            if (col.key === 'name') {
                              return <td key={col.key} className="px-3 py-3 font-medium text-slate-200 whitespace-nowrap sticky left-0 bg-[#13151B] z-10">{val}</td>;
                            }

                            if (isEditing) {
                              return (
                                <td key={col.key} className="px-1 py-1 text-right">
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={e => setEditValue(e.target.value)}
                                    onBlur={saveEdit}
                                    onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingCell(null); }}
                                    autoFocus
                                    className="w-24 bg-[#1E9EDE]/10 border border-[#1E9EDE]/30 rounded px-2 py-1 text-right text-sm text-white focus:outline-none"
                                  />
                                </td>
                              );
                            }

                            return (
                              <td
                                key={col.key}
                                onClick={() => isEditableNow && startEdit(rowIdx, col.key, val as number)}
                                className={`px-3 py-3 text-right font-mono text-xs whitespace-nowrap ${
                                  isEditableNow ? 'cursor-pointer hover:bg-[#1E9EDE]/5' : ''
                                } ${
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
                  disabled={payrollRows.length === 0 || payrollStatus !== 'draft'}
                  className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all active:scale-95"
                >
                  급여 확정
                </button>
                <button
                  onClick={handlePreviewVoucher}
                  disabled={payrollRows.length === 0}
                  className="bg-[#13151B] border border-white/[0.06] hover:border-[#1E9EDE]/30 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  전표 미리보기
                </button>
                <button
                  onClick={handleUploadVoucher}
                  disabled={payrollStatus !== 'confirmed'}
                  className="bg-[#13151B] border border-white/[0.06] hover:border-[#1E9EDE]/30 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  전표 업로드
                </button>
                <button
                  onClick={handleDownloadBankExcel}
                  disabled={payrollStatus !== 'confirmed' && payrollStatus !== 'voucher_uploaded'}
                  className="bg-[#13151B] border border-white/[0.06] hover:border-[#1E9EDE]/30 disabled:opacity-30 disabled:cursor-not-allowed text-slate-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-all active:scale-95"
                >
                  은행 엑셀 다운로드
                </button>
                <button
                  onClick={handleTelegramNotify}
                  disabled={payrollStatus !== 'bank_exported' && payrollStatus !== 'voucher_uploaded'}
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

              {editRates ? (
                /* 보험 요율 설정 */
                <div className="bg-[#13151B] border border-white/[0.06] rounded-xl p-6 max-w-lg">
                  <h3 className="text-sm font-bold text-white mb-4">{rates.year}년 보험 요율 (근로자 부담분)</h3>
                  <div className="space-y-4">
                    {([
                      ['national_pension', '국민연금'],
                      ['health_insurance', '건강보험'],
                      ['long_term_care', '장기요양보험 (건강보험 대비)'],
                      ['employment_insurance', '고용보험'],
                    ] as [keyof InsuranceRates, string][]).map(([key, label]) => (
                      <div key={key} className="flex items-center justify-between gap-4">
                        <label className="text-sm text-slate-400">{label}</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={rates[key]}
                            onChange={e => setRates({ ...rates, [key]: parseFloat(e.target.value) || 0 })}
                            className="w-24 bg-[#0B0D11] border border-white/[0.06] rounded px-3 py-1.5 text-right text-sm text-white focus:outline-none focus:border-[#1E9EDE]/50"
                          />
                          <span className="text-xs text-slate-500">%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                /* 직원 목록 + 편집 */
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
                              <button onClick={saveEmployee} className="text-xs bg-[#1E9EDE] text-white px-3 py-1 rounded-md hover:bg-[#1a8bc7]">저장</button>
                              <button onClick={() => setEditingEmployee(null)} className="text-xs bg-slate-800 text-slate-300 px-3 py-1 rounded-md hover:bg-slate-700">취소</button>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {([
                              ['base_salary', '기본급'],
                              ['meal_allowance', '식대'],
                              ['car_allowance', '차량유지비'],
                              ['childcare_allowance', '보육수당'],
                            ] as [keyof Employee, string][]).map(([key, label]) => (
                              <div key={key}>
                                <label className="text-xs text-slate-500 mb-1 block">{label}</label>
                                <input
                                  type="number"
                                  value={editingEmployee[key] as number}
                                  onChange={e => setEditingEmployee({ ...editingEmployee, [key]: parseInt(e.target.value) || 0 })}
                                  className="w-full bg-[#0B0D11] border border-white/[0.06] rounded px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#1E9EDE]/50"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <div>
                              <span className="text-sm font-bold text-white">{emp.name}</span>
                              <span className="text-xs text-slate-500 ml-2">{emp.department} · {emp.position}</span>
                            </div>
                            <button
                              onClick={() => setEditingEmployee({ ...emp })}
                              className="text-xs text-slate-400 hover:text-[#1E9EDE] transition-colors"
                            >
                              편집
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                            <div className="flex justify-between"><span className="text-slate-500">기본급</span><span className="text-slate-300 font-mono">{formatNumber(emp.base_salary)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">식대</span><span className="text-slate-300 font-mono">{formatNumber(emp.meal_allowance)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">차량유지비</span><span className="text-slate-300 font-mono">{formatNumber(emp.car_allowance)}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500">보육수당</span><span className="text-slate-300 font-mono">{formatNumber(emp.childcare_allowance)}</span></div>
                          </div>
                          <div className="mt-3 pt-3 border-t border-white/[0.04] flex justify-between text-xs">
                            <span className="text-slate-500">입사일</span>
                            <span className="text-slate-400">{emp.join_date}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
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

        {/* ===== 전표 미리보기 모달 ===== */}
        {showVoucherModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowVoucherModal(false)}>
            <div className="bg-[#13151B] border border-white/[0.06] rounded-2xl w-full max-w-4xl mx-4 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
              <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">전표 미리보기 — {selectedMonth}</h3>
                <button onClick={() => setShowVoucherModal(false)} className="text-slate-400 hover:text-white transition-colors">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              <div className="p-6 overflow-x-auto scrollbar-thin">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      {['구분', '계정코드', '계정명', '거래처코드', '거래처명', '차변', '대변', '적요'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500 text-left whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {voucherRows.map((v, i) => (
                      <tr key={i} className="border-b border-white/[0.04] hover:bg-white/[0.02]">
                        <td className={`px-3 py-2.5 text-xs font-semibold ${v.type === '차변' ? 'text-blue-400' : 'text-rose-400'}`}>{v.type}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-400">{v.account_code}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-300">{v.account_name}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-slate-500">{v.vendor_code || '-'}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">{v.vendor_name || '-'}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-right text-blue-400">{v.debit ? formatNumber(v.debit) : ''}</td>
                        <td className="px-3 py-2.5 text-xs font-mono text-right text-rose-400">{v.credit ? formatNumber(v.credit) : ''}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500">{v.description}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-white/[0.03] font-semibold">
                      <td colSpan={5} className="px-3 py-3 text-xs text-slate-400 text-right">합계</td>
                      <td className="px-3 py-3 text-xs font-mono text-right text-blue-400">
                        {formatNumber(voucherRows.reduce((s, v) => s + v.debit, 0))}
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-right text-rose-400">
                        {formatNumber(voucherRows.reduce((s, v) => s + v.credit, 0))}
                      </td>
                      <td className="px-3 py-3">
                        {voucherRows.reduce((s, v) => s + v.debit, 0) === voucherRows.reduce((s, v) => s + v.credit, 0) ? (
                          <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            일치
                          </span>
                        ) : (
                          <span className="text-xs text-red-400 font-semibold">불일치</span>
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
