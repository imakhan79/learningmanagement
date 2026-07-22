import { useEffect, useMemo, useState } from 'react';
import {
  DollarSign, TrendingUp, FileText, CreditCard, Tag, Percent, AlertCircle,
  Clock, CheckCircle2, Plus, Pencil, Layers3, X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import {
  FeeStructure, FeeAssessment, FeeDiscount, FeeInstallment,
  getFeeStructures, createFeeStructure, updateFeeStructure,
  getAllAssessments, assessFeeToStudent,
  getDiscounts, createDiscount,
  recordFeePayment, createInstallmentPlan, getInstallments,
} from '../lib/feeManagement';
import { StatCard, ChartCard, BarChart } from '../components/charts';
import { Button, Input, Select, Textarea, Badge, Spinner, EmptyState, Modal, formatDate, formatCurrency } from '../components/ui';

interface CourseOption { id: string; title: string; }
interface StudentOption { id: string; full_name: string; email: string; }

const TABS = [
  { id: 'overview', label: 'Overview', icon: <TrendingUp size={16} /> },
  { id: 'setup', label: 'Fee Setup', icon: <Layers3 size={16} /> },
  { id: 'invoices', label: 'Invoices & Payments', icon: <FileText size={16} /> },
  { id: 'discounts', label: 'Discounts', icon: <Percent size={16} /> },
  { id: 'collections', label: 'Pending & Default', icon: <AlertCircle size={16} /> },
] as const;

type TabId = typeof TABS[number]['id'];

const WAIVER_TYPES = ['Need-Based Waiver', 'General Waiver', 'Scholarship Waiver'];

export default function FinanceHubPage() {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [loading, setLoading] = useState(true);

  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [assessments, setAssessments] = useState<FeeAssessment[]>([]);
  const [discounts, setDiscounts] = useState<FeeDiscount[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);

  const load = async () => {
    setLoading(true);
    const [sRes, aRes, dRes, payRes, stuRes, crsRes] = await Promise.all([
      getFeeStructures(),
      getAllAssessments(),
      getDiscounts(),
      supabase.from('fee_payments').select('*, assessment:fee_assessments(fee_structure_id)').eq('status', 'completed'),
      supabase.from('profiles').select('id, full_name, email').eq('role', 'student').order('full_name'),
      supabase.from('courses').select('id, title').order('title'),
    ]);
    setStructures(sRes.data || []);
    setAssessments(aRes.data || []);
    setDiscounts(dRes.data || []);
    setPayments(payRes.data || []);
    setStudents(stuRes.data || []);
    setCourses(crsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const structureCourse = (structureId: string) => structures.find((s) => s.id === structureId)?.course_id || null;

  const totalRevenue = useMemo(() => payments.reduce((s, p) => s + (p.amount || 0), 0), [payments]);

  const revenueByCourse = useMemo(() => {
    const m: Record<string, number> = {};
    payments.forEach((p) => {
      const courseId = structureCourse(p.assessment?.fee_structure_id);
      const label = courses.find((c) => c.id === courseId)?.title || 'General / Unassigned';
      m[label] = (m[label] || 0) + (p.amount || 0);
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value: Math.round(value) }));
  }, [payments, courses, structures]);

  const now = new Date();
  const outstanding = assessments.filter((a) => a.status === 'unpaid' || a.status === 'partial' || a.status === 'overdue');
  const pending = outstanding.filter((a) => new Date(a.due_date) >= now);
  const defaulted = outstanding.filter((a) => new Date(a.due_date) < now);

  if (loading) return <Spinner />;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1 mb-2">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Finance Hub</h1>
        <p className="text-slate-500 font-medium">Revenue, fee structures, invoicing, and collections</p>
      </div>

      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-slate-100 w-fit overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
              activeTab === t.id ? 'bg-white text-primary-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
            <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={<DollarSign size={20} />} color="emerald" />
            <StatCard label="Pending Payments" value={pending.length} icon={<Clock size={20} />} color="amber" />
            <StatCard label="Default Payments" value={defaulted.length} icon={<AlertCircle size={20} />} color="rose" />
          </div>
          <ChartCard title="Total Revenue by Course">
            <div className="py-2"><BarChart data={revenueByCourse} color="#10b981" /></div>
          </ChartCard>
        </div>
      )}

      {activeTab === 'setup' && (
        <FeeSetupTab structures={structures} courses={courses} onChanged={load} />
      )}

      {activeTab === 'invoices' && (
        <InvoicesTab assessments={assessments} structures={structures} students={students} onChanged={load} />
      )}

      {activeTab === 'discounts' && (
        <DiscountsTab discounts={discounts} onChanged={load} />
      )}

      {activeTab === 'collections' && (
        <div className="space-y-6">
          <ChartCard title="Pending Payments" action={<Badge color="amber">Within due date · {pending.length}</Badge>}>
            <AssessmentList rows={pending} emptyLabel="No pending payments" />
          </ChartCard>
          <ChartCard title="Default Payments" action={<Badge color="danger">Past due date · {defaulted.length}</Badge>}>
            <AssessmentList rows={defaulted} emptyLabel="No defaulted payments" />
          </ChartCard>
        </div>
      )}
    </div>
  );
}

