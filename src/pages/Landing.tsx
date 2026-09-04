import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: "easeOut" as const },
};

/** Static preview of the subject list, shown on the landing page. */
const PREVIEW_ROWS = [
  { name: "Engineering Physics", code: "L/PHY1001/STM", section: "Lecture", percent: "92%", status: "present" },
  { name: "Engineering Mathematics I", code: "L/MTH1101/SR", section: "Lecture", percent: "88%", status: "present" },
  { name: "Physics Laboratory", code: "LAB/PHY1051/RJR", section: "Lab", percent: "76%", status: "absent" },
  { name: "Basic Electronics", code: "L/ECE1001/AMD", section: "Lecture", percent: "100%", status: "present" },
] as const;

export default function Landing() {
  return (
    <main className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Top bar */}
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
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
        <Link
          to="/auth?returnTo=/dashboard"
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto w-full max-w-5xl px-6 pb-20 pt-20 sm:pt-28">
        <motion.div {...fadeUp}>
          <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Attendance, for students
          </p>
          <h1 className="mt-6 max-w-2xl font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Attendance, without the noise.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
            A quiet place to mark attendance for every subject at Heritage
            Institute of Technology — one tap per class, per day. No clutter,
            no dashboards, no distractions.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-6">
            <Link
              to="/auth?returnTo=/dashboard"
              className="inline-flex h-10 items-center gap-2 bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-85"
            >
              Open the app
              <ArrowRight className="size-4" />
            </Link>
            <p className="text-xs text-muted-foreground">
              Email code sign-in · no password
            </p>
          </div>
        </motion.div>
      </section>

      {/* Product preview */}
      <section className="mx-auto w-full max-w-3xl px-6 pb-24">
        <motion.div
          {...fadeUp}
          transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
        >
          <div className="border-y border-border">
            <div className="flex items-center justify-between border-b border-border py-4">
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Today
              </p>
              <p className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                One tap per subject
              </p>
            </div>
            {PREVIEW_ROWS.map((row) => (
              <div
                key={row.code}
                className="flex items-center justify-between gap-6 border-b border-border py-5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{row.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {row.code} · {row.section} ·{" "}
                    <span className="tabular-nums">{row.percent} present</span>
                  </p>
                </div>
                <div
                  className="flex shrink-0 items-center rounded-full border border-border p-0.5"
                  aria-hidden="true"
                >
                  <span
                    className={`rounded-full px-3.5 py-1 text-xs font-medium ${
                      row.status === "present"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    }`}
                  >
                    Present
                  </span>
                  <span
                    className={`rounded-full px-3.5 py-1 text-xs font-medium ${
                      row.status === "absent"
                        ? "bg-foreground text-background"
                        : "text-muted-foreground"
                    }`}
                  >
                    Absent
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Groups A &amp; B · analysis and history per subject
          </p>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            HIT · Attendance
          </p>
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            v1.0 · Minimal
          </p>
        </div>
      </footer>
    </main>
  );
}