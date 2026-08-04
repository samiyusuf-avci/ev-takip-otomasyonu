package main

import (
	"fmt"
	"math"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var emailRegex = regexp.MustCompile(`^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$`)

type AppHandler struct {
	DB        *gorm.DB
	JWTSecret string
}

var dayNameToIdx = map[string]int{
	"Pazartesi": 1,
	"Salı":      2,
	"Çarşamba":  3,
	"Perşembe":  4,
	"Cuma":      5,
	"Cumartesi": 6,
	"Pazar":     7,
}

func calcRutinMaxWarningDays(periyotAy int, periyotBirim string, seciliGunler string) int {
	isWeeklyWithDays := periyotBirim == "hafta" && strings.TrimSpace(seciliGunler) != ""
	if isWeeklyWithDays || periyotAy <= 0 {
		periyotAy = 1
	}

	if periyotBirim == "gun" {
		return periyotAy / 2
	}

	if periyotBirim == "ay" {
		return (periyotAy * 30) / 2
	}

	// periyotBirim == "hafta"
	var selectedList []string
	if strings.TrimSpace(seciliGunler) != "" {
		parts := strings.Split(seciliGunler, ",")
		for _, p := range parts {
			cleaned := strings.TrimSpace(p)
			if cleaned != "" {
				selectedList = append(selectedList, cleaned)
			}
		}
	}

	if len(selectedList) == 0 {
		periodDays := periyotAy * 7
		return periodDays / 2
	}

	dayMap := make(map[int]bool)
	var dayNums []int
	for _, name := range selectedList {
		if idx, ok := dayNameToIdx[name]; ok {
			if !dayMap[idx] {
				dayMap[idx] = true
				dayNums = append(dayNums, idx)
			}
		}
	}

	if len(dayNums) == 0 {
		periodDays := periyotAy * 7
		return periodDays / 2
	}

	sort.Ints(dayNums)

	if len(dayNums) == 1 {
		minGap := periyotAy * 7
		return minGap / 2
	}

	minGap := 999
	for i := 0; i < len(dayNums)-1; i++ {
		gap := dayNums[i+1] - dayNums[i]
		if gap < minGap {
			minGap = gap
		}
	}

	wrapGap := (7 - dayNums[len(dayNums)-1]) + dayNums[0] + (periyotAy-1)*7
	if wrapGap < minGap {
		minGap = wrapGap
	}

	maxDays := minGap / 2
	if maxDays < 0 {
		maxDays = 0
	}
	return maxDays
}

// -------------------------------------------------------------
// USER AUTHENTICATION HANDLERS
// -------------------------------------------------------------

type RegisterReq struct {
	Isim   string `json:"isim"`
	Eposta string `json:"eposta"`
	Sifre  string `json:"sifre"`
}

func (h *AppHandler) Register(c *fiber.Ctx) error {
	var req RegisterReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Lütfen tüm alanları doldurun."})
	}

	if strings.TrimSpace(req.Isim) == "" || strings.TrimSpace(req.Eposta) == "" || strings.TrimSpace(req.Sifre) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Lütfen isim, e-posta ve şifre alanlarını doldurun."})
	}

	epostaLower := strings.ToLower(strings.TrimSpace(req.Eposta))
	if !emailRegex.MatchString(epostaLower) {
		return c.Status(400).JSON(fiber.Map{"error": "Geçerli bir e-posta adresi giriniz (örnek: isim@domain.com)."})
	}

	if len(req.Sifre) < 6 {
		return c.Status(400).JSON(fiber.Map{"error": "Şifreniz en az 6 karakter olmalıdır."})
	}

	// E-posta benzersizlik kontrolü
	var existingUser Kullanici
	err := h.DB.Where("eposta = ?", epostaLower).First(&existingUser).Error
	if err == nil {
		return c.Status(400).JSON(fiber.Map{"error": "Bu e-posta adresi zaten kullanımda."})
	}

	// Şifreyi hashle
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Sifre), 10)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Şifre oluşturulamadı."})
	}

	// Kullanıcıyı kaydet
	now := time.Now()
	newUser := Kullanici{
		Isim:            req.Isim,
		Eposta:          epostaLower,
		Sifre:           string(hashedPassword),
		Role:            "user",
		OlusturmaTarihi: now,
		SonAktifTarih:   &now,
	}

	if err := h.DB.Create(&newUser).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// JWT token oluştur
	claims := jwt.MapClaims{
		"id":     newUser.ID,
		"eposta": newUser.Eposta,
		"role":   newUser.Role,
		"exp":    time.Now().Add(7 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Token oluşturulamadı."})
	}

	return c.Status(201).JSON(fiber.Map{
		"token": tokenString,
		"user": fiber.Map{
			"id":     newUser.ID,
			"isim":   newUser.Isim,
			"eposta": newUser.Eposta,
			"role":   newUser.Role,
		},
	})
}

type LoginReq struct {
	Eposta string `json:"eposta"`
	Sifre  string `json:"sifre"`
}

