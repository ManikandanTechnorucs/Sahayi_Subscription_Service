import { Router } from 'express';
import { container } from '../container';

const router = Router();

router.post('/', (req, res, next) => {
  void container.razorpayWebhookController.handle(req, res, next);
});

export default router;
