import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.DATABASE_PATH || path.resolve(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Veritabanı bağlantı hatası:', err.message);
  } else {
    console.log('SQLite veritabanına başarıyla bağlanıldı:', dbPath);
    // SQLite'da Foreign Key desteğini etkinleştiriyoruz
    db.run('PRAGMA foreign_keys = ON;', (err) => {
      if (err) console.error('Foreign Key etkinleştirme hatası:', err.message);
    });
  }
});

// Promise tabanlı SQL fonksiyonları
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error('SQL Çalıştırma Hatası:', sql, err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error('SQL Get Hatası:', sql, err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('SQL All Hatası:', sql, err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

// Helper to alter table and add column safely if it does not exist
const addColumnIfNotExist = async (tableName, columnName, columnDefinition) => {
  const columns = await dbAll(`PRAGMA table_info(${tableName})`);
  const hasColumn = columns.some(col => col.name === columnName);
  if (!hasColumn) {
    try {
      await dbRun(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition}`);
      console.log(`Column ${columnName} added to ${tableName}.`);
    } catch (err) {
      console.error(`Error adding column ${columnName} to ${tableName}:`, err);
    }
  }
};

// Veritabanı tablolarını ilklendir
export const initDatabase = async () => {
  try {
    // 0. KULLANICILAR TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS kullanicilar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          isim TEXT NOT NULL,
          eposta TEXT UNIQUE NOT NULL,
          sifre TEXT NOT NULL,
          telegram_chat_id TEXT,
          olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 1. GIDALAR TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS gidalar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kullanici_id INTEGER,
          urun_adi TEXT NOT NULL,
          kategori TEXT,
          skt DATE NOT NULL, -- Son Kullanma Tarihi (YYYY-MM-DD)
          hatirlatma_gun_kala INTEGER DEFAULT 3, -- Ürüne özel kaç gün kala hatırlatılacak?
          durum TEXT DEFAULT 'bekliyor', -- 'tuketildi', 'atildi', 'bekliyor'
          FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
      )
    `);

    // 2. FATURALAR TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS faturalar (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kullanici_id INTEGER,
          fatura_adi TEXT NOT NULL, -- Örn: Elektrik, İnternet
          tutar REAL,
          son_odeme_tarihi DATE NOT NULL, -- (YYYY-MM-DD)
          hatirlatma_gun_kala INTEGER DEFAULT 5, -- Faturaya özel kaç gün kala hatırlatılacak?
          durum TEXT DEFAULT 'odenmedi', -- 'odendi', 'odenmedi'
          FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
      )
    `);

    // 3. GARANTILER TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS garantiler (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kullanici_id INTEGER,
          cihaz_adi TEXT NOT NULL,
          marka_model TEXT,
          garanti_bitis DATE NOT NULL, -- (YYYY-MM-DD)
          hatirlatma_gun_kala INTEGER DEFAULT 30, -- Cihaza özel kaç gün kala hatırlatılacak?
          notlar TEXT,
          FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
      )
    `);

    // 4. RUTIN KLASÖRLERİ TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS rutin_klasorleri (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          kullanici_id INTEGER,
          klasor_adi TEXT NOT NULL, -- Örn: "Araba", "Ev Bakımı"
          FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
      )
    `);

    // 5. RUTIN GÖREVLERİ TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS rutinler (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          klasor_id INTEGER,
          kullanici_id INTEGER,
          gorev_adi TEXT NOT NULL, -- Örn: "Motor Yağı Değişimi"
          periyot_ay INTEGER NOT NULL, -- Kaç ayda bir tekrarlanacağı
          hatirlatma_gun_kala INTEGER DEFAULT 15, -- Kaç gün kala uyarsın?
          hedef_km INTEGER, -- Opsiyonel
          mevcut_km INTEGER, -- Opsiyonel
          son_yapilma_tarihi DATE, -- (YYYY-MM-DD)
          FOREIGN KEY (klasor_id) REFERENCES rutin_klasorleri(id) ON DELETE CASCADE,
          FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
      )
    `);

    // 6. AYARLAR TABLOSU
    await dbRun(`
      CREATE TABLE IF NOT EXISTS ayarlar (
          anahtar TEXT PRIMARY KEY,
          deger TEXT
      )
    `);

    // Varsayılan boş ayarları ekle (Varsa dokunma)
    await dbRun(`INSERT OR IGNORE INTO ayarlar (anahtar, deger) VALUES ('telegram_token', '')`);
    await dbRun(`INSERT OR IGNORE INTO ayarlar (anahtar, deger) VALUES ('telegram_chat_id', '')`);

    // Yabancı anahtar kolonlarını mevcut veri tabanı varsa eklemek için göç (migration) tetikle
    await addColumnIfNotExist('gidalar', 'kullanici_id', 'INTEGER REFERENCES kullanicilar(id) ON DELETE CASCADE');
    await addColumnIfNotExist('faturalar', 'kullanici_id', 'INTEGER REFERENCES kullanicilar(id) ON DELETE CASCADE');
    await addColumnIfNotExist('garantiler', 'kullanici_id', 'INTEGER REFERENCES kullanicilar(id) ON DELETE CASCADE');
    await addColumnIfNotExist('rutin_klasorleri', 'kullanici_id', 'INTEGER REFERENCES kullanicilar(id) ON DELETE CASCADE');
    await addColumnIfNotExist('rutinler', 'kullanici_id', 'INTEGER REFERENCES kullanicilar(id) ON DELETE CASCADE');

    console.log('Tüm veritabanı tabloları hazır.');
  } catch (error) {
    console.error('Veritabanı tabloları oluşturulurken hata:', error);
  }
};

export default db;
