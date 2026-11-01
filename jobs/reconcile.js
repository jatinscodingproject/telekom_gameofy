const cron = require('node-cron');
const { Op } = require('sequelize');
const { Subscription } = require('../models');
const svc = require('../services/subscriptionService');
const { S } = require('../services/subscriptionState');

/**
 * Safety net for lost / late callbacks (Telkom retries callbacks for max 6 h, then gives up).
 *  A) PENDING > 10 min with a Telkom id  -> GET /subscription/{id} and apply the answer.
 *  B) PENDING > 24 h                     -> mark FAILED locally (user never confirmed / Wi-Fi row never matched).
 *  C) ACTIVE/SUSPENDED not heard of for 3 days -> verify with Telkom (renewals normally produce billing callbacks).
 */
let running = false;

async function run() {
  if (running) return;
  running = true;
  const stats = { synced: 0, abandoned: 0, verified: 0, errors: 0 };
  try {
    const now = Date.now();

    const pending = await Subscription.findAll({
      where: { status: S.PENDING, is_ad_hoc: false, subscription_id: { [Op.ne]: null },
               created_at: { [Op.lt]: new Date(now - 10 * 60 * 1000) } },
      limit: 200, order: [['id', 'ASC']]
    });
    for (const row of pending) {
      try { const r = await svc.syncFromTelkom(row); if (r.synced) stats.synced++; } catch { stats.errors++; }
    }

    const [abandoned] = await Subscription.update(
      { status: S.FAILED, reason: 'ABANDONED' },
      { where: { status: S.PENDING, created_at: { [Op.lt]: new Date(now - 24 * 3600 * 1000) } } }
    );
    stats.abandoned = abandoned;

    const stale = await Subscription.findAll({
      where: { status: { [Op.in]: [S.ACTIVE, S.SUSPENDED] }, is_ad_hoc: false, subscription_id: { [Op.ne]: null },
               [Op.or]: [{ last_callback_at: null }, { last_callback_at: { [Op.lt]: new Date(now - 3 * 24 * 3600 * 1000) } }],
               updated_at: { [Op.lt]: new Date(now - 3 * 24 * 3600 * 1000) } },
      limit: 100, order: [['updated_at', 'ASC']]
    });
    for (const row of stale) {
      try { const r = await svc.syncFromTelkom(row); if (r.synced) stats.verified++; await row.update({ updated_at: new Date() }); } catch { stats.errors++; }
    }

    if (Object.values(stats).some(Boolean)) console.log('[reconcile]', stats);
  } catch (err) {
    console.error('[reconcile] failed:', err.message);
  } finally { running = false; }
}

function start() {
  cron.schedule('*/10 * * * *', run);
  console.log('Reconcile job scheduled (every 10 min)');
}

module.exports = { start, run };
