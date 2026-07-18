import { useState, useEffect } from 'react';
import {
  DollarSign,
  Plus,
  FileText,
  CreditCard,
  History,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  Tag,
  Undo2,
  Download,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import {
  FeeStructure,
  FeeAssessment,
  FeePayment,
  FeeDiscount,
  getFeeStructures,
  getAllAssessments,
  getAllPayments,
  getDiscounts,
  getStudentAssessments,
  getStudentPayments,
  createFeeStructure,
  assessFeeToStudent,
  createDiscount,
  simulateOnlinePayment,
  updatePaymentStatus,
} from '../lib/feeManagement';
import { Spinner, Badge, formatDateTime } from '../components/ui';

// ─────────────────────────────────────────
// UI Helpers
// ─────────────────────────────────────────
function formatCurrency(amount: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

const STATUS_COLORS: Record<string, 'green' | 'rose' | 'amber' | 'slate' | 'blue' | 'purple'> = {
  active: 'green',
  inactive: 'slate',
  unpaid: 'rose',
  partial: 'amber',
  paid: 'green',
  overdue: 'rose',
  cancelled: 'slate',
  pending: 'amber',
  completed: 'green',
  failed: 'rose',
  refunded: 'purple',
  requested: 'blue',
  approved: 'green',
  processed: 'slate',
  rejected: 'rose',
};

// ─────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────
export default function FinancePage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  if (!profile) return <div className="p-12 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-black text-slate-800 flex items-center gap-2 tracking-tight">
            <DollarSign size={28} className="text-primary-600 drop-shadow-sm" />
            Finance & Fees
          </h1>
          <p className="text-slate-500 font-medium">Manage invoices, payments, and financial records</p>
        </div>
      </div>

      {isAdmin ? <AdminFinanceView /> : <StudentFinanceView studentId={profile.id} />}
    </div>
  );
}

