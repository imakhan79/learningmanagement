import { useState } from 'react';
import { GraduationCap, BookOpen, Users, Award, BarChart3, Star, CheckCircle2, ArrowRight, Play, Globe, Zap, Shield, ChevronDown, Menu, X } from 'lucide-react';

const STATS = [
  { label: 'Active Students',   value: '50,000+' },
  { label: 'Expert Instructors',value: '1,200+' },
  { label: 'Courses Available', value: '8,500+' },
  { label: 'Countries Reached', value: '140+' },
];

const FEATURES = [
  { icon: <Play size={22}/>,     title: 'Video-First Learning',    desc: 'HD video lectures with adaptive streaming, captions, and playback speed control.' },
  { icon: <Zap size={22}/>,      title: 'AI-Powered Insights',     desc: 'Personalized learning paths and smart recommendations driven by AI analysis.' },
  { icon: <Shield size={22}/>,   title: 'Verified Certificates',   desc: 'Industry-recognized digital certificates with QR verification and blockchain proof.' },
  { icon: <Globe size={22}/>,    title: 'Live Virtual Classes',    desc: 'Real-time sessions with Google Meet, Zoom, Teams, and Jitsi Meet integration.' },
  { icon: <BarChart3 size={22}/>,title: 'Deep Analytics',          desc: 'Comprehensive dashboards for students, professors, and administrators.' },
  { icon: <Users size={22}/>,    title: 'Collaborative Learning',  desc: 'Discussion forums, group projects, peer review, and team assignments.' },
];

