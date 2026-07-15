import cron from 'node-cron';
import { checkAndNotify } from './notifications.js';

export const initCronJobs = () => {
  // Her gün gece yarısı (00:00) çalıştır
  cron.schedule('0 0 * * *', async () => {
    console.log('Zamanlanmış kontrol tetiklendi (Saat 00:00).');
    await checkAndNotify();
  });

  console.log('Cron Job zamanlayıcısı kuruldu (Her gün 00:00).');
};
