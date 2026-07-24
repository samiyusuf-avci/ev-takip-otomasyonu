package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

func main() {
	// .env dosyasını oku
	if err := godotenv.Load(); err != nil {
		fmt.Println(".env dosyası yüklenemedi, sistem çevresel değişkenleri kullanılacak.")
	}

	port := getEnv("PORT", "5000")
	jwtSecret := getEnv("JWT_SECRET", "gizli_anahtar_123")
	dbPath := getEnv("DATABASE_PATH", "database.sqlite")

	// Veritabanı dosyasının bulunacağı dizinin varlığından emin ol
	if dir := filepath.Dir(dbPath); dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			log.Fatalf("Veritabanı klasörü oluşturulamadı (%s): %v", dir, err)
		}
	}

	// Veritabanı bağlantısını aç (CGO gerektirmeyen pure-Go SQLite)
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("Veritabanı bağlantı hatası: %v", err)
	}

	fmt.Printf("SQLite veritabanına başarıyla bağlanıldı: %s\n", dbPath)

	// SQLite Foreign Key desteğini etkinleştir
	db.Exec("PRAGMA foreign_keys = ON;")

	// Veritabanı tablolarını raw SQL ile oluştur (GORM AutoMigrate SQLite yorum satırı bug'ını önler)
	if err := initDatabase(db); err != nil {
		log.Fatalf("Veritabanı tabloları oluşturulurken hata: %v", err)
	}
	fmt.Println("Tüm veritabanı tabloları hazır.")

	// Varsayılan boş ayarları kontrol et/oluştur
	db.FirstOrCreate(&Ayarlar{Anahtar: "telegram_token", Deger: ""})
	db.FirstOrCreate(&Ayarlar{Anahtar: "telegram_chat_id", Deger: ""})
	db.FirstOrCreate(&Ayarlar{Anahtar: "bildirim_saati", Deger: "09:00"})

	// Cron Görevlerini Başlat (Zamanlanmış görevler)
	cronScheduler := cron.New()
	var lastNotifiedKey string

	_, err = cronScheduler.AddFunc("* * * * *", func() {
		loc, err := time.LoadLocation("Europe/Istanbul")
		if err != nil {
			loc = time.Local
		}
		now := time.Now().In(loc)
		todayStr := now.Format("2006-01-02")
		currentHM := now.Format("15:04")

		var setting Ayarlar
		bildirimSaati := "09:00"
		if err := db.Where("anahtar = ?", "bildirim_saati").First(&setting).Error; err == nil && setting.Deger != "" {
			bildirimSaati = setting.Deger
		}

		currentKey := todayStr + " " + bildirimSaati
		if currentHM == bildirimSaati && lastNotifiedKey != currentKey {
			lastNotifiedKey = currentKey
			fmt.Printf("Zamanlanmış otomatik kontrol tetiklendi (Saat %s TSİ).\n", currentHM)
			checkAndNotify(db)
		}
	})
	if err != nil {
		fmt.Printf("Cron Job oluşturulurken hata: %v\n", err)
	} else {
		cronScheduler.Start()
		fmt.Println("Cron Job zamanlayıcısı kuruldu (Dinamik saat kontrolü - TSİ).")
	}

	// Fiber Uygulamasını Başlat
	app := fiber.New()

	// CORS Ayarları
	app.Use(SetupCORS())

	// Handlers Yapılandırması
	h := &AppHandler{
		DB:        db,
		JWTSecret: jwtSecret,
	}

	// Public Auth Rotaları
	app.Post("/api/auth/register", h.Register)
	app.Post("/api/auth/login", h.Login)

	// Yetkilendirme gerektiren (Protected) Rotalar
	api := app.Group("/api", AuthMiddleware(jwtSecret))

	api.Get("/auth/me", h.Me)
	api.Put("/auth/update-profile", h.UpdateProfile)
	api.Delete("/auth/delete-account", h.DeleteAccount)
	api.Get("/dashboard-summary", h.GetDashboardSummary)

	// Gıdalar API Rotaları
	api.Get("/gidalar", h.GetGidalar)
	api.Post("/gidalar", h.CreateGida)
	api.Put("/gidalar/:id", h.UpdateGida)
	api.Delete("/gidalar/:id", h.DeleteGida)

	// Faturalar API Rotaları
	api.Get("/faturalar", h.GetFaturalar)
	api.Post("/faturalar", h.CreateFatura)
	api.Put("/faturalar/:id", h.UpdateFatura)
	api.Delete("/faturalar/:id", h.DeleteFatura)

	// Garantiler API Rotaları
	api.Get("/garantiler", h.GetGarantiler)
	api.Post("/garantiler", h.CreateGaranti)
	api.Put("/garantiler/:id", h.UpdateGaranti)
	api.Delete("/garantiler/:id", h.DeleteGaranti)

	// Rutin Klasörleri API Rotaları
	api.Get("/rutin_klasorleri", h.GetRutinKlasorleri)
	api.Post("/rutin_klasorleri", h.CreateRutinKlasor)
	api.Put("/rutin_klasorleri/:id", h.UpdateRutinKlasor)
	api.Delete("/rutin_klasorleri/:id", h.DeleteRutinKlasor)

	// Rutinler API Rotaları
	api.Get("/rutinler", h.GetRutinler)
	api.Post("/rutinler", h.CreateRutin)
	api.Put("/rutinler/:id", h.UpdateRutin)
	api.Post("/rutinler/:id/done", h.MarkRutinDone)
	api.Delete("/rutinler/:id", h.DeleteRutin)

	// Ayarlar API Rotaları
	api.Get("/ayarlar", h.GetAyarlar)
	api.Post("/ayarlar", h.SaveAyarlar)

	// Test Bildirim Rotaları
	api.Post("/test-bildirim", h.TestBildirim)
	api.Post("/send-test-telegram", h.SendTestTelegram)

	// Sunucuyu Çalıştır
	addr := fmt.Sprintf(":%s", port)
	fmt.Printf("Sunucu http://localhost:%s portunda çalışıyor.\n", port)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("Sunucu başlatma hatası: %v", err)
	}
}

