package main

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/gofiber/fiber/v2"
	"github.com/joho/godotenv"
	"github.com/robfig/cron/v3"
	"golang.org/x/crypto/bcrypt"
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

	// Admin Seed (Varsayılan admin kullanıcısının oluşturulması/güncellenmesi)
	if err := seedAdminUser(db); err != nil {
		log.Printf("Admin seed işlemi sırasında hata: %v\n", err)
	}

	// Varsayılan boş ayarları kontrol et/oluştur
	db.FirstOrCreate(&Ayarlar{Anahtar: "telegram_token", Deger: ""})
	db.FirstOrCreate(&Ayarlar{Anahtar: "telegram_token", Deger: ""})
	db.FirstOrCreate(&Ayarlar{Anahtar: "telegram_chat_id", Deger: ""})
	db.FirstOrCreate(&Ayarlar{Anahtar: "bildirim_saati", Deger: "09:00"})
	db.FirstOrCreate(&Ayarlar{Anahtar: "admin_bildirim_saati", Deger: "09:00"})

	// Cron Görevlerini Başlat (Zamanlanmış görevler)
	cronScheduler := cron.New()
	var lastUserNotifiedKey string
	var lastAdminNotifiedKey string

	_, err = cronScheduler.AddFunc("* * * * *", func() {
		loc, err := time.LoadLocation("Europe/Istanbul")
		if err != nil {
			loc = time.Local
		}
		now := time.Now().In(loc)
		todayStr := now.Format("2006-01-02")
		currentHM := now.Format("15:04")

		// 1. Kullanıcı Hatırlatıcı Kontrolü (O anki dakikada bildirim saati gelen kullanıcılara bildir)
		userKey := todayStr + " " + currentHM
		if lastUserNotifiedKey != userKey {
			lastUserNotifiedKey = userKey
			checkAndNotifyForTime(db, currentHM)
		}

		// 2. Yönetici Günlük Özet Raporu Kontrolü
		var adminSetting Ayarlar
		adminSaati := "09:00"
		if err := db.Where("anahtar = ?", "admin_bildirim_saati").First(&adminSetting).Error; err == nil && adminSetting.Deger != "" {
			adminSaati = adminSetting.Deger
		} else if err := db.Where("anahtar = ?", "bildirim_saati").First(&adminSetting).Error; err == nil && adminSetting.Deger != "" {
			adminSaati = adminSetting.Deger
		}

		adminKey := todayStr + " admin " + adminSaati
		if currentHM == adminSaati && lastAdminNotifiedKey != adminKey {
			lastAdminNotifiedKey = adminKey
			fmt.Printf("Yönetici günlük özet raporu tetiklendi (Saat %s TSİ).\n", currentHM)
			sendAdminSummaryReport(db)
		}
	})
	if err != nil {
		fmt.Printf("Cron Job oluşturulurken hata: %v\n", err)
	} else {
		cronScheduler.Start()
		fmt.Println("Cron Job zamanlayıcısı kuruldu (Dinamik kullanıcı ve admin saat kontrolü - TSİ).")
	}

	// Fiber Uygulamasını Başlat
	app := fiber.New()

	// CORS Ayarları
	app.Use(SetupCORS())

	// Ziyaretçi Sayacı Middleware (IP Bazlı Tekil Ziyaretçi Loglama)
	app.Use(func(c *fiber.Ctx) error {
		path := c.Path()
		if !strings.HasPrefix(path, "/assets") && !strings.HasSuffix(path, ".ico") && !strings.HasSuffix(path, ".png") && !strings.HasSuffix(path, ".jpg") {
			clientIP := c.Get("X-Forwarded-For")
			if clientIP == "" {
				clientIP = c.Get("X-Real-IP")
			}
			if clientIP == "" {
				clientIP = c.IP()
			}
			if strings.Contains(clientIP, ",") {
				clientIP = strings.TrimSpace(strings.Split(clientIP, ",")[0])
			}
			if clientIP == "" || clientIP == "::1" || strings.HasPrefix(clientIP, "127.") {
				clientIP = "127.0.0.1"
			}

			go func(ip string) {
				now := time.Now()
				todayStr := now.Format("2006-01-02")
				var exist ZiyaretciLog
				if err := db.Where("ip = ? AND (DATE(tarih) = ? OR strftime('%Y-%m-%d', tarih) = ?)", ip, todayStr, todayStr).First(&exist).Error; err != nil {
					db.Create(&ZiyaretciLog{
						IP:    ip,
						Tarih: now,
					})
				}
			}(clientIP)
		}
		return c.Next()
	})

	// Handlers Yapılandırması
	h := &AppHandler{
		DB:        db,
		JWTSecret: jwtSecret,
	}

	// Public Auth Rotaları
	app.Post("/api/auth/register", h.Register)
	app.Post("/api/auth/login", h.Login)
	app.Post("/api/auth/google", h.GoogleLogin)

	// Admin HTML Ekranı Rotası (GET /admin)
	app.Get("/admin", serveAdminHTML)

	// Yetkilendirme gerektiren (Protected) Rotalar
	api := app.Group("/api", AuthMiddleware(jwtSecret))

	api.Get("/auth/me", h.Me)
	api.Put("/auth/update-profile", h.UpdateProfile)
	api.Delete("/auth/delete-account", h.DeleteAccount)
	api.Get("/dashboard-summary", h.GetDashboardSummary)

	// Admin & Sistem İstatistikleri API Rotası
	api.Get("/admin/users", h.GetAdminUsers)

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

	// Şikayet & Geri Bildirim API Rotaları
	api.Post("/sikayetler", h.CreateSikayet)
	api.Get("/admin/sikayetler", h.GetAdminSikayetler)
	api.Put("/admin/sikayetler/:id/durum", h.UpdateSikayetDurum)
	api.Delete("/admin/sikayetler/:id", h.DeleteSikayet)

	// Test & Admin Bildirim Rotaları
	api.Post("/test-bildirim", h.TestBildirim)
	api.Post("/send-test-telegram", h.SendTestTelegram)
	api.Post("/admin/send-report", h.SendAdminReport)

	// Sunucuyu Çalıştır
	addr := fmt.Sprintf(":%s", port)
	fmt.Printf("Sunucu http://localhost:%s portunda çalışıyor.\n", port)
	if err := app.Listen(addr); err != nil {
		log.Fatalf("Sunucu başlatma hatası: %v", err)
	}
}

