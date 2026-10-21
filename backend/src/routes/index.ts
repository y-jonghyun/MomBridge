import { Router } from 'express';
import authRoutes from '../modules/auth/auth.routes';
import missionRoutes from '../modules/missions/missions.routes';
import submissionRoutes from '../modules/submissions/submissions.routes';
import operatorRoutes from '../modules/operator/operator.routes';
import participantRoutes from '../modules/participant/participant.routes';
import clientRoutes from '../modules/client/client.routes';
import communityRoutes from '../modules/community/community.routes';
import notificationRoutes from '../modules/notifications/notifications.routes';
import keywordRoutes from '../modules/keywords/keywords.routes';
import campaignRoutes from '../modules/reports/campaign.routes';
import publicReportRoutes from '../modules/reports/public-report.routes';
import operatorReportRoutes from '../modules/reports/operator-report.routes';
import settingsRoutes from '../modules/settings/settings.routes';
import internalRoutes from '../modules/jobs/internal.routes';
import reviewToolsRoutes from '../modules/review-check/review-tools.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/missions', missionRoutes);
router.use('/submissions', submissionRoutes);
router.use('/operator/reports', operatorReportRoutes);
router.use('/operator/settings', settingsRoutes);
router.use('/operator/tools', reviewToolsRoutes);
router.use('/operator', operatorRoutes);
router.use('/participant', participantRoutes);
router.use('/client', campaignRoutes);
router.use('/client', clientRoutes);
router.use('/community', communityRoutes);
router.use('/notifications', notificationRoutes);
router.use('/keywords', keywordRoutes);
router.use('/reports', publicReportRoutes);
router.use('/internal', internalRoutes);

export default router;