// ─────────────────────────────────────────
// ADMIN VIEW
// ─────────────────────────────────────────
function AdminFinanceView() {
  const [tab, setTab] = useState<'assessments' | 'structures' | 'payments' | 'discounts'>('assessments');
  const [loading, setLoading] = useState(true);

  // Data
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [assessments, setAssessments] = useState<FeeAssessment[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [courses, setCourses] = useState<any[]>([]);

  // Modals
  const [showStructureModal, setShowStructureModal] = useState(false);
  const [showAssessmentModal, setShowAssessmentModal] = useState(false);

  // Form States
  const [structForm, setStructForm] = useState<Partial<FeeStructure>>({ fee_type: 'tuition', frequency: 'one-time', status: 'active', currency: 'USD' });
  const [assessForm, setAssessForm] = useState({ student_id: '', fee_structure_id: '', amount: 0, due_date: '' });

  async function loadData() {
    setLoading(true);
    const [sRes, aRes, pRes, dRes, stuRes, crsRes] = await Promise.all([
      getFeeStructures(),
      getAllAssessments(),
      getAllPayments(),
      getDiscounts(),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'student'),
      supabase.from('courses').select('id, title')
    ]);
    setStructures(sRes.data || []);
    setAssessments(aRes.data || []);
    setPayments(pRes.data || []);
    setDiscounts(dRes.data || []);
    setStudents(stuRes.data || []);
    setCourses(crsRes.data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreateStructure() {
    if (!structForm.title || !structForm.amount) return;
    await createFeeStructure(structForm);
    setShowStructureModal(false);
    loadData();
  }

  async function handleAssessFee() {
    if (!assessForm.student_id || !assessForm.fee_structure_id || !assessForm.amount || !assessForm.due_date) return;
    await assessFeeToStudent(assessForm.student_id, assessForm.fee_structure_id, assessForm.amount, assessForm.due_date);
    setShowAssessmentModal(false);
    loadData();
  }

  if (loading) return <div className="p-12 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-8">
      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit overflow-x-auto shadow-inner-soft">
        {(['assessments', 'structures', 'payments', 'discounts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 capitalize whitespace-nowrap ${
              tab === t ? 'bg-white text-primary-700 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ASSESSMENTS TAB */}
      {tab === 'assessments' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Student Invoices</h2>
            <button onClick={() => setShowAssessmentModal(true)} className="btn-gradient px-5 py-2.5 text-sm">
              <Plus size={16} className="mr-2" /> Bill Student
            </button>
          </div>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-400 font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Fee Type</th>
                  <th className="px-6 py-4 text-right">Assessed</th>
                  <th className="px-6 py-4 text-right">Paid</th>
                  <th className="px-6 py-4 text-center">Status</th>
                  <th className="px-6 py-4">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {assessments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 font-bold text-slate-800">{a.student?.full_name || a.student?.email}</td>
                    <td className="px-6 py-4 font-medium">{a.structure?.title}</td>
                    <td className="px-6 py-4 text-right font-black text-slate-700">{formatCurrency(a.amount_assessed)}</td>
                    <td className="px-6 py-4 text-right font-black text-success-600">{formatCurrency(a.amount_paid)}</td>
                    <td className="px-6 py-4 text-center">
                      <Badge color={STATUS_COLORS[a.status]} className="shadow-sm">{a.status}</Badge>
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-500">{new Date(a.due_date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {assessments.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">No assessments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STRUCTURES TAB */}
      {tab === 'structures' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Fee Structures</h2>
            <button onClick={() => setShowStructureModal(true)} className="btn-gradient px-5 py-2.5 text-sm">
              <Plus size={16} className="mr-2" /> New Structure
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {structures.map(s => (
              <div key={s.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm card-hover flex flex-col relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-primary-400 to-primary-600" />
                <div className="flex items-start justify-between mb-4 mt-2">
                  <h3 className="font-bold text-slate-800 text-lg tracking-tight line-clamp-1">{s.title}</h3>
                  <Badge color={STATUS_COLORS[s.status]} className="shadow-sm">{s.status}</Badge>
                </div>
                <div className="text-3xl font-black text-primary-600 mb-6">{formatCurrency(s.amount, s.currency)}</div>
                <div className="space-y-2 mt-auto text-sm text-slate-500 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <p className="flex justify-between font-medium"><span className="text-slate-400">Type:</span> <span className="capitalize font-bold text-slate-700">{s.fee_type}</span></p>
                  <p className="flex justify-between font-medium"><span className="text-slate-400">Frequency:</span> <span className="capitalize font-bold text-slate-700">{s.frequency}</span></p>
                  {s.course_id && <p className="flex justify-between font-medium"><span className="text-slate-400">Course:</span> <span className="font-bold text-slate-700 truncate ml-2">{(s as any).course?.title}</span></p>}
                </div>
              </div>
            ))}
            {structures.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 font-medium">No fee structures configured.</div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENTS TAB */}
      {tab === 'payments' && (
        <div className="space-y-6 animate-fade-in">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Transaction History</h2>
          <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-400 font-black tracking-widest">
                <tr>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Ref / Method</th>
                  <th className="px-6 py-4">Student</th>
                  <th className="px-6 py-4">Assessment</th>
                  <th className="px-6 py-4 text-right">Amount</th>
                  <th className="px-6 py-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500">{formatDateTime(p.created_at)}</td>
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-800">{p.reference_number || 'N/A'}</div>
                      <div className="text-xs font-medium uppercase tracking-wider text-slate-400">{p.payment_method.replace('_', ' ')}</div>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{p.student?.full_name || p.student?.email}</td>
                    <td className="px-6 py-4 font-medium text-slate-700">{p.assessment?.structure?.title || 'Unknown Fee'}</td>
                    <td className="px-6 py-4 text-right font-black text-success-600">{formatCurrency(p.amount)}</td>
                    <td className="px-6 py-4 text-center"><Badge color={STATUS_COLORS[p.status]} className="shadow-sm">{p.status}</Badge></td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">No payments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISCOUNTS TAB */}
      {tab === 'discounts' && (
        <div className="space-y-6 animate-fade-in">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Discounts & Scholarships</h2>
          <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50">
            <Tag size={48} className="mx-auto text-slate-300 mb-4 opacity-50" />
            <p className="text-slate-600 font-bold text-lg mb-2">Manage financial aid and generic discounts.</p>
            <p className="text-slate-400 font-medium">You can map these to student assessments via the API.</p>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">New Fee Structure</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Title</label>
                <input type="text" className="input" value={structForm.title || ''} onChange={e => setStructForm({ ...structForm, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount</label>
                  <input type="number" className="input" value={structForm.amount || ''} onChange={e => setStructForm({ ...structForm, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Type</label>
                  <select className="input" value={structForm.fee_type} onChange={e => setStructForm({ ...structForm, fee_type: e.target.value })}>
                    <option value="tuition">Tuition</option>
                    <option value="exam">Exam</option>
                    <option value="library">Library</option>
                    <option value="miscellaneous">Misc</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100">
              <button onClick={() => setShowStructureModal(false)} className="flex-1 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors">Cancel</button>
              <button onClick={handleCreateStructure} className="flex-1 py-3 btn-gradient">Create Structure</button>
            </div>
          </div>
        </div>
      )}

      {showAssessmentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 space-y-6">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">Bill a Student</h3>
            <div className="space-y-4">
              <div>
                <label className="label">Student</label>
                <select className="input" value={assessForm.student_id} onChange={e => setAssessForm({ ...assessForm, student_id: e.target.value })}>
                  <option value="">Select student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Fee Structure</label>
                <select className="input" value={assessForm.fee_structure_id} onChange={e => {
                  const struct = structures.find(s => s.id === e.target.value);
                  setAssessForm({ ...assessForm, fee_structure_id: e.target.value, amount: struct?.amount || 0 });
                }}>
                  <option value="">Select structure...</option>
                  {structures.map(s => <option key={s.id} value={s.id}>{s.title} ({formatCurrency(s.amount)})</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Amount</label>
                  <input type="number" className="input" value={assessForm.amount} onChange={e => setAssessForm({ ...assessForm, amount: Number(e.target.value) })} />
                </div>
                <div>
                  <label className="label">Due Date</label>
                  <input type="date" className="input" value={assessForm.due_date} onChange={e => setAssessForm({ ...assessForm, due_date: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="flex gap-4 pt-6 mt-6 border-t border-slate-100">
              <button onClick={() => setShowAssessmentModal(false)} className="flex-1 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors">Cancel</button>
              <button onClick={handleAssessFee} className="flex-1 py-3 btn-gradient">Generate Invoice</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────
// STUDENT VIEW
// ─────────────────────────────────────────
function StudentFinanceView({ studentId }: { studentId: string }) {
  const [tab, setTab] = useState<'invoices' | 'history'>('invoices');
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<FeeAssessment[]>([]);
  const [payments, setPayments] = useState<FeePayment[]>([]);

  // Payment Modal
  const [payModal, setPayModal] = useState<{ show: boolean, assessment: FeeAssessment | null }>({ show: false, assessment: null });
  const [payAmount, setPayAmount] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paySuccess, setPaySuccess] = useState(false);

  async function loadData() {
    setLoading(true);
    const [aRes, pRes] = await Promise.all([
      getStudentAssessments(studentId),
      getStudentPayments(studentId),
    ]);
    setAssessments(aRes.data || []);
    setPayments(pRes.data || []);
    setLoading(false);
  }

  useEffect(() => { loadData(); }, [studentId]);

  function openPayModal(a: FeeAssessment) {
    setPayModal({ show: true, assessment: a });
    setPayAmount(a.amount_assessed - a.amount_paid);
    setPaySuccess(false);
  }

  async function handlePay() {
    if (!payModal.assessment) return;
    setIsProcessing(true);
    const res = await simulateOnlinePayment(studentId, payModal.assessment.id, payAmount, 'online_gateway');
    setIsProcessing(false);
    if (!res.error) {
      setPaySuccess(true);
      loadData();
    }
  }

  if (loading) return <div className="p-12 flex justify-center"><Spinner /></div>;

  const totalDue = assessments.reduce((acc, a) => acc + (a.amount_assessed - a.amount_paid), 0);

  return (
    <div className="space-y-8">
      {/* Student Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:scale-110 transition-transform duration-500">
            <DollarSign size={100} />
          </div>
          <div className="relative z-10">
            <p className="text-slate-400 font-bold tracking-widest text-xs uppercase mb-2">Total Outstanding Balance</p>
            <h2 className="text-5xl font-black tracking-tight">{formatCurrency(totalDue)}</h2>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 p-1.5 bg-slate-100 rounded-2xl w-fit shadow-inner-soft">
        {(['invoices', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 capitalize ${
              tab === t ? 'bg-white text-primary-700 shadow-sm scale-100' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* INVOICES TAB */}
      {tab === 'invoices' && (
        <div className="grid md:grid-cols-2 gap-6 animate-fade-in">
          {assessments.map(a => {
            const balance = a.amount_assessed - a.amount_paid;
            const isDue = balance > 0;
            return (
              <div key={a.id} className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden flex flex-col group">
                <div className={`absolute top-0 left-0 right-0 h-1.5 ${isDue ? 'bg-gradient-to-r from-amber-400 to-rose-500' : 'bg-gradient-to-r from-emerald-400 to-emerald-600'}`} />
                <div className="flex items-start justify-between mb-6 mt-2">
                  <div>
                    <h3 className="font-black text-slate-800 text-xl tracking-tight mb-1.5">{a.structure?.title}</h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                      <Badge color={STATUS_COLORS[a.status]} className="shadow-sm">{a.status}</Badge>
                      <span className="flex items-center gap-1"><History size={14} className="opacity-50" /> Due: {new Date(a.due_date).toLocaleDateString()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mb-1">Total</p>
                    <p className="font-black text-slate-800 text-xl">{formatCurrency(a.amount_assessed)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 mt-auto">
                  <div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Amount Paid</p>
                    <p className="font-black text-success-600 text-lg">{formatCurrency(a.amount_paid)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Remaining</p>
                    <p className={`font-black text-2xl tracking-tight ${isDue ? 'text-rose-600' : 'text-slate-400'}`}>{formatCurrency(balance)}</p>
                  </div>
                </div>

                {isDue && (
                  <button
                    onClick={() => openPayModal(a)}
                    className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 hover:shadow-lg hover:shadow-slate-900/20 transition-all active:scale-[0.98]"
                  >
                    <CreditCard size={18} /> Pay Now
                  </button>
                )}
                {!isDue && (
                  <div className="w-full mt-6 flex items-center justify-center gap-2 py-3.5 bg-success-50 text-success-700 rounded-xl font-bold border border-success-100">
                    <CheckCircle2 size={18} /> Fully Paid
                  </div>
                )}
              </div>
            );
          })}
          {assessments.length === 0 && (
            <div className="col-span-full py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 flex flex-col items-center justify-center">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-500 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 size={40} />
              </div>
              <p className="text-xl font-black text-slate-700 tracking-tight mb-1">You're all caught up!</p>
              <p className="text-slate-500 font-medium">No pending invoices or fees.</p>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm animate-fade-in">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-100 text-xs uppercase text-slate-400 font-black tracking-widest">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Transaction ID</th>
                <th className="px-6 py-4">Method</th>
                <th className="px-6 py-4 text-right">Amount</th>
                <th className="px-6 py-4 text-center">Status</th>
                <th className="px-6 py-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-slate-500">{formatDateTime(p.created_at)}</td>
                  <td className="px-6 py-4 font-bold font-mono text-xs text-slate-700 bg-slate-50/50 rounded px-2">{p.reference_number || 'N/A'}</td>
                  <td className="px-6 py-4 font-medium uppercase tracking-wider text-xs text-slate-400">{p.payment_method.replace('_', ' ')}</td>
                  <td className="px-6 py-4 text-right font-black text-slate-800">{formatCurrency(p.amount)}</td>
                  <td className="px-6 py-4 text-center"><Badge color={STATUS_COLORS[p.status]} className="shadow-sm">{p.status}</Badge></td>
                  <td className="px-6 py-4 text-center">
                    {p.status === 'completed' && (
                      <button className="p-2 text-primary-500 hover:bg-primary-50 rounded-xl transition-colors inline-flex items-center" title="Download Receipt">
                        <Download size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-slate-400 font-medium">No payment history.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PAYMENT GATEWAY SIMULATION MODAL */}
      {payModal.show && payModal.assessment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden relative">
            <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-emerald-400 to-teal-500 z-10" />
            <div className="bg-slate-900 pt-8 pb-6 px-8 text-white relative">
              <div className="absolute top-0 right-0 opacity-10 p-4">
                <CreditCard size={120} />
              </div>
              <div className="flex justify-between items-start mb-6 relative z-10">
                <div>
                  <p className="text-emerald-400 text-xs font-black tracking-widest uppercase mb-1 flex items-center gap-1.5"><CheckCircle2 size={12}/> Secure Checkout</p>
                  <h3 className="text-2xl font-black tracking-tight">{payModal.assessment.structure?.title}</h3>
                </div>
                {!isProcessing && !paySuccess && (
                  <button onClick={() => setPayModal({ show: false, assessment: null })} className="text-slate-400 hover:text-white bg-white/10 hover:bg-white/20 p-1.5 rounded-full transition-colors backdrop-blur-sm">
                    <XCircle size={20} />
                  </button>
                )}
              </div>
              <div className="text-5xl font-black tracking-tighter relative z-10">{formatCurrency(payAmount)}</div>
            </div>

            <div className="p-8 space-y-6">
              {paySuccess ? (
                <div className="text-center py-8 animate-fade-in">
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <CheckCircle2 size={40} className="text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight mb-2">Payment Successful!</h3>
                  <p className="text-slate-500 font-medium mb-8">Your transaction has been processed and your invoice is updated.</p>
                  <button onClick={() => setPayModal({ show: false, assessment: null })} className="w-full py-4 bg-slate-100 text-slate-800 font-black rounded-xl hover:bg-slate-200 transition-colors">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Amount to Pay</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</span>
                        <input
                          type="number"
                          className="w-full pl-8 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xl font-black focus:ring-2 focus:ring-emerald-500 transition-shadow outline-none"
                          value={payAmount}
                          max={payModal.assessment.amount_assessed - payModal.assessment.amount_paid}
                          onChange={e => setPayAmount(Number(e.target.value))}
                        />
                      </div>
                      <p className="text-xs text-slate-400 font-medium mt-2 flex items-center gap-1.5"><AlertCircle size={12}/> You can make a partial payment.</p>
                    </div>

                    <div className="p-5 rounded-2xl border-2 border-emerald-500 bg-emerald-50 relative overflow-hidden group cursor-default">
                      <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-white rounded-xl shadow-sm">
                          <CreditCard size={24} className="text-emerald-600" />
                        </div>
                        <div>
                          <p className="font-black text-emerald-900 tracking-tight">Credit Card</p>
                          <p className="text-sm font-bold text-emerald-700/80 font-mono mt-0.5">•••• •••• •••• 4242</p>
                        </div>
                      </div>
                      <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
                        <CreditCard size={100} />
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      onClick={handlePay}
                      disabled={isProcessing || payAmount <= 0}
                      className="w-full flex items-center justify-center gap-2 py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl font-black text-lg hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-500/25 active:scale-[0.98]"
                    >
                      {isProcessing ? (
                        <><Spinner size="sm" /> Processing...</>
                      ) : (
                        <>Pay {formatCurrency(payAmount)}</>
                      )}
                    </button>
                    <p className="text-center text-xs text-slate-400 font-medium mt-4">
                      This is a simulated gateway. No real charges will occur.
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