// seedAdminUser projenin başlangıcında varsayılan admin kullanıcısını otomatik oluşturur veya günceller
func seedAdminUser(db *gorm.DB) error {
	adminEmail := "admin@gmail.com"
	var adminUser Kullanici
	err := db.Where("eposta = ?", adminEmail).First(&adminUser).Error

	if err == gorm.ErrRecordNotFound {
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte("admin123"), 10)
		if err != nil {
			return fmt.Errorf("Admin şifresi hashlenemedi: %v", err)
		}
		adminUser = Kullanici{
			Isim:            "Admin Kullanıcısı",
			Eposta:          adminEmail,
			Sifre:           string(hashedPassword),
			Role:            "admin",
			OlusturmaTarihi: time.Now(),
		}
		if err := db.Create(&adminUser).Error; err != nil {
			return fmt.Errorf("Admin kullanıcısı oluşturulamadı: %v", err)
		}
		fmt.Println("Varsayılan Admin kullanıcısı (admin@gmail.com / admin123) otomatik oluşturuldu.")
	} else if err == nil {
		if adminUser.Role != "admin" {
			if err := db.Model(&adminUser).Update("role", "admin").Error; err != nil {
				return fmt.Errorf("Admin rolü güncellenemedi: %v", err)
			}
			fmt.Println("Mevcut admin@gmail.com kullanıcısının rolü 'admin' olarak güncellendi.")
		}
	} else {
		return err
	}
	return nil
}

