import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQuery } from "convex/react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";

type Status = "present" | "absent";

/** Local calendar date as YYYY-MM-DD. */
function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function SubjectRowSkeleton() {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border py-5">
      <div className="space-y-2">
        <div className="h-4 w-44 animate-pulse rounded bg-muted" />
        <div className="h-3 w-28 animate-pulse rounded bg-muted" />
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

  useEffect(() => {
    ensureDefaultSubjects();
  }, [ensureDefaultSubjects]);

  const sections = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.subjects.map((subject) => subject.section))].sort();
  }, [data]);

  const [activeSection, setActiveSection] = useState<string | null>(null);
  const section = activeSection ?? sections[0] ?? null;
  const visibleSubjects = data
    ? data.subjects.filter((subject) => subject.section === section)
    : [];

  const markedCount = data
    ? data.subjects.filter((subject) => subject.todayStatus !== null).length
    : 0;

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const handleMark = async (
    subjectId: (typeof visibleSubjects)[number]["_id"],
    status: Status,
  ) => {
    await mark({ subjectId, date: today, status });
  };

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
            <p className="hidden text-xs text-muted-foreground sm:block">
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
          </p>
        </section>

        {/* Section tabs */}
        {data && sections.length > 1 && (
          <nav
            className="flex gap-8 border-b border-border"
            aria-label="Class sections"
          >
            {sections.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setActiveSection(item)}
                className={cn(
                  "-mb-px border-b py-4 text-[11px] font-medium uppercase tracking-[0.18em] transition-colors",
                  section === item
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {item}
              </button>
            ))}
          </nav>
        )}

        {/* Subject list */}
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
              No subjects in this section.
            </p>
          ) : (
            visibleSubjects.map((subject) => {
              const percent =
                subject.total > 0
                  ? Math.round((subject.present / subject.total) * 100)
                  : null;
              return (
                <div
                  key={subject._id}
                  className="flex items-center justify-between gap-6 border-b border-border py-5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{subject.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {subject.code} · {subject.section}
                      {percent !== null && (
                        <span className="tabular-nums">
                          {" "}
                          · {percent}% present
                        </span>
                      )}
                    </p>
                  </div>
                  <StatusToggle
                    status={subject.todayStatus}
                    onSelect={(status) => handleMark(subject._id, status)}
                  />
                </div>
              );
            })
          )}
        </section>

        <footer className="py-8 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Tap a status to mark · tap again to clear
        </footer>
      </div>
    </main>
  );
}