func (h *AppHandler) Login(c *fiber.Ctx) error {
	var req LoginReq
	if err := c.BodyParser(&req); err != nil {
	}

	epostaLower := strings.ToLower(req.Eposta)

	var user Kullanici
	if err := h.DB.Where("eposta = ?", epostaLower).First(&user).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Hatalı e-posta veya şifre."})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Sifre), []byte(req.Sifre)); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Hatalı e-posta veya şifre."})
	}

	if user.Role == "" {
		user.Role = "user"
	}

	now := time.Now()
	h.DB.Model(&user).Update("son_aktif_tarihi", now)

	claims := jwt.MapClaims{
		"id":     user.ID,
		"eposta": user.Eposta,
		"role":   user.Role,
		"exp":    time.Now().Add(7 * 24 * time.Hour).Unix(),
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tokenString, err := token.SignedString([]byte(h.JWTSecret))
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Token oluşturulamadı."})
	}

	return c.JSON(fiber.Map{
		"token": tokenString,
		"user": fiber.Map{
			"id":               user.ID,
			"isim":             user.Isim,
			"eposta":           user.Eposta,
			"role":             user.Role,
			"telegram_chat_id": user.TelegramChatID,
		},
	})
}

func (h *AppHandler) Me(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	now := time.Now()
	h.DB.Model(&Kullanici{}).Where("id = ?", userID).Update("son_aktif_tarihi", now)

	var user Kullanici
	if err := h.DB.Select("id, isim, eposta, role, telegram_chat_id, olusturma_tarihi, son_aktif_tarihi").Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Kullanıcı bulunamadı."})
	}

	return c.JSON(user)
}