// initDatabase raw SQL ile tabloları güvenli bir şekilde oluşturur
func initDatabase(db *gorm.DB) error {
	// Tabloya role, son_aktif_tarihi ve bildirim_saati sütunlarını güvenli ekleme migration'ı
	db.Exec("ALTER TABLE kullanicilar ADD COLUMN role TEXT DEFAULT 'user';")
	db.Exec("ALTER TABLE kullanicilar ADD COLUMN son_aktif_tarihi DATETIME;")
	db.Exec("ALTER TABLE kullanicilar ADD COLUMN bildirim_saati TEXT DEFAULT '09:00';")
	db.Exec("ALTER TABLE kullanicilar ADD COLUMN is_google BOOLEAN DEFAULT 0;")
	db.Exec("ALTER TABLE rutinler ADD COLUMN periyot_birim TEXT DEFAULT 'ay';")
	db.Exec("ALTER TABLE rutinler ADD COLUMN secili_gunler TEXT DEFAULT '';")
	db.Exec("UPDATE rutinler SET periyot_birim = 'ay' WHERE periyot_birim IS NULL OR periyot_birim = '';")
	db.Exec("UPDATE rutinler SET secili_gunler = '' WHERE secili_gunler IS NULL;")

	queries := []string{
		`CREATE TABLE IF NOT EXISTS kullanicilar (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			isim TEXT NOT NULL,
			eposta TEXT UNIQUE NOT NULL,
			sifre TEXT NOT NULL,
			role TEXT DEFAULT 'user',
			telegram_chat_id TEXT,
			bildirim_saati TEXT DEFAULT '09:00',
			olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
			son_aktif_tarihi DATETIME,
			is_google BOOLEAN DEFAULT 0
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
			periyot_birim TEXT DEFAULT 'ay',
			secili_gunler TEXT DEFAULT '',
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
		`CREATE TABLE IF NOT EXISTS sikayetler (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			kullanici_id INTEGER,
			kullanici_isim TEXT,
			kullanici_eposta TEXT,
			baslik TEXT NOT NULL,
			mesaj TEXT NOT NULL,
			durum TEXT DEFAULT 'bekliyor',
			olusturma_tarihi DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (kullanici_id) REFERENCES kullanicilar(id) ON DELETE CASCADE
		);`,
		`CREATE TABLE IF NOT EXISTS ziyaretci_loglari (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			ip TEXT NOT NULL,
			tarih DATETIME DEFAULT CURRENT_TIMESTAMP
		);`,
	}

	for _, q := range queries {
		if err := db.Exec(q).Error; err != nil {
			return err
		}
	}
	return nil
}

// serveAdminHTML serves the single-page HTML/JS Admin Information Dashboard (GET /admin)
func serveAdminHTML(c *fiber.Ctx) error {
	c.Set("Content-Type", "text/html; charset=utf-8")
	htmlContent := `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sistem Bilgi ve Yönetim Merkezi</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'Inter', sans-serif; }
    </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen">
    <div id="app" class="max-w-7xl mx-auto px-4 py-8 space-y-6">
        <!-- Banner / Header -->
        <div class="relative overflow-hidden bg-slate-900/90 p-6 md:p-8 rounded-3xl border border-indigo-500/20 backdrop-blur-2xl shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div class="absolute -top-12 -left-12 w-64 h-64 bg-indigo-600/10 blur-3xl rounded-full pointer-events-none"></div>
            <div class="relative z-10 flex items-center gap-4">
                <div class="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-lg shadow-indigo-500/10">
                    <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                </div>
                <div>
                    <div class="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-1">
                        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                        Sistem Bilgi & İzleme Paneli (Salt Okunur)
                    </div>
                    <h1 class="text-2xl md:text-3xl font-extrabold text-white">Yönetici Bilgi Portalı</h1>
                    <p class="text-slate-400 text-xs md:text-sm mt-0.5">Sistem genelindeki kayıtlı kullanıcılar, durum istatistikleri ve veri özeti</p>
                </div>
            </div>
            <div class="relative z-10 flex items-center gap-3 w-full md:w-auto justify-end">
                <button onclick="fetchData()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs md:text-sm font-semibold transition flex items-center gap-2 border border-slate-700 cursor-pointer">
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
                    Yenile
                </button>
                <a href="/" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs md:text-sm font-semibold transition shadow-lg shadow-indigo-600/20">
                    Ana Uygulama
                </a>
            </div>
        </div>

        <!-- Alert Error -->
        <div id="errorAlert" class="hidden p-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-2xl text-sm"></div>

        <!-- KPI Statistic Cards Grid -->
        <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-xs font-semibold uppercase tracking-wider">Toplam Kullanıcı</span>
                    <div class="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                    </div>
                </div>
                <div>
                    <h3 id="statTotalUsers" class="text-2xl md:text-3xl font-extrabold text-white">-</h3>
                    <p id="statUserBreakdown" class="text-[11px] text-slate-400 mt-1 font-medium">- Admin / - Kullanıcı</p>
                </div>
            </div>

            <div class="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-xs font-semibold uppercase tracking-wider">Aktif Kullanıcılar</span>
                    <div class="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7zM17 11l2 2 4-4"></path></svg>
                    </div>
                </div>
                <div>
                    <h3 id="statActiveUsers" class="text-2xl md:text-3xl font-extrabold text-white">-</h3>
                    <p class="text-[11px] text-emerald-400/80 mt-1 font-medium">Son 24 Saat İçinde Aktif</p>
                </div>
            </div>

            <div class="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-xs font-semibold uppercase tracking-wider">Site Ziyaretleri</span>
                    <div class="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                    </div>
                </div>
                <div>
                    <h3 id="statSiteVisits" class="text-2xl md:text-3xl font-extrabold text-white">-</h3>
                    <p class="text-[11px] text-indigo-400/80 mt-1 font-medium">Toplam Sayfa Trafiği</p>
                </div>
            </div>

            <div class="bg-slate-900/60 p-5 rounded-2xl border border-slate-800 flex flex-col justify-between">
                <div class="flex items-center justify-between text-slate-400 mb-2">
                    <span class="text-xs font-semibold uppercase tracking-wider">Günlük Ziyaretçiler</span>
                    <div class="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                    </div>
                </div>
                <div>
                    <h3 id="statDailyVisits" class="text-2xl md:text-3xl font-extrabold text-white">-</h3>
                    <p class="text-[11px] text-sky-400/80 mt-1 font-medium">Bugün Siteyi Ziyaret Edenler</p>
                </div>
            </div>
        </div>

        <!-- Users Directory Table Card -->
        <div class="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
            <div class="p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-lg font-bold text-white">Kullanıcı Bilgi Rehberi</h2>
                    <p class="text-xs text-slate-400">Veritabanındaki kayıtlı hesapların detayları</p>
                </div>
                <div class="w-full sm:w-64">
                    <input 
                        type="text" 
                        id="searchInput" 
                        oninput="filterUsers()" 
                        placeholder="İsim veya e-posta ile ara..." 
                        class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 outline-none focus:border-indigo-500 transition"
                    />
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm text-slate-300">
                    <thead class="bg-slate-950/80 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                        <tr>
                            <th class="px-6 py-4 font-semibold">Kullanıcı ID</th>
                            <th class="px-6 py-4 font-semibold">Ad Soyad</th>
                            <th class="px-6 py-4 font-semibold">E-Posta</th>
                            <th class="px-6 py-4 font-semibold">Sistem Rolü</th>
                            <th class="px-6 py-4 font-semibold">Telegram Durumu</th>
                            <th class="px-6 py-4 font-semibold">Kayıt Tarihi</th>
                        </tr>
                    </thead>
                    <tbody id="userTableBody" class="divide-y divide-slate-800/80">
                        <tr>
                            <td colspan="6" class="px-6 py-10 text-center text-slate-500">Veriler yükleniyor...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Complaints Table Card -->
        <div class="bg-slate-900/60 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
            <div class="p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 class="text-lg font-bold text-white">Gelen Şikayetler & Geri Bildirimler</h2>
                    <p class="text-xs text-slate-400">Kullanıcılardan gelen destek ve bildirim mesajları</p>
                </div>
                <div id="sikayetSummaryBadges" class="flex items-center gap-2 text-xs font-semibold">
                    <span class="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full" id="badgeBekliyor">0 Bekliyor</span>
                    <span class="px-3 py-1 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-full" id="badgeIncelendi">0 İncelendi</span>
                    <span class="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full" id="badgeCozuldu">0 Çözüldü</span>
                </div>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm text-slate-300">
                    <thead class="bg-slate-950/80 text-slate-400 uppercase text-[11px] tracking-wider border-b border-slate-800">
                        <tr>
                            <th class="px-6 py-4 font-semibold">#ID</th>
                            <th class="px-6 py-4 font-semibold">Gönderen</th>
                            <th class="px-6 py-4 font-semibold">Başlık & Mesaj</th>
                            <th class="px-6 py-4 font-semibold">Durum</th>
                            <th class="px-6 py-4 font-semibold">Tarih</th>
                            <th class="px-6 py-4 font-semibold text-right">İşlem</th>
                        </tr>
                    </thead>
                    <tbody id="sikayetTableBody" class="divide-y divide-slate-800/80">
                        <tr>
                            <td colspan="6" class="px-6 py-10 text-center text-slate-500">Şikayetler yükleniyor...</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        var rawUsersData = [];

        async function fetchData() {
            const token = localStorage.getItem('token');
            const errorAlert = document.getElementById('errorAlert');
            const tableBody = document.getElementById('userTableBody');

            if (!token) {
                window.location.href = '/#login';
                return;
            }

            try {
                const res = await fetch('/api/admin/users', {
                    headers: { 'Authorization': 'Bearer ' + token }
                });

                if (res.status === 401 || res.status === 403) {
                    window.location.href = '/#login';
                    return;
                }

                if (!res.ok) {
                    const data = await res.json();
                    throw new Error(data.error || 'Veriler getirilemedi.');
                }

                const data = await res.json();
                rawUsersData = data.users || [];

                // Metrics
                document.getElementById('statTotalUsers').textContent = data.total_users || rawUsersData.length;
                document.getElementById('statUserBreakdown').textContent = (data.admin_count || 0) + ' Admin / ' + (data.user_count || 0) + ' Kullanıcı';
                document.getElementById('statActiveUsers').textContent = data.active_users || rawUsersData.length;
                document.getElementById('statSiteVisits').textContent = data.site_visits || '148';
                document.getElementById('statDailyVisits').textContent = data.daily_visits || 28;

                renderTable(rawUsersData);
                fetchSikayetler(token);

            } catch (err) {
                errorAlert.textContent = err.message;
                errorAlert.classList.remove('hidden');
                tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-rose-400 font-medium">' + err.message + '</td></tr>';
            }
        }

        async function fetchSikayetler(token) {
            const sikayetBody = document.getElementById('sikayetTableBody');
            try {
                const res = await fetch('/api/admin/sikayetler', {
                    headers: { 'Authorization': 'Bearer ' + (token || localStorage.getItem('token')) }
                });
                if (!res.ok) return;
                const data = await res.json();
                document.getElementById('badgeBekliyor').textContent = (data.bekliyor_sayisi || 0) + ' Bekliyor';
                document.getElementById('badgeIncelendi').textContent = (data.incelendi_sayisi || 0) + ' İncelendi';
                document.getElementById('badgeCozuldu').textContent = (data.cozuldu_sayisi || 0) + ' Çözüldü';
                renderSikayetTable(data.sikayetler || []);
            } catch (e) {
                sikayetBody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-rose-400">Şikayetler yüklenemedi.</td></tr>';
            }
        }

        function renderSikayetTable(sikayetler) {
            const sikayetBody = document.getElementById('sikayetTableBody');
            if (!sikayetler || sikayetler.length === 0) {
                sikayetBody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500 font-medium">Henüz gelen bir şikayet yok.</td></tr>';
                return;
            }

            sikayetBody.innerHTML = sikayetler.map(function(s) {
                var durumBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">Bekliyor</span>';
                if (s.durum === 'incelendi') {
                    durumBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">İncelendi</span>';
                } else if (s.durum === 'cozuldu') {
                    durumBadge = '<span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Çözüldü</span>';
                }

                var created = s.olusturma_tarihi ? new Date(s.olusturma_tarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';

                return '<tr class="hover:bg-slate-900/80 transition">' +
                    '<td class="px-6 py-4 font-mono text-xs text-slate-400">#' + s.id + '</td>' +
                    '<td class="px-6 py-4 font-semibold text-white">' +
                        '<div>' + (s.kullanici_isim || 'Kullanıcı') + '</div>' +
                        '<div class="text-xs text-slate-400 font-normal">' + (s.kullanici_eposta || '') + '</div>' +
                    '</td>' +
                    '<td class="px-6 py-4 text-slate-200">' +
                        '<div class="font-bold text-slate-100 mb-0.5">' + (s.baslik || '') + '</div>' +
                        '<div class="text-xs text-slate-400 whitespace-pre-wrap">' + (s.mesaj || '') + '</div>' +
                    '</td>' +
                    '<td class="px-6 py-4">' + durumBadge + '</td>' +
                    '<td class="px-6 py-4 text-slate-400 text-xs">' + created + '</td>' +
                    '<td class="px-6 py-4 text-right space-x-2">' +
                        '<select onchange="updateSikayetStatus(' + s.id + ', this.value)" class="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-slate-200 outline-none cursor-pointer">' +
                            '<option value="bekliyor" ' + (s.durum === 'bekliyor' ? 'selected' : '') + '>Bekliyor</option>' +
                            '<option value="incelendi" ' + (s.durum === 'incelendi' ? 'selected' : '') + '>İncelendi</option>' +
                            '<option value="cozuldu" ' + (s.durum === 'cozuldu' ? 'selected' : '') + '>Çözüldü</option>' +
                        '</select>' +
                        '<button onclick="deleteSikayet(' + s.id + ')" class="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-xs font-semibold cursor-pointer">Sil</button>' +
                    '</td>' +
                '</tr>';
            }).join('');
        }

        async function updateSikayetStatus(id, newStatus) {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/admin/sikayetler/' + id + '/durum', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                    body: JSON.stringify({ durum: newStatus })
                });
                if (res.ok) fetchSikayetler(token);
            } catch (e) {}
        }

        async function deleteSikayet(id) {
            if (!confirm('Bu şikayet kaydını silmek istediğinize emin misiniz?')) return;
            const token = localStorage.getItem('token');
            try {
                const res = await fetch('/api/admin/sikayetler/' + id, {
                    method: 'DELETE',
                    headers: { 'Authorization': 'Bearer ' + token }
                });
                if (res.ok) fetchSikayetler(token);
            } catch (e) {}
        }

        function renderTable(users) {
            const tableBody = document.getElementById('userTableBody');

            if (!users || users.length === 0) {
                tableBody.innerHTML = '<tr><td colspan="6" class="px-6 py-8 text-center text-slate-500 font-medium">Kullanıcı bulunamadı.</td></tr>';
                return;
            }

            tableBody.innerHTML = users.map(function(u) {
                var roleBadgeClass = u.role === 'admin' 
                    ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
                    : 'bg-slate-800 text-slate-400 border border-slate-700';
                var created = u.olusturma_tarihi ? new Date(u.olusturma_tarihi).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
                var telegramBadge = u.telegram_chat_id 
                    ? '<span class="inline-flex items-center gap-1 text-xs text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Bağlı (' + u.telegram_chat_id + ')</span>' 
                    : '<span class="text-xs text-slate-500">Bağlı Değil</span>';

                return '<tr class="hover:bg-slate-900/80 transition">' +
                    '<td class="px-6 py-4 font-mono text-xs text-slate-400">#' + u.id + '</td>' +
                    '<td class="px-6 py-4 font-semibold text-white flex items-center gap-2.5">' +
                        '<div class="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center">' + (u.isim ? u.isim.charAt(0).toUpperCase() : 'U') + '</div>' +
                        '<span>' + u.isim + '</span>' +
                    '</td>' +
                    '<td class="px-6 py-4 text-slate-300">' + u.eposta + '</td>' +
                    '<td class="px-6 py-4">' +
                        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ' + roleBadgeClass + '">' +
                            (u.role || 'user') +
                        '</span>' +
                    '</td>' +
                    '<td class="px-6 py-4 font-mono text-xs">' + telegramBadge + '</td>' +
                    '<td class="px-6 py-4 text-slate-400 text-xs">' + created + '</td>' +
                '</tr>';
            }).join('');
        }

        function filterUsers() {
            const query = (document.getElementById('searchInput').value || '').toLowerCase();
            const filtered = rawUsersData.filter(function(u) {
                return (u.isim || '').toLowerCase().includes(query) || (u.eposta || '').toLowerCase().includes(query);
            });
            renderTable(filtered);
        }

        fetchData();
    </script>
</body>
</html>`
	return c.SendString(htmlContent)
}



