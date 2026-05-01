import 'dotenv/config';

const MODE = (process.env.SSO_MODE ?? 'legacy').toLowerCase();

async function main(): Promise<void> {
  console.log(`\n🚀 SSO Core — mode: [${MODE.toUpperCase()}]\n`);

  if (MODE === 'hexagonal') {
    const { bootstrap } = await import('./src-hex/interfaces/http/Bootstrap');
    await bootstrap();
  } else {
    const { bootstrap } = await import('./src/bootstrap');
    await bootstrap();
  }
}

main().catch((err) => {
  console.error('❌ Fatal startup error:', err);
  process.exit(1);
});
