import { Bell, Check, ShieldCheck } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { trpc } from "@/lib/trpc";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useMemo, useState } from "react";
import {
  filterManagerNotifications,
  sortManagerNotifications,
  type ManagerNotificationFilter,
  type ManagerNotificationSort,
} from "./managerNotificationFilter";

function signedValue(value: number, suffix = "") {
  if (value === 0) return `0${suffix}`;
  return `${value > 0 ? "+" : ""}${value}${suffix}`;
}

const trendChartConfig = {
  acknowledgementRate: { label: "نسبة التأكيد", color: "#0b776b" },
} satisfies ChartConfig;

function formatUtcDayLabel(date: string) {
  return new Intl.DateTimeFormat("ar-SA-u-ca-gregory", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00.000Z`));
}

export function ManagerNotificationCenter({ navigate }: { navigate: (to: string) => void }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const notifications = trpc.notifications.listMine.useQuery(undefined, { enabled: isAuthenticated });
  const [reportDays, setReportDays] = useState<7 | 30 | 90>(30);
  const report = trpc.notifications.responseReport.useQuery({ days: reportDays }, { enabled: isAuthenticated });
  const comparison = trpc.notifications.responseComparison.useQuery({ days: reportDays }, { enabled: isAuthenticated });
  const trend = trpc.notifications.responseTrend.useQuery({ days: reportDays }, { enabled: isAuthenticated });
  const csv = trpc.notifications.exportResponseCsv.useQuery({ days: reportDays }, { enabled: false });
  const [filter, setFilter] = useState<ManagerNotificationFilter>("ALL");
  const [sort, setSort] = useState<ManagerNotificationSort>("PENDING_FIRST");

  const refresh = () => {
    utils.notifications.listMine.invalidate();
    utils.notifications.responseReport.invalidate();
    utils.notifications.responseComparison.invalidate();
    utils.notifications.responseTrend.invalidate();
    utils.audit.listOperations.invalidate();
  };

  const acknowledge = trpc.notifications.acknowledge.useMutation({
    onSuccess: () => {
      toast.success("تم تأكيد الاطلاع.");
      refresh();
    },
    onError: () => toast.error("تعذر تأكيد الإشعار."),
  });
  const acknowledgeAll = trpc.notifications.acknowledgeAll.useMutation({
    onSuccess: ({ acknowledgedCount }) => {
      toast.success(acknowledgedCount ? `تم تأكيد ${acknowledgedCount} إشعاراً.` : "لا توجد إشعارات غير مؤكدة.");
      refresh();
    },
    onError: () => toast.error("تعذر تأكيد الإشعارات."),
  });
  const downloadCsv = async () => {
    const result = await csv.refetch();
    if (!result.data) return toast.error("تعذر إعداد ملف CSV.");
    const url = URL.createObjectURL(new Blob([result.data.content], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = result.data.filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const all = notifications.data ?? [];
  const unread = report.data?.pending ?? all.filter(item => !item.acknowledgedAt).length;
  const items = useMemo(() => sortManagerNotifications(filterManagerNotifications(all, filter), sort), [all, filter, sort]);
  const comparisonData = comparison.data;
  const trendData = useMemo(() => (trend.data ?? []).map(point => ({ ...point, label: formatUtcDayLabel(point.date) })), [trend.data]);
  const trendTotals = useMemo(() => trendData.reduce((totals, point) => ({ total: totals.total + point.total, pending: totals.pending + point.pending }), { total: 0, pending: 0 }), [trendData]);

  if (!isAuthenticated) {
    return <main className="shell page-wrap"><section className="panel mx-auto max-w-2xl py-12 text-center"><ShieldCheck className="mx-auto text-[#0b776b]" size={34}/><h1 className="mt-4 text-xl font-bold text-[#31584f]">مركز إشعارات محمي</h1><p className="mt-3 text-sm text-[#6b867e]">سجّل الدخول بحساب مدير لعرض الإشعارات.</p><button className="primary-btn mt-6" onClick={startLogin}>تسجيل الدخول</button></section></main>;
  }

  if (notifications.isError) {
    return <main className="shell page-wrap"><section className="panel mx-auto max-w-2xl py-12 text-center"><ShieldCheck className="mx-auto text-[#0b776b]" size={34}/><h1 className="mt-4 text-xl font-bold text-[#31584f]">وصول المدير مطلوب</h1><button className="outline-btn mt-6" onClick={() => navigate("/")}>الرئيسية</button></section></main>;
  }

  return <main className="shell page-wrap">
    <div className="page-header">
      <div><h1>مركز الإشعارات</h1><p>تنبيهات داخل التطبيق للزيارات المتأخرة في عيادات المدير.</p></div>
      <button className="outline-btn" onClick={() => navigate("/operations")}>لوحة التشغيل</button>
    </div>

    <section className="metric-grid">
      <div className="metric-card"><span className="metric-label">غير مؤكدة</span><span className="metric-value">{unread}</span></div>
      <div className="metric-card"><span className="metric-label">نسبة التأكيد</span><span className="metric-value">{report.data?.acknowledgementRate ?? 0}%</span></div>
      <div className="metric-card"><span className="metric-label">متوسط الاستجابة</span><span className="metric-value">{report.data?.averageResponseMinutes ?? "—"}</span></div>
      <div className="metric-card"><span className="metric-label">نتائج المرشح</span><span className="metric-value">{items.length}</span></div>
    </section>

    <section className="panel mt-5" aria-labelledby="response-comparison-title">
      <div className="section-head">
        <div>
          <h2 id="response-comparison-title" className="section-title">مقارنة مع الفترة السابقة المناظرة</h2>
          <p className="section-copy">تتم مقارنة آخر {reportDays} يوماً بالفترة السابقة ذات الطول نفسه ضمن الإشعارات المتاحة للمدير.</p>
        </div>
        <span className="badge">مقارنة {reportDays} يوماً</span>
      </div>

      {comparison.isLoading && <p className="py-5 text-sm text-[#6f887f]">جارٍ إعداد المقارنة الزمنية…</p>}
      {comparison.isError && <p className="mt-4 rounded-2xl bg-[#fff5e9] p-4 text-sm text-[#9a5e16]">تعذر تحميل المقارنة الآن. تبقى قائمة الإشعارات ومؤشرات الفترة الحالية متاحة.</p>}
      {!comparison.isLoading && !comparison.isError && comparisonData && <div className="mt-5 grid gap-3 lg:grid-cols-2">
        <article className="rounded-2xl border border-[#dbe9e4] bg-[#fbfefd] p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-[#31584f]">نسبة التأكيد</h3><span className="text-xs text-[#6b867e]">نقطة مئوية</span></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white p-3"><dt className="text-[#6b867e]">الفترة الحالية</dt><dd className="mt-1 text-xl font-bold text-[#31584f]">{comparisonData.current.acknowledgementRate}%</dd></div>
            <div className="rounded-xl bg-white p-3"><dt className="text-[#6b867e]">الفترة السابقة</dt><dd className="mt-1 text-xl font-bold text-[#31584f]">{comparisonData.previous.acknowledgementRate}%</dd></div>
          </dl>
          <p className={`mt-4 text-sm font-semibold ${comparisonData.acknowledgementRateDelta > 0 ? "text-[#0b776b]" : comparisonData.acknowledgementRateDelta < 0 ? "text-[#a75524]" : "text-[#6b867e]"}`}>الفرق: {signedValue(comparisonData.acknowledgementRateDelta, " نقطة مئوية")}</p>
        </article>
        <article className="rounded-2xl border border-[#dbe9e4] bg-[#fbfefd] p-5">
          <div className="flex items-center justify-between gap-3"><h3 className="font-bold text-[#31584f]">الإشعارات غير المؤكدة</h3><span className="text-xs text-[#6b867e]">عدد الإشعارات</span></div>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white p-3"><dt className="text-[#6b867e]">الفترة الحالية</dt><dd className="mt-1 text-xl font-bold text-[#31584f]">{comparisonData.current.pending}</dd></div>
            <div className="rounded-xl bg-white p-3"><dt className="text-[#6b867e]">الفترة السابقة</dt><dd className="mt-1 text-xl font-bold text-[#31584f]">{comparisonData.previous.pending}</dd></div>
          </dl>
          <p className={`mt-4 text-sm font-semibold ${comparisonData.pendingDelta < 0 ? "text-[#0b776b]" : comparisonData.pendingDelta > 0 ? "text-[#a75524]" : "text-[#6b867e]"}`}>الفرق: {signedValue(comparisonData.pendingDelta)}</p>
        </article>
      </div>}
      {!comparison.isLoading && !comparison.isError && !comparisonData && <p className="py-5 text-sm text-[#6f887f]">لا تتوفر بيانات مقارنة للفترة المختارة.</p>}
      <p className="mt-4 text-xs leading-6 text-[#6b867e]">الفروق وصفية وليست معياراً طبياً. تغطي المقارنة آخر 30 إشعاراً فقط ولا تعرض عناوين الإشعارات أو رسائلها في التصدير.</p>
    </section>

    <section className="panel mt-5" aria-labelledby="response-trend-title">
      <div className="section-head">
        <div>
          <h2 id="response-trend-title" className="section-title">اتجاه الاستجابة اليومي</h2>
          <p className="section-copy">نسبة التأكيد لكل يوم من آخر {reportDays} يوماً؛ تُعرض الأيام بالتوقيت العالمي UTC لتوحيد التجميع.</p>
        </div>
        <span className="badge">اتجاه {reportDays} يوماً</span>
      </div>

      {trend.isLoading && <p className="py-5 text-sm text-[#6f887f]">جارٍ إعداد الاتجاه اليومي…</p>}
      {trend.isError && <p className="mt-4 rounded-2xl bg-[#fff5e9] p-4 text-sm text-[#9a5e16]">تعذر تحميل الاتجاه اليومي الآن. تبقى المؤشرات والمقارنة الزمنية متاحة.</p>}
      {!trend.isLoading && !trend.isError && <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-2xl border border-[#dbe9e4] bg-[#fbfefd] p-4">
          <ChartContainer config={trendChartConfig} className="h-60 w-full aspect-auto" dir="ltr">
            <BarChart data={trendData} margin={{ top: 12, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} minTickGap={18} />
              <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} width={38} />
              <ChartTooltip cursor={{ fill: "#e7f6f1" }} content={<ChartTooltipContent />} />
              <Bar dataKey="acknowledgementRate" fill="var(--color-acknowledgementRate)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-1">
          <div className="rounded-2xl bg-[#f5faf8] p-4"><dt className="text-xs text-[#6b867e]">إشعارات الفترة</dt><dd className="mt-2 text-2xl font-bold text-[#31584f]">{trendTotals.total}</dd></div>
          <div className="rounded-2xl bg-[#fffaf0] p-4"><dt className="text-xs text-[#6b867e]">غير مؤكدة بالفترة</dt><dd className="mt-2 text-2xl font-bold text-[#31584f]">{trendTotals.pending}</dd></div>
          <div className="col-span-2 rounded-2xl border border-[#dbe9e4] bg-white p-4 text-xs leading-6 text-[#6b867e] lg:col-span-1">اليوم الذي لا يحتوي إشعاراً يظهر عند 0% للحفاظ على تسلسل الأيام؛ الرسم وصفي ولا يستنتج معياراً طبياً.</div>
        </dl>
      </div>}
    </section>

    <section className="panel mt-5">
      <div className="section-head">
        <div><h2 className="section-title">التنبيهات الأخيرة</h2><p className="section-copy">القائمة مقيدة بخادمياً بعيادات المدير.</p></div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="field-label text-xs">فترة التقرير<select className="field-input mt-1 min-w-28" value={reportDays} onChange={e => setReportDays(Number(e.target.value) as 7 | 30 | 90)}><option value={7}>7 أيام</option><option value={30}>30 يوماً</option><option value={90}>90 يوماً</option></select></label>
          <label className="field-label text-xs">الحالة<select className="field-input mt-1 min-w-32" value={filter} onChange={e => setFilter(e.target.value as ManagerNotificationFilter)}><option value="ALL">كل الإشعارات</option><option value="PENDING">غير مؤكدة</option><option value="ACKNOWLEDGED">مؤكدة</option></select></label>
          <label className="field-label text-xs">الترتيب<select className="field-input mt-1 min-w-32" value={sort} onChange={e => setSort(e.target.value as ManagerNotificationSort)}><option value="PENDING_FIRST">غير المؤكدة أولاً</option><option value="NEWEST">الأحدث أولاً</option><option value="OLDEST">الأقدم أولاً</option></select></label>
          <button className="outline-btn" disabled={csv.isFetching} onClick={downloadCsv}>{csv.isFetching ? "جارٍ إعداد CSV…" : "تنزيل مؤشرات CSV"}</button>
          <button className="outline-btn" disabled={!unread || acknowledgeAll.isPending} onClick={() => acknowledgeAll.mutate()}><Check className="ml-1" size={15}/>{acknowledgeAll.isPending ? "جارٍ التأكيد…" : `تأكيد الكل (${unread})`}</button>
        </div>
      </div>
      {notifications.isLoading ? <p className="py-5 text-sm text-[#6f887f]">جارٍ التحميل…</p> : <div className="grid gap-3">
        {items.map(item => <article key={item.id} className={`rounded-2xl border p-5 ${item.acknowledgedAt ? "border-[#dbe9e4] bg-[#fbfefd]" : "border-[#f4d5a8] bg-[#fffaf0]"}`}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#e7f6f1] text-[#0b776b]"><Bell size={18}/></span><div><h3 className="font-bold text-[#31584f]">{item.title}</h3><p className="mt-1 text-sm text-[#6b867e]">{item.message}</p></div></div>{item.acknowledgedAt ? <span className="badge badge-success">تم الاطلاع</span> : <button className="outline-btn" disabled={acknowledge.isPending} onClick={() => acknowledge.mutate({ notificationId: item.id })}>تأكيد الاطلاع</button>}</div></article>)}
        {items.length === 0 && <div className="rounded-2xl bg-[#f5faf8] p-6 text-center text-sm text-[#6b867e]">لا توجد إشعارات تطابق المرشح الحالي.</div>}
      </div>}
    </section>
  </main>;
}
