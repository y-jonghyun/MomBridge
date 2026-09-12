import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import missionRoutes from '../modules/missions/missions.routes';
import submissionRoutes from '../modules/submissions/submissions.routes';
import operatorRoutes from '../modules/operator/operator.routes';
import participantRoutes from '../modules/participant/participant.routes';
import clientRoutes from '../modules/client/client.routes';
import communityRoutes from '../modules/community/community.routes';
import notificationRoutes from '../modules/notifications/notifications.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/missions', missionRoutes);
router.use('/submissions', submissionRoutes);
router.use('/operator', operatorRoutes);
router.use('/participant', participantRoutes);
router.use('/client', clientRoutes);
router.use('/community', communityRoutes);
router.use('/notifications', notificationRoutes);

export default router;
