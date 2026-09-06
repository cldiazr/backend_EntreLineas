const BASE = "http://localhost:4000/api";
const login = await fetch(BASE + "/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@entrelines.com", password: "admin123" }),
});
const loginData = await login.json();
if (login.status !== 200) { console.error("LOGIN FAIL", login.status, loginData); process.exit(1); }
console.log("LOGIN OK —", loginData.user?.name ?? loginData.user?.email);

const headers = { Authorization: `Bearer ${loginData.token}` };

const resW = await fetch(BASE + "/wallets", { headers });
const w = await resW.json();
console.log("wallets:", JSON.stringify(w.wallets));

const resD = await fetch(BASE + "/dashboard/summary", { headers });
const d = await resD.json();
console.log("summary:", JSON.stringify(d.summary));
console.log("latestRate:", d.latestRateVESPerUSD);

const resP = await fetch(BASE + "/employee-payments", { headers });
const p = await resP.json();
console.log("employee-payments count:", p.payments.length, "| status:", p.payments.map(x => x.status + ":" + x.currency + ":" + x.amountUSD).join(", "));

const resR = await fetch(BASE + "/roles", { headers }).catch(() => null);
if (resR) console.log("roles endpoint:", resR.status);