const COURSES = [
  { title: 'Machine Learning Fundamentals', instructor: 'Dr. Sarah Chen',   students: 4820, rating: 4.9, duration: '42h', category: 'AI / ML',          color: 'from-violet-500 to-purple-600',  img: 'https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=400&q=80' },
  { title: 'Full-Stack Web Development',    instructor: 'Prof. Mark Wilson', students: 7340, rating: 4.8, duration: '68h', category: 'Web Dev',          color: 'from-blue-500 to-indigo-600',    img: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=400&q=80' },
  { title: 'Data Science & Analytics',      instructor: 'Dr. Aisha Patel',   students: 3950, rating: 4.9, duration: '36h', category: 'Data Science',     color: 'from-emerald-500 to-teal-600',   img: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=400&q=80' },
  { title: 'UI/UX Design Mastery',          instructor: 'Emma Rodriguez',    students: 5210, rating: 4.7, duration: '28h', category: 'Design',           color: 'from-rose-500 to-pink-600',      img: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80' },
  { title: 'Cloud Architecture (AWS)',       instructor: 'James Liu',         students: 2870, rating: 4.8, duration: '52h', category: 'Cloud',            color: 'from-orange-500 to-amber-600',   img: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80' },
  { title: 'Cybersecurity Essentials',       instructor: 'Dr. Alex Kim',     students: 3120, rating: 4.9, duration: '44h', category: 'Security',         color: 'from-red-500 to-rose-600',       img: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=80' },
];

const TESTIMONIALS = [
  { name: 'Priya Nair',    role: 'Software Engineer @ Google',   text: 'EduNexus completely transformed my career. The ML course was hands-on and incredibly well structured.', avatar: 'PN', color: 'from-violet-500 to-purple-600' },
  { name: 'Carlos Ruiz',   role: 'Lead Designer @ Figma',        text: 'Best investment I ever made. The UI/UX course gave me the skills to land my dream job within 3 months.', avatar: 'CR', color: 'from-pink-500 to-rose-600' },
  { name: 'Yuki Tanaka',   role: 'Data Analyst @ Meta',          text: 'The analytics dashboard for tracking my progress kept me motivated. Finished 3 courses in 6 months!', avatar: 'YT', color: 'from-emerald-500 to-teal-600' },
];

const PRICING = [
  { name: 'Starter',    price: 0,   period: 'forever',  features: ['5 Free Courses', 'Community Access', 'Basic Certificates', 'Mobile App'], highlighted: false, cta: 'Get Started Free' },
  { name: 'Pro',        price: 29,  period: 'per month', features: ['Unlimited Courses', 'Live Sessions', 'Premium Certificates', 'AI Tutoring', 'Priority Support', 'Offline Downloads'], highlighted: true, cta: 'Start Free Trial' },
  { name: 'Enterprise', price: 99,  period: 'per user/mo', features: ['Everything in Pro', 'Custom LMS Branding', 'SSO Integration', 'Dedicated CSM', 'Analytics API', 'SLA Guarantee'], highlighted: false, cta: 'Contact Sales' },
];

const FAQS = [
  { q: 'Can I switch plans anytime?',          a: 'Yes, you can upgrade or downgrade your plan at any time. Changes take effect immediately.' },
  { q: 'Are certificates industry-recognized?',a: 'Yes. All certificates include QR verification, digital signatures, and can be shared on LinkedIn.' },
  { q: 'Is there a mobile app?',               a: 'Yes, EduNexus is fully responsive and works beautifully on all devices including iOS and Android via PWA.' },
  { q: 'How does the AI tutor work?',          a: 'Our AI analyzes your learning patterns and provides personalized hints, practice problems, and study recommendations.' },
];

export default function LandingPage({ onGetStarted }: { onGetStarted: () => void }) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const NAV_LINKS = [
    { href: '#features', label: 'Features' },
    { href: '#courses',  label: 'Courses' },
    { href: '#pricing',  label: 'Pricing' },
    { href: '#faq',      label: 'FAQ' },
  ];

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── Nav ── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/10"
           style={{ background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
              <GraduationCap size={16} className="text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">EduNexus</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="hover:text-primary-600 transition-colors">{l.label}</a>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-3">
            <button onClick={onGetStarted} className="text-sm font-semibold text-slate-700 hover:text-primary-600 transition-colors">Sign In</button>
            <button onClick={onGetStarted}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
              Get Started Free
            </button>
          </div>
          <button
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label={mobileNavOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {/* Mobile nav panel */}
        {mobileNavOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white animate-fade-down">
            <div className="px-4 sm:px-6 py-4 flex flex-col gap-1">
              {NAV_LINKS.map((l) => (
                <a key={l.href} href={l.href} onClick={() => setMobileNavOpen(false)}
                   className="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-primary-600 transition-colors">
                  {l.label}
                </a>
              ))}
              <div className="flex flex-col gap-2 mt-3 pt-3 border-t border-slate-100">
                <button onClick={onGetStarted} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors text-left">
                  Sign In
                </button>
                <button onClick={onGetStarted}
                  className="px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 4px 14px rgba(79,70,229,0.35)' }}>
                  Get Started Free
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-24 pb-20 overflow-hidden"
               style={{ background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 50%,#24243e 100%)' }}>
        {/* Animated orbs */}
        <div className="absolute top-20 left-1/4 w-72 h-72 rounded-full opacity-20 animate-float" style={{ background: 'radial-gradient(circle,#6366f1,transparent 70%)' }} />
        <div className="absolute bottom-10 right-1/4 w-64 h-64 rounded-full opacity-15" style={{ background: 'radial-gradient(circle,#14b8a6,transparent 70%)', animation: 'float 8s ease-in-out infinite reverse' }} />
        <div className="absolute top-1/2 right-10 w-48 h-48 rounded-full opacity-10" style={{ background: 'radial-gradient(circle,#f59e0b,transparent 70%)', animation: 'float 10s ease-in-out infinite' }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-6"
               style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)', color: '#a5b4fc' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 animate-pulse" />
            #1 Enterprise LMS Platform in 2026
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black text-white mb-6 leading-tight tracking-tight">
            Learn Smarter.<br />
            <span style={{ background: 'linear-gradient(90deg,#818cf8,#34d399)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Grow Faster.
            </span>
          </h1>
          <p className="text-lg sm:text-xl text-slate-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            The world's most advanced learning platform — with AI-powered tutoring, live virtual classes, deep analytics, and verified certificates.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button onClick={onGetStarted}
              className="px-8 py-4 rounded-2xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all hover:scale-105 active:scale-95"
              style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 8px 32px rgba(79,70,229,0.5)' }}>
              Start Learning Free <ArrowRight size={18}/>
            </button>
            <button className="px-8 py-4 rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all hover:scale-105"
              style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'white', backdropFilter: 'blur(10px)' }}>
              <Play size={16} className="fill-white"/> Watch Demo
            </button>
          </div>
          <p className="mt-4 text-slate-400 text-sm">No credit card required · Free forever plan available</p>

          {/* Hero preview card */}
          <div className="mt-16 relative max-w-4xl mx-auto">
            <div className="rounded-3xl overflow-hidden"
                 style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 40px 120px rgba(0,0,0,0.5)' }}>
              <div className="bg-slate-800/60 px-4 py-3 flex items-center gap-2 border-b border-white/10">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400/80" />
                  <div className="w-3 h-3 rounded-full bg-green-400/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="px-4 py-1 rounded-lg text-xs text-slate-400" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    app.edunexus.io/dashboard
                  </div>
                </div>
              </div>
              <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {STATS.map(s => (
                  <div key={s.label} className="text-center py-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.05)' }}>
                    <p className="text-2xl font-black text-white">{s.value}</p>
                    <p className="text-xs text-slate-400 mt-1">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="bg-slate-900 py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {STATS.map(s => (
              <div key={s.label}>
                <p className="text-3xl font-black text-white mb-1">{s.value}</p>
                <p className="text-slate-400 text-sm">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section id="features" className="py-24 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-primary-600 bg-primary-50 px-3 py-1.5 rounded-full">Platform Features</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-4 tracking-tight">Everything You Need to Learn</h2>
            <p className="text-slate-500 mt-3 max-w-xl mx-auto">Built for modern learners and enterprise teams — from solo students to global organizations.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <div key={i} className="card p-6 card-hover group">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4 text-primary-600 bg-primary-50 group-hover:bg-primary-100 transition-colors"
                     style={{ boxShadow: '0 4px 12px rgba(99,102,241,0.15)' }}>
                  {f.icon}
                </div>
                <h3 className="font-bold text-slate-800 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Courses ── */}
      <section id="courses" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-end justify-between mb-12">
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-secondary-600 bg-secondary-50 px-3 py-1.5 rounded-full">Top Courses</span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-4">Learn from the Best</h2>
            </div>
            <button onClick={onGetStarted} className="hidden sm:flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 transition-colors">
              Browse all <ArrowRight size={16}/>
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {COURSES.map((c, i) => (
              <div key={i} className="card card-hover overflow-hidden group cursor-pointer" onClick={onGetStarted}>
                <div className={`h-40 bg-gradient-to-br ${c.color} relative overflow-hidden`}>
                  <img src={c.img} alt={c.title} className="w-full h-full object-cover opacity-50 group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute top-3 left-3 px-2.5 py-1 rounded-full text-xs font-bold text-white" style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
                    {c.category}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-bold text-slate-800 mb-1 line-clamp-2 group-hover:text-primary-700 transition-colors">{c.title}</h3>
                  <p className="text-xs text-slate-500 mb-3">{c.instructor}</p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <div className="flex items-center gap-1">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      <span className="font-semibold text-slate-700">{c.rating}</span>
                    </div>
                    <span>{c.students.toLocaleString()} students</span>
                    <span>{c.duration}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="py-24" style={{ background: 'linear-gradient(135deg,#0f0c29 0%,#302b63 100%)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-black text-white">Loved by Learners Worldwide</h2>
            <p className="text-slate-400 mt-3">Join thousands of professionals who leveled up with EduNexus</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="rounded-2xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} className="fill-amber-400 text-amber-400" />)}
                </div>
                <p className="text-slate-300 text-sm leading-relaxed mb-5">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white text-xs font-bold`}>{t.avatar}</div>
                  <div>
                    <p className="text-sm font-semibold text-white">{t.name}</p>
                    <p className="text-xs text-slate-400">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="py-24 bg-[#f8fafc]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-accent-600 bg-accent-50 px-3 py-1.5 rounded-full">Pricing</span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mt-4">Simple, Transparent Pricing</h2>
            <p className="text-slate-500 mt-3">No hidden fees. Cancel anytime.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {PRICING.map((p, i) => (
              <div key={i} className={`rounded-3xl p-8 flex flex-col transition-all duration-300 hover:-translate-y-1 ${p.highlighted ? 'text-white relative overflow-hidden' : 'card'}`}
                   style={p.highlighted ? { background: 'linear-gradient(135deg,#4f46e5,#7c3aed)', boxShadow: '0 20px 60px rgba(79,70,229,0.4)' } : undefined}>
                {p.highlighted && (
                  <div className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>Most Popular</div>
                )}
                <h3 className={`text-xl font-bold mb-1 ${p.highlighted ? 'text-white' : 'text-slate-800'}`}>{p.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className={`text-4xl font-black ${p.highlighted ? 'text-white' : 'text-slate-900'}`}>${p.price}</span>
                  <span className={`text-sm ${p.highlighted ? 'text-white/70' : 'text-slate-500'}`}>/{p.period}</span>
                </div>
                <ul className="space-y-3 flex-1 mb-8">
                  {p.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2.5 text-sm">
                      <CheckCircle2 size={16} className={p.highlighted ? 'text-green-300' : 'text-success-500'} />
                      <span className={p.highlighted ? 'text-white/90' : 'text-slate-600'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button onClick={onGetStarted}
                  className={`w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-105 active:scale-95 ${
                    p.highlighted ? 'bg-white text-primary-700 hover:bg-white/90' : 'bg-primary-600 text-white hover:bg-primary-700'
                  }`}
                  style={!p.highlighted ? { boxShadow: '0 4px 12px rgba(79,70,229,0.25)' } : undefined}>
                  {p.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="py-24 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-black text-slate-900">Frequently Asked Questions</h2>
          </div>
          <div className="space-y-3">
            {FAQS.map((f, i) => (
              <div key={i} className="card overflow-hidden">
                <button className="w-full flex items-center justify-between px-6 py-4 text-left" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                  <span className="font-semibold text-slate-800 text-sm">{f.q}</span>
                  <ChevronDown size={18} className={`text-slate-400 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5 text-sm text-slate-500 leading-relaxed border-t border-slate-50 pt-3">
                    {f.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24" style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#7c3aed 100%)' }}>
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-5xl font-black text-white mb-4 tracking-tight">Ready to Transform Your Learning?</h2>
          <p className="text-lg text-white/80 mb-8">Join 50,000+ learners already advancing their careers with EduNexus.</p>
          <button onClick={onGetStarted}
            className="px-10 py-4 rounded-2xl bg-white text-primary-700 font-bold text-lg hover:scale-105 active:scale-95 transition-all"
            style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            Get Started for Free <ArrowRight size={20} className="inline ml-1" />
          </button>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#4f46e5,#7c3aed)' }}>
                <GraduationCap size={16} className="text-white" />
              </div>
              <span className="font-bold text-white">EduNexus</span>
            </div>
            <p className="text-slate-400 text-sm">© 2026 EduNexus. Built with ❤️ for learners worldwide.</p>
            <div className="flex gap-4 text-sm text-slate-400">
              <a href="#" className="hover:text-white transition-colors">Privacy</a>
              <a href="#" className="hover:text-white transition-colors">Terms</a>
              <a href="#" className="hover:text-white transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
