import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import { initDatabase, dbRun, dbAll, dbGet } from './database.js';
import { initCronJobs } from './cron-jobs.js';
import { checkAndNotify, sendTelegramMessage } from './notifications.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// İzin verilen origin'ler (Vercel URL'nizi deploy sonrası güncelleyin)
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:3000',
  process.env.FRONTEND_URL || 'https://ev-takip-frontend.vercel.app'
];

app.use(cors({
  origin: function (origin, callback) {
    // Postman gibi araçlar için origin olmayabilir, izin ver
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('CORS politikasından dolayı bu kaynağa erişim engellendi: ' + origin));
    }
  },
  credentials: true
}));
app.use(express.json());

// Veritabanı tablolarını oluştur
await initDatabase();

// Cron görevlerini başlat
initCronJobs();

const JWT_SECRET = process.env.JWT_SECRET || 'gizli_anahtar_123';

// Auth Middleware
export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Yetkilendirme başlığı bulunamadı.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token bulunamadı.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // { id, eposta }
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token.' });
  }
};

// -------------------------------------------------------------
// USER AUTHENTICATION ENDPOINTS
// -------------------------------------------------------------
app.post('/api/auth/register', async (req, res) => {
  const { isim, eposta, sifre } = req.body;
  if (!isim || !eposta || !sifre) {
    return res.status(400).json({ error: 'Lütfen isim, e-posta ve şifre alanlarını doldurun.' });
  }

  try {
    // E-posta benzersizlik kontrolü
    const existingUser = await dbGet("SELECT id FROM kullanicilar WHERE eposta = ?", [eposta.toLowerCase()]);
    if (existingUser) {
      return res.status(400).json({ error: 'Bu e-posta adresi zaten kullanımda.' });
    }

    // Şifreyi hashle
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(sifre, salt);

    // Kullanıcıyı veritabanına kaydet
    const result = await dbRun(
      "INSERT INTO kullanicilar (isim, eposta, sifre) VALUES (?, ?, ?)",
      [isim, eposta.toLowerCase(), hashedPassword]
    );

    // JWT token oluştur
    const token = jwt.sign({ id: result.id, eposta: eposta.toLowerCase() }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      token,
      user: {
        id: result.id,
        isim,
        eposta: eposta.toLowerCase()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { eposta, sifre } = req.body;
  if (!eposta || !sifre) {
    return res.status(400).json({ error: 'Lütfen e-posta ve şifre girin.' });
  }

  try {
    const user = await dbGet("SELECT * FROM kullanicilar WHERE eposta = ?", [eposta.toLowerCase()]);
    if (!user) {
      return res.status(400).json({ error: 'Hatalı e-posta veya şifre.' });
    }

    const isMatch = await bcrypt.compare(sifre, user.sifre);
    if (!isMatch) {
      return res.status(400).json({ error: 'Hatalı e-posta veya şifre.' });
    }

    const token = jwt.sign({ id: user.id, eposta: user.eposta }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        isim: user.isim,
        eposta: user.eposta,
        telegram_chat_id: user.telegram_chat_id
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await dbGet("SELECT id, isim, eposta, telegram_chat_id FROM kullanicilar WHERE id = ?", [req.user.id]);
    if (!user) {
      return res.status(404).json({ error: 'Kullanıcı bulunamadı.' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// DASHBOARD ENDPOINT
// -------------------------------------------------------------
app.get('/api/dashboard-summary', authMiddleware, async (req, res) => {
  try {
    const todayStr = new Date().toISOString().split('T')[0];

    // Gıdalar Özeti
    const gidalar = await dbAll("SELECT * FROM gidalar WHERE durum = 'bekliyor' AND kullanici_id = ?", [req.user.id]);
    let gidaAlertCount = 0;
    gidalar.forEach(g => {
      const diffTime = new Date(g.skt) - new Date(todayStr);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= g.hatirlatma_gun_kala) {
        gidaAlertCount++;
      }
    });

    // Faturalar Özeti
    const faturalar = await dbAll("SELECT * FROM faturalar WHERE durum = 'odenmedi' AND kullanici_id = ?", [req.user.id]);
    let faturaAlertCount = 0;
    let toplamBorc = 0;
    faturalar.forEach(f => {
      toplamBorc += f.tutar || 0;
      const diffTime = new Date(f.son_odeme_tarihi) - new Date(todayStr);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= f.hatirlatma_gun_kala) {
        faturaAlertCount++;
      }
    });

    // Garantiler Özeti
    const garantiler = await dbAll("SELECT * FROM garantiler WHERE kullanici_id = ?", [req.user.id]);
    let garantiAlertCount = 0;
    garantiler.forEach(g => {
      const diffTime = new Date(g.garanti_bitis) - new Date(todayStr);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays >= 0 && diffDays <= g.hatirlatma_gun_kala) {
        garantiAlertCount++;
      }
    });

    // Rutinler Özeti
    const rutinler = await dbAll("SELECT * FROM rutinler WHERE kullanici_id = ?", [req.user.id]);
    let rutinAlertCount = 0;
    rutinler.forEach(r => {
      if (r.son_yapilma_tarihi) {
        const nextDate = new Date(r.son_yapilma_tarihi);
        nextDate.setMonth(nextDate.getMonth() + r.periyot_ay);
        const diffTime = nextDate - new Date(todayStr);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (diffDays <= r.hatirlatma_gun_kala) {
          rutinAlertCount++;
        }
      } else {
        rutinAlertCount++;
      }

      if (r.hedef_km && r.mevcut_km) {
        const kalan = r.hedef_km - r.mevcut_km;
        if (kalan <= 500) {
          rutinAlertCount++;
        }
      }
    });

    res.json({
      gidalar: { toplam: gidalar.length, uyarilar: gidaAlertCount },
      faturalar: { toplam: faturalar.length, uyarilar: faturaAlertCount, toplamBorc },
      garantiler: { toplam: garantiler.length, uyarilar: garantiAlertCount },
      rutinler: { toplam: rutinler.length, uyarilar: rutinAlertCount }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 1. GIDALAR ENDPOINTS
// -------------------------------------------------------------
app.get('/api/gidalar', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM gidalar WHERE kullanici_id = ? ORDER BY skt ASC", [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/gidalar', authMiddleware, async (req, res) => {
  const { urun_adi, kategori, skt, hatirlatma_gun_kala, durum } = req.body;
  if (!urun_adi || !skt) {
    return res.status(400).json({ error: 'Urun adı ve SKT gereklidir.' });
  }
  try {
    const result = await dbRun(
      "INSERT INTO gidalar (kullanici_id, urun_adi, kategori, skt, hatirlatma_gun_kala, durum) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, urun_adi, kategori || '', skt, hatirlatma_gun_kala ?? 3, durum || 'bekliyor']
    );
    res.status(201).json({ id: result.id, urun_adi, kategori, skt, hatirlatma_gun_kala, durum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/gidalar/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { urun_adi, kategori, skt, hatirlatma_gun_kala, durum } = req.body;
  try {
    await dbRun(
      "UPDATE gidalar SET urun_adi = ?, kategori = ?, skt = ?, hatirlatma_gun_kala = ?, durum = ? WHERE id = ? AND kullanici_id = ?",
      [urun_adi, kategori, skt, hatirlatma_gun_kala, durum, id, req.user.id]
    );
    res.json({ message: 'Gıda başarıyla güncellendi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/gidalar/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM gidalar WHERE id = ? AND kullanici_id = ?", [id, req.user.id]);
    res.json({ message: 'Gıda başarıyla silindi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 2. FATURALAR ENDPOINTS
// -------------------------------------------------------------
app.get('/api/faturalar', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM faturalar WHERE kullanici_id = ? ORDER BY son_odeme_tarihi ASC", [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/faturalar', authMiddleware, async (req, res) => {
  const { fatura_adi, tutar, son_odeme_tarihi, hatirlatma_gun_kala, durum } = req.body;
  if (!fatura_adi || !son_odeme_tarihi) {
    return res.status(400).json({ error: 'Fatura adı ve Son Ödeme Tarihi gereklidir.' });
  }
  try {
    const result = await dbRun(
      "INSERT INTO faturalar (kullanici_id, fatura_adi, tutar, son_odeme_tarihi, hatirlatma_gun_kala, durum) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, fatura_adi, tutar || 0, son_odeme_tarihi, hatirlatma_gun_kala ?? 5, durum || 'odenmedi']
    );
    res.status(201).json({ id: result.id, fatura_adi, tutar, son_odeme_tarihi, hatirlatma_gun_kala, durum });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/faturalar/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { fatura_adi, tutar, son_odeme_tarihi, hatirlatma_gun_kala, durum } = req.body;
  try {
    await dbRun(
      "UPDATE faturalar SET fatura_adi = ?, tutar = ?, son_odeme_tarihi = ?, hatirlatma_gun_kala = ?, durum = ? WHERE id = ? AND kullanici_id = ?",
      [fatura_adi, tutar, son_odeme_tarihi, hatirlatma_gun_kala, durum, id, req.user.id]
    );
    res.json({ message: 'Fatura başarıyla güncellendi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/faturalar/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM faturalar WHERE id = ? AND kullanici_id = ?", [id, req.user.id]);
    res.json({ message: 'Fatura başarıyla silindi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 3. GARANTİLER ENDPOINTS
// -------------------------------------------------------------
app.get('/api/garantiler', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM garantiler WHERE kullanici_id = ? ORDER BY garanti_bitis ASC", [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/garantiler', authMiddleware, async (req, res) => {
  const { cihaz_adi, marka_model, garanti_bitis, hatirlatma_gun_kala, notlar } = req.body;
  if (!cihaz_adi || !garanti_bitis) {
    return res.status(400).json({ error: 'Cihaz adı ve Garanti Bitiş Tarihi gereklidir.' });
  }
  try {
    const result = await dbRun(
      "INSERT INTO garantiler (kullanici_id, cihaz_adi, marka_model, garanti_bitis, hatirlatma_gun_kala, notlar) VALUES (?, ?, ?, ?, ?, ?)",
      [req.user.id, cihaz_adi, marka_model || '', garanti_bitis, hatirlatma_gun_kala ?? 30, notlar || '']
    );
    res.status(201).json({ id: result.id, cihaz_adi, marka_model, garanti_bitis, hatirlatma_gun_kala, notlar });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/garantiler/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { cihaz_adi, marka_model, garanti_bitis, hatirlatma_gun_kala, notlar } = req.body;
  try {
    await dbRun(
      "UPDATE garantiler SET cihaz_adi = ?, marka_model = ?, garanti_bitis = ?, hatirlatma_gun_kala = ?, notlar = ? WHERE id = ? AND kullanici_id = ?",
      [cihaz_adi, marka_model, garanti_bitis, hatirlatma_gun_kala, notlar, id, req.user.id]
    );
    res.json({ message: 'Garanti başarıyla güncellendi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/garantiler/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM garantiler WHERE id = ? AND kullanici_id = ?", [id, req.user.id]);
    res.json({ message: 'Garanti kaydı başarıyla silindi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 4. RUTİN KLASÖRLERİ ENDPOINTS
// -------------------------------------------------------------
app.get('/api/rutin_klasorleri', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll("SELECT * FROM rutin_klasorleri WHERE kullanici_id = ? ORDER BY klasor_adi ASC", [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rutin_klasorleri', authMiddleware, async (req, res) => {
  const { klasor_adi } = req.body;
  if (!klasor_adi) {
    return res.status(400).json({ error: 'Klasör adı gereklidir.' });
  }
  try {
    const result = await dbRun("INSERT INTO rutin_klasorleri (kullanici_id, klasor_adi) VALUES (?, ?)", [req.user.id, klasor_adi]);
    res.status(201).json({ id: result.id, klasor_adi });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rutin_klasorleri/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM rutin_klasorleri WHERE id = ? AND kullanici_id = ?", [id, req.user.id]);
    res.json({ message: 'Klasör ve ilişkili rutin görevler başarıyla silindi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 5. RUTİNLER ENDPOINTS
// -------------------------------------------------------------
app.get('/api/rutinler', authMiddleware, async (req, res) => {
  try {
    const rows = await dbAll(`
      SELECT r.*, k.klasor_adi 
      FROM rutinler r 
      LEFT JOIN rutin_klasorleri k ON r.klasor_id = k.id 
      WHERE r.kullanici_id = ?
      ORDER BY r.son_yapilma_tarihi ASC
    `, [req.user.id]);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rutinler', authMiddleware, async (req, res) => {
  const { klasor_id, gorev_adi, periyot_ay, hatirlatma_gun_kala, hedef_km, mevcut_km, son_yapilma_tarihi } = req.body;
  if (!gorev_adi || !periyot_ay) {
    return res.status(400).json({ error: 'Görev adı ve Periyot (ay) gereklidir.' });
  }
  try {
    const result = await dbRun(
      `INSERT INTO rutinler (kullanici_id, klasor_id, gorev_adi, periyot_ay, hatirlatma_gun_kala, hedef_km, mevcut_km, son_yapilma_tarihi) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, klasor_id || null, gorev_adi, periyot_ay, hatirlatma_gun_kala ?? 15, hedef_km || null, mevcut_km || null, son_yapilma_tarihi || null]
    );
    res.status(201).json({ id: result.id, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/rutinler/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { klasor_id, gorev_adi, periyot_ay, hatirlatma_gun_kala, hedef_km, mevcut_km, son_yapilma_tarihi } = req.body;
  try {
    await dbRun(
      `UPDATE rutinler 
       SET klasor_id = ?, gorev_adi = ?, periyot_ay = ?, hatirlatma_gun_kala = ?, hedef_km = ?, mevcut_km = ?, son_yapilma_tarihi = ? 
       WHERE id = ? AND kullanici_id = ?`,
      [klasor_id || null, gorev_adi, periyot_ay, hatirlatma_gun_kala, hedef_km || null, mevcut_km || null, son_yapilma_tarihi || null, id, req.user.id]
    );
    res.json({ message: 'Rutin görev başarıyla güncellendi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rutinler/:id/done', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { mevcut_km, yeni_hedef_km } = req.body;
  const todayStr = new Date().toISOString().split('T')[0];
  try {
    if (mevcut_km !== undefined) {
      await dbRun(
        "UPDATE rutinler SET son_yapilma_tarihi = ?, mevcut_km = ?, hedef_km = ? WHERE id = ? AND kullanici_id = ?",
        [todayStr, mevcut_km, yeni_hedef_km || null, id, req.user.id]
      );
    } else {
      await dbRun("UPDATE rutinler SET son_yapilma_tarihi = ? WHERE id = ? AND kullanici_id = ?", [todayStr, id, req.user.id]);
    }
    res.json({ message: 'Rutin görev yapıldı olarak işaretlendi.', son_yapilma_tarihi: todayStr });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rutinler/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  try {
    await dbRun("DELETE FROM rutinler WHERE id = ? AND kullanici_id = ?", [id, req.user.id]);
    res.json({ message: 'Rutin görev başarıyla silindi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 6. AYARLAR ENDPOINTS
// -------------------------------------------------------------
app.get('/api/ayarlar', authMiddleware, async (req, res) => {
  try {
    const user = await dbGet("SELECT telegram_chat_id FROM kullanicilar WHERE id = ?", [req.user.id]);
    const tokenRow = await dbGet("SELECT deger FROM ayarlar WHERE anahtar = 'telegram_token'");
    res.json({
      telegram_token: tokenRow?.deger || '',
      telegram_chat_id: user?.telegram_chat_id || ''
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/ayarlar', authMiddleware, async (req, res) => {
  const { telegram_token, telegram_chat_id } = req.body;
  try {
    await dbRun("INSERT OR REPLACE INTO ayarlar (anahtar, deger) VALUES ('telegram_token', ?)", [telegram_token || '']);
    await dbRun("UPDATE kullanicilar SET telegram_chat_id = ? WHERE id = ?", [telegram_chat_id || '', req.user.id]);
    res.json({ message: 'Ayarlar başarıyla kaydedildi.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// -------------------------------------------------------------
// 7. BİLDİRİM MANUEL TETİKLEME / TEST ENDPOINTS
// -------------------------------------------------------------
app.post('/api/test-bildirim', authMiddleware, async (req, res) => {
  try {
    const result = await checkAndNotify();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/send-test-telegram', authMiddleware, async (req, res) => {
  const { telegram_token, telegram_chat_id } = req.body;
  
  if (!telegram_token || !telegram_chat_id) {
    return res.status(400).json({ error: 'Token ve Chat ID gereklidir.' });
  }

  try {
    const url = `https://api.telegram.org/bot${telegram_token}/sendMessage`;
    const response = await axios.post(url, {
      chat_id: telegram_chat_id,
      text: '🏠 <b>Akıllı Ev ve Yaşam Asistanı</b>\n\nTelegram bağlantınız başarıyla test edildi! Bildirimleri almaya hazırsınız.',
      parse_mode: 'HTML'
    });
    res.json({ success: response.data.ok });
  } catch (error) {
    res.status(500).json({ error: error.response?.data?.description || error.message });
  }
});

// Sunucuyu Başlat
app.listen(PORT, () => {
  console.log(`Sunucu http://localhost:${PORT} portunda çalışıyor.`);
});
