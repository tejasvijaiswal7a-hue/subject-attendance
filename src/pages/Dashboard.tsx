import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

type Status = "present" | "absent";
type HistoryEntry = { date: string; status: Status };

const CATEGORY_ORDER = ["Lecture", "Lab", "Tutorial", "Sessions"] as const;

/** Local calendar date as YYYY-MM-DD. */
function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** "Tue · Sep 3" from a YYYY-MM-DD key. */
function formatDay(dateKey: string) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function dayNumber(dateKey: string) {
  return Number(dateKey.slice(8, 10));
}

function percent(present: number, total: number) {
  return total > 0 ? Math.round((present / total) * 100) : null;
}

function StatusToggle({
  status,
  onSelect,
}: {
  status: Status | null;
  onSelect: (status: Status) => void;
}) {
  return (
    <div
      className="flex shrink-0 items-center rounded-full border border-border p-0.5"
      role="group"
      aria-label="Today's attendance"
    >
      <button
        type="button"
        onClick={() => onSelect("present")}
        aria-pressed={status === "present"}
        className={cn(
          "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
          status === "present"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Present
      </button>
      <button
        type="button"
        onClick={() => onSelect("absent")}
        aria-pressed={status === "absent"}
        className={cn(
          "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
          status === "absent"
            ? "bg-foreground text-background"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        Absent
      </button>
    </div>
  );
}

/**
 * Cumulative attendance % over the most recent 14 marks.
 * Bar height is the running percentage; color is that day's status.
 */
function TrendGraph({ history }: { history: HistoryEntry[] }) {
  const marks = history.slice(0, 14).reverse();
  let present = 0;
  const bars = marks.map((mark, i) => {
    if (mark.status === "present") present += 1;
    return {
      day: dayNumber(mark.date),
      pct: Math.round((present / (i + 1)) * 100),
      isPresent: mark.status === "present",
    };
  });

  return (
    <div>
      <div className="flex h-24 items-end gap-[3px]">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={cn(
              "flex-1 rounded-t-[2px] transition-colors",
              bar.isPresent ? "bg-foreground" : "bg-border",
            )}
            style={{ height: `${Math.max(bar.pct, 5)}%` }}
            title={`${formatDay(marks[i].date)} · ${bar.pct}%`}
          />
        ))}
        {bars.length === 0 && (
          <p className="w-full text-center text-xs text-muted-foreground">
            No marks yet — mark today to start your trend.
          </p>
        )}
      </div>
      {bars.length > 0 && (
        <div className="mt-2 flex justify-between">
          {bars.map((bar, i) => (
            <span
              key={i}
              className="flex-1 text-center text-[9px] tabular-nums text-muted-foreground"
            >
              {bar.day}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function SubjectRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border py-5">
      <div className="space-y-2">
        <div className="h-4 w-44 animate-pulse rounded bg-muted" />
        <div className="h-3 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="h-6 w-32 animate-pulse rounded-full bg-muted" />
    </div>
  );
}

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const today = useMemo(() => toDateKey(new Date()), []);
  const displayDate = useMemo(
    () =>
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      }),
    [],
  );

  const data = useQuery(api.attendance.dashboard, { date: today });
  const ensureDefaultSubjects = useMutation(api.attendance.ensureDefaultSubjects);
  const mark = useMutation(api.attendance.mark);
  const setGroup = useMutation(api.attendance.setGroup);

  useEffect(() => {
    ensureDefaultSubjects();
  }, [ensureDefaultSubjects]);

  const [view, setView] = useState<"mark" | "history">("mark");
  const [activeCategory, setActiveCategory] = useState<string>("All");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [groupPending, setGroupPending] = useState(false);

  const categories = useMemo(() => {
    if (!data) return [];
    const present = new Set(data.subjects.map((s) => s.category));
    return CATEGORY_ORDER.filter((c) => present.has(c));
  }, [data]);

  const visibleSubjects = useMemo(() => {
    if (!data) return [];
    return activeCategory === "All"
      ? data.subjects
      : data.subjects.filter((s) => s.category === activeCategory);
  }, [data, activeCategory]);

  const markedCount = data
    ? data.subjects.filter((s) => s.todayStatus !== null).length
    : 0;
  const overallPct = data
    ? percent(data.summary.totalPresent, data.summary.totalMarks)
    : null;

  /** date -> entries, newest first */
  const timeline = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<
      string,
      { name: string; code: string; status: Status }[]
    >();
    for (const subject of data.subjects) {
      for (const entry of subject.history) {
        const list = byDate.get(entry.date) ?? [];
        list.push({ name: subject.name, code: subject.code, status: entry.status });
        byDate.set(entry.date, list);
      }
    }
    return [...byDate.entries()]
      .map(([date, entries]) => ({ date, entries }))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [data]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleMark = async (subjectId: string, status: Status) => {
    await mark({ subjectId: subjectId as never, date: today, status });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleGroup = async (group: "A" | "B") => {
    setGroupPending(true);
    try {
      await setGroup({ group });
    } finally {
      setGroupPending(false);
    }
  };

  const group = data?.group ?? null;

  // ── Group gate: shown before anything else, once per student ─────────────
  if (data && group === null) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
        <div className="w-full max-w-lg">
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Heritage Institute of Technology
          </p>
          <h1 className="mt-4 font-serif text-4xl tracking-tight sm:text-5xl">
            Which group are you in?
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Your timetable is split into two groups. Pick yours to open your
            attendance — you can change it later from the dashboard.
          </p>
          <div className="mt-10 grid grid-cols-2 gap-4">
            {(["A", "B"] as const).map((item) => (
              <button
                key={item}
                type="button"
                disabled={groupPending}
                onClick={() => handleGroup(item)}
                className="group border border-border py-8 text-center transition-colors hover:border-foreground disabled:opacity-50"
              >
                <span className="font-serif text-3xl tracking-tight">
                  Group {item}
                </span>
                <span className="mt-2 block text-[11px] uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">
                  {groupPending ? "Saving…" : "Select"}
                </span>
              </button>
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-3xl px-6">
        {/* Top bar */}
        <header className="flex items-center justify-between border-b border-border py-6">
          <div className="flex items-center gap-3">
            <span className="flex size-9 items-center justify-center border border-border text-sm font-semibold">
              H
            </span>
            <div className="leading-tight">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em]">
                Heritage Institute of Technology
              </p>
              <p className="text-xs text-muted-foreground">Attendance</p>
            </div>
          </div>
          <div className="flex items-center gap-5">
            {group && (
              <span className="hidden border border-border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.18em] sm:block">
                Group {group}
              </span>
            )}
            <p className="hidden text-xs text-muted-foreground md:block">
              {displayDate}
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              Sign out
            </Button>
          </div>
        </header>

        {/* Heading */}
        <section className="border-b border-border pb-10 pt-14">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {displayDate}
          </p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">
            Attendance
          </h1>
          <p className="mt-4 text-sm text-muted-foreground">
            {user?.name ? `${user.name} · ` : ""}
            {markedCount} of {data?.subjects.length ?? 0} subjects marked today
            {overallPct !== null && (
              <span className="tabular-nums">
                {" "}
                · {overallPct}% present overall
              </span>
            )}
          </p>
        </section>

        {/* View tabs */}
        <nav className="flex gap-8 border-b border-border" aria-label="Views">
          {(
            [
              { key: "mark", label: "Mark attendance" },
              { key: "history", label: "History" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setView(item.key)}
              className={cn(
                "-mb-px border-b py-4 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors",
                view === item.key
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {view === "mark" && (
          <>
            {/* Category filter */}
            {data && categories.length > 1 && (
              <div className="flex flex-wrap gap-x-7 gap-y-2 border-b border-border py-3">
                {["All", ...categories].map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setActiveCategory(item)}
                    className={cn(
                      "py-1 text-xs transition-colors",
                      activeCategory === item
                        ? "font-medium text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}

            {/* Subject list with per-subject analysis */}
            <section className="border-b border-border">
              {!data ? (
                <>
                  <SubjectRowSkeleton />
                  <SubjectRowSkeleton />
                  <SubjectRowSkeleton />
                  <SubjectRowSkeleton />
                  <SubjectRowSkeleton />
                </>
              ) : visibleSubjects.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  No subjects in this category.
                </p>
              ) : (
                visibleSubjects.map((subject) => {
                  const isOpen = expanded.has(subject._id);
                  const pct = percent(subject.present, subject.total);
                  return (
                    <div
                      key={subject._id}
                      className="border-b border-border last:border-b-0"
                    >
                      <div
                        className="flex items-center justify-between gap-4 py-5"
                        role="button"
                        tabIndex={0}
                        onClick={() => toggleExpanded(subject._id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            toggleExpanded(subject._id);
                          }
                        }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{subject.name}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {subject.code} · {subject.category}
                            {pct !== null && (
                              <span className="tabular-nums">
                                {" "}
                                · {pct}% present
                              </span>
                            )}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="hidden font-serif text-lg tabular-nums sm:block">
                            {pct !== null ? `${pct}%` : "—"}
                          </span>
                          <div onClick={(e) => e.stopPropagation()}>
                            <StatusToggle
                              status={subject.todayStatus}
                              onSelect={(status) => handleMark(subject._id, status)}
                            />
                          </div>
                          <ChevronDown
                            className={cn(
                              "size-4 text-muted-foreground transition-transform",
                              isOpen && "rotate-180",
                            )}
                          />
                        </div>
                      </div>

                      {isOpen && (
                        <div className="border-t border-border pb-8 pt-6">
                          {/* Stats */}
                          <div className="flex items-end justify-between gap-6">
                            <div>
                              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                Present overall
                              </p>
                              <p className="mt-2 font-serif text-5xl tracking-tight tabular-nums">
                                {pct !== null ? `${pct}%` : "—"}
                              </p>
                            </div>
                            <div className="flex gap-6 pb-1 text-xs text-muted-foreground">
                              <span>
                                <span className="font-medium text-foreground tabular-nums">
                                  {subject.present}
                                </span>{" "}
                                present
                              </span>
                              <span>
                                <span className="font-medium text-foreground tabular-nums">
                                  {subject.total - subject.present}
                                </span>{" "}
                                absent
                              </span>
                              <span>
                                <span className="font-medium text-foreground tabular-nums">
                                  {subject.total}
                                </span>{" "}
                                marks
                              </span>
                            </div>
                          </div>

                          {/* Graph */}
                          <div className="mt-8">
                            <div className="flex items-center justify-between">
                              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                Cumulative attendance · last{" "}
                                {Math.min(subject.history.length, 14)} marks
                              </p>
                              <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                  <span className="size-2 bg-foreground" /> Present
                                </span>
                                <span className="flex items-center gap-1.5">
                                  <span className="size-2 bg-border" /> Absent
                                </span>
                              </div>
                            </div>
                            <div className="mt-4">
                              <TrendGraph history={subject.history} />
                            </div>
                          </div>

                          {/* Recent marks */}
                          {subject.history.length > 0 && (
                            <div className="mt-8">
                              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                                Recent
                              </p>
                              <div className="mt-3 divide-y divide-border border-y border-border">
                                {subject.history.slice(0, 7).map((entry) => (
                                  <div
                                    key={entry.date}
                                    className="flex items-center justify-between py-2.5"
                                  >
                                    <span className="text-xs text-muted-foreground">
                                      {formatDay(entry.date)}
                                    </span>
                                    <span
                                      className={cn(
                                        "text-xs font-medium",
                                        entry.status === "present"
                                          ? "text-foreground"
                                          : "text-muted-foreground",
                                      )}
                                    >
                                      {entry.status === "present"
                                        ? "Present"
                                        : "Absent"}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </section>
          </>
        )}

        {view === "history" && (
          <section className="border-b border-border pb-12">
            {/* Summary */}
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border py-6">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Every day tracked
                </p>
                <p className="mt-2 font-serif text-3xl tracking-tight tabular-nums">
                  {timeline.length} day{timeline.length === 1 ? "" : "s"}
                </p>
              </div>
              <p className="pb-1 text-xs text-muted-foreground">
                <span className="font-medium text-foreground tabular-nums">
                  {data?.summary.totalMarks ?? 0}
                </span>{" "}
                marks ·{" "}
                <span className="font-medium text-foreground tabular-nums">
                  {data?.summary.totalPresent ?? 0}
                </span>{" "}
                present
                {overallPct !== null && (
                  <span className="tabular-nums"> · {overallPct}% overall</span>
                )}
              </p>
            </div>

            {/* Day-by-day timeline */}
            {timeline.length === 0 ? (
              <p className="py-14 text-center text-sm text-muted-foreground">
                No attendance recorded yet. Mark a few subjects to build your
                history.
              </p>
            ) : (
              timeline.map((day) => {
                const presentCount = day.entries.filter(
                  (e) => e.status === "present",
                ).length;
                const dayPct = percent(presentCount, day.entries.length);
                return (
                  <div key={day.date} className="border-b border-border py-6">
                    <div className="flex items-center justify-between gap-4">
                      <p className="text-xs font-medium">{formatDay(day.date)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {presentCount} of {day.entries.length} present
                        {dayPct !== null && ` · ${dayPct}%`}
                      </p>
                    </div>
                    <div className="mt-3 h-1 w-full bg-muted">
                      <div
                        className="h-full bg-foreground transition-all"
                        style={{ width: `${dayPct ?? 0}%` }}
                      />
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {day.entries.map((entry) => (
                        <span
                          key={day.date + entry.code}
                          className={cn(
                            "inline-flex items-center gap-2 border border-border px-2.5 py-1 text-[11px]",
                            entry.status === "present"
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              entry.status === "present"
                                ? "bg-foreground"
                                : "bg-border",
                            )}
                          />
                          {entry.code} ·{" "}
                          {entry.status === "present" ? "Present" : "Absent"}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </section>
        )}

        <footer className="py-8 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Tap a status to mark · tap again to clear · tap a subject for analysis
        </footer>
      </div>
    </main>
  );
}