// GetAdminUsers returns a list of all registered users and complete system metrics (admin only)
func (h *AppHandler) GetAdminUsers(c *fiber.Ctx) error {
	var users []Kullanici = []Kullanici{}
	roleVal, _ := c.Locals("userRole").(string)

	if roleVal == "admin" {
		if err := h.DB.Select("id, isim, eposta, role, telegram_chat_id, olusturma_tarihi, son_aktif_tarihi").Find(&users).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Kullanıcılar getirilirken hata oluştu."})
		}
	}

	var adminCount, userCount, activeUsers, totalGida, totalFatura, totalGaranti, totalRutin int64
	h.DB.Model(&Kullanici{}).Where("role = ?", "admin").Count(&adminCount)
	h.DB.Model(&Kullanici{}).Where("role != ? OR role IS NULL OR role = ''", "admin").Count(&userCount)

	twentyFourHoursAgo := time.Now().Add(-24 * time.Hour)
	h.DB.Model(&Kullanici{}).Where("son_aktif_tarihi >= ? OR (son_aktif_tarihi IS NULL AND olusturma_tarihi >= ?)", twentyFourHoursAgo, twentyFourHoursAgo).Count(&activeUsers)

	h.DB.Model(&Gida{}).Count(&totalGida)
	h.DB.Model(&Fatura{}).Count(&totalFatura)
	h.DB.Model(&Garanti{}).Count(&totalGaranti)
	h.DB.Model(&Rutin{}).Count(&totalRutin)

	// Unique visitor counts calculated from IP logs in ziyaretci_loglari
	var siteVisits, dailyVisits int64
	h.DB.Model(&ZiyaretciLog{}).Select("COUNT(DISTINCT ip)").Scan(&siteVisits)

	todayStr := time.Now().Format("2006-01-02")
	todayZero := getTodayZeroTime()
	h.DB.Model(&ZiyaretciLog{}).Where("DATE(tarih) = ? OR strftime('%Y-%m-%d', tarih) = ? OR tarih >= ?", todayStr, todayStr, todayZero).Select("COUNT(DISTINCT ip)").Scan(&dailyVisits)

	var dailyUsers, dailyComplaints int64
	h.DB.Model(&Kullanici{}).Where("olusturma_tarihi >= ?", todayZero).Count(&dailyUsers)
	h.DB.Model(&Sikayet{}).Where("olusturma_tarihi >= ?", todayZero).Count(&dailyComplaints)

	// 1. Son 7 günün günlük ziyaret sayıları (ziyaretci_loglari tablosundan)
	type DayStat struct {
		DateStr    string `gorm:"column:date_str"`
		VisitCount int64  `gorm:"column:visit_count"`
	}
	var rawWeekly []DayStat
	sevenDaysAgoStr := time.Now().AddDate(0, 0, -6).Format("2006-01-02 00:00:00")
	h.DB.Model(&ZiyaretciLog{}).
		Select("strftime('%Y-%m-%d', tarih) as date_str, COUNT(DISTINCT ip) as visit_count").
		Where("tarih >= ?", sevenDaysAgoStr).
		Group("strftime('%Y-%m-%d', tarih)").
		Scan(&rawWeekly)

	visitMap := make(map[string]int64)
	for _, stat := range rawWeekly {
		visitMap[stat.DateStr] = stat.VisitCount
	}

	dayNames := map[time.Weekday]string{
		time.Monday:    "Pzt",
		time.Tuesday:   "Sal",
		time.Wednesday: "Çar",
		time.Thursday:  "Per",
		time.Friday:    "Cum",
		time.Saturday:  "Cmt",
		time.Sunday:    "Paz",
	}

	type WeeklyVisitItem struct {
		Day     string `json:"day"`
		Date    string `json:"date"`
		Val     int64  `json:"val"`
		IsToday bool   `json:"is_today"`
	}

	var weeklyVisits []WeeklyVisitItem
	now := time.Now()
	for i := 6; i >= 0; i-- {
		d := now.AddDate(0, 0, -i)
		dStr := d.Format("2006-01-02")
		val := visitMap[dStr]
		if i == 0 && val == 0 && dailyVisits > 0 {
			val = dailyVisits
		}
		weeklyVisits = append(weeklyVisits, WeeklyVisitItem{
			Day:     dayNames[d.Weekday()],
			Date:    dStr,
			Val:     val,
			IsToday: i == 0,
		})
	}

	// 2. Saatlik Trafik Yoğunluğu (Son 24 saatin 8 zaman dilimi)
	type RawHour struct {
		HourStr   string `gorm:"column:hour_str"`
		HourCount int64  `gorm:"column:hour_count"`
	}
	var rawHours []RawHour
	h.DB.Model(&ZiyaretciLog{}).
		Select("strftime('%H', tarih) as hour_str, COUNT(*) as hour_count").
		Where("tarih >= ?", time.Now().Add(-24*time.Hour)).
		Group("strftime('%H', tarih)").
		Scan(&rawHours)

	hourCountMap := make(map[int]int64)
	for _, rh := range rawHours {
		var hInt int
		fmt.Sscanf(rh.HourStr, "%d", &hInt)
		hourCountMap[hInt] = rh.HourCount
	}

	timeSlots := []struct {
		Slot string
		Hour int
		Desc string
	}{
		{"03:00", 3, "Gece Sakinliği"},
		{"06:00", 6, "Sabah Başlangıcı"},
		{"09:00", 9, "Sabah Zirvesi"},
		{"12:00", 12, "Öğle Dengesi"},
		{"15:00", 15, "Stabil Akış"},
		{"18:00", 18, "Akşam Yükselişi"},
		{"20:00", 20, "ANA ZİRVE"},
		{"00:00", 0, "Gece Dengesi"},
	}

	var maxHourCount int64 = 1
	for _, cnt := range hourCountMap {
		if cnt > maxHourCount {
			maxHourCount = cnt
		}
	}

	type HourlyTrafficItem struct {
		Time string `json:"time"`
		Pct  int    `json:"pct"`
		Desc string `json:"desc"`
	}
	var hourlyTraffic []HourlyTrafficItem
	for _, ts := range timeSlots {
		cnt := hourCountMap[ts.Hour]
		pct := 15
		if maxHourCount > 0 && cnt > 0 {
			pct = 20 + int((float64(cnt)/float64(maxHourCount))*75.0)
		} else {
			switch ts.Hour {
			case 3:
				pct = 33
			case 6:
				pct = 45
			case 9:
				pct = 75
			case 12:
				pct = 52
			case 15:
				pct = 40
			case 18:
				pct = 68
			case 20:
				pct = 95
			case 0:
				pct = 50
			}
		}
		hourlyTraffic = append(hourlyTraffic, HourlyTrafficItem{
			Time: ts.Slot,
			Pct:  pct,
			Desc: fmt.Sprintf("%%%d %s", pct, ts.Desc),
		})
	}

	return c.JSON(fiber.Map{
		"users":            users,
		"total_users":      adminCount + userCount,
		"admin_count":      adminCount,
		"user_count":       userCount,
		"active_users":     activeUsers,
		"site_visits":      siteVisits,
		"daily_visits":     dailyVisits,
		"daily_users":      dailyUsers,
		"daily_complaints": dailyComplaints,
		"total_gida":       totalGida,
		"total_fatura":     totalFatura,
		"total_garanti":    totalGaranti,
		"total_rutin":      totalRutin,
		"weekly_visits":    weeklyVisits,
		"hourly_traffic":   hourlyTraffic,
	})
}

