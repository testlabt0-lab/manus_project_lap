import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useLocation } from "wouter";
import {
  Activity,
  ArrowLeft,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  ChevronLeft,
  CircleHelp,
  ClipboardList,
  Download,
  FileText,
  HeartPulse,
  LayoutDashboard,
  MapPin,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  Network,
  ReceiptText,
  Search,
  ShieldCheck,
  Stethoscope,
  UserRound,
  UsersRound,
  WalletCards,
} from "lucide-react";
import { useMemo, useState } from "react";
import { canReadPatientVisitOutput, nextVisitState, progressForVisit, visitStateMeta, type VisitState } from "../../../shared/medicare";
import { DEMO_VISIT } from "../../../shared/mockData";

type Role = "patient" | "manager" | "staff";

const PACKAGE_URL = "/manus-storage/MediCare_Pro_Project_Source_and_Docs_cafbe617.zip";
const DFD_URL = "/manus-storage/medicare-dfd-level1_7cbb25c9.png";
const SEQUENCE_URL = "/manus-storage/medicare-sequence-visit_7d7ad50e.png";
const ERD_URL = "/manus-storage/medicare-database-erd_94d6991a.png";

const patientTabs = [
  { label: "الرئيسية", path: "/", icon: LayoutDashboard },
  { label: "زياراتي", path: "/visits", icon: CalendarDays },
  { label: "التقارير", path: "/report", icon: FileText },
  { label: "الفواتير", path: "/invoice", icon: ReceiptText },
];

const timeline: Array<{ state: VisitState; time: string; title: string }> = [
  { state: "REQUESTED", time: "اليوم، 08:41 ص", title: "تم استلام طلب الزيارة" },
  { state: "ASSIGNED", time: "اليوم، 09:05 ص", title: "تم تعيين الفريق المناسب" },
  { state: "CONFIRMED", time: "اليوم، 09:12 ص", title: "تم تأكيد الموعد" },
  { state: "EN_ROUTE", time: "اليوم، 09:45 ص", title: "الفريق في الطريق" },
  { state: "ARRIVED", time: "بانتظار التحديث", title: "تم الوصول إلى العنوان" },
  { state: "IN_PROGRESS", time: "بانتظار التحديث", title: "بدأت الزيارة" },
  { state: "COMPLETED", time: "بانتظار الإقفال", title: "اكتملت الزيارة والتقرير" },
];