// initDatabase raw SQL ile tabloları güvenli bir şekilde oluşturur
func initDatabase(db *gorm.DB) error {
	queries := []string{
		`CREATE TABLE IF NOT EXISTS kullanicilar (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			isim TEXT NOT NULL,
			eposta TEXT UNIQUE NOT NULL,
			sifre TEXT NOT NULL,
			telegram_chat_id TEXT,
			olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
		`CREATE TABLE IF NOT EXISTS gidalar (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kullanici_id INTEGER,
			urun_adi TEXT NOT NULL,
			kategori TEXT,
			skt DATE NOT NULL,
			hatirlatma_gun_kala INTEGER DEFAULT 3,
			durum TEXT DEFAULT 'bekliyor',
			FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS faturalar (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kullanici_id INTEGER,
			fatura_adi TEXT NOT NULL,
			tutar REAL,
			son_odeme_tarihi DATE NOT NULL,
			hatirlatma_gun_kala INTEGER DEFAULT 5,
			durum TEXT DEFAULT 'odenmedi',
			FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS garantiler (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kullanici_id INTEGER,
			cihaz_adi TEXT NOT NULL,
			marka_model TEXT,
			garanti_bitis DATE NOT NULL,
			hatirlatma_gun_kala INTEGER DEFAULT 30,
			notlar TEXT,
			FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS rutin_klasorleri (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kullanici_id INTEGER,
			klasor_adi TEXT NOT NULL,
			FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS rutinler (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			klasor_id INTEGER,
			kullanici_id INTEGER,
			gorev_adi TEXT NOT NULL,
			periyot_ay INTEGER NOT NULL,
			hatirlatma_gun_kala INTEGER DEFAULT 15,
			hedef_km INTEGER,
			mevcut_km INTEGER,
			son_yapilma_tarihi DATE,
			FOREIGN KEY (klasor_id) REFERENCES rutin_klasorleri(id) ON DELETE CASCADE,
			FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS ayarlar (
			anahtar TEXT PRIMARY KEY,
			deger TEXT
		);`,
	}

	for _, q := range queries {
		if err := db.Exec(q).Error; err != nil {
			return err
		}
	}
	return nil
}