// SendAdminReport handles manual triggering of the daily admin report to Telegram
func (h *AppHandler) SendAdminReport(c *fiber.Ctx) error {
	roleVal, _ := c.Locals("userRole").(string)
	if roleVal != "admin" {
		return c.Status(403).JSON(fiber.Map{"error": "Bu işlem için admin yetkisi gereklidir."})
	}

	sent, err := sendAdminSummaryReport(h.DB)
	if err != nil || !sent {
		return c.Status(500).JSON(fiber.Map{
			"success": false,
			"error":   "Admin raporu gönderilemedi. Lütfen Telegram Bot Token ve Chat ID ayarlarınızı kontrol edin.",
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Günlük Admin Özeti Telegram üzerinden başarıyla gönderildi!",
	})
}




type UpdateProfileReq struct {
	Isim        string `json:"isim"`
	Eposta      string `json:"eposta"`
	MevcutSifre string `json:"mevcut_sifre"`
	Sifre       string `json:"sifre"`
}

func (h *AppHandler) UpdateProfile(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	var req UpdateProfileReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz istek gövdesi."})
	}

	if strings.TrimSpace(req.Isim) == "" || strings.TrimSpace(req.Eposta) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "İsim ve e-posta alanları boş bırakılamaz."})
	}

	epostaLower := strings.ToLower(strings.TrimSpace(req.Eposta))
	if !emailRegex.MatchString(epostaLower) {
		return c.Status(400).JSON(fiber.Map{"error": "Geçerli bir e-posta adresi giriniz (örnek: isim@domain.com)."})
	}

	var user Kullanici
	if err := h.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Kullanıcı bulunamadı."})
	}

	if epostaLower != user.Eposta {
		var existingUser Kullanici
		err := h.DB.Where("eposta = ? AND id != ?", epostaLower, userID).First(&existingUser).Error
		if err == nil {
			return c.Status(400).JSON(fiber.Map{"error": "Bu e-posta adresi başka bir kullanıcı tarafından kullanılıyor."})
		}
		user.Eposta = epostaLower
	}

	user.Isim = req.Isim

	if req.Sifre != "" {
		if req.MevcutSifre == "" {
			return c.Status(400).JSON(fiber.Map{"error": "Şifrenizi değiştirmek için lütfen mevcut şifrenizi girin."})
		}

		// Şifre uzunluğu en az 6 karakter olmalı
		if len(req.Sifre) < 6 {
			return c.Status(400).JSON(fiber.Map{"error": "Yeni şifreniz en az 6 karakter olmalıdır."})
		}

		// Mevcut şifreyi doğrula
		err := bcrypt.CompareHashAndPassword([]byte(user.Sifre), []byte(req.MevcutSifre))
		if err != nil {
			return c.Status(400).JSON(fiber.Map{"error": "Mevcut şifreniz hatalı."})
		}

		// Yeni şifrenin mevcut şifreyle aynı olup olmadığını kontrol et
		errSame := bcrypt.CompareHashAndPassword([]byte(user.Sifre), []byte(req.Sifre))
		if errSame == nil {
			return c.Status(400).JSON(fiber.Map{"error": "Yeni şifreniz mevcut şifrenizle aynı olamaz."})
		}

		// Yeni şifreyi hashle
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Sifre), 10)
		if err != nil {
			return c.Status(500).JSON(fiber.Map{"error": "Şifre şifrelenirken hata oluştu."})
		}
		user.Sifre = string(hashedPassword)
	}

	if err := h.DB.Save(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Profil güncellenirken hata oluştu."})
	}

	return c.JSON(fiber.Map{
		"message": "Profil başarıyla güncellendi.",
		"user": fiber.Map{
			"id":     user.ID,
			"isim":   user.Isim,
			"eposta": user.Eposta,
		},
	})
}

type DeleteAccountReq struct {
	Sifre string `json:"sifre"`
}

// DeleteAccount verifies password and deletes the authenticated user and all associated records
func (h *AppHandler) DeleteAccount(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var req DeleteAccountReq
	if err := c.BodyParser(&req); err != nil || strings.TrimSpace(req.Sifre) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Hesabınızı silmek için lütfen mevcut şifrenizi girin."})
	}

	var user Kullanici
	if err := h.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Kullanıcı bulunamadı."})
	}

	// Şifreyi doğrula
	if err := bcrypt.CompareHashAndPassword([]byte(user.Sifre), []byte(req.Sifre)); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Girdiğiniz şifre hatalı. Hesap silinemedi."})
	}

	// Kullanıcıya ait tüm bağlı kayıtları temizle
	h.DB.Where("kullanici_id = ?", userID).Delete(&Gida{})
	h.DB.Where("kullanici_id = ?", userID).Delete(&Fatura{})
	h.DB.Where("kullanici_id = ?", userID).Delete(&Garanti{})
	h.DB.Where("kullanici_id = ?", userID).Delete(&Rutin{})
	h.DB.Where("kullanici_id = ?", userID).Delete(&RutinKlasor{})

	if err := h.DB.Where("id = ?", userID).Delete(&Kullanici{}).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Hesap silinirken bir hata oluştu: " + err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Hesabınız ve tüm verileriniz başarıyla silindi."})
}

// -------------------------------------------------------------
// DASHBOARD HANDLER
// -------------------------------------------------------------

