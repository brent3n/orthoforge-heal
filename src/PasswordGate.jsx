import { useState, useEffect } from "react";

// ─── Password Configuration ─────────────────────────────────
// The password is stored as a reversed base64 string for basic obfuscation.
// To change the password:
//   1. Go to https://www.base64encode.org
//   2. Encode your new password
//   3. Reverse the resulting string
//   4. Replace the value below
// Current password: OFI2026-v7
const _k = "==wN21iNyAjMJZ0T";  // reversed base64 of "OFI2026-v7" T0ZJMjAyNi12Nwo=
const _d = (s) => { try { return atob(s.split("").reverse().join("")); } catch { return ""; } };

export default function PasswordGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (sessionStorage.getItem("ofi_auth") === "1") {
      setAuthenticated(true);
    }
  }, []);

  const handleSubmit = () => {
    if (password === _d(_k)) {
      sessionStorage.setItem("ofi_auth", "1");
      setAuthenticated(true);
    } else {
      setError("Incorrect password. Please contact your administrator.");
      setPassword("");
    }
  };

  if (authenticated) return children;

  return (
    <div style={{ minHeight: "100vh", background: "#0d1117", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0d1117; margin: 0; }
      `}</style>
      <div style={{ background: "#161b22", borderRadius: 16, padding: "48px 40px", maxWidth: 420, width: "90%", border: "1px solid #2d333b", boxShadow: "0 8px 32px rgba(0,0,0,0.4)", textAlign: "center" }}>
        <img src="./orthoforge-logo.png" alt="OrthoForge" style={{ width: 80, height: 80, objectFit: "contain", marginBottom: 16 }} />
        <h1 style={{ color: "#30b8c9", fontSize: 24, fontWeight: 700, marginBottom: 8, letterSpacing: 0.5 }}>OrthoForge</h1>
        <p style={{ color: "#8b949e", fontSize: 14, marginBottom: 32 }}>Healing Analysis Dashboard</p>

        <input
          type="password"
          placeholder="Enter access password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(""); }}
          onKeyDown={(e) => e.key === "Enter" && password && handleSubmit()}
          autoFocus
          style={{ width: "100%", padding: "12px 16px", background: "#0d1117", color: "#e6edf3", border: `1px solid ${error ? "#f85149" : "#444c56"}`, borderRadius: 8, fontSize: 15, fontFamily: "'JetBrains Mono', monospace", outline: "none", textAlign: "center", letterSpacing: 2, marginBottom: 16 }}
        />

        {error && <p style={{ color: "#f85149", fontSize: 13, marginBottom: 16, fontWeight: 500 }}>{error}</p>}

        <button
          onClick={handleSubmit}
          disabled={!password}
          style={{ width: "100%", padding: "12px 24px", background: !password ? "#1a3a40" : "#30b8c9", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: !password ? "default" : "pointer", fontFamily: "'DM Sans', sans-serif", opacity: !password ? 0.5 : 1 }}
        >
          Sign In
        </button>

        <p style={{ color: "#484f58", fontSize: 11, marginTop: 24 }}>Authorized clinical use only</p>
      </div>
    </div>
  );
}
