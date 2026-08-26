import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const eventTypeLabels: Record<string, string> = {
  VISIT_ASSIGNED: "تكليف زيارة",
  VISIT_STATE_CHANGED: "تحديث حالة زيارة",
  STAFF_MEMBERSHIP_STATUS_CHANGED: "تغيير حالة عضوية فريق",
  NOTIFICATION_ACKNOWLEDGED: "تأكيد اطلاع إشعار",
  NOTIFICATION_THRESHOLD_CHANGED: "تغيير عتبة التأكيد",
};

export function AuditEventDetailsDialog({ eventId, onOpenChange }: { eventId: number | null; onOpenChange: (open: boolean) => void }) {
  const detail = trpc.audit.getOperation.useQuery({ eventId: eventId ?? 1 }, { enabled: eventId !== null });
  const event = detail.data;
  return <Dialog open={eventId !== null} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="max-h-[calc(100vh-2rem)] overflow-y-auto text-right sm:max-w-xl"><DialogHeader><DialogTitle>تفاصيل حدث التدقيق</DialogTitle><DialogDescription>تعرض هذه النافذة حقولاً تشغيلية محدودة فقط ضمن نطاق العيادة المصرح به.</DialogDescription></DialogHeader>{detail.isLoading ? <p className="rounded-2xl bg-[#f5faf8] p-5 text-sm text-[#6b867e]">جارٍ تحميل تفاصيل الحدث…</p> : detail.isError ? <p className="rounded-2xl bg-[#fff8e9] p-5 text-sm text-[#a66b29]">تعذر تحميل التفاصيل؛ قد لا يكون الحدث متاحاً ضمن عياداتك الحالية.</p> : event ? <dl className="grid gap-3 text-sm"><div className="rounded-xl bg-[#f5faf8] p-4"><dt className="text-xs text-[#718980]">نوع الحدث</dt><dd className="mt-1 font-bold text-[#31584f]">{eventTypeLabels[event.eventType] ?? "حدث تشغيلي"}</dd></div><div className="rounded-xl border border-[#dbe9e4] p-4"><dt className="text-xs text-[#718980]">الملخص التشغيلي</dt><dd className="mt-1 leading-7 text-[#31584f]">{event.summary}</dd></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#dbe9e4] p-4"><dt className="text-xs text-[#718980]">المنفذ</dt><dd className="mt-1 font-bold text-[#31584f]">{event.actorName}</dd></div><div className="rounded-xl border border-[#dbe9e4] p-4"><dt className="text-xs text-[#718980]">وقت الحدث</dt><dd className="mt-1 font-bold text-[#31584f]">{new Date(event.createdAt).toLocaleString("ar-SA")}</dd></div></div><div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-[#dbe9e4] p-4"><dt className="text-xs text-[#718980]">العيادة</dt><dd className="mt-1 font-bold text-[#31584f]">#{event.clinicId}</dd></div><div className="rounded-xl border border-[#dbe9e4] p-4"><dt className="text-xs text-[#718980]">نوع المورد</dt><dd className="mt-1 font-bold text-[#31584f]">{event.resourceType}</dd></div><div className="rounded-xl border border-[#dbe9e4] p-4"><dt className="text-xs text-[#718980]">معرّف المورد</dt><dd className="mt-1 font-bold text-[#31584f]">#{event.resourceId}</dd></div></div></dl> : <p className="rounded-2xl bg-[#f5faf8] p-5 text-sm text-[#6b867e]">لا تتوفر تفاصيل لهذا الحدث.</p>}</DialogContent></Dialog>;
}