func (h *AppHandler) GetDashboardSummary(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	// 1. Gıdalar Özeti
	var gidalar []Gida
	if err := h.DB.Where("durum = 'bekliyor' AND kullanici_id = ?", userID).Find(&gidalar).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	gidaAlertCount := 0
	for _, g := range gidalar {
		days, err := getDaysRemaining(g.SKT)
		if err == nil && days <= g.HatirlatmaGunKala {
			gidaAlertCount++
		}
	}

	// 2. Faturalar Özeti
	var faturalar []Fatura
	if err := h.DB.Where("durum = 'odenmedi' AND kullanici_id = ?", userID).Find(&faturalar).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	faturaAlertCount := 0
	toplamBorc := 0.0
	for _, f := range faturalar {
		if f.Tutar != nil {
			toplamBorc += *f.Tutar
		}
		days, err := getDaysRemaining(f.SonOdemeTarihi)
		if err == nil && days <= f.HatirlatmaGunKala {
			faturaAlertCount++
		}
	}

	// 3. Garantiler Özeti
	var garantiler []Garanti
	if err := h.DB.Where("kullanici_id = ?", userID).Find(&garantiler).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	garantiAlertCount := 0
	for _, g := range garantiler {
		days, err := getDaysRemaining(g.GarantiBitis)
		if err == nil && days >= 0 && days <= g.HatirlatmaGunKala {
			garantiAlertCount++
		}
	}

	// 4. Rutinler Özeti
	var rutinler []Rutin
	if err := h.DB.Where("kullanici_id = ?", userID).Find(&rutinler).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}
	rutinAlertCount := 0
	for _, r := range rutinler {
		alertTriggered := false
		if r.SonYapilmaTarihi != nil && *r.SonYapilmaTarihi != "" {
			seciliGunler := ""
			if r.SeciliGunler != nil {
				seciliGunler = *r.SeciliGunler
			}
			nextDate, err := getNextRoutineDate(*r.SonYapilmaTarihi, r.PeriyotAy, r.PeriyotBirim, seciliGunler)
			if err == nil {
				today := getTodayZeroTime()
				diffDays := int(math.Ceil(nextDate.Sub(today).Hours() / 24.0))
				if diffDays <= r.HatirlatmaGunKala {
					alertTriggered = true
				}
			}
		} else {
			alertTriggered = true
		}

		if !alertTriggered && r.HedefKM != nil && r.MevcutKM != nil {
			kalan := *r.HedefKM - *r.MevcutKM
			if kalan <= 500 {
				alertTriggered = true
			}
		}

		if alertTriggered {
			rutinAlertCount++
		}
	}

	return c.JSON(fiber.Map{
		"gidalar":    fiber.Map{"toplam": len(gidalar), "uyarilar": gidaAlertCount},
		"faturalar":  fiber.Map{"toplam": len(faturalar), "uyarilar": faturaAlertCount, "toplamBorc": toplamBorc},
		"garantiler": fiber.Map{"toplam": len(garantiler), "uyarilar": garantiAlertCount},
		"rutinler":   fiber.Map{"toplam": len(rutinler), "uyarilar": rutinAlertCount},
	})
}

// -------------------------------------------------------------
// GIDALAR HANDLERS
// -------------------------------------------------------------

func (h *AppHandler) GetGidalar(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var gidalar []Gida
	if err := h.DB.Where("kullanici_id = ?", userID).Order("skt ASC").Find(&gidalar).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(gidalar)
}

func (h *AppHandler) CreateGida(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var gida Gida
	if err := c.BodyParser(&gida); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	if gida.UrunAdi == "" || gida.SKT == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Urun adı ve SKT gereklidir."})
	}

	gida.KullaniciID = userID
	if gida.HatirlatmaGunKala < 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Hatırlatma gün sayısı 0 veya daha büyük olmalıdır."})
	}
	if gida.Durum == "" {
		gida.Durum = "bekliyor"
	}

	if err := h.DB.Create(&gida).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(gida)
}

func (h *AppHandler) UpdateGida(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var updateData Gida
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	var gida Gida
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&gida).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Gıda kaydı bulunamadı."})
	}

	gida.UrunAdi = updateData.UrunAdi
	gida.Kategori = updateData.Kategori
	gida.SKT = updateData.SKT
	gida.HatirlatmaGunKala = updateData.HatirlatmaGunKala
	gida.Durum = updateData.Durum

	if err := h.DB.Save(&gida).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Gıda başarıyla güncellendi."})
}

func (h *AppHandler) DeleteGida(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var gida Gida
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&gida).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Gıda kaydı bulunamadı."})
	}

	if err := h.DB.Delete(&gida).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Gıda başarıyla silindi."})
}

// -------------------------------------------------------------
// FATURALAR HANDLERS
// -------------------------------------------------------------

func (h *AppHandler) GetFaturalar(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var faturalar []Fatura
	if err := h.DB.Where("kullanici_id = ?", userID).Order("son_odeme_tarihi ASC").Find(&faturalar).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(faturalar)
}

func (h *AppHandler) CreateFatura(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var fatura Fatura
	if err := c.BodyParser(&fatura); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	if fatura.FaturaAdi == "" || fatura.SonOdemeTarihi == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Fatura adı ve Son Ödeme Tarihi gereklidir."})
	}

	fatura.KullaniciID = userID
	if fatura.Durum == "" {
		fatura.Durum = "odenmedi"
	}

	if err := h.DB.Create(&fatura).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(fatura)
}

func (h *AppHandler) UpdateFatura(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var updateData Fatura
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	var fatura Fatura
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&fatura).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Fatura kaydı bulunamadı."})
	}

	fatura.FaturaAdi = updateData.FaturaAdi
	fatura.Tutar = updateData.Tutar
	fatura.SonOdemeTarihi = updateData.SonOdemeTarihi
	fatura.HatirlatmaGunKala = updateData.HatirlatmaGunKala
	fatura.Durum = updateData.Durum

	if err := h.DB.Save(&fatura).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Fatura başarıyla güncellendi."})
}

func (h *AppHandler) DeleteFatura(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var fatura Fatura
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&fatura).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Fatura kaydı bulunamadı."})
	}

	if err := h.DB.Delete(&fatura).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Fatura başarıyla silindi."})
}

// -------------------------------------------------------------
// GARANTİLER HANDLERS
// -------------------------------------------------------------

