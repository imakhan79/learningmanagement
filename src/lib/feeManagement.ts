import { supabase } from './supabase';

export interface FeeStructure {
  id: string;
  title: string;
  description?: string;
  amount: number;
  currency: string;
  fee_type: string;
  frequency: string;
  course_id?: string;
  status: 'active' | 'inactive';
  created_at: string;
}

export interface FeeAssessment {
  id: string;
  student_id: string;
  fee_structure_id: string;
  amount_assessed: number;
  amount_paid: number;
  due_date: string;
  status: 'unpaid' | 'partial' | 'paid' | 'overdue' | 'cancelled';
  created_at: string;
  structure?: FeeStructure;
  student?: any;
}

export interface FeePayment {
  id: string;
  student_id: string;
  assessment_id: string;
  amount: number;
  payment_method: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  reference_number?: string;
  created_at: string;
  assessment?: FeeAssessment;
  student?: any;
}

export interface FeeDiscount {
  id: string;
  title: string;
  discount_type: 'percentage' | 'fixed';
  value: number;
  active: boolean;
  created_at: string;
}

// ─────────────────────────────────────────
// Admin / Finance Operations
// ─────────────────────────────────────────

export async function getFeeStructures() {
  return supabase.from('fee_structures').select('*, course:courses(title)').order('created_at', { ascending: false });
}

export async function createFeeStructure(params: Partial<FeeStructure>) {
  return supabase.from('fee_structures').insert(params).select().single();
}

export async function getAllAssessments() {
  return supabase
    .from('fee_assessments')
    .select('*, structure:fee_structures(title, fee_type), student:profiles(full_name, email)')
    .order('created_at', { ascending: false });
}

export async function assessFeeToStudent(studentId: string, feeStructureId: string, amount: number, dueDate: string) {
  return supabase.from('fee_assessments').insert({
    student_id: studentId,
    fee_structure_id: feeStructureId,
    amount_assessed: amount,
    due_date: dueDate,
  }).select().single();
}

export async function getAllPayments() {
  return supabase
    .from('fee_payments')
    .select('*, assessment:fee_assessments(fee_structure_id, structure:fee_structures(title)), student:profiles(full_name, email)')
    .order('created_at', { ascending: false });
}

export async function updatePaymentStatus(paymentId: string, status: 'completed' | 'failed' | 'refunded') {
  // Update payment status
  const { data: payment, error } = await supabase.from('fee_payments').update({ status }).eq('id', paymentId).select().single();
  if (error || !payment) return { data: null, error };

  // If completed, update the assessment amount_paid
  if (status === 'completed') {
    const { data: assessment } = await supabase.from('fee_assessments').select('amount_assessed, amount_paid').eq('id', payment.assessment_id).single();
    if (assessment) {
      const newPaid = assessment.amount_paid + payment.amount;
      const newStatus = newPaid >= assessment.amount_assessed ? 'paid' : 'partial';
      await supabase.from('fee_assessments').update({ amount_paid: newPaid, status: newStatus }).eq('id', payment.assessment_id);
    }
  }

  return { data: payment, error: null };
}

export async function getDiscounts() {
  return supabase.from('fee_discounts').select('*').order('created_at', { ascending: false });
}

export async function createDiscount(params: Partial<FeeDiscount>) {
  return supabase.from('fee_discounts').insert(params).select().single();
}

// ─────────────────────────────────────────
// Student Operations
// ─────────────────────────────────────────

export async function getStudentAssessments(studentId: string) {
  return supabase
    .from('fee_assessments')
    .select('*, structure:fee_structures(title, fee_type, description)')
    .eq('student_id', studentId)
    .order('due_date', { ascending: true });
}

export async function getStudentPayments(studentId: string) {
  return supabase
    .from('fee_payments')
    .select('*, assessment:fee_assessments(fee_structure_id, structure:fee_structures(title))')
    .eq('student_id', studentId)
    .order('created_at', { ascending: false });
}

/**
 * Simulates a payment gateway process.
 * In a real app, this would redirect to Stripe/PayPal and use webhooks.
 * Here we create a pending payment, wait 1.5 seconds, then mark it completed.
 */
export async function simulateOnlinePayment(studentId: string, assessmentId: string, amount: number, method: string) {
  // 1. Create pending payment
  const { data: payment, error } = await supabase.from('fee_payments').insert({
    student_id: studentId,
    assessment_id: assessmentId,
    amount,
    payment_method: method,
    status: 'pending',
    reference_number: `SIM-${Date.now()}-${Math.floor(Math.random() * 1000)}`
  }).select().single();

  if (error || !payment) return { data: null, error };

  // 2. Simulate processing delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // 3. Complete payment
  return updatePaymentStatus(payment.id, 'completed');
}
