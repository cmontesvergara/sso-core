import 'dotenv/config';
import { bootstrap } from './src-hex/interfaces/http/Bootstrap';

async function main(): Promise<void> {
  console.log('\n🚀 SSO Core — mode: [HEXAGONAL]\n');
  await bootstrap();
}

main().catch((err) => {
  console.error('❌ Fatal startup error:', err);
  process.exit(1);
});