func (h *AppHandler) GetGarantiler(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var garantiler []Garanti
	if err := h.DB.Where("kullanici_id = ?", userID).Order("garanti_bitis ASC").Find(&garantiler).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(garantiler)
}

func (h *AppHandler) CreateGaranti(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var garanti Garanti
	if err := c.BodyParser(&garanti); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	if garanti.CihazAdi == "" || garanti.GarantiBitis == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Cihaz adı ve Garanti Bitiş Tarihi gereklidir."})
	}

	garanti.KullaniciID = userID

	if err := h.DB.Create(&garanti).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(garanti)
}

func (h *AppHandler) UpdateGaranti(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var updateData Garanti
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	var garanti Garanti
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&garanti).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Garanti kaydı bulunamadı."})
	}

	garanti.CihazAdi = updateData.CihazAdi
	garanti.MarkaModel = updateData.MarkaModel
	garanti.GarantiBitis = updateData.GarantiBitis
	garanti.HatirlatmaGunKala = updateData.HatirlatmaGunKala
	garanti.Notlar = updateData.Notlar

	if err := h.DB.Save(&garanti).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Garanti başarıyla güncellendi."})
}

func (h *AppHandler) DeleteGaranti(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var garanti Garanti
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&garanti).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Garanti kaydı bulunamadı."})
	}

	if err := h.DB.Delete(&garanti).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Garanti kaydı başarıyla silindi."})
}

// -------------------------------------------------------------
// RUTİN KLASÖRLERİ HANDLERS
// -------------------------------------------------------------

func (h *AppHandler) GetRutinKlasorleri(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var klasorler []RutinKlasor
	if err := h.DB.Where("kullanici_id = ?", userID).Order("klasor_adi ASC").Find(&klasorler).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(klasorler)
}

func (h *AppHandler) CreateRutinKlasor(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var klasor RutinKlasor
	if err := c.BodyParser(&klasor); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	if klasor.KlasorAdi == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Klasör adı gereklidir."})
	}

	klasor.KullaniciID = userID

	if err := h.DB.Create(&klasor).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(klasor)
}

func (h *AppHandler) UpdateRutinKlasor(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var updateData RutinKlasor
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	if updateData.KlasorAdi == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Klasör adı gereklidir."})
	}

	var klasor RutinKlasor
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&klasor).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Klasör bulunamadı."})
	}

	klasor.KlasorAdi = updateData.KlasorAdi

	if err := h.DB.Save(&klasor).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Klasör adı başarıyla güncellendi.", "klasor": klasor})
}

func (h *AppHandler) DeleteRutinKlasor(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var klasor RutinKlasor
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&klasor).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Klasör bulunamadı."})
	}

	if err := h.DB.Delete(&klasor).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Klasör ve ilişkili rutin görevler başarıyla silindi."})
}

// -------------------------------------------------------------
// RUTİNLER HANDLERS
// -------------------------------------------------------------

func (h *AppHandler) GetRutinler(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var rutinler []RutinWithKlasor
	err := h.DB.Model(&Rutin{}).
		Select("rutinler.*, k.klasor_adi").
		Joins("LEFT JOIN rutin_klasorleri k ON rutinler.klasor_id = k.id").
		Where("rutinler.kullanici_id = ?", userID).
		Order("rutinler.son_yapilma_tarihi ASC").
		Scan(&rutinler).Error

	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(rutinler)
}

func (h *AppHandler) CreateRutin(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var rutin Rutin
	if err := c.BodyParser(&rutin); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	if rutin.PeriyotBirim == "" {
		rutin.PeriyotBirim = "ay"
	}

	if rutin.GorevAdi == "" || rutin.PeriyotAy <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Görev adı ve Periyot gereklidir."})
	}

	rutin.KullaniciID = userID

	seciliGunler := ""
	if rutin.SeciliGunler != nil {
		seciliGunler = *rutin.SeciliGunler
	}

	maxDays := calcRutinMaxWarningDays(rutin.PeriyotAy, rutin.PeriyotBirim, seciliGunler)
	if rutin.HatirlatmaGunKala < 0 || rutin.HatirlatmaGunKala > maxDays {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("Hatırlatma gün sayısı periyot süresinin yarısından (en fazla %d gün) fazla olamaz.", maxDays)})
	}

	if err := h.DB.Create(&rutin).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.Status(201).JSON(rutin)
}

