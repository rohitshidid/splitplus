"use client";

import Link from "next/link";
import BrandIcon from "@/components/BrandIcon";

/** The one persistent chrome across the signed-in app. */
export default function AppBar({ right }: { right?: React.ReactNode }) {
    return (
        <div className="appbar">
            <div className="container appbar-in">
                <Link href="/dashboard" className="brand" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <BrandIcon size={30} />
                    Splitplus
                </Link>
                <div className="row" style={{ marginLeft: "auto" }}>{right}</div>
            </div>
        </div>
    );
}
