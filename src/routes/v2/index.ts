import { Router } from 'express';
import authV2Routes from './auth';
import roleV2Routes from './role';

const router = Router();

router.use('/auth', authV2Routes);
router.use('/role', roleV2Routes);

export default router;