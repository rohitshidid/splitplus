import Link from "next/link";

export default function Home() {
  return (
    <main className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
      <h1 style={{ fontSize: "3rem", marginBottom: "1rem" }}>Splitplus</h1>
      <p style={{ color: "var(--muted)", fontSize: "1.25rem", marginBottom: "3rem" }}>
        The easiest way to track expenses and settle debts with friends.
      </p>

      <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
        <Link href="/login" className="btn btn-primary" style={{ padding: "0.75rem 2rem" }}>
          Login
        </Link>
        <Link href="/signup" className="btn" style={{ background: "var(--muted-light)", color: "var(--foreground)", padding: "0.75rem 2rem" }}>
          Sign Up
        </Link>
      </div>
    </main>
  );
}
