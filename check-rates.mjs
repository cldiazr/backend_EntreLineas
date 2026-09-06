import "dotenv/config";
import { Client } from "pg";
const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
const r = await c.query('SELECT id, "rateVESPerUSD", date FROM "ExchangeRate" ORDER BY date DESC');
console.log("count:", r.rows.length);
console.log(JSON.stringify(r.rows, null, 2));
await c.end();