func (h *AppHandler) UpdateRutin(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var updateData Rutin
	if err := c.BodyParser(&updateData); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	var rutin Rutin
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&rutin).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Rutin görev bulunamadı."})
	}

	periyotBirim := updateData.PeriyotBirim
	if periyotBirim == "" {
		periyotBirim = "ay"
	}

	seciliGunler := ""
	if updateData.SeciliGunler != nil {
		seciliGunler = *updateData.SeciliGunler
	}

	maxDays := calcRutinMaxWarningDays(updateData.PeriyotAy, periyotBirim, seciliGunler)
	if updateData.HatirlatmaGunKala < 0 || updateData.HatirlatmaGunKala > maxDays {
		return c.Status(400).JSON(fiber.Map{"error": fmt.Sprintf("Hatırlatma gün sayısı periyot süresinin yarısından (en fazla %d gün) fazla olamaz.", maxDays)})
	}

	updates := map[string]interface{}{
		"klasor_id":           updateData.KlasorID,
		"gorev_adi":           updateData.GorevAdi,
		"periyot_ay":          updateData.PeriyotAy,
		"periyot_birim":       periyotBirim,
		"secili_gunler":       seciliGunler,
		"hatirlatma_gun_kala": updateData.HatirlatmaGunKala,
		"hedef_km":            updateData.HedefKM,
		"mevcut_km":           updateData.MevcutKM,
		"son_yapilma_tarihi":  updateData.SonYapilmaTarihi,
	}

	if err := h.DB.Model(&Rutin{}).Where("id = ? AND kullanici_id = ?", id, userID).Updates(updates).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Rutin görev başarıyla güncellendi."})
}

type RutinDoneReq struct {
	MevcutKM    *int `json:"mevcut_km"`
	YeniHedefKM *int `json:"yeni_hedef_km"`
}

func (h *AppHandler) MarkRutinDone(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var req RutinDoneReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	var rutin Rutin
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&rutin).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Rutin görev bulunamadı."})
	}

	todayStr := time.Now().Format("2006-01-02")
	rutin.SonYapilmaTarihi = &todayStr

	if req.MevcutKM != nil {
		rutin.MevcutKM = req.MevcutKM
		rutin.HedefKM = req.YeniHedefKM
	}

	if err := h.DB.Save(&rutin).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"message":            "Rutin görev yapıldı olarak işaretlendi.",
		"son_yapilma_tarihi": todayStr,
	})
}

func (h *AppHandler) DeleteRutin(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	id, err := strconv.Atoi(c.Params("id"))
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz ID."})
	}

	var rutin Rutin
	if err := h.DB.Where("id = ? AND kullanici_id = ?", id, userID).First(&rutin).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Rutin görev bulunamadı."})
	}

	if err := h.DB.Delete(&rutin).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Rutin görev başarıyla silindi."})
}

// -------------------------------------------------------------
// AYARLAR HANDLERS
// -------------------------------------------------------------

func (h *AppHandler) GetAyarlar(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var user Kullanici
	if err := h.DB.Select("telegram_chat_id, bildirim_saati").Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var tokenRow, adminBildirimSaatiRow Ayarlar
	h.DB.Where("anahtar = ?", "telegram_token").First(&tokenRow)
	h.DB.Where("anahtar = ?", "admin_bildirim_saati").First(&adminBildirimSaatiRow)
	if adminBildirimSaatiRow.Deger == "" {
		h.DB.Where("anahtar = ?", "bildirim_saati").First(&adminBildirimSaatiRow)
	}

	userBildirimSaati := user.BildirimSaati
	if userBildirimSaati == "" {
		userBildirimSaati = "09:00"
	}

	adminBildirimSaati := adminBildirimSaatiRow.Deger
	if adminBildirimSaati == "" {
		adminBildirimSaati = "09:00"
	}

	return c.JSON(fiber.Map{
		"telegram_token":       tokenRow.Deger,
		"telegram_chat_id":    user.TelegramChatID,
		"bildirim_saati":      userBildirimSaati,
		"admin_bildirim_saati": adminBildirimSaati,
	})
}

type SaveAyarlarReq struct {
	TelegramToken      string `json:"telegram_token"`
	TelegramChatID     string `json:"telegram_chat_id"`
	BildirimSaati      string `json:"bildirim_saati"`
	AdminBildirimSaati string `json:"admin_bildirim_saati"`
}

func (h *AppHandler) SaveAyarlar(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)
	roleVal, _ := c.Locals("userRole").(string)

	var req SaveAyarlarReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	if req.TelegramToken != "" {
		tokenSetting := Ayarlar{Anahtar: "telegram_token", Deger: req.TelegramToken}
		if err := h.DB.Save(&tokenSetting).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Sadece Admin rolü Yönetici Özet Rapor Saatini güncelleyebilir
	if roleVal == "admin" && req.AdminBildirimSaati != "" {
		adminTimeSetting := Ayarlar{Anahtar: "admin_bildirim_saati", Deger: req.AdminBildirimSaati}
		if err := h.DB.Save(&adminTimeSetting).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	// Kullanıcıya özel Telegram Chat ID ve kişisel bildirim saatini güncelle
	updates := map[string]interface{}{}
	updates["telegram_chat_id"] = req.TelegramChatID
	if req.BildirimSaati != "" {
		updates["bildirim_saati"] = req.BildirimSaati
	}

	if len(updates) > 0 {
		if err := h.DB.Model(&Kullanici{}).Where("id = ?", userID).Updates(updates).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	return c.JSON(fiber.Map{"message": "Ayarlar başarıyla kaydedildi."})
}

// -------------------------------------------------------------
// BİLDİRİM MANUEL TETİKLEME / TEST HANDLERS
// -------------------------------------------------------------

func (h *AppHandler) TestBildirim(c *fiber.Ctx) error {
	userIDVal := c.Locals("userID")
	if userIDVal == nil {
		return c.Status(401).JSON(fiber.Map{"error": "Yetkisiz erişim."})
	}
	userID := userIDVal.(uint)

	success, sent, alertsCount, err := checkAndNotifyForUser(h.DB, userID)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	sentCount := 0
	if sent {
		sentCount = 1
	}

	return c.JSON(fiber.Map{
		"success":        success,
		"sent":           sent,
		"sentUsersCount": sentCount,
		"alertsCount":    alertsCount,
	})
}

type SendTestTelegramReq struct {
	TelegramToken  string `json:"telegram_token"`
	TelegramChatID string `json:"telegram_chat_id"`
}

func (h *AppHandler) SendTestTelegram(c *fiber.Ctx) error {
	var req SendTestTelegramReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	if req.TelegramToken == "" || req.TelegramChatID == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Token ve Chat ID gereklidir."})
	}

	bot, err := tgbotapi.NewBotAPI(req.TelegramToken)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Telegram bağlantı hatası: %s", err.Error())})
	}

	chatIDInt, err := strconv.ParseInt(req.TelegramChatID, 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz Chat ID."})
	}

	msgText := "🏠 <b>Akıllı Ev ve Yaşam Asistanı</b>\n\nTelegram bağlantınız başarıyla test edildi! Bildirimleri almaya hazırsınız."
	msg := tgbotapi.NewMessage(chatIDInt, msgText)
	msg.ParseMode = "HTML"

	_, err = bot.Send(msg)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": fmt.Sprintf("Telegram mesaj gönderme hatası: %s", err.Error())})
	}

	return c.JSON(fiber.Map{"success": true})
}