function AssessmentList({ rows, emptyLabel }: { rows: FeeAssessment[]; emptyLabel: string }) {
  return (
    <div className="space-y-2.5 pt-2">
      {rows.map((a) => (
        <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
          <span className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <AlertCircle size={16} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-slate-700 truncate">{(a as any).student?.full_name || 'Unknown'}</p>
            <p className="text-xs text-slate-500 truncate">{(a as any).structure?.title || 'Fee'} &middot; Due {formatDate(a.due_date)}</p>
          </div>
          <Badge color={a.status === 'partial' ? 'amber' : 'danger'}>{a.status}</Badge>
          <span className="text-sm font-bold text-slate-700 shrink-0">{formatCurrency(a.amount_assessed - a.amount_paid)} due</span>
        </div>
      ))}
      {rows.length === 0 && <EmptyState icon={<CheckCircle2 size={24} />} title={emptyLabel} />}
    </div>
  );
}

function FeeSetupTab({ structures, courses, onChanged }: { structures: FeeStructure[]; courses: CourseOption[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<FeeStructure | null>(null);

  return (
    <ChartCard
      title="Course Fee Structures"
      action={<Button size="sm" variant="gradient" onClick={() => { setEditing(null); setShowForm(true); }}><Plus size={14} /> Setup Fee</Button>}
    >
      <div className="space-y-2.5 pt-2">
        {structures.map((s: any) => (
          <div key={s.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            <span className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700 truncate">{s.title}</p>
              <p className="text-xs text-slate-500 truncate">{s.course?.title || 'General'} &middot; {s.fee_type} &middot; {s.frequency}</p>
            </div>
            <Badge color={s.status === 'active' ? 'success' : 'slate'}>{s.status}</Badge>
            <span className="text-sm font-bold text-slate-700 shrink-0">{formatCurrency(s.amount, s.currency)}</span>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(s); setShowForm(true); }}><Pencil size={13} /></Button>
          </div>
        ))}
        {structures.length === 0 && <EmptyState icon={<Layers3 size={24} />} title="No fee structures yet" description="Set up an admission or tuition fee to get started." />}
      </div>

      {showForm && (
        <FeeStructureFormModal
          structure={editing}
          courses={courses}
          onClose={() => setShowForm(false)}
          onSaved={() => { setShowForm(false); onChanged(); }}
        />
      )}
    </ChartCard>
  );
}

function FeeStructureFormModal({ structure, courses, onClose, onSaved }: {
  structure: FeeStructure | null; courses: CourseOption[]; onClose: () => void; onSaved: () => void;
}) {
  const [title, setTitle] = useState(structure?.title || '');
  const [description, setDescription] = useState(structure?.description || '');
  const [amount, setAmount] = useState(String(structure?.amount ?? ''));
  const [feeType, setFeeType] = useState(structure?.fee_type || 'tuition');
  const [frequency, setFrequency] = useState(structure?.frequency || 'monthly');
  const [courseId, setCourseId] = useState(structure?.course_id || '');
  const [status, setStatus] = useState(structure?.status || 'active');
  const [saving, setSaving] = useState(false);

  const applyPreset = (preset: 'admission' | 'tuition') => {
    if (preset === 'admission') { setFeeType('registration'); setFrequency('one-time'); if (!title) setTitle('Admission Fee'); }
    else { setFeeType('tuition'); setFrequency('monthly'); if (!title) setTitle('Tuition Fee'); }
  };

  const save = async () => {
    setSaving(true);
    const payload = { title, description, amount: parseFloat(amount) || 0, currency: 'USD', fee_type: feeType, frequency, course_id: courseId || null, status };
    if (structure) await updateFeeStructure(structure.id, payload);
    else await createFeeStructure(payload);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={structure ? 'Edit Course Fee' : 'Setup Course Fee'} maxW="max-w-lg">
      <div className="space-y-5 p-6 pt-2 max-h-[75vh] overflow-y-auto">
        {!structure && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => applyPreset('admission')}>Admission Fee (one-time)</Button>
            <Button size="sm" variant="outline" onClick={() => applyPreset('tuition')}>Tuition Fee (monthly)</Button>
          </div>
        )}
        <div>
          <label className="label">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Tuition Fee" />
        </div>
        <div>
          <label className="label">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Amount (USD)</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Course</label>
            <Select value={courseId} onChange={(e) => setCourseId(e.target.value)}>
              <option value="">General (all courses)</option>
              {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Fee Type</label>
            <Select value={feeType} onChange={(e) => setFeeType(e.target.value)}>
              <option value="tuition">Tuition</option>
              <option value="registration">Registration / Admission</option>
              <option value="exam">Exam</option>
              <option value="library">Library</option>
              <option value="late_fee">Late Fee</option>
              <option value="miscellaneous">Miscellaneous</option>
            </Select>
          </div>
          <div>
            <label className="label">Frequency</label>
            <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
              <option value="one-time">One-Time</option>
              <option value="monthly">Monthly</option>
              <option value="semester">Semester</option>
              <option value="annual">Annual</option>
            </Select>
          </div>
        </div>
        <div>
          <label className="label">Status</label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </Select>
        </div>
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !title || !amount}>{saving ? 'Saving...' : 'Save Fee'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function InvoicesTab({ assessments, structures, students, onChanged }: {
  assessments: FeeAssessment[]; structures: FeeStructure[]; students: StudentOption[]; onChanged: () => void;
}) {
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState<FeeAssessment | null>(null);
  const [installmentTarget, setInstallmentTarget] = useState<FeeAssessment | null>(null);

  return (
    <ChartCard
      title="Invoices"
      action={<Button size="sm" variant="gradient" onClick={() => setShowInvoiceForm(true)}><Plus size={14} /> Generate Invoice</Button>}
    >
      <div className="space-y-2.5 pt-2">
        {assessments.map((a: any) => (
          <div key={a.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
            <span className="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FileText size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700 truncate">{a.student?.full_name || 'Unknown'}</p>
              <p className="text-xs text-slate-500 truncate">{a.structure?.title} &middot; Due {formatDate(a.due_date)}</p>
            </div>
            <Badge color={a.status === 'paid' ? 'success' : a.status === 'partial' ? 'amber' : 'danger'}>{a.status}</Badge>
            <span className="text-sm font-bold text-slate-700 shrink-0">{formatCurrency(a.amount_paid)} / {formatCurrency(a.amount_assessed)}</span>
            {a.status !== 'paid' && a.status !== 'cancelled' && (
              <div className="flex items-center gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => setPaymentTarget(a)}><CreditCard size={12} /> Record Payment</Button>
                <Button size="sm" variant="ghost" onClick={() => setInstallmentTarget(a)}>Installments</Button>
              </div>
            )}
          </div>
        ))}
        {assessments.length === 0 && <EmptyState icon={<FileText size={24} />} title="No invoices yet" />}
      </div>

      {showInvoiceForm && (
        <GenerateInvoiceModal structures={structures} students={students} onClose={() => setShowInvoiceForm(false)} onSaved={() => { setShowInvoiceForm(false); onChanged(); }} />
      )}
      {paymentTarget && (
        <RecordPaymentModal assessment={paymentTarget} onClose={() => setPaymentTarget(null)} onSaved={() => { setPaymentTarget(null); onChanged(); }} />
      )}
      {installmentTarget && (
        <InstallmentsModal assessment={installmentTarget} onClose={() => setInstallmentTarget(null)} onSaved={() => { setInstallmentTarget(null); onChanged(); }} />
      )}
    </ChartCard>
  );
}

function GenerateInvoiceModal({ structures, students, onClose, onSaved }: {
  structures: FeeStructure[]; students: StudentOption[]; onClose: () => void; onSaved: () => void;
}) {
  const [studentId, setStudentId] = useState(students[0]?.id || '');
  const [structureId, setStructureId] = useState(structures[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const s = structures.find((x) => x.id === structureId);
    if (s) setAmount(String(s.amount));
  }, [structureId]);

  const save = async () => {
    if (!studentId || !structureId || !dueDate) return;
    setSaving(true);
    await assessFeeToStudent(studentId, structureId, parseFloat(amount) || 0, new Date(dueDate).toISOString());
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Generate Student Invoice" maxW="max-w-md">
      <div className="space-y-5 p-6 pt-2">
        <div>
          <label className="label">Student</label>
          <Select value={studentId} onChange={(e) => setStudentId(e.target.value)}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name || s.email}</option>)}
          </Select>
        </div>
        <div>
          <label className="label">Fee</label>
          <Select value={structureId} onChange={(e) => setStructureId(e.target.value)}>
            {structures.map((s) => <option key={s.id} value={s.id}>{s.title} ({formatCurrency(s.amount)})</option>)}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Amount</label>
            <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Due Date</label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !studentId || !structureId || !dueDate}>{saving ? 'Generating...' : 'Generate Invoice'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function RecordPaymentModal({ assessment, onClose, onSaved }: { assessment: any; onClose: () => void; onSaved: () => void }) {
  const remaining = assessment.amount_assessed - assessment.amount_paid;
  const [amount, setAmount] = useState(String(remaining));
  const [method, setMethod] = useState('cash');
  const [saving, setSaving] = useState(false);

  const amountNum = parseFloat(amount) || 0;
  const invalid = amountNum <= 0 || amountNum > remaining;

  const save = async () => {
    if (invalid) return;
    setSaving(true);
    await recordFeePayment(assessment.student_id, assessment.id, amountNum, method);
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Record Fee Payment" maxW="max-w-sm">
      <div className="space-y-5 p-6 pt-2">
        <p className="text-sm text-slate-500">{assessment.student?.full_name} owes <span className="font-bold text-slate-800">{formatCurrency(remaining)}</span> for {assessment.structure?.title}.</p>
        <div>
          <label className="label">Amount</label>
          <Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
          {invalid && amount !== '' && <p className="text-xs font-semibold text-danger-600 mt-1">Amount must be between 0 and {formatCurrency(remaining)}.</p>}
        </div>
        <div>
          <label className="label">Payment Method</label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank Transfer</option>
            <option value="credit_card">Credit Card</option>
            <option value="online_gateway">Online Gateway</option>
            <option value="wallet">Wallet</option>
          </Select>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !amount || invalid}>{saving ? 'Recording...' : 'Record Payment (Full)'}</Button>
        </div>
      </div>
    </Modal>
  );
}

function InstallmentsModal({ assessment, onClose, onSaved }: { assessment: any; onClose: () => void; onSaved: () => void }) {
  const [installments, setInstallments] = useState<FeeInstallment[]>([]);
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState('3');
  const [firstDue, setFirstDue] = useState('');

  const remaining = assessment.amount_assessed - assessment.amount_paid;

  const load = async () => {
    setLoading(true);
    const { data } = await getInstallments(assessment.id);
    setInstallments(data || []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [assessment.id]);

  const createPlan = async () => {
    if (!firstDue) return;
    await createInstallmentPlan(assessment.id, remaining, parseInt(count, 10) || 1, new Date(firstDue).toISOString());
    load();
  };

  const payOne = async (inst: FeeInstallment) => {
    await recordFeePayment(assessment.student_id, assessment.id, inst.amount, 'cash');
    await supabase.from('fee_installments').update({ status: 'paid' }).eq('id', inst.id);
    load();
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title={`Installments — ${assessment.student?.full_name}`} maxW="max-w-lg">
      <div className="space-y-5 p-6 pt-2">
        <p className="text-sm text-slate-500">Remaining balance: <span className="font-bold text-slate-800">{formatCurrency(remaining)}</span></p>
        {loading ? <Spinner /> : installments.length === 0 ? (
          <div className="space-y-3 p-4 rounded-xl bg-slate-50 border border-slate-100">
            <p className="text-sm font-semibold text-slate-700">No installment plan yet</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Number of Installments</label>
                <Input type="number" value={count} onChange={(e) => setCount(e.target.value)} min={2} />
              </div>
              <div>
                <label className="label">First Due Date</label>
                <Input type="date" value={firstDue} onChange={(e) => setFirstDue(e.target.value)} />
              </div>
            </div>
            <Button size="sm" variant="gradient" onClick={createPlan} disabled={!firstDue}>Create Installment Plan</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {installments.map((inst, i) => (
              <div key={inst.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
                <span className="text-xs font-bold text-slate-400 w-16">#{i + 1}</span>
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-700">{formatCurrency(inst.amount)}</p>
                  <p className="text-xs text-slate-500">Due {formatDate(inst.due_date)}</p>
                </div>
                {inst.status === 'paid' ? <Badge color="success">Paid</Badge> : (
                  <Button size="sm" variant="outline" onClick={() => payOne(inst)}>Record Payment</Button>
                )}
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end pt-2 border-t border-slate-100">
          <Button variant="secondary" onClick={onClose}><X size={14} /> Close</Button>
        </div>
      </div>
    </Modal>
  );
}

function DiscountsTab({ discounts, onChanged }: { discounts: FeeDiscount[]; onChanged: () => void }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <ChartCard
      title="Fee Discounts & Waivers"
      action={<Button size="sm" variant="gradient" onClick={() => setShowForm(true)}><Plus size={14} /> Apply Discount</Button>}
    >
      <div className="space-y-2.5 pt-2">
        {discounts.map((d) => (
          <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100">
            <span className="w-9 h-9 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center shrink-0">
              <Tag size={16} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-slate-700 truncate">{d.title}</p>
            </div>
            <Badge color={d.active ? 'success' : 'slate'}>{d.active ? 'active' : 'inactive'}</Badge>
            <span className="text-sm font-bold text-slate-700 shrink-0">{d.discount_type === 'percentage' ? `${d.value}%` : formatCurrency(d.value)}</span>
          </div>
        ))}
        {discounts.length === 0 && <EmptyState icon={<Percent size={24} />} title="No discounts configured" />}
      </div>
      {showForm && <DiscountFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); onChanged(); }} />}
    </ChartCard>
  );
}

function DiscountFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState(WAIVER_TYPES[0]);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [value, setValue] = useState('10');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await createDiscount({ title, discount_type: discountType, value: parseFloat(value) || 0, active: true });
    setSaving(false);
    onSaved();
  };

  return (
    <Modal open onClose={onClose} title="Apply Fee Discount / Waiver" maxW="max-w-sm">
      <div className="space-y-5 p-6 pt-2">
        <div>
          <label className="label">Waiver Type</label>
          <Select value={title} onChange={(e) => setTitle(e.target.value)}>
            {WAIVER_TYPES.map((w) => <option key={w} value={w}>{w}</option>)}
            <option value="">Custom...</option>
          </Select>
          {!WAIVER_TYPES.includes(title) && (
            <Input className="mt-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Custom waiver title" />
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Type</label>
            <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as any)}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </Select>
          </div>
          <div>
            <label className="label">Value</label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end gap-3 pt-2 border-t border-slate-100">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="gradient" onClick={save} disabled={saving || !title}>{saving ? 'Saving...' : 'Save Discount'}</Button>
        </div>
      </div>
    </Modal>
  );
}
