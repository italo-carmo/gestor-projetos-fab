const { Client } = require("pg");
const c = new Client({ connectionString: "postgresql://smif:smif@localhost:5432/smif_gestao" });

async function run() {
  await c.connect();

  const r1 = await c.query(`
    SELECT DATE("submittedAt") as d, COUNT(*) as cnt 
    FROM "BiCpcaMeetingResponse" 
    WHERE "submittedAt" IS NOT NULL 
    GROUP BY DATE("submittedAt") 
    ORDER BY d
  `);
  console.log("=== submittedAt dates ===");
  r1.rows.forEach(row => console.log(`${row.d} -> ${row.cnt} respostas`));

  const r2 = await c.query(`
    SELECT id, "submittedAt", "createdAt", "sourceRow", "answersJson"
    FROM "BiCpcaMeetingResponse" 
    WHERE "submittedAt" >= '2026-09-01' AND "submittedAt" < '2026-10-01'
    LIMIT 5
  `);
  console.log("\n=== Records with Sept 2026 ===");
  r2.rows.forEach(row => {
    console.log("Row " + row.sourceRow + " | submittedAt: " + row.submittedAt);
    const answers = typeof row.answersJson === 'string' ? JSON.parse(row.answersJson) : row.answersJson;
    if (answers) {
      const keys = Object.keys(answers).slice(0, 3);
      keys.forEach(k => console.log("  " + k + " = " + String(answers[k]).substring(0, 80)));
    }
  });

  // Also check if inferSubmittedAtFromPayload might be generating bad dates
  const r3 = await c.query(`
    SELECT id, "submittedAt", "createdAt", "sourceRow"
    FROM "BiCpcaMeetingResponse" 
    WHERE "submittedAt" IS NULL
    LIMIT 3
  `);
  console.log("\n=== Null submittedAt samples ===");
  r3.rows.forEach(row => console.log(JSON.stringify(row)));

  // Check total
  const r4 = await c.query(`SELECT COUNT(*) as total FROM "BiCpcaMeetingResponse"`);
  console.log("\nTotal responses: " + r4.rows[0].total);

  await c.end();
}
run().catch(e => { console.error(e); process.exit(1); });
