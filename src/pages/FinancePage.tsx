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

  if (!profile) return <Spinner />;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/30">
          <DollarSign size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Finance & Fees</h1>
          <p className="text-sm text-slate-500">Manage invoices, payments, and financial records</p>
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
  const [tab, setTab] = useState<'structures' | 'assessments' | 'payments' | 'discounts'>('assessments');
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

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit overflow-x-auto">
        {(['assessments', 'structures', 'payments', 'discounts'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 capitalize whitespace-nowrap ${
              tab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ASSESSMENTS TAB */}
      {tab === 'assessments' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Student Invoices (Assessments)</h2>
            <button onClick={() => setShowAssessmentModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 flex items-center gap-2">
              <Plus size={16} /> Bill Student
            </button>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Fee Type</th>
                  <th className="px-4 py-3 text-right">Assessed</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3">Due Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assessments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-800">{a.student?.full_name || a.student?.email}</td>
                    <td className="px-4 py-3">{a.structure?.title}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatCurrency(a.amount_assessed)}</td>
                    <td className="px-4 py-3 text-right text-emerald-600 font-medium">{formatCurrency(a.amount_paid)}</td>
                    <td className="px-4 py-3 text-center"><Badge color={STATUS_COLORS[a.status]}>{a.status}</Badge></td>
                    <td className="px-4 py-3">{new Date(a.due_date).toLocaleDateString()}</td>
                  </tr>
                ))}
                {assessments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No assessments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STRUCTURES TAB */}
      {tab === 'structures' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800">Fee Structures</h2>
            <button onClick={() => setShowStructureModal(true)} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-700 flex items-center gap-2">
              <Plus size={16} /> New Structure
            </button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {structures.map(s => (
              <div key={s.id} className="bg-white border border-slate-200 rounded-2xl p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-slate-800 text-lg">{s.title}</h3>
                  <Badge color={STATUS_COLORS[s.status]}>{s.status}</Badge>
                </div>
                <div className="text-2xl font-black text-emerald-600 mb-4">{formatCurrency(s.amount, s.currency)}</div>
                <div className="space-y-1.5 text-sm text-slate-500">
                  <p><span className="font-medium text-slate-700">Type:</span> <span className="capitalize">{s.fee_type}</span></p>
                  <p><span className="font-medium text-slate-700">Freq:</span> <span className="capitalize">{s.frequency}</span></p>
                  {s.course_id && <p><span className="font-medium text-slate-700">Course:</span> {(s as any).course?.title}</p>}
                </div>
              </div>
            ))}
            {structures.length === 0 && (
              <div className="col-span-full py-12 text-center text-slate-400">No fee structures configured.</div>
            )}
          </div>
        </div>
      )}

      {/* PAYMENTS TAB */}
      {tab === 'payments' && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold text-slate-800">Transaction History</h2>
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Ref / Method</th>
                  <th className="px-4 py-3">Student</th>
                  <th className="px-4 py-3">Assessment</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 whitespace-nowrap">{formatDateTime(p.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{p.reference_number || 'N/A'}</div>
                      <div className="text-xs capitalize">{p.payment_method.replace('_', ' ')}</div>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{p.student?.full_name || p.student?.email}</td>
                    <td className="px-4 py-3">{p.assessment?.structure?.title || 'Unknown Fee'}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-700">{formatCurrency(p.amount)}</td>
                    <td className="px-4 py-3 text-center"><Badge color={STATUS_COLORS[p.status]}>{p.status}</Badge></td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No payments found</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISCOUNTS TAB */}
      {tab === 'discounts' && (
        <div className="space-y-4 animate-fade-in">
          <h2 className="text-lg font-semibold text-slate-800">Discounts & Scholarships</h2>
          <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-2xl">
            <Tag size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 font-medium">Manage financial aid and generic discounts.</p>
            <p className="text-sm text-slate-400 mb-4">You can map these to student assessments via the API.</p>
          </div>
        </div>
      )}

      {/* MODALS */}
      {showStructureModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">New Fee Structure</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Title</label>
              <input type="text" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-400" value={structForm.title || ''} onChange={e => setStructForm({ ...structForm, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Amount</label>
                <input type="number" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-400" value={structForm.amount || ''} onChange={e => setStructForm({ ...structForm, amount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Type</label>
                <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-400" value={structForm.fee_type} onChange={e => setStructForm({ ...structForm, fee_type: e.target.value })}>
                  <option value="tuition">Tuition</option>
                  <option value="exam">Exam</option>
                  <option value="library">Library</option>
                  <option value="miscellaneous">Misc</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowStructureModal(false)} className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Cancel</button>
              <button onClick={handleCreateStructure} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">Create</button>
            </div>
          </div>
        </div>
      )}

      {showAssessmentModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Bill a Student</h3>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Student</label>
              <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-400" value={assessForm.student_id} onChange={e => setAssessForm({ ...assessForm, student_id: e.target.value })}>
                <option value="">Select student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Fee Structure</label>
              <select className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-400" value={assessForm.fee_structure_id} onChange={e => {
                const struct = structures.find(s => s.id === e.target.value);
                setAssessForm({ ...assessForm, fee_structure_id: e.target.value, amount: struct?.amount || 0 });
              }}>
                <option value="">Select structure...</option>
                {structures.map(s => <option key={s.id} value={s.id}>{s.title} ({formatCurrency(s.amount)})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Amount</label>
                <input type="number" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-400" value={assessForm.amount} onChange={e => setAssessForm({ ...assessForm, amount: Number(e.target.value) })} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Due Date</label>
                <input type="date" className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-400" value={assessForm.due_date} onChange={e => setAssessForm({ ...assessForm, due_date: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowAssessmentModal(false)} className="flex-1 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors">Cancel</button>
              <button onClick={handleAssessFee} className="flex-1 py-2 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors">Generate Invoice</button>
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

  if (loading) return <Spinner />;

  const totalDue = assessments.reduce((acc, a) => acc + (a.amount_assessed - a.amount_paid), 0);

  return (
    <div className="space-y-6">
      {/* Student Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white shadow-xl">
          <p className="text-slate-400 font-medium mb-1">Total Outstanding Balance</p>
          <h2 className="text-4xl font-black">{formatCurrency(totalDue)}</h2>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        {(['invoices', 'history'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-6 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 capitalize ${
              tab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* INVOICES TAB */}
      {tab === 'invoices' && (
        <div className="grid md:grid-cols-2 gap-4 animate-fade-in">
          {assessments.map(a => {
            const balance = a.amount_assessed - a.amount_paid;
            const isDue = balance > 0;
            return (
              <div key={a.id} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-800 text-lg mb-1">{a.structure?.title}</h3>
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <Badge color={STATUS_COLORS[a.status]}>{a.status}</Badge>
                      Due: {new Date(a.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total</p>
                    <p className="font-bold text-slate-800">{formatCurrency(a.amount_assessed)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Amount Paid</p>
                    <p className="font-medium text-emerald-600">{formatCurrency(a.amount_paid)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">Remaining Balance</p>
                    <p className="font-bold text-rose-600 text-lg">{formatCurrency(balance)}</p>
                  </div>
                </div>

                {isDue && (
                  <button
                    onClick={() => openPayModal(a)}
                    className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors"
                  >
                    <CreditCard size={18} /> Pay Now
                  </button>
                )}
                {!isDue && (
                  <div className="w-full mt-4 flex items-center justify-center gap-2 py-3 bg-emerald-50 text-emerald-700 rounded-xl font-medium border border-emerald-100">
                    <CheckCircle2 size={18} /> Fully Paid
                  </div>
                )}
              </div>
            );
          })}
          {assessments.length === 0 && (
            <div className="col-span-full py-16 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
              <CheckCircle2 size={40} className="mx-auto mb-3 text-emerald-400" />
              <p className="text-lg font-semibold text-slate-600">You're all caught up!</p>
              <p className="text-sm">No pending invoices or fees.</p>
            </div>
          )}
        </div>
      )}

      {/* HISTORY TAB */}
      {tab === 'history' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-fade-in">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs uppercase text-slate-500 font-semibold">
              <tr>
                <th className="px-4 py-4">Date</th>
                <th className="px-4 py-4">Transaction ID</th>
                <th className="px-4 py-4">Method</th>
                <th className="px-4 py-4 text-right">Amount</th>
                <th className="px-4 py-4 text-center">Status</th>
                <th className="px-4 py-4 text-center">Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {payments.map(p => (
                <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">{formatDateTime(p.created_at)}</td>
                  <td className="px-4 py-3 font-medium font-mono text-xs">{p.reference_number || 'N/A'}</td>
                  <td className="px-4 py-3 capitalize">{p.payment_method.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-800">{formatCurrency(p.amount)}</td>
                  <td className="px-4 py-3 text-center"><Badge color={STATUS_COLORS[p.status]}>{p.status}</Badge></td>
                  <td className="px-4 py-3 text-center">
                    {p.status === 'completed' && (
                      <button className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg inline-flex items-center" title="Download Receipt">
                        <Download size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {payments.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No payment history.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PAYMENT GATEWAY SIMULATION MODAL */}
      {payModal.show && payModal.assessment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-900 p-6 text-white">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-slate-400 text-sm font-medium">Secure Checkout</p>
                  <h3 className="text-xl font-bold mt-1">{payModal.assessment.structure?.title}</h3>
                </div>
                {!isProcessing && !paySuccess && (
                  <button onClick={() => setPayModal({ show: false, assessment: null })} className="text-slate-400 hover:text-white transition-colors">
                    <XCircle size={24} />
                  </button>
                )}
              </div>
              <div className="text-4xl font-black">{formatCurrency(payAmount)}</div>
            </div>

            <div className="p-6 space-y-6">
              {paySuccess ? (
                <div className="text-center py-6 animate-fade-in">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-emerald-600" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-800 mb-2">Payment Successful!</h3>
                  <p className="text-slate-500 text-sm mb-6">Your transaction has been processed and your invoice is updated.</p>
                  <button onClick={() => setPayModal({ show: false, assessment: null })} className="w-full py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors">
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">Amount to Pay</label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">$</span>
                        <input
                          type="number"
                          className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-bold focus:ring-2 focus:ring-slate-900"
                          value={payAmount}
                          max={payModal.assessment.amount_assessed - payModal.assessment.amount_paid}
                          onChange={e => setPayAmount(Number(e.target.value))}
                        />
                      </div>
                      <p className="text-xs text-slate-400 mt-1">You can make a partial payment.</p>
                    </div>

                    <div className="p-4 rounded-xl border-2 border-emerald-500 bg-emerald-50 relative overflow-hidden">
                      <div className="flex items-center gap-3">
                        <CreditCard size={24} className="text-emerald-600" />
                        <div>
                          <p className="font-bold text-emerald-900">Credit Card</p>
                          <p className="text-xs text-emerald-700">•••• •••• •••• 4242</p>
                        </div>
                      </div>
                      <div className="absolute -right-4 -bottom-4 opacity-10">
                        <CreditCard size={80} />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handlePay}
                    disabled={isProcessing || payAmount <= 0}
                    className="w-full flex items-center justify-center gap-2 py-4 bg-emerald-600 text-white rounded-xl font-bold text-lg hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-lg shadow-emerald-600/30"
                  >
                    {isProcessing ? (
                      <><Spinner size="sm" /> Processing...</>
                    ) : (
                      <>Pay {formatCurrency(payAmount)}</>
                    )}
                  </button>
                  <p className="text-center text-xs text-slate-400">
                    This is a simulated gateway. No real charges will occur.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