function Badge({ state }: { state: VisitState }) {
  const meta = visitStateMeta[state];
  return <span className={`badge badge-${meta.tone}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{meta.label}</span>;
}

function Logo() {
  return <div className="brand-mark"><span className="brand-symbol"><HeartPulse size={19} /></span><span>MediCare <b>Pro</b></span></div>;
}

function TopBar({ path, navigate, role, setRole }: { path: string; navigate: (to: string) => void; role: Role; setRole: (role: Role) => void }) {
  return <header className="topbar"><div className="shell topbar-inner">
    <button aria-label="العودة للرئيسية" onClick={() => navigate("/")}><Logo /></button>
    <nav className="nav-list" aria-label="التنقل الرئيسي">
      {patientTabs.map(item => <button className={`nav-item ${path === item.path ? "active" : ""}`} key={item.path} onClick={() => navigate(item.path)}>{item.label}</button>)}
      <button className={`nav-item ${path.startsWith("/operations") || path === "/team" ? "active" : ""}`} onClick={() => navigate(role === "staff" ? "/team" : "/operations")}>لوحات التشغيل</button>
      <button className={`nav-item ${path === "/flow" || path === "/docs" ? "active" : ""}`} onClick={() => navigate("/flow")}>مركز المعرفة</button>
    </nav>
    <div className="flex items-center gap-2">
      <button className="outline-btn hidden sm:inline-flex" aria-label="الإشعارات" onClick={() => toast.info("لديك تحديث واحد على الزيارة")}> <Bell size={16} /> </button>
      <select className="role-chip" aria-label="تبديل الدور التجريبي" value={role} onChange={e => { const next = e.target.value as Role; setRole(next); navigate(next === "patient" ? "/" : next === "manager" ? "/operations" : "/team"); }}>
        <option value="patient">عرض المريض</option><option value="manager">مدير العيادة</option><option value="staff">الفريق الطبي</option>
      </select>
      <div className="hidden h-9 w-9 place-items-center rounded-full bg-[#dff1eb] text-sm font-bold text-[#0b776b] sm:grid">س</div>
    </div>
  </div></header>;
}

function MobileNav({ path, navigate }: { path: string; navigate: (path: string) => void }) {
  return <nav className="mobile-nav" aria-label="تنقل المريض على الهاتف">{patientTabs.map(item => { const Icon = item.icon; return <button className={path === item.path ? "active" : ""} onClick={() => navigate(item.path)} key={item.path}><Icon size={18}/><span>{item.label}</span></button>; })}</nav>;
}

function VisitRow({ onOpen, state = DEMO_VISIT.state }: { onOpen: () => void; state?: VisitState }) {
  return <div className="visit-row"><div className="visit-meta"><span className="visit-icon"><Stethoscope size={20}/></span><div><p className="visit-name">{DEMO_VISIT.serviceName}</p><p className="visit-sub">{DEMO_VISIT.scheduledLabel} · مرجع {DEMO_VISIT.reference}</p></div></div><div className="flex items-center gap-2"><Badge state={state}/><button className="outline-btn" onClick={onOpen}>التفاصيل</button></div></div>;
}

function PatientDashboard({ navigate, visitState }: { navigate: (to: string) => void; visitState: VisitState }) {
  const progress = progressForVisit(visitState);
  return <main className="shell">
    <section className="hero-grid">
      <div className="hero-card"><div className="relative z-10"><p className="eyebrow"><span className="h-2 w-2 rounded-full bg-[#86e4cb]"/>مساحة المريض الآمنة</p><h1 className="hero-title">مرحباً، سارة.<br/>الرعاية في مكانك وبإيقاعك.</h1><p className="hero-copy">احجز زيارة منزلية، تابع حالتها خطوة بخطوة، واطّلع على تقريرك وفاتورتك عند إتاحتهما.</p><button className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-bold text-[#0b776b] shadow-lg transition hover:-translate-y-0.5" onClick={() => navigate("/book")}>احجز زيارة منزلية <ArrowLeft size={17}/></button></div></div>
      <aside className="quick-card"><div><p className="text-sm font-bold text-[#31584f]">الزيارة القادمة</p><div className="mt-4 flex items-center justify-between gap-3"><div><p className="text-lg font-bold text-[#183f37]">طب عام في المنزل</p><p className="mt-1 text-sm text-[#6e8880]">الإثنين، 26 مايو · 10:00 ص</p></div><Badge state={visitState}/></div><div className="mt-5 h-2 overflow-hidden rounded-full bg-[#e7f0ed]"><div className="h-full rounded-full bg-[#0b776b] transition-all" style={{ width: `${progress}%` }}/></div><p className="mt-2 text-xs text-[#678279]">اكتمل {progress}% من مسار الزيارة</p></div><button className="outline-btn mt-6 w-full" onClick={() => navigate("/visit/V-1024")}>متابعة الزيارة</button></aside>
    </section>
    <section className="metric-grid" aria-label="ملخص المريض"><div className="metric-card"><span className="metric-label">زيارات قادمة</span><span className="metric-value">1</span></div><div className="metric-card"><span className="metric-label">تقارير متاحة</span><span className="metric-value">2</span></div><div className="metric-card"><span className="metric-label">فواتير مفتوحة</span><span className="metric-value">1</span></div><div className="metric-card"><span className="metric-label">الإشعارات</span><span className="metric-value">3</span></div></section>
    <section className="content-grid"><div className="panel"><div className="section-head"><div><h2 className="section-title">زياراتي</h2><p className="section-copy">تحديثات المسار تظهر هنا بصورة مبسطة.</p></div><button className="outline-btn" onClick={() => navigate("/visits")}>عرض الكل</button></div><VisitRow state={visitState} onOpen={() => navigate("/visit/V-1024")}/><div className="visit-row"><div className="visit-meta"><span className="visit-icon"><HeartPulse size={20}/></span><div><p className="visit-name">متابعة نتائج الزيارة</p><p className="visit-sub">الأربعاء 14 مايو · اكتملت</p></div></div><Badge state="COMPLETED"/></div></div>
      <div className="panel"><div className="section-head"><div><h2 className="section-title">وصول سريع</h2><p className="section-copy">كل ما تحتاجه في مكان واحد.</p></div></div><div className="grid grid-cols-2 gap-3"><button className="rounded-2xl border border-[#dbe9e4] p-4 text-right transition hover:bg-[#f1faf7]" onClick={() => navigate("/report")}><FileText className="text-[#0b776b]" size={19}/><p className="mt-4 text-sm font-bold text-[#31584f]">التقارير</p><span className="mt-1 block text-xs text-[#779087]">تقاريرك النهائية</span></button><button className="rounded-2xl border border-[#dbe9e4] p-4 text-right transition hover:bg-[#f1faf7]" onClick={() => navigate("/invoice")}><WalletCards className="text-[#0b776b]" size={19}/><p className="mt-4 text-sm font-bold text-[#31584f]">الفواتير</p><span className="mt-1 block text-xs text-[#779087]">مبالغ وحالات دفع</span></button></div></div>
    </section>
  </main>;
}

function BookingPage({ navigate }: { navigate: (to: string) => void }) {
  const [step, setStep] = useState(1); const [slot, setSlot] = useState("10:00 ص"); const [service, setService] = useState("طب عام");
  const steps = ["الخدمة", "الموعد", "العنوان", "المراجعة"];
  const advance = () => { if (step < 4) setStep(step + 1); else { toast.success("تم إنشاء طلب الزيارة برقم V-1027"); navigate("/visit/V-1024"); } };
  return <main className="shell page-wrap"><div className="page-header"><div><h1>حجز زيارة منزلية</h1><p>أكمل الخطوات الأربع لإنشاء طلبك. لن يتم تأكيد الموعد قبل مراجعة العيادة.</p></div><button className="outline-btn" onClick={() => navigate("/")}><ChevronLeft size={16}/> العودة</button></div>
    <div className="stepper">{steps.map((title,index) => <div className={`step ${step === index + 1 ? "current" : step > index + 1 ? "done" : ""}`} key={title}><span className="step-num">{step > index + 1 ? <Check size={13}/> : index + 1}</span>{title}</div>)}</div>
    <div className="booking-layout"><section className="panel form-card"><h2 className="section-title">{steps[step - 1]}</h2><p className="section-copy mb-6">{step === 1 ? "اختر التخصص والخدمة والعيادة المناسبة." : step === 2 ? "اختر وقتاً متاحاً للزيارة." : step === 3 ? "حدد عنوان الزيارة من عناوينك المحفوظة." : "راجع البيانات قبل إرسال الطلب."}</p>
      {step === 1 && <div className="form-grid"><label><span className="field-label">التخصص</span><select className="form-select" value={service} onChange={e => setService(e.target.value)}><option>طب عام</option><option>تمريض منزلي</option><option>متابعة مزمنة</option></select></label><label><span className="field-label">الخدمة</span><select className="form-select"><option>زيارة منزلية</option><option>متابعة عن بُعد</option></select></label><label className="sm:col-span-2"><span className="field-label">العيادة</span><select className="form-select"><option>عيادة الحياة — الرياض</option><option>عيادة الرعاية الأولى — الرياض</option></select></label></div>}
      {step === 2 && <div><div className="mb-5 flex items-center justify-between rounded-xl bg-[#f0f8f5] p-4"><div><p className="text-sm font-bold text-[#31584f]">الإثنين، 26 مايو</p><p className="mt-1 text-xs text-[#6c857d]">المواعيد المعروضة متاحة حالياً</p></div><CalendarDays className="text-[#0b776b]"/></div><div className="slot-grid">{["09:00 ص","10:00 ص","11:30 ص","01:00 م","02:30 م","04:00 م"].map(item => <button key={item} className={`slot ${slot === item ? "selected" : ""}`} onClick={() => setSlot(item)}>{item}</button>)}</div></div>}
      {step === 3 && <div className="grid gap-3"><button className="rounded-xl border-2 border-[#0b776b] bg-[#effaf6] p-4 text-right"><div className="flex items-center justify-between"><div><p className="font-bold text-[#285247]">المنزل</p><p className="mt-1 text-sm text-[#668179]">حي تجريبي · شارع النخيل</p></div><Check className="text-[#0b776b]"/></div></button><button className="rounded-xl border border-[#dbe9e4] p-4 text-right"><p className="font-bold text-[#46675f]">عنوان العمل</p><p className="mt-1 text-sm text-[#7b938b]">حي تجريبي · شارع الملك</p></button></div>}
      {step === 4 && <div className="rounded-2xl border border-[#dbe9e4] bg-[#fbfdfc] p-3"><div className="summary-line"><span>الخدمة</span><strong>{service} · زيارة منزلية</strong></div><div className="summary-line"><span>الموعد</span><strong>الإثنين 26 مايو · {slot}</strong></div><div className="summary-line"><span>العنوان</span><strong>المنزل · حي تجريبي</strong></div><div className="summary-line"><span>الحالة الأولية</span><strong>بانتظار مراجعة العيادة</strong></div></div>}
      <div className="mt-8 flex items-center justify-between gap-3"><button className="outline-btn" onClick={() => step === 1 ? navigate("/") : setStep(step - 1)}>{step === 1 ? "إلغاء" : "السابق"}</button><button className="primary-btn" onClick={advance}>{step === 4 ? "تأكيد الحجز" : "متابعة"}<ArrowLeft className="mr-2 inline" size={16}/></button></div>
    </section><aside className="panel h-max"><p className="text-sm font-bold text-[#31584f]">ملخص الحجز</p><div className="mt-4"><div className="summary-line"><span>العيادة</span><strong>عيادة الحياة</strong></div><div className="summary-line"><span>الخدمة</span><strong>{service}</strong></div><div className="summary-line"><span>المدة</span><strong>60 دقيقة</strong></div><div className="summary-line"><span>الوقت</span><strong>{step >= 2 ? slot : "اختر وقتاً"}</strong></div></div><p className="mt-5 rounded-xl bg-[#fff7e6] p-3 text-xs leading-6 text-[#8e670d]"><CircleHelp className="ml-1 inline" size={15}/> تظهر نتيجة الحجز بعد تحقق الخادم من الإتاحة. هذه نسخة عرض تستخدم بيانات تجريبية آمنة.</p></aside></div>
  </main>;
}

function VisitDetails({ navigate, visitState, setVisitState }: { navigate: (to: string) => void; visitState: VisitState; setVisitState: (state: VisitState) => void }) {
  const index = timeline.findIndex(item => item.state === visitState); const cancellable = ["REQUESTED","ASSIGNED","CONFIRMED"].includes(visitState);
  return <main className="shell page-wrap"><div className="page-header"><div><div className="flex items-center gap-2"><h1>تفاصيل الزيارة</h1><Badge state={visitState}/></div><p>مرجع V-1024 · آخر تحديث قبل دقائق قليلة</p></div><button className="outline-btn" onClick={() => navigate("/visits")}><ChevronLeft size={16}/> زياراتي</button></div>
    <div className="visit-layout"><section className="grid gap-5"><div className="panel"><div className="flex items-start justify-between gap-4"><div><p className="text-lg font-bold text-[#254c43]">طب عام في المنزل</p><p className="mt-2 text-sm text-[#6d877e]">الإثنين، 26 مايو · 10:00 ص — 11:00 ص</p></div><span className="visit-icon"><Stethoscope size={20}/></span></div><div className="mt-5 grid grid-cols-2 gap-3 rounded-xl bg-[#f6faf8] p-4 text-sm"><div><span className="text-[#7b938b]">العيادة</span><p className="mt-1 font-bold text-[#31584f]">عيادة الحياة</p></div><div><span className="text-[#7b938b]">العنوان</span><p className="mt-1 font-bold text-[#31584f]">حي تجريبي · الرياض</p></div></div>{cancellable && <button className="mt-5 text-sm font-bold text-[#b42318] underline underline-offset-4" onClick={() => { setVisitState("CANCELLED"); toast.success("تم إرسال طلب الإلغاء بنجاح"); }}>إلغاء الزيارة</button>}</div>
      <div className="map-card"><div className="map-grid"/><div className="map-route"/><span className="map-pin patient"><MapPin size={18}/></span><span className="map-pin team"><Stethoscope size={17}/></span><div className="absolute bottom-4 right-4 rounded-xl bg-white/95 p-3 text-xs shadow-sm"><p className="font-bold text-[#31584f]">تتبع محدود وآمن</p><span className="text-[#718980]">يظهر عند السماح وحالة «في الطريق»</span></div></div></section>
      <aside className="panel"><p className="text-sm font-bold text-[#31584f]">مسار الزيارة</p><div className="timeline mt-5">{timeline.map((item,i) => <div className={`timeline-item ${i < index ? "done" : i === index ? "current" : ""}`} key={item.state}><span className="timeline-dot">{i <= index ? <Check size={13}/> : <span className="h-1.5 w-1.5 rounded-full bg-current"/>}</span><div className="timeline-copy"><p className="timeline-title">{item.title}</p><p className="timeline-time">{i <= index ? item.time : "خطوة لاحقة"}</p></div></div>)}</div></aside></div>
    <section className="mt-5 grid gap-5 md:grid-cols-2"><div className="panel"><div className="flex items-center justify-between"><div><p className="font-bold text-[#31584f]">التقرير الطبي</p><p className="mt-1 text-sm text-[#718980]">{visitState === "COMPLETED" ? "التقرير النهائي جاهز للعرض" : "يتاح التقرير بعد إقفال الزيارة"}</p></div><FileText className="text-[#0b776b]"/></div><button className="outline-btn mt-5" disabled={visitState !== "COMPLETED"} onClick={() => navigate("/report")}>عرض التقرير</button></div><div className="panel"><div className="flex items-center justify-between"><div><p className="font-bold text-[#31584f]">الفاتورة</p><p className="mt-1 text-sm text-[#718980]">فاتورة الزيارة تصدر بعد اكتمال الخدمة.</p></div><ReceiptText className="text-[#0b776b]"/></div><button className="outline-btn mt-5" disabled={visitState !== "COMPLETED"} onClick={() => navigate("/invoice")}>عرض الفاتورة</button></div></section>
  </main>;
}

function VisitsPage({ navigate, visitState }: { navigate: (to: string) => void; visitState: VisitState }) { return <main className="shell page-wrap"><div className="page-header"><div><h1>زياراتي</h1><p>قائمة مبسطة للزيارات والحالات المحفوظة في الحساب التجريبي.</p></div><button className="primary-btn" onClick={() => navigate("/book")}>حجز زيارة <ArrowLeft className="mr-2 inline" size={16}/></button></div><section className="panel"><VisitRow state={visitState} onOpen={() => navigate("/visit/V-1024")}/><div className="visit-row"><div className="visit-meta"><span className="visit-icon"><Stethoscope size={20}/></span><div><p className="visit-name">متابعة ما بعد الزيارة</p><p className="visit-sub">الأربعاء 14 مايو · مرجع V-1008</p></div></div><div className="flex gap-2"><Badge state="COMPLETED"/><button className="outline-btn" onClick={() => navigate("/report")}>التقرير</button></div></div><div className="visit-row"><div className="visit-meta"><span className="visit-icon"><Stethoscope size={20}/></span><div><p className="visit-name">زيارة تمريض منزلي</p><p className="visit-sub">الإثنين 05 مايو · مرجع V-0994</p></div></div><Badge state="CANCELLED"/></div></section></main>; }

function LockedOutput({ title, description, navigate }: { title: string; description: string; navigate: (to: string) => void }) { return <main className="shell page-wrap"><div className="page-header"><div><h1>{title}</h1><p>يحمي النظام محتوى الزيارة ولا يعرضه قبل اكتمال الشروط اللازمة.</p></div><button className="outline-btn" onClick={() => navigate("/visit/V-1024")}>تفاصيل الزيارة</button></div><section className="panel mx-auto max-w-2xl py-12 text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#eef8f4] text-[#0b776b]"><ShieldCheck size={27}/></span><h2 className="mt-5 text-xl font-bold text-[#285047]">المحتوى غير متاح بعد</h2><p className="mx-auto mt-3 max-w-md text-sm leading-7 text-[#6a857c]">{description}</p><button className="primary-btn mt-6" onClick={() => navigate("/visit/V-1024")}>متابعة حالة الزيارة</button></section></main>; }

function ReportPage({ navigate, canRead }: { navigate: (to: string) => void; canRead: boolean }) { if (!canRead) return <LockedOutput title="التقارير الطبية" description="يصبح التقرير متاحاً بعد اكتمال الزيارة وإقفاله من الفريق المخول." navigate={navigate}/>; return <main className="shell page-wrap"><div className="page-header"><div><h1>التقارير الطبية</h1><p>تعرض التقارير النهائية فقط للمريض صاحب الزيارة.</p></div><button className="outline-btn" onClick={() => navigate("/visits")}>الزيارات</button></div><section className="panel max-w-4xl"><div className="flex items-start justify-between gap-4 border-b border-[#e6efeb] pb-5"><div><span className="badge badge-success">نهائي</span><h2 className="mt-3 text-xl font-bold text-[#264e45]">تقرير متابعة الزيارة المنزلية</h2><p className="mt-1 text-sm text-[#728b83]">الزيارة V-1008 · 14 مايو · عيادة الحياة</p></div><FileText className="text-[#0b776b]" size={25}/></div><div className="grid gap-4 py-6 text-sm leading-8 text-[#46665e]"><div><h3 className="font-bold text-[#2f564c]">ملخص الزيارة</h3><p className="mt-1">هذه بيانات عرض آمنة لتوضيح مكان التقرير النهائي. في بيئة الإنتاج، يُحمّل المحتوى عند الحاجة فقط ولا يخزّن في المتصفح.</p></div><div><h3 className="font-bold text-[#2f564c]">التوصيات</h3><p className="mt-1">يمكن للفريق المخول إضافة توصيات متابعة منظمة بحسب سياسة العيادة. لا تحل هذه الصفحة محل الطوارئ أو المشورة الطبية الفورية.</p></div></div><div className="rounded-xl bg-[#eff9f5] p-4 text-sm text-[#387061]"><ShieldCheck className="ml-2 inline" size={17}/> هذا التقرير ظاهر ضمن نطاق المريض المصرح فقط.</div></section></main>; }

function InvoicePage({ navigate, canRead }: { navigate: (to: string) => void; canRead: boolean }) { if (!canRead) return <LockedOutput title="الفواتير" description="تصدر الفاتورة بعد اكتمال الخدمة، ثم تظهر لك ضمن حسابك المصرح فقط." navigate={navigate}/>; return <main className="shell page-wrap"><div className="page-header"><div><h1>الفواتير</h1><p>تظهر ملخصات مالية منفصلة عن التقرير السريري.</p></div><button className="outline-btn" onClick={() => navigate("/visits")}>الزيارات</button></div><section className="panel max-w-4xl"><div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#e6efeb] pb-5"><div><span className="badge badge-warning">بانتظار السداد التجريبي</span><h2 className="mt-3 text-xl font-bold text-[#264e45]">فاتورة INV-2026-042</h2><p className="mt-1 text-sm text-[#728b83]">زيارة طب عام في المنزل · V-1008</p></div><ReceiptText className="text-[#0b776b]" size={25}/></div><div className="py-5"><div className="summary-line"><span>زيارة منزلية — طب عام</span><strong>250 ر.س</strong></div><div className="summary-line"><span>رسوم خدمة</span><strong>20 ر.س</strong></div><div className="summary-line"><span>الإجمالي</span><strong>270 ر.س</strong></div></div><div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f6faf8] p-4"><span className="text-sm text-[#53726a]">الدفع هنا للعرض فقط. لا يتم جمع بيانات دفع حقيقية.</span><button className="primary-btn" onClick={() => toast.success("تم تسجيل نتيجة دفع تجريبية")}>سداد تجريبي</button></div></section></main>; }

function OperationsSidebar({ active, setActive }: { active: Role; setActive: (role: Role) => void }) { const links = [{ role:"manager" as Role, label:"لوحة مدير العيادة", icon: LayoutDashboard },{ role:"staff" as Role, label:"مهامي كفريق طبي", icon: Stethoscope },{ role:"patient" as Role, label:"عرض المريض", icon: UserRound }]; return <aside className="panel ops-sidebar">{links.map(link => { const Icon = link.icon; return <button key={link.role} className={`ops-nav ${active === link.role ? "active" : ""}`} onClick={() => setActive(link.role)}><Icon size={17}/>{link.label}</button>; })}<div className="mt-3 border-t border-[#e5efeb] pt-3"><p className="px-2 text-xs font-bold text-[#839890]">سياق التشغيل</p><div className="mt-2 rounded-xl bg-[#eff9f5] p-3 text-xs text-[#3a7063]"><ShieldCheck className="ml-1 inline" size={15}/> عيادة الحياة · وصول حسب الدور</div></div></aside>; }

function OperationsPage({ role, setRole, visitState, setVisitState, navigate }: { role: Role; setRole: (role: Role) => void; visitState: VisitState; setVisitState: (state: VisitState) => void; navigate: (to: string) => void }) {
  const isStaff = role === "staff"; const next = nextVisitState(visitState);
  return <main className="shell page-wrap"><div className="page-header"><div><h1>{isStaff ? "مهامي الميدانية" : "لوحة تشغيل العيادة"}</h1><p>{isStaff ? "تحديثات مضبوطة حسب التعيين وحالة الزيارة." : "إدارة الطلبات والتعيينات ضمن نطاق العيادة النشطة."}</p></div><button className="outline-btn" onClick={() => navigate("/flow")}><Network size={16}/> تدفق البيانات</button></div><div className="ops-layout"><OperationsSidebar active={role} setActive={nextRole => { setRole(nextRole); navigate(nextRole === "patient" ? "/" : nextRole === "staff" ? "/team" : "/operations"); }}/><section className="ops-main">{isStaff ? <><div className="metric-grid"><div className="metric-card"><span className="metric-label">مهامي اليوم</span><span className="metric-value">3</span></div><div className="metric-card"><span className="metric-label">في الطريق</span><span className="metric-value">1</span></div><div className="metric-card"><span className="metric-label">مكتملة</span><span className="metric-value">2</span></div><div className="metric-card"><span className="metric-label">تحتاج قبولاً</span><span className="metric-value">0</span></div></div><div className="panel mt-5"><div className="section-head"><div><h2 className="section-title">التكليف الحالي</h2><p className="section-copy">V-1024 · طب عام في المنزل</p></div><Badge state={visitState}/></div><div className="grid gap-4 md:grid-cols-2"><div className="rounded-2xl bg-[#f5faf8] p-4"><p className="text-xs text-[#789188]">الإجراء المتاح الآن</p><p className="mt-2 font-bold text-[#2a5148]">{next ? `تحديث الحالة إلى: ${visitStateMeta[next].label}` : "لا توجد انتقالات أخرى"}</p><button className="primary-btn mt-4" disabled={!next} onClick={() => { if (next) { setVisitState(next); toast.success(`تم تحديث حالة الزيارة إلى ${visitStateMeta[next].label}`); } }}>{next ? "تحديث الحالة" : "اكتملت المهمة"}</button></div><div className="rounded-2xl border border-[#dbe9e4] p-4"><p className="text-xs text-[#789188]">صلاحيات الواجهة</p><ul className="mt-3 grid gap-2 text-sm text-[#4a6c63]"><li><Check className="ml-1 inline text-[#0b776b]" size={15}/> عرض الزيارات المكلف بها فقط</li><li><Check className="ml-1 inline text-[#0b776b]" size={15}/> تحديث الحالة وفق المسار</li><li><span className="ml-1 inline-block h-2 w-2 rounded-full bg-[#c8972b]"/> لا يصدر الفاتورة أو يقرأ فواتير غيره</li></ul></div></div></div></> : <><div className="metric-grid"><div className="metric-card"><span className="metric-label">طلبات جديدة</span><span className="metric-value">8</span></div><div className="metric-card"><span className="metric-label">زيارات اليوم</span><span className="metric-value">14</span></div><div className="metric-card"><span className="metric-label">في الطريق</span><span className="metric-value">3</span></div><div className="metric-card"><span className="metric-label">مكتملة</span><span className="metric-value">11</span></div></div><div className="panel mt-5"><div className="section-head"><div><h2 className="section-title">طلبات تحتاج إلى تعيين</h2><p className="section-copy">بيانات تجريبية آمنة ضمن عيادة الحياة.</p></div><button className="outline-btn" onClick={() => toast.info("التصفية حسب الخدمة ستتوفر عند ربط البيانات الحقيقية")}> <Search className="ml-1 inline" size={15}/> تصفية</button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>رقم الزيارة</th><th>الخدمة</th><th>الموعد</th><th>الحالة</th><th>الإجراء</th></tr></thead><tbody><tr><td className="font-bold">V-1028</td><td>تمريض منزلي</td><td>26 مايو · 11:30 ص</td><td><Badge state="REQUESTED"/></td><td><button className="outline-btn" onClick={() => toast.success("تم تعيين د. رامي للزيارة V-1028")}>تعيين فريق</button></td></tr><tr><td className="font-bold">V-1029</td><td>متابعة مزمنة</td><td>26 مايو · 01:00 م</td><td><Badge state="REQUESTED"/></td><td><button className="outline-btn" onClick={() => toast.success("تم تعيين الفريق التجريبي")}>تعيين فريق</button></td></tr></tbody></table></div></div></>}</section></div></main>;
}

function FlowPage({ navigate }: { navigate: (to: string) => void }) { const [active, setActive] = useState("المريض"); const nodes = ["المريض","واجهة الويب","API الآمن","RBAC + JWT","قاعدة البيانات مع RLS","العيادة والفريق","التقرير والفاتورة"]; return <main className="shell page-wrap"><div className="page-header"><div><h1>دورة الزيارة وتدفق البيانات</h1><p>عرض تفاعلي مبسط يربط المسار التشغيلي بطبقات الحماية.</p></div><button className="outline-btn" onClick={() => navigate("/docs")}><BookOpen size={16}/> مركز الوثائق</button></div><div className="flow-layout"><aside className="panel"><p className="text-sm font-bold text-[#31584f]">استكشف المراحل</p><div className="flow-list mt-4">{nodes.map(node => <button key={node} className={`flow-node ${active === node ? "active" : ""}`} onClick={() => setActive(node)}>{node}</button>)}</div></aside><section className="panel flow-canvas"><div className="flow-route">{nodes.map((node,index) => <div key={node}><div className={`flow-box ${active === node ? "active" : ""}`}><span className="ml-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#e7f6f1] text-xs text-[#0b776b]">{index + 1}</span>{node}{node === "RBAC + JWT" && <span className="float-left text-xs font-normal text-[#0b776b]">تحقق من الهوية والصلاحية</span>}{node === "قاعدة البيانات مع RLS" && <span className="float-left text-xs font-normal text-[#0b776b]">عزل صفوف البيانات</span>}</div>{index < nodes.length - 1 && <div className="flow-arrow">↓</div>}</div>)}</div><div className="security-strip"><span className="security-token"><ShieldCheck className="ml-1 inline" size={14}/>RBAC</span><span className="security-token"><ShieldCheck className="ml-1 inline" size={14}/>JWT قصير العمر</span><span className="security-token"><ShieldCheck className="ml-1 inline" size={14}/>RLS</span><span className="security-token"><ShieldCheck className="ml-1 inline" size={14}/>سجل تدقيق</span></div></section></div></main>; }

function DocsPage() { const docs = [{ id:"dfd", type:"DFD", title:"مخطط تدفق البيانات", desc:"المستوى التفصيلي للكيانات والعمليات ومخازن البيانات.", src:DFD_URL },{ id:"seq", type:"SEQUENCE", title:"مخطط تسلسل الزيارة", desc:"من الحجز حتى التقرير والفاتورة والإشعار.", src:SEQUENCE_URL },{ id:"erd", type:"ERD", title:"مخطط قاعدة البيانات", desc:"الكيانات والعلاقات المرتبطة بمسار المريض.", src:ERD_URL },{ id:"security", type:"SECURITY", title:"الأمن والصلاحيات", desc:"RBAC وJWT وRLS وسجل التدقيق.", src:"" },{ id:"test", type:"TESTING", title:"خطة اختبار UI/UX", desc:"حالات UI والوصول وتجربة المستخدم.", src:"" },{ id:"design", type:"DESIGN SYSTEM", title:"نظام التصميم", desc:"Tokens ومكتبة المكونات وقواعد الاستجابة.", src:"" }]; const [selected,setSelected] = useState(docs[0]); return <main className="shell page-wrap"><div className="page-header"><div><h1>مركز الوثائق</h1><p>المخططات والوثائق الهندسية التي تدعم المشروع في مكان واحد.</p></div><a className="primary-btn inline-flex items-center" href={PACKAGE_URL} download><Download className="ml-2" size={16}/> تنزيل حزمة المشروع</a></div><section className="doc-grid">{docs.map(doc => <button key={doc.id} className={`panel doc-card ${selected.id === doc.id ? "ring-2 ring-[#0b776b]/20" : ""}`} onClick={() => setSelected(doc)}><div className="doc-thumb">{doc.src ? <img src={doc.src} alt={`معاينة ${doc.title}`} /> : <FileText className="doc-thumb-icon" size={38}/>}</div><div className="doc-body"><span className="doc-type">{doc.type}</span><h3>{doc.title}</h3><p>{doc.desc}</p></div></button>)}</section><section className="panel preview-panel"><div className="section-head"><div><h2 className="section-title">معاينة: {selected.title}</h2><p className="section-copy">{selected.desc}</p></div><MoreHorizontal className="text-[#789188]"/></div>{selected.src ? <img className="preview-image" src={selected.src} alt={`المعاينة الكبيرة لـ ${selected.title}`} /> : <div className="rounded-2xl bg-[#f6faf8] p-9 text-center text-sm text-[#6b867d]"><FileText className="mx-auto mb-3 text-[#0b776b]" size={33}/><p>يتوفر هذا المستند ضمن حزمة المشروع المضغوطة.</p><a className="mt-4 inline-flex text-sm font-bold text-[#0b776b] underline" href={PACKAGE_URL} download>تنزيل الحزمة</a></div>}</section></main>; }

export default function Home() {
  const [location, setLocation] = useLocation(); const [role,setRole] = useState<Role>("patient"); const [visitState,setVisitState] = useState<VisitState>("EN_ROUTE");
  const path = location === "/" ? "/" : location.replace(/\/$/, ""); const navigate = (to:string) => setLocation(to);
  const page = useMemo(() => {
    if (path === "/book") return <BookingPage navigate={navigate}/>;
    if (path.startsWith("/visit/")) return <VisitDetails navigate={navigate} visitState={visitState} setVisitState={setVisitState}/>;
    if (path === "/visits") return <VisitsPage navigate={navigate} visitState={visitState}/>;
    if (path === "/report") return <ReportPage navigate={navigate} canRead={canReadPatientVisitOutput(visitState)}/>;
    if (path === "/invoice") return <InvoicePage navigate={navigate} canRead={canReadPatientVisitOutput(visitState)}/>;
    if (path === "/operations" || path === "/team") return <OperationsPage role={path === "/team" ? "staff" : role === "patient" ? "manager" : role} setRole={setRole} navigate={navigate} visitState={visitState} setVisitState={setVisitState}/>;
    if (path === "/flow") return <FlowPage navigate={navigate}/>;
    if (path === "/docs") return <DocsPage/>;
    return <PatientDashboard navigate={navigate} visitState={visitState}/>;
  }, [path, role, visitState]);
  return <div className="app-canvas" dir="rtl"><TopBar path={path} navigate={navigate} role={role} setRole={setRole}/>{page}<MobileNav path={path} navigate={navigate}/></div>;
}
