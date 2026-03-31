const cron = require('node-cron');
const { PrismaClient } = require('@prisma/client');
const { triggerCall } = require('../routes/ivr');

const prisma = new PrismaClient();

/**
 * Lance le scheduler IVR.
 * Toutes les minutes, il vérifie quelles MPMEs ont configuré
 * un appel vocal et si l'heure est venue de les appeler.
 */
function startIVRScheduler() {
  if (!process.env.TWILIO_ACCOUNT_SID) {
    console.log('⚠️  IVR Scheduler désactivé (TWILIO_ACCOUNT_SID manquant)');
    return;
  }

  console.log('⏰ IVR Scheduler démarré — vérification chaque minute');

  // Tourne chaque minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Chercher toutes les MPMEs dont l'heure d'appel correspond à maintenant
      const profiles = await prisma.mPMEProfile.findMany({
        where: {
          ivrPhone: { not: null },
          ivrTime: hhmm,
        },
      });

      if (profiles.length === 0) return;

      console.log(`📞 IVR Scheduler — ${profiles.length} appel(s) à déclencher à ${hhmm}`);

      for (const profile of profiles) {
        // Vérifier qu'on n'a pas déjà appelé aujourd'hui
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const alreadyCalled = await prisma.iVRSession.findFirst({
          where: {
            mpmeId: profile.id,
            createdAt: { gte: today },
            status: { in: ['active', 'completed', 'pending'] },
          },
        });

        if (alreadyCalled) {
          console.log(`⏭️  MPME ${profile.id} déjà appelée aujourd'hui`);
          continue;
        }

        try {
          await triggerCall(profile);
        } catch (err) {
          console.error(`❌ Erreur appel MPME ${profile.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('❌ IVR Scheduler erreur:', err);
    }
  });
}

module.exports = { startIVRScheduler };
