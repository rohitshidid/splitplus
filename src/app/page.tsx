"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function Home() {
  useEffect(() => {
    // Everything enters the same way, once, as it comes into view.
    const items = Array.from(document.querySelectorAll<HTMLElement>(".reveal"));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduce) {
      items.forEach(el => el.classList.add("in"));
    } else {
      const io = new IntersectionObserver(
        entries => entries.forEach(e => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
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
    }
  }, []);

  return (
    <div className="landing">
      <nav className="lnav">
        <div className="container container-wide lnav-in">
          <span className="brand-mark">S</span>
          <span className="nav-name" style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.015em" }}>Splitplus</span>
          <div className="lnav-links">
            <a className="opt" href="#how">How it works</a>
            <a className="opt" href="#splits">Splits</a>
            <a className="opt" href="#sync">Sync</a>
            <Link href="/login">Log in</Link>
            <Link href="/signup" className="btn btn-primary btn-sm">Sign up</Link>
          </div>
        </div>
      </nav>

      {/* ------------------------------------------------------------ hero */}
      <header className="hero">
        <div className="container container-wide">
          <div className="hero-mark reveal" style={{ "--i": 0 } as React.CSSProperties}>S</div>
          <h1 className="reveal" style={{ "--i": 1 } as React.CSSProperties}>
            Nobody remembers who paid for dinner.
          </h1>
          <p className="lede reveal" style={{ "--i": 2 } as React.CSSProperties}>
            Splitplus keeps the running total for a group of friends, a flat, or a trip —
            <strong> down to the cent, split however you actually split it</strong>, and the same
            on every phone in the group.
          </p>
          <div className="hero-cta reveal" style={{ "--i": 3 } as React.CSSProperties}>
            <Link href="/signup" className="btn btn-primary btn-lg">
              Create an account <span className="arrow">→</span>
            </Link>
            <Link href="/login" className="btn btn-ghost btn-lg">I already have one</Link>
          </div>
          <p className="hero-note reveal" style={{ "--i": 4 } as React.CSSProperties}>
            Free · no app to install · your data lives in a Google Sheet you own
          </p>

          {/* The hero mockup. Structured so a real screenshot drops straight in:
              replace the contents of .win-body with an <img> and nothing else moves. */}
          <div className="stage reveal" style={{ "--i": 5 } as React.CSSProperties}>
            <div className="win">
              <div className="win-bar">
                <i /><i /><i />
                <span className="win-title">Splitplus — Lisbon, four of us</span>
              </div>
              <div className="win-body">
                <div className="g-head">
                  <div className="avatar">L</div>
                  <div className="grow">
                    <div className="g-title">Lisbon, four of us</div>
                    <div className="g-sub">4 members · 11 expenses · last updated 2 minutes ago</div>
                  </div>
                  <span className="pill pill-green">All synced</span>
                </div>

                <div className="g-main">
                  <div className="g-col">
                    <div className="g-label">Balances</div>
                    <div className="g-bal">
                      <span className="avatar">R</span>
                      <span className="nm">Rohit <span style={{ color: "var(--ink-faint)", fontWeight: 400 }}>(you)</span></span>
                      <span className="amt up">gets back €84.20</span>
                    </div>
                    <div className="g-bal">
                      <span className="avatar">A</span>
                      <span className="nm">Ana</span>
                      <span className="amt down">owes €31.75</span>
                    </div>
                    <div className="g-bal">
                      <span className="avatar">M</span>
                      <span className="nm">Marco</span>
                      <span className="amt down">owes €52.45</span>
                    </div>
                    <div className="g-bal">
                      <span className="avatar">J</span>
                      <span className="nm">Jo</span>
                      <span className="amt flat">settled up</span>
                    </div>
                    <div className="bar" title="Share of the total each person has fronted">
                      <i style={{ width: "44%", background: "var(--accent)" }} />
                      <i style={{ width: "23%", background: "#3fb98a" }} />
                      <i style={{ width: "19%", background: "#7fd0b1" }} />
                      <i style={{ width: "14%", background: "#c2e6d8" }} />
                    </div>
                    <div style={{ fontSize: 10.5, color: "var(--ink-faint)", marginTop: 6 }}>
                      Share of the €612.80 fronted so far
                    </div>
                  </div>

                  <div className="g-col">
                    <div className="g-label">Recent expenses</div>
                    <div className="g-exp">
                      <span className="ic">🍽</span>
                      <span>
                        <span className="d">Dinner at Ramiro</span>
                        <span className="m">Rohit paid · split equally</span>
                      </span>
                      <span className="v">€148.00<span>€37.00 each</span></span>
                    </div>
                    <div className="g-exp">
                      <span className="ic">🏠</span>
                      <span>
                        <span className="d">Apartment, 3 nights</span>
                        <span className="m">Ana paid · exact amounts</span>
                      </span>
                      <span className="v">€318.00<span>4 shares</span></span>
                    </div>
                    <div className="g-exp">
                      <span className="ic">🚕</span>
                      <span>
                        <span className="d">Airport taxi</span>
                        <span className="m">Marco paid · split equally</span>
                      </span>
                      <span className="v">€41.30<span>€10.33 each</span></span>
                    </div>
                    <div className="g-exp">
                      <span className="ic">🎟</span>
                      <span>
                        <span className="d">Tram passes</span>
                        <span className="m">Rohit paid · 40 / 30 / 20 / 10%</span>
                      </span>
                      <span className="v">€105.50<span>by percentage</span></span>
                    </div>
                  </div>
                </div>

                <div className="g-foot">
                  <span className="pill pill-green">Jo settled up</span>
                  <span style={{ color: "var(--ink-faint)", fontSize: 11.5 }}>2 settlements left</span>
                  <span className="tot">
                    <b>€612.80</b>
                    <span>total tracked</span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* ----------------------------------------------------------- stats */}
      <section className="lsection tint">
        <div className="container container-wide">
          <div className="stats">
            {[
              ["3", "ways to split: equally, exact amounts, or percentages"],
              ["1¢", "the largest rounding error you will ever see"],
              ["0", "apps to install — it runs in the browser you have"],
              ["∞", "devices per account, all showing the same numbers"],
            ].map(([b, s], i) => (
              <div className="stat reveal" key={b} style={{ "--i": i } as React.CSSProperties}>
                <b>{b}</b>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- problem */}
      <section className="lsection">
        <div className="container container-wide">
          <div className="sec-head center reveal">
            <span className="eyebrow">The problem</span>
            <h2>The group chat is not a ledger.</h2>
            <p className="lede">
              Someone fronts the apartment. Someone else covers dinner twice. Three days later
              there is a photo of a receipt, a message saying <em>&ldquo;i&rsquo;ll get the next one&rdquo;</em>,
              and <strong>no one has any idea who is up and who is down.</strong>
            </p>
          </div>

          <div className="lcards">
            {[
              ["🧮", "It does the arithmetic", "Every expense updates four balances at once. You never open a calculator, and you never argue about a number that a calculator would have settled."],
              ["🎯", "Splits that match reality", "Two people shared the room, one had the sofa, one didn't drink. Exact amounts and percentages are first-class, not a workaround."],
              ["📱", "The same on everyone's phone", "Add an expense on a laptop, and it's on your friend's phone before they've put it down. No exports, no \"send me the sheet\"."],
            ].map(([ico, h, p], i) => (
              <div className="lcard reveal" key={h as string} style={{ "--i": i } as React.CSSProperties}>
                <div className="ico">{ico}</div>
                <h3>{h}</h3>
                <p>{p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section className="lsection tint" id="splits">
        <div className="container container-wide">
          <div className="feature reveal">
            <div className="feature-text">
              <span className="eyebrow">Splits</span>
              <h3 style={{ marginTop: 14 }}>Not everything splits four ways.</h3>
              <p>
                Equal is the default because it&rsquo;s usually right. When it isn&rsquo;t, put in the{" "}
                <strong>exact amounts</strong> or the <strong>percentages</strong> and Splitplus checks your
                arithmetic before it saves — if the shares don&rsquo;t add up to the total, it says so
                rather than quietly losing three euros.
              </p>
            </div>
            <div className="panel">
              <div className="panel-head">Apartment, 3 nights <span className="sp">€318.00</span></div>
              <div className="panel-row">
                <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>R</span>
                <span>Rohit <span className="sub">double room</span></span>
                <span className="s">€106.00</span>
              </div>
              <div className="panel-row">
                <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>A</span>
                <span>Ana <span className="sub">double room</span></span>
                <span className="s">€106.00</span>
              </div>
              <div className="panel-row">
                <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>M</span>
                <span>Marco <span className="sub">single</span></span>
                <span className="s">€74.00</span>
              </div>
              <div className="panel-row">
                <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>J</span>
                <span>Jo <span className="sub">sofa, paid less</span></span>
                <span className="s">€32.00</span>
              </div>
              <div className="panel-foot">
                <span className="pill pill-green">Adds up</span>
                <span>€318.00 of €318.00 assigned</span>
              </div>
            </div>
          </div>

          <div className="feature flip reveal" id="sync">
            <div className="feature-text">
              <span className="eyebrow">Sync</span>
              <h3 style={{ marginTop: 14 }}>One account. Every device.</h3>
              <p>
                Sign up on a laptop, log in on a phone, and <strong>everything is already there</strong> —
                the groups, the expenses, the invites waiting for an answer. Nothing to connect, nothing
                to configure, no copy of the data that can drift out of date.
              </p>
            </div>
            <div className="panel">
              <div className="panel-head">Invites</div>
              <div className="panel-row">
                <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>L</span>
                <span>Lisbon, four of us <span className="sub">Rohit invited you</span></span>
                <span className="s" style={{ display: "flex", gap: 6 }}>
                  <span className="btn btn-primary btn-sm" style={{ pointerEvents: "none" }}>Accept</span>
                  <span className="btn btn-ghost btn-sm" style={{ pointerEvents: "none" }}>Decline</span>
                </span>
              </div>
              <div className="panel-row">
                <span className="avatar" style={{ width: 24, height: 24, fontSize: 10.5 }}>F</span>
                <span>Flat 3B <span className="sub">Ana invited you</span></span>
                <span className="s" style={{ display: "flex", gap: 6 }}>
                  <span className="btn btn-primary btn-sm" style={{ pointerEvents: "none" }}>Accept</span>
                  <span className="btn btn-ghost btn-sm" style={{ pointerEvents: "none" }}>Decline</span>
                </span>
              </div>
              <div className="panel-foot">
                <span className="pill pill-green">Live</span>
                <span>Checked every 20 seconds while the page is open</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- how */}
      <section className="lsection" id="how">
        <div className="container">
          <div className="sec-head reveal">
            <span className="eyebrow">How it works</span>
            <h2>Four steps, then never again.</h2>
          </div>
          <div className="steps">
            {[
              ["Make an account", "A username and a password. No email, no phone number, no confirmation link to go and find."],
              ["Start a group", "Name it after the trip, the flat, or the people. You're the admin, which only means you decide who gets in."],
              ["Invite by username", "They get the invite on their own device, whichever one they next open. Accept, and they see the whole history."],
              ["Add expenses as they happen", "Who paid, how much, and how it splits. The balances move immediately, for everyone."],
            ].map(([h, p], i) => (
              <div className="step reveal" key={h as string} style={{ "--i": i } as React.CSSProperties}>
                <div>
                  <h3>{h}</h3>
                  <p>{p}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- data & trust */}
      <section className="lsection tint">
        <div className="container container-wide">
          <div className="sec-head center reveal">
            <span className="eyebrow">Where your data lives</span>
            <h2>In a spreadsheet you can open.</h2>
            <p className="lede">
              Splitplus has no server of its own. It talks to a <strong>Google Sheet you own</strong>,
              through a script you deploy once. If you ever want out, the data is already in the
              most portable format there is.
            </p>
          </div>

          <div className="tbl-wrap reveal">
            <div className="tbl-scroll">
              <table>
                <thead>
                  <tr><th>What</th><th>Where it lives</th><th>Who can read it</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="what"><span className="dot g" />Groups &amp; expenses</td>
                    <td>Your sheet<span className="sub">One row per expense, one per group</span></td>
                    <td>Anyone with the script URL<span className="sub">Keep it to the people in your groups</span></td>
                  </tr>
                  <tr>
                    <td className="what"><span className="dot b" />Your password</td>
                    <td>Your sheet, as a SHA-256 hash<span className="sub">The plaintext never leaves the browser</span></td>
                    <td>Nobody usefully<span className="sub">A hash isn&rsquo;t a password</span></td>
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
              The script has no per-user authorization: anyone who has its URL can read the sheet
              behind it. That&rsquo;s fine for a sheet you share with friends, and it is not fine for
              anything you&rsquo;d call sensitive. Treat the URL like the sheet itself.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- cta */}
      <section className="lsection">
        <div className="container center reveal">
          <h2>Settle up like adults.</h2>
          <p className="lede" style={{ marginTop: 18 }}>
            It takes about a minute to set up, and it ends the &ldquo;wait, who paid for the taxi&rdquo;
            conversation permanently.
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