// -------------------------------------------------------------
// ŞİKAYET & GERİ BİLDİRİM HANDLERS
// -------------------------------------------------------------

type CreateSikayetReq struct {
	Baslik string `json:"baslik"`
	Mesaj  string `json:"mesaj"`
}

func (h *AppHandler) CreateSikayet(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var req CreateSikayetReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz istek gövdesi."})
	}

	if strings.TrimSpace(req.Baslik) == "" || strings.TrimSpace(req.Mesaj) == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Lütfen başlık ve mesaj alanlarını doldurun."})
	}

	var user Kullanici
	if err := h.DB.Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Kullanıcı bulunamadı."})
	}

	sikayet := Sikayet{
		KullaniciID:     user.ID,
		KullaniciIsim:   user.Isim,
		KullaniciEposta: user.Eposta,
		Baslik:          strings.TrimSpace(req.Baslik),
		Mesaj:           strings.TrimSpace(req.Mesaj),
		Durum:           "bekliyor",
		OlusturmaTarihi: time.Now(),
	}

	if err := h.DB.Create(&sikayet).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Şikayet kaydedilirken bir hata oluştu."})
	}

	return c.Status(201).JSON(fiber.Map{
		"message": "Şikayetiniz yöneticilere iletildi. İlginiz için teşekkür ederiz.",
		"sikayet": sikayet,
	})
}

func (h *AppHandler) GetAdminSikayetler(c *fiber.Ctx) error {
	var sikayetler []Sikayet
	if err := h.DB.Order("id DESC").Find(&sikayetler).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Şikayetler getirilemedi."})
	}

	var bekliyorSayisi, incelendiSayisi, cozulduSayisi int64
	h.DB.Model(&Sikayet{}).Where("durum = ?", "bekliyor").Count(&bekliyorSayisi)
	h.DB.Model(&Sikayet{}).Where("durum = ?", "incelendi").Count(&incelendiSayisi)
	h.DB.Model(&Sikayet{}).Where("durum = ?", "cozuldu").Count(&cozulduSayisi)

	return c.JSON(fiber.Map{
		"sikayetler":       sikayetler,
		"toplam":          len(sikayetler),
		"bekliyor_sayisi": bekliyorSayisi,
		"incelendi_sayisi": incelendiSayisi,
		"cozuldu_sayisi":  cozulduSayisi,
	})
}

type UpdateSikayetDurumReq struct {
	Durum string `json:"durum"`
}

func (h *AppHandler) UpdateSikayetDurum(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz şikayet ID."})
	}

	var req UpdateSikayetDurumReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz istek gövdesi."})
	}

	durum := strings.TrimSpace(req.Durum)
	if durum != "bekliyor" && durum != "incelendi" && durum != "cozuldu" {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz durum değeri."})
	}

	var sikayet Sikayet
	if err := h.DB.Where("id = ?", id).First(&sikayet).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Şikayet bulunamadı."})
	}

	sikayet.Durum = durum
	if err := h.DB.Save(&sikayet).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Şikayet durumu güncellenemedi."})
	}

	return c.JSON(fiber.Map{
		"message": "Şikayet durumu güncellendi.",
		"sikayet": sikayet,
	})
}

func (h *AppHandler) DeleteSikayet(c *fiber.Ctx) error {
	idStr := c.Params("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz şikayet ID."})
	}

	var sikayet Sikayet
	if err := h.DB.Where("id = ?", id).First(&sikayet).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Şikayet bulunamadı."})
	}

	if err := h.DB.Delete(&sikayet).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": "Şikayet silinemedi."})
	}

	return c.JSON(fiber.Map{"message": "Şikayet başarıyla silindi."})
}

