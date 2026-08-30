"use client";

import Link from "next/link";

/** The one persistent chrome across the signed-in app. */
export default function AppBar({ right }: { right?: React.ReactNode }) {
    return (
        <div className="appbar">
            <div className="container appbar-in">
                <Link href="/dashboard" className="brand">
                    <span className="brand-mark">S</span>
                    Splitplus
                </Link>
                <div className="row" style={{ marginLeft: "auto" }}>{right}</div>
            </div>
        </div>
    );
}
