import axios from 'axios';
import { dbAll, dbGet } from './database.js';

// Telegram üzerinden mesaj gönderen yardımcı fonksiyon
export const sendTelegramMessage = async (message) => {
  try {
    const tokenRow = await dbGet("SELECT deger FROM ayarlar WHERE anahtar = 'telegram_token'");
    const chatIdRow = await dbGet("SELECT deger FROM ayarlar WHERE anahtar = 'telegram_chat_id'");

    const token = tokenRow?.deger;
    const chatId = chatIdRow?.deger;

    if (!token || !chatId) {
      console.log('Telegram Bot Token veya Chat ID bulunamadı. Bildirim gönderimi atlandı.');
      return false;
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: chatId,
      text: message,
      parse_mode: 'HTML'
    });

    return response.data.ok;
  } catch (error) {
    console.error('Telegram bildirim gönderme hatası:', error.response?.data || error.message);
    return false;
  }
};

// Gün hesaplama fonksiyonu
const getDaysRemaining = (targetDateStr) => {
  if (!targetDateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
};

// Rutin sonraki tarihi hesaplama
const getNextRoutineDate = (lastDoneStr, periodMonths) => {
  if (!lastDoneStr) return null;
  const date = new Date(lastDoneStr);
  date.setMonth(date.getMonth() + parseInt(periodMonths, 10));
  return date;
};

// Tüm hatırlatıcıları tara ve gerekliyse Telegram bildirimi gönder
export const checkAndNotify = async () => {
  console.log('Hatırlatıcılar taranıyor...');
  try {
    const users = await dbAll("SELECT id, telegram_chat_id FROM kullanicilar WHERE telegram_chat_id IS NOT NULL AND telegram_chat_id != ''");
    const tokenRow = await dbGet("SELECT deger FROM ayarlar WHERE anahtar = 'telegram_token'");
    const token = tokenRow?.deger;

    if (!token) {
      console.log('Telegram Bot Token bulunamadı. Bildirim gönderimi atlandı.');
      return { success: false, error: 'Telegram bot token bulunamadı.' };
    }

    let totalSent = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const user of users) {
      const alerts = [];

      // 1. GIDALAR KONTROLÜ
      const gidalar = await dbAll("SELECT * FROM gidalar WHERE durum = 'bekliyor' AND kullanici_id = ?", [user.id]);
      const gidaAlerts = [];
      for (const gida of gidalar) {
        const days = getDaysRemaining(gida.skt);
        if (days !== null) {
          if (days < 0) {
            gidaAlerts.push(`⚠️ <b>${gida.urun_adi}</b> (S.K.T. ${Math.abs(days)} gün geçti!)`);
          } else if (days <= gida.hatirlatma_gun_kala) {
            gidaAlerts.push(`⏰ <b>${gida.urun_adi}</b> (${days === 0 ? 'Bugün son gün!' : days + ' gün kaldı'})`);
          }
        }
      }
      if (gidaAlerts.length > 0) {
        alerts.push(`🥑 <b>Gıda Son Kullanma Uyarıları:</b>\n${gidaAlerts.join('\n')}`);
      }

      // 2. FATURALAR KONTROLÜ
      const faturalar = await dbAll("SELECT * FROM faturalar WHERE durum = 'odenmedi' AND kullanici_id = ?", [user.id]);
      const faturaAlerts = [];
      for (const fatura of faturalar) {
        const days = getDaysRemaining(fatura.son_odeme_tarihi);
        if (days !== null) {
          if (days < 0) {
            faturaAlerts.push(`⚠️ <b>${fatura.fatura_adi}</b> (Son ödeme tarihi ${Math.abs(days)} gün geçti! Tutar: ${fatura.tutar || 0} TL)`);
          } else if (days <= fatura.hatirlatma_gun_kala) {
            faturaAlerts.push(`💵 <b>${fatura.fatura_adi}</b> (${days === 0 ? 'Bugün son ödeme günü!' : days + ' gün kaldı'} - Tutar: ${fatura.tutar || 0} TL)`);
          }
        }
      }
      if (faturaAlerts.length > 0) {
        alerts.push(`💸 <b>Fatura Son Ödeme Uyarıları:</b>\n${faturaAlerts.join('\n')}`);
      }

      // 3. GARANTİLER KONTROLÜ
      const garantiler = await dbAll("SELECT * FROM garantiler WHERE kullanici_id = ?", [user.id]);
      const garantiAlerts = [];
      for (const garanti of garantiler) {
        const days = getDaysRemaining(garanti.garanti_bitis);
        if (days !== null) {
          if (days < 0) {
            // Expired warranties don't need daily notification
          } else if (days <= garanti.hatirlatma_gun_kala) {
            garantiAlerts.push(`🔌 <b>${garanti.cihaz_adi}</b> (${garanti.marka_model || ''}) - Garanti bitimine ${days} gün kaldı.`);
          }
        }
      }
      if (garantiAlerts.length > 0) {
        alerts.push(`🛡️ <b>Garanti Süresi Uyarıları:</b>\n${garantiAlerts.join('\n')}`);
      }

      // 4. RUTİNLER KONTROLÜ
      const rutinler = await dbAll(`
        SELECT r.*, k.klasor_adi 
        FROM rutinler r 
        LEFT JOIN rutin_klasorleri k ON r.klasor_id = k.id
        WHERE r.kullanici_id = ?
      `, [user.id]);
      const rutinAlerts = [];
      for (const rutin of rutinler) {
        if (rutin.son_yapilma_tarihi) {
          const nextDate = getNextRoutineDate(rutin.son_yapilma_tarihi, rutin.periyot_ay);
          if (nextDate) {
            const diffDays = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays <= rutin.hatirlatma_gun_kala) {
              const folderText = rutin.klasor_adi ? `[${rutin.klasor_adi}] ` : '';
              if (diffDays < 0) {
                rutinAlerts.push(`🔁 <b>${folderText}${rutin.gorev_adi}</b> (Zamanı ${Math.abs(diffDays)} gün geçti!)`);
              } else {
                rutinAlerts.push(`🔁 <b>${folderText}${rutin.gorev_adi}</b> (Yapılmasına ${diffDays === 0 ? 'bugün son!' : diffDays + ' gün kaldı'})`);
              }
            }
          }
        } else {
          const folderText = rutin.klasor_adi ? `[${rutin.klasor_adi}] ` : '';
          rutinAlerts.push(`🔁 <b>${folderText}${rutin.gorev_adi}</b> (Henüz hiç yapılmadı!)`);
        }
      }
      if (rutinAlerts.length > 0) {
        alerts.push(`📅 <b>Rutin Görev Zamanı Uyarıları:</b>\n${rutinAlerts.join('\n')}`);
      }

      // EĞER UYARI VARSA TEK BİR MESAJDA BİRLEŞTİR VE GÖNDER
      if (alerts.length > 0) {
        const header = `🏠 <b>Akıllı Ev ve Yaşam Asistanı Günlük Özeti</b>\n<i>Tarih: ${today.toLocaleDateString('tr-TR')}</i>\n\n`;
        const finalMessage = header + alerts.join('\n\n');

        try {
          const url = `https://api.telegram.org/bot${token}/sendMessage`;
          await axios.post(url, {
            chat_id: user.telegram_chat_id,
            text: finalMessage,
            parse_mode: 'HTML'
          });
          totalSent++;
        } catch (error) {
          console.error(`User ${user.id} için Telegram bildirim gönderme hatası:`, error.response?.data || error.message);
        }
      }
    }

    console.log(`Bildirim özeti ${totalSent} kullanıcıya gönderildi.`);
    return { success: true, sentUsersCount: totalSent };
  } catch (error) {
    console.error('Hatırlatıcı tarama işlemi başarısız:', error);
    return { success: false, error: error.message };
  }
};
