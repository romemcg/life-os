"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { Plus, ImagePlus, Pencil, Lock, Infinity as InfinityIcon } from "lucide-react";
import { PageHeader, useToast, clsx } from "@/components/ui";
import { RecordForm } from "@/components/RecordForm";
import { PILLAR_FIELDS } from "@/components/shared";
import { useTree, resizeImage, setAreaImage } from "@/components/vision";
import { type Row } from "@/lib/client";
import { STAGES } from "@/lib/stages";

export default function VisionPage() {
  const t = useTree();
  const [edit, setEdit] = useState<Partial<Row> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadFor, setUploadFor] = useState<Row | null>(null);
  const { toast, node } = useToast();

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !uploadFor) return;
    try {
      await setAreaImage(uploadFor, await resizeImage(file), t.cards);
      toast("Image saved");
    } catch (err) {
      toast((err as Error).message, "err");
    }
  }

  const loose = t.tasks.filter((x) => !x.pillar_id);

  const areas = t.pillars.map((p) => {
    const ms = t.milestones.filter((m) => m.pillar_id === p.id && m.status !== "dropped");
    const done = ms.filter((m) => m.status === "done").length;
    const open = ms.filter((m) => m.status !== "done").sort((a, b) => (a.stage ?? 2) - (b.stage ?? 2) || (a.target_date ?? "9999").localeCompare(b.target_date ?? "9999"));
    const locked = ms.length > 0 && ms.every((m) => (m.stage ?? 2) !== 0 && (m.stage ?? 2) > t.stage);
    const always = ms.length > 0 && ms.every((m) => (m.stage ?? 2) === 0);
    const opensAt = locked ? Math.min(...ms.map((m) => m.stage ?? 2)) : null;
    const img = t.cards.find((v) => v.pillar_id === p.id && v.image)?.image as string | undefined;
    const tasksOpen = t.tasks.filter((x) => x.pillar_id === p.id && x.status === "open").length;
    return { p, total: ms.length, done, next: open[0], locked, always, opensAt, img, tasksOpen };
  });
  const now = areas.filter((a) => !a.locked);
  const later = areas.filter((a) => a.locked).sort((a, b) => (a.opensAt ?? 9) - (b.opensAt ?? 9));
  const stageName = STAGES.find((s) => s.id === t.stage)?.name ?? "";
  const cardProps = { onImage: (p: Row) => { setUploadFor(p); fileRef.current?.click(); }, onEdit: (p: Row) => setEdit(p) };

  return (
    <div>
      <PageHeader
        title="Vision"
        subtitle="Your life areas, in one place. Open an area to see its milestones, then open a milestone to plan its tasks. Everything is added and edited here."
        actions={<button className="btn-primary" onClick={() => setEdit({ color: "#3b82f6", stage_weight: 0.5, sort: t.pillars.length })}><Plus size={15} /> Life area</button>}
      />
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="h-section">Focus now</h2>
          <p className="text-sm muted">Stage {t.stage}, {stageName}. These areas need your energy.</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {now.map((a) => <AreaCard key={a.p.id} a={a} {...cardProps} />)}
        </div>
      </section>

      {later.length > 0 && (
        <section className="mt-9">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="h-section">Waiting for later</h2>
            <p className="text-sm muted">They open in order, so none of these need you yet.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {later.map((a) => <AreaCard key={a.p.id} a={a} later {...cardProps} />)}
          </div>
        </section>
      )}

      {loose.length > 0 && (
        <Link href="/vision/0/none" className="card card-pad mt-6 block text-sm hover:border-teal-500/50">
          <span className="font-medium">{loose.length} task{loose.length === 1 ? "" : "s"} without a life area</span>
          <span className="ml-2 muted">Open to sort them into an area and milestone.</span>
        </Link>
      )}

      <RecordForm table="pillars" open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? "Edit life area" : "New life area"} initial={edit} fields={PILLAR_FIELDS} allowDelete={false} allowArchive />
      {node}
    </div>
  );
}

type Area = { p: Row; total: number; done: number; next?: Row; locked: boolean; always: boolean; opensAt: number | null; img?: string; tasksOpen: number };

/** A life area as a poster: photo, a scrim so the words always read, then progress and the next step. */
function AreaCard({ a, later, onImage, onEdit }: { a: Area; later?: boolean; onImage: (p: Row) => void; onEdit: (p: Row) => void }) {
  const { p } = a;
  const pct = a.total ? (a.done / a.total) * 100 : 0;
  const opensName = a.opensAt ? STAGES.find((s) => s.id === a.opensAt)?.name : "";
  return (
    <div className={clsx("group relative isolate overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 transition-shadow duration-300 hover:shadow-[var(--shadow-lift)]", later ? "aspect-[5/6]" : "aspect-[4/5]")}>
      {a.img ? (
        // The scale crops a few pixels off the left edge, where some generated photos carry a pale seam.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.img} alt="" className={clsx("absolute inset-0 -z-10 h-full w-full origin-right scale-[1.08] object-cover transition duration-700 group-hover:scale-[1.13]", later && "saturate-[.6]")} />
      ) : (
        <div className="absolute inset-0 -z-10" style={{ background: `radial-gradient(120% 80% at 20% 0%, ${p.color}66, transparent 60%), linear-gradient(180deg, rgb(var(--ink-800)), rgb(var(--ink-850)))` }} />
      )}
      <div className="pointer-events-none absolute inset-0 -z-10" style={{ background: "linear-gradient(to top, rgba(7,14,28,0.92) 0%, rgba(7,14,28,0.72) 26%, rgba(7,14,28,0.25) 52%, rgba(7,14,28,0) 74%)" }} />
      <Link href={`/vision/${p.id}`} className="absolute inset-0 z-0 rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-teal-400" aria-label={`Open ${p.name}`} />

      {(a.locked || a.always) && (
        <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
          {a.locked ? <><Lock size={11} />Stage {a.opensAt}, {opensName}</> : <><InfinityIcon size={11} />Always on</>}
        </span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-3.5 text-white">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: p.color }} />
          <h3 className={clsx("font-display font-semibold leading-tight", later ? "text-base" : "text-[19px]")}>{p.name}</h3>
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2 text-xs text-white/75">
          <span>{a.done} of {a.total} milestones</span>
          {a.tasksOpen > 0 && <span>{a.tasksOpen} open task{a.tasksOpen === 1 ? "" : "s"}</span>}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/20" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${p.name} progress`}>
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.max(pct, a.total ? 4 : 0)}%`, background: "rgba(255,255,255,0.9)" }} />
        </div>
        {!later && a.next && <p className="mt-2.5 line-clamp-2 border-t border-white/15 pt-2 text-xs leading-snug text-white/90">Next: {a.next.title}</p>}
      </div>

      <div className="absolute right-2 top-2 z-10 flex gap-1 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100">
        <button className="rounded-lg bg-black/45 p-1.5 text-white backdrop-blur hover:bg-black/65" aria-label={`Change image for ${p.name}`} title="Change image" onClick={() => onImage(p)}><ImagePlus size={14} /></button>
        <button className="rounded-lg bg-black/45 p-1.5 text-white backdrop-blur hover:bg-black/65" aria-label={`Edit ${p.name}`} title="Edit life area" onClick={() => onEdit(p)}><Pencil size={14} /></button>
      </div>
    </div>
  );
}
