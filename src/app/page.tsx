"use client";

import Link from "next/link";
import { useEffect } from "react";
import SplitDemo from "@/components/SplitDemo";

const S = (i: number) => ({ "--i": i } as React.CSSProperties);

export default function Home() {
  useEffect(() => {
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      items.forEach(el => el.classList.add("in"));
      return;
    }

    // Everything enters the same way, once, as it comes into view.
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      }),
      { rootMargin: "0px 0px -8% 0px", threshold: 0.06 }
    );
    items.forEach(el => io.observe(el));

    // The nav only grows a hairline once the page has actually moved.
    const nav = document.querySelector(".lnav");
    const onScroll = () => nav?.classList.toggle("stuck", window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });

    return () => { io.disconnect(); window.removeEventListener("scroll", onScroll); };
  }, []);

  return (
    <div className="landing">
      <nav className="lnav">
        <div className="container container-wide lnav-in">
          <span className="brand-mark">S</span>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.015em" }}>Splitplus</span>
          <div className="lnav-links">
            <a className="opt" href="#what">What it is</a>
            <a className="opt" href="#features">Features</a>
            <a className="opt" href="#setup">Setup</a>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="btn btn-primary btn-sm">Sign up</Link>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------- hero */}
      <header className="hero">
        <div className="container container-wide">
          <div className="hero-mark reveal" style={S(0)}>S</div>
          <h1 className="reveal" style={S(1)}>Split the bill. Keep the friendship.</h1>
          <p className="lede reveal" style={S(2)}>
            Splitplus is a <strong>shared expense tracker</strong> for a trip, a flat, or a group of
            friends — where <strong>your data lives in a Google Sheet you own</strong>. Log who paid for what,
            split it however you actually split it, and it tells everyone exactly who owes whom — <strong>on every device, at the same time</strong>.
          </p>
          <div className="hero-cta reveal" style={S(3)}>
            <Link href="/signup" className="btn btn-primary btn-lg">
              Create an account <span className="arrow">→</span>
            </Link>
            <Link href="/login" className="btn btn-ghost btn-lg">I already have one</Link>
          </div>
          <p className="hero-note reveal" style={S(4)}>
            Free · nothing to install · <strong>your data lives in a Google Sheet you own</strong>
          </p>

          <div className="stage reveal" style={S(5)}>
            <SplitDemo />
            <p className="try-note">
              ↑ <strong>This one is real.</strong> Open an expense, settle someone&apos;s share, add
              your own — every balance recalculates with the same code the app runs. Nothing is saved.
            </p>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------ what it is */}
      <section className="lsection tint" id="what">
        <div className="container container-wide">
          <div className="sec-head center reveal">
            <span className="eyebrow">What it is</span>
            <h2>A ledger for money between friends.</h2>
            <p className="lede">
              One person books the flat. Someone else covers dinner, twice. A third gets the taxi.
              By day four nobody can reconstruct it. Splitplus is the shared record that can —
              <strong> and it does the arithmetic so nobody has to argue about it.</strong>
            </p>
          </div>

          <div className="lcards">
            {[
              ["📓", "Log what happened", "Add an expense as it happens: what it was, who paid, and how it splits. Anyone in the group can add one — it isn't one person's job to keep the books."],
              ["⚖️", "It works out who owes whom", "Every expense updates everyone’s balance at once. Open the group and the answer is right there, in plain words — who gets money back, who owes it, and exactly how much."],
              ["🤝", "Tick off debts as they're paid", "When someone pays you back, settle their share. It leaves both sides of the ledger at once, and you can undo it if you settled the wrong one."],
            ].map(([ico, h, p], i) => (
              <div className="lcard reveal" key={h as string} style={S(i)}>
                <div className="ico">{ico}</div>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>

          <div className="stats" style={{ marginTop: 50 }}>
            {[
              ["3", "ways to split: equally, exact amounts, or percentages"],
              ["1¢", "the largest rounding error you will ever see"],
              ["20s", "before an invite or expense reaches everyone else"],
              ["∞", "devices per account, all showing the same numbers"],
            ].map(([b, s], i) => (
              <div className="stat reveal" key={b} style={S(i)}>
                <b>{b}</b><span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- features */}
      <section className="lsection" id="features">
        <div className="container container-wide">
          <div className="sec-head center reveal" style={{ marginBottom: 70 }}>
            <span className="eyebrow">Features</span>
            <h2>The four things it does well.</h2>
          </div>

          {/* 1 — splits */}
          <div className="feature reveal">
            <div className="feature-text">
              <span className="eyebrow">Splits</span>
              <h3>Not everything splits four ways.</h3>
              <p>
                Equal is the default because it&apos;s usually right. When it isn&apos;t, enter the{" "}
                <strong>exact amounts</strong> or the <strong>percentages</strong>. Splitplus checks
                the arithmetic before it saves — if the shares don&apos;t reach the total it says so,
                rather than quietly losing three dollars. Equal splits distribute the leftover cents
                one at a time, so four ways into $41.30 is 10.33 + 10.33 + 10.32 + 10.32, not four
                roundings that don&apos;t add up.
              </p>
            </div>
            <div className="panel">
              <div className="panel-head">Apartment, 3 nights <span className="sp">$318.00</span></div>
              {[["Rohit", "double room", "$106.00"], ["Ana", "double room", "$106.00"],
                ["Marco", "single", "$74.00"], ["Jo", "sofa, paid less", "$32.00"]].map(([n, sub, amt]) => (
                <div className="panel-row" key={n}>
                  <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>{n.charAt(0)}</span>
                  <span>{n} <span className="sub">{sub}</span></span>
                  <span className="s">{amt}</span>
                </div>
              ))}
              <div className="panel-foot">
                <span className="pill pill-green">Adds up</span>
                <span>$318.00 of $318.00 assigned</span>
              </div>
            </div>
          </div>

          {/* 2 — settling */}
          <div className="feature flip reveal">
            <div className="feature-text">
              <span className="eyebrow">Settling up</span>
              <h3>Tick off debts one at a time.</h3>
              <p>
                Ana pays you back for dinner but Marco hasn&apos;t yet. <strong>Settle Ana&apos;s share
                alone</strong> and only her part of that bill leaves the books — hers and yours, both
                sides at once, so the ledger always balances to zero. Settled bills stay in the
                timeline, greyed out with a line through the amount, and one click puts them back if
                you settled the wrong one.
              </p>
            </div>
            <div className="panel">
              <div className="panel-head">Dinner at Ramiro <span className="sp">$148.00</span></div>
              {[["Ana", "$37.00", true], ["Marco", "$37.00", false], ["Jo", "$37.00", false]].map(([n, amt, done]) => (
                <div className="panel-row" key={n as string}>
                  <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>{(n as string).charAt(0)}</span>
                  <span style={done ? { opacity: .55 } : undefined}>{n}</span>
                  <span className="s" style={done ? { textDecoration: "line-through", color: "var(--ink-faint)" } : undefined}>
                    {amt}
                  </span>
                  <span className={`pill ${done ? "pill-green" : "pill-amber"}`} style={{ marginLeft: 8 }}>
                    {done ? "Settled" : "Owed"}
                  </span>
                </div>
              ))}
              <div className="panel-foot"><span>1 of 3 settled · $74.00 still owed</span></div>
            </div>
          </div>

          {/* 3 — sync */}
          <div className="feature reveal">
            <div className="feature-text">
              <span className="eyebrow">Sync</span>
              <h3>One account. Every device.</h3>
              <p>
                Sign up on a laptop, log in on your phone, and <strong>everything is already
                there</strong> — the groups, the expenses, the invites waiting for an answer. There is
                no &ldquo;export&rdquo; and no &ldquo;send me the sheet&rdquo;. Add an expense at the
                restaurant and it&apos;s on everyone else&apos;s screen within twenty seconds.
              </p>
            </div>
            <div className="panel">
              <div className="panel-head">Same group, two devices</div>
              <div className="panel-row">
                <span>💻 Laptop <span className="sub">Rohit adds &ldquo;Airport taxi&rdquo;, $41.30</span></span>
                <span className="s faint">now</span>
              </div>
              <div className="panel-row">
                <span>📱 Ana&apos;s phone <span className="sub">Balance moves to −$10.33</span></span>
                <span className="s faint">+12s</span>
              </div>
              <div className="panel-row">
                <span>📱 Marco&apos;s phone <span className="sub">Balance moves to −$10.32</span></span>
                <span className="s faint">+18s</span>
              </div>
              <div className="panel-foot">
                <span className="pill pill-green">Live</span>
                <span>Checked every 20 seconds while the page is open</span>
              </div>
            </div>
          </div>

          {/* 4 — invites */}
          <div className="feature flip reveal">
            <div className="feature-text">
              <span className="eyebrow">Groups</span>
              <h3>Invite by username, not email.</h3>
              <p>
                No invite links to chase and no email addresses to collect. Type someone&apos;s
                username and <strong>the invite appears on their device</strong>, whichever one they
                next open. They accept and see the whole history. Someone can also request to join
                with a group ID, and the admin approves or rejects it.
              </p>
            </div>
            <div className="panel">
              <div className="panel-head">Invites</div>
              {[["L", "Lisbon, four of us", "Rohit invited you"], ["F", "Flat 3B", "Ana invited you"]].map(([i, n, sub]) => (
                <div className="panel-row" key={n}>
                  <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>{i}</span>
                  <span>{n} <span className="sub">{sub}</span></span>
                  <span className="s" style={{ display: "flex", gap: 6 }}>
                    <span className="btn btn-primary btn-sm" style={{ pointerEvents: "none" }}>Accept</span>
                    <span className="btn btn-ghost btn-sm" style={{ pointerEvents: "none" }}>Decline</span>
                  </span>
                </div>
              ))}
              <div className="panel-foot"><span>Waiting on an answer from Marco</span></div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------ what it isn't */}
      <section className="lsection tint">
        <div className="container container-wide">
          <div className="sec-head center reveal">
            <span className="eyebrow">Scope</span>
            <h2>Four things it is not.</h2>
            <p className="lede">
              Knowing where something stops is more useful than a longer feature list.
            </p>
          </div>

          <div className="nots">
            {[
              ["Not a payment app", "It never moves money. Splitplus records that Ana owes you $37; Ana still pays you by whatever means you already use, and then one of you ticks it off."],
              ["Not connected to a bank", "There is nothing to link and no read access to any account. Every expense is one someone typed in, which is also why nothing shows up that you didn't put there."],
              ["No receipt scanning", "No photos, no OCR, no guessing at line items. A description and an amount, entered in about five seconds."],
              ["Not multi-currency", "One group, one currency, no conversion. If your trip crosses currencies you'll want to convert as you enter, or keep a group per currency."],
            ].map(([h, p], i) => (
              <div className="not reveal" key={h} style={S(i)}>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------ setup */}
      <section className="lsection" id="setup">
        <div className="container">
          <div className="sec-head reveal">
            <span className="eyebrow">Setup</span>
            <h2>About a minute, once.</h2>
            <p className="lede">
              Splitplus has no server. It reads and writes a <strong>Google Sheet you own</strong>,
              through a script you deploy yourself — so the data is yours, in the most portable format
              there is.
            </p>
          </div>

          <div className="steps">
            {[
              ["Make a sheet", "A blank Google Sheet. Extensions → Apps Script, paste in the Splitplus script, and run setup once to create the tabs."],
              ["Deploy it", "Deploy → Web app, executing as you, accessible to anyone with the link. Copy the URL it gives you into the app's config."],
              ["Create an account", "A username and a password. No email, no phone number, no confirmation link to go and find."],
              ["Invite your people", "Start a group, add them by username, and start logging expenses. Everyone sees the same numbers from then on."],
            ].map(([h, p], i) => (
              <div className="step reveal" key={h} style={S(i)}>
                <div><h3>{h}</h3><p>{p}</p></div>
              </div>
            ))}
          </div>

          <div className="tbl-wrap reveal">
            <div className="tbl-scroll">
              <table>
                <thead><tr><th>What</th><th>Where it lives</th><th>Who can read it</th></tr></thead>
                <tbody>
                  <tr>
                    <td className="what"><span className="dot g" />Groups &amp; expenses</td>
                    <td>Your sheet<span className="sub">One row per expense, one per group</span></td>
                    <td>Anyone with the script URL<span className="sub">Keep it to the people in your groups</span></td>
                  </tr>
                  <tr>
                    <td className="what"><span className="dot b" />Your password</td>
                    <td>Your sheet, as a SHA-256 hash<span className="sub">The plaintext never leaves your browser</span></td>
                    <td>Nobody usefully<span className="sub">A hash isn&apos;t a password</span></td>
                  </tr>
                  <tr>
                    <td className="what"><span className="dot a" />A local copy</td>
                    <td>Your browser<span className="sub">So the app opens instantly and survives a dead signal</span></td>
                    <td>Only that browser<span className="sub">Cleared when you clear site data</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="note reveal">
            <h3>One honest caveat</h3>
            <p>
              The script has no per-user authorization: anyone holding its URL can read the sheet
              behind it, not just their own rows. That&apos;s fine for a sheet you share with friends,
              and it is not fine for anything you&apos;d call sensitive. Treat the URL like the sheet
              itself.
            </p>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- cta */}
      <section className="lsection tint">
        <div className="container center reveal">
          <h2>Settle up like adults.</h2>
          <p className="lede" style={{ marginTop: 18 }}>
            It ends the &ldquo;wait, who paid for the taxi?&rdquo; conversation permanently.
          </p>
          <div className="hero-cta">
            <Link href="/signup" className="btn btn-primary btn-lg">
              Create an account <span className="arrow">→</span>
            </Link>
            <Link href="/login" className="btn btn-ghost btn-lg">Log in</Link>
          </div>
        </div>
      </section>

      <footer className="lfoot">
        <div className="container container-wide lfoot-in">
          <span className="brand-mark" style={{ width: 22, height: 22, fontSize: 12 }}>S</span>
          <span>Splitplus — free, and yours to host</span>
          <span className="sp">
            <Link href="/login">Log in</Link>
            <Link href="/signup">Sign up</Link>
            <a href="https://github.com/rohitshidid/splitplus">Source</a>
          </span>
        </div>
      </footer>
    </div>
  );
}
