import Link from "next/link";

export default function SignupPage() {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-5 py-16">
      <div className="hero-blob" style={{ inset: "-10% 20% auto auto" }} aria-hidden="true" />
      <div className="hero-blob" style={{ inset: "auto auto -10% -10%", animationDelay: "-6s" }} aria-hidden="true" />

      <div className="fade-up relative w-full max-w-md">
        <Link href="/" className="eyebrow mb-8 inline-flex no-underline">
          ← AssetFlow
        </Link>

        <div
          className="overflow-hidden rounded-lg border border-line"
          style={{ background: "var(--card)", boxShadow: "0 30px 70px -30px rgba(20,15,5,.22)" }}
        >
          <div
            className="px-8 pb-6 pt-8"
            style={{
              background:
                "linear-gradient(120deg, var(--hue-amber-soft), var(--hue-violet-soft))",
            }}
          >
            <span className="eyebrow">Get started</span>
            <h1 className="mt-3 text-[26px] font-extrabold leading-tight">
              Create your workspace.
            </h1>
            <p className="mt-2 text-[13.5px] text-text-soft">
              Every account starts as Employee — no role selection here. Admins promote
              Department Heads &amp; Asset Managers later from the directory.
            </p>
          </div>

          <form className="flex flex-col gap-4 px-8 py-7">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                First name
                <input
                  type="text"
                  placeholder="Priya"
                  className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-violet)]"
                />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-medium">
                Last name
                <input
                  type="text"
                  placeholder="Nair"
                  className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-violet)]"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Work email
              <input
                type="email"
                placeholder="you@company.com"
                className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-violet)]"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Password
              <input
                type="password"
                placeholder="At least 8 characters"
                className="rounded-[2px] border border-line bg-paper-raised px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[var(--hue-violet)]"
              />
            </label>

            <button type="submit" className="btn btn-accent btn-lg mt-2 justify-center">
              Create free account
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[13.5px] text-text-soft">
          Already have a workspace?{" "}
          <Link href="/login" className="font-semibold text-accent no-underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
