import { Router } from 'express';
import authV2Routes from './auth';

const router = Router();

router.use('/auth', authV2Routes);

export default router;