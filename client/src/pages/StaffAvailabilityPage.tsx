import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { CalendarClock, ShieldCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function StaffAvailabilityPage({ navigate }: { navigate: (to: string) => void }) {
  const { isAuthenticated } = useAuth();
  const utils = trpc.useUtils();
  const clinics = trpc.notifications.managedClinics.useQuery(undefined, { enabled: isAuthenticated });
  const staff = trpc.memberships.listStaffForOperations.useQuery(undefined, { enabled: isAuthenticated });
  const operationalVisits = trpc.visits.listOperations.useQuery(undefined, { enabled: isAuthenticated });
  const [clinicId, setClinicId] = useState<number | null>(null);
  const [staffUserId, setStaffUserId] = useState("");
  const [visitId, setVisitId] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const windows = trpc.staffAvailability.list.useQuery({ clinicId: clinicId ?? 1 }, { enabled: isAuthenticated && clinicId !== null });

  useEffect(() => {
    if (clinicId === null && clinics.data?.[0]) setClinicId(clinics.data[0].clinicId);
  }, [clinicId, clinics.data]);

  const clinicStaff = useMemo(() => staff.data?.filter(member => member.clinicId === clinicId) ?? [], [clinicId, staff.data]);
  const clinicRequestedVisits = useMemo(() => operationalVisits.data?.filter(visit => visit.clinicId === clinicId && visit.state === "REQUESTED") ?? [], [clinicId, operationalVisits.data]);
  const availabilityPreview = trpc.visits.assignmentAvailability.useQuery({ visitId: Number(visitId), staffUserId: Number(staffUserId) }, { enabled: isAuthenticated && Boolean(visitId) && Boolean(staffUserId) });
  useEffect(() => {
    if (!clinicStaff.some(member => String(member.userId) === staffUserId)) setStaffUserId("");
  }, [clinicStaff, staffUserId]);
  useEffect(() => {
    if (!clinicRequestedVisits.some(visit => String(visit.id) === visitId)) setVisitId("");
  }, [clinicRequestedVisits, visitId]);

  const createWindow = trpc.staffAvailability.create.useMutation({
    onSuccess: () => {
      toast.success("تم حفظ فترة التوافر ضمن العيادة المختارة.");
      setStaffUserId(""); setStartAt(""); setEndAt("");
      utils.staffAvailability.list.invalidate();
    },
    onError: () => toast.error("تعذر حفظ فترة التوافر. تحقق من العيادة والعضو والفترة."),
  });
  const cancelWindow = trpc.staffAvailability.cancel.useMutation({
    onSuccess: () => { toast.success("تم إلغاء فترة التوافر."); utils.staffAvailability.list.invalidate(); },
    onError: () => toast.error("تعذر إلغاء فترة التوافر ضمن نطاق العيادة."),
  });

  const submit = () => {
    const start = new Date(startAt); const end = new Date(endAt);
    if (clinicId === null || !staffUserId || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end) return toast.error("اختر عضواً وفترة صحيحة تنتهي بعد بدايتها.");
    createWindow.mutate({ clinicId, staffUserId: Number(staffUserId), startAt: start, endAt: end });
  };

  if (!isAuthenticated) return <main className="shell page-wrap"><section className="panel mx-auto max-w-2xl py-12 text-center"><ShieldCheck className="mx-auto text-[#0b776b]" size={34}/><h1 className="mt-4 text-xl font-bold text-[#31584f]">توافر الفريق محمي</h1><p className="mt-3 text-sm leading-7 text-[#6b867e]">سجّل الدخول بحساب مدير لإدارة توافر أعضاء الفريق ضمن العيادة.</p><button className="primary-btn mt-6" onClick={startLogin}>تسجيل الدخول</button></section></main>;

  return <main className="shell page-wrap"><div className="page-header"><div><h1>توافر الفريق</h1><p>سجّل فترات عمل الفريق داخل العيادة، وتحقق من توافق الموعد قبل تكليف الزيارة.</p></div><button className="outline-btn" onClick={() => navigate("/operations")}>لوحة التشغيل</button></div><section className="panel"><div className="section-head"><div><h2 className="section-title">إضافة فترة توافر</h2><p className="section-copy">لا يقبل الخادم إلا عضواً نشطاً من نوع ممارس أو تمريض ضمن العيادة التي يديرها الحساب.</p></div><CalendarClock className="text-[#0b776b]" size={24}/></div><div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="field-label">العيادة<select className="field-input mt-2" value={clinicId ?? ""} disabled={clinics.isLoading || !clinics.data?.length} onChange={event => setClinicId(Number(event.target.value))}>{clinics.data?.map(clinic => <option key={clinic.clinicId} value={clinic.clinicId}>{clinic.clinicName}</option>)}</select></label><label className="field-label">عضو الفريق<select className="field-input mt-2" value={staffUserId} disabled={staff.isLoading || clinicId === null} onChange={event => setStaffUserId(event.target.value)}><option value="">اختر عضواً نشطاً</option>{clinicStaff.map(member => <option key={`${member.clinicId}-${member.userId}`} value={member.userId}>{member.displayName} — {member.memberRole === "CLINICIAN" ? "ممارس" : "تمريض"}</option>)}</select></label><label className="field-label">بداية التوافر<input className="field-input mt-2" type="datetime-local" value={startAt} onChange={event => setStartAt(event.target.value)}/></label><label className="field-label">نهاية التوافر<input className="field-input mt-2" type="datetime-local" value={endAt} onChange={event => setEndAt(event.target.value)}/></label></div><div className="mt-5 flex flex-wrap items-center gap-3"><button className="primary-btn" disabled={createWindow.isPending || clinicId === null || !staffUserId || !startAt || !endAt} onClick={submit}>{createWindow.isPending ? "جارٍ الحفظ…" : "حفظ فترة التوافر"}</button><span className="text-xs leading-6 text-[#6b867e]">لا ترسل هذه النسخة رسالة أو إشعاراً خارج التطبيق، ولا تسجل معلومات مرضى.</span></div></section><section className="panel mt-5"><div className="section-head"><div><h2 className="section-title">معاينة توافق التعيين</h2><p className="section-copy">يفحص التحقق تغطية فترة مدتها 60 دقيقة تبدأ في وقت الزيارة. عند وجود فترات توافر للعضو، يجب أن تغطي إحداها الفترة كاملة.</p></div></div><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="field-label">زيارة مطلوبة<select className="field-input mt-2" value={visitId} disabled={operationalVisits.isLoading || clinicId === null} onChange={event => setVisitId(event.target.value)}><option value="">اختر زيارة مطلوبة</option>{clinicRequestedVisits.map(visit => <option key={visit.id} value={visit.id}>{visit.reference} — {new Date(visit.scheduledStart).toLocaleString("ar-SA")}</option>)}</select></label><div className="rounded-2xl border border-[#dbe9e4] bg-[#fbfefd] p-4 text-sm leading-7">{!staffUserId || !visitId ? <p className="text-[#6b867e]">اختر العضو والزيارة لمعاينة التوافق.</p> : availabilityPreview.isLoading ? <p className="text-[#6b867e]">جارٍ فحص التوافر…</p> : availabilityPreview.isError ? <p className="text-[#9a5e16]">تعذر فحص التوافر ضمن هذه العيادة.</p> : availabilityPreview.data?.status === "AVAILABLE" ? <p className="font-semibold text-[#0b776b]">متاح: توجد فترة توافر تغطي وقت الزيارة كاملاً.</p> : availabilityPreview.data?.status === "OUTSIDE_AVAILABILITY" ? <p className="font-semibold text-[#9a5e16]">تعارض: لدى العضو فترات مسجلة لكنها لا تغطي وقت الزيارة كاملاً، وسيُرفض التعيين.</p> : <p className="text-[#527169]">لا توجد فترات توافر مسجلة للعضو؛ يسمح الإصدار الحالي بالتعيين ويعرض هذه الحالة للمراجعة.</p>}</div></div></section><section className="panel mt-5"><div className="section-head"><div><h2 className="section-title">الفترات الحالية</h2><p className="section-copy">تعرض آخر 30 فترة محفوظة للعيادة المختارة؛ لا تظهر فترات عيادات أخرى.</p></div></div>{windows.isLoading ? <p className="py-5 text-sm text-[#6b867e]">جارٍ تحميل فترات التوافر…</p> : windows.isError ? <p className="mt-4 rounded-2xl bg-[#fff5e9] p-4 text-sm text-[#9a5e16]">تعذر عرض فترات التوافر لهذه العيادة.</p> : <div className="mt-4 overflow-x-auto rounded-xl border border-[#dce9e4]"><table className="w-full min-w-[720px] text-right text-sm"><thead className="bg-[#f5faf8] text-[#527169]"><tr><th className="px-4 py-3 font-semibold">العضو</th><th className="px-4 py-3 font-semibold">العيادة</th><th className="px-4 py-3 font-semibold">البداية</th><th className="px-4 py-3 font-semibold">النهاية</th><th className="px-4 py-3 font-semibold">الإجراء</th></tr></thead><tbody>{windows.data?.map(window => <tr key={window.id} className="border-t border-[#e7f0ec]"><td className="px-4 py-3 font-semibold text-[#31584f]">{window.staffName}</td><td className="px-4 py-3 text-[#527169]">{window.clinicName}</td><td className="px-4 py-3 text-[#527169]">{new Date(window.startAt).toLocaleString("ar-SA")}</td><td className="px-4 py-3 text-[#527169]">{new Date(window.endAt).toLocaleString("ar-SA")}</td><td className="px-4 py-3"><button className="outline-btn" disabled={cancelWindow.isPending} onClick={() => cancelWindow.mutate({ availabilityWindowId: window.id })}>إلغاء</button></td></tr>)}{windows.data?.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-[#6b867e]">لا توجد فترات توافر نشطة لهذه العيادة بعد.</td></tr>}</tbody></table></div>}</section></main>;
}
