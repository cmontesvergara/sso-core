#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function auditV2Tokens() {
  console.log("🔍 Auditando tokens V2...\\n");
  const TIME_WINDOW = 2;

  const sessions = await prisma.$queryRaw`SELECT id, session_token, user_id, app_id, created_at, expires_at FROM app_sessions WHERE created_at > NOW() - INTERVAL '30 days' ORDER BY created_at DESC LIMIT 1000;`;

  console.log(`Total: ${sessions.length}`);

  let v2Count = 0;
  let hexCount = 0;
  const v2Sessions = [];

  for (const s of sessions) {
    const rts = await prisma.$queryRaw`SELECT id FROM refresh_tokens WHERE user_id = ${s.user_id}::uuid AND created_at BETWEEN ${s.created_at}::timestamp - INTERVAL '${TIME_WINDOW} minutes' AND ${s.created_at}::timestamp + INTERVAL '${TIME_WINDOW} minutes' LIMIT 1;`;
    if (rts.length === 0) { v2Count++; v2Sessions.push(s); } else { hexCount++; }
  }

  console.log(`✅ Hex: ${hexCount}`);
  console.log(`⚠️  V2: ${v2Count}`);

  const now = new Date();
  const active = v2Sessions.filter(s => new Date(s.expires_at) > now);
  console.log(`🚨 Activas: ${active.length}`);

  if (active.length === 0) console.log("✅ Seguro eliminar V2");
  else {
    const users = [...new Set(active.map(s => s.user_id))];
    console.log(`⚠️  Usuarios afectados: ${users.length}`);
  }

  await prisma.$disconnect();
  process.exit(active.length > 0 ? 1 : 0);
}

auditV2Tokens().catch(e => { console.error(e); process.exit(1); });
