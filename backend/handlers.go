package main

import (
	"fmt"
	"math"
	"regexp"
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
	newUser := Kullanici{
		Isim:            req.Isim,
		Eposta:          epostaLower,
		Sifre:           string(hashedPassword),
		OlusturmaTarihi: time.Now(),
	}

	if err := h.DB.Create(&newUser).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	// JWT token oluştur
	claims := jwt.MapClaims{
		"id":     newUser.ID,
		"eposta": newUser.Eposta,
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
		return c.Status(400).JSON(fiber.Map{"error": "Lütfen e-posta ve şifre girin."})
	}

	if req.Eposta == "" || req.Sifre == "" {
		return c.Status(400).JSON(fiber.Map{"error": "Lütfen e-posta ve şifre girin."})
	}

	epostaLower := strings.ToLower(req.Eposta)

	var user Kullanici
	if err := h.DB.Where("eposta = ?", epostaLower).First(&user).Error; err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Hatalı e-posta veya şifre."})
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.Sifre), []byte(req.Sifre)); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Hatalı e-posta veya şifre."})
	}

	claims := jwt.MapClaims{
		"id":     user.ID,
		"eposta": user.Eposta,
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
			"telegram_chat_id": user.TelegramChatID,
		},
	})
}

func (h *AppHandler) Me(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var user Kullanici
	if err := h.DB.Select("id, isim, eposta, telegram_chat_id").Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(404).JSON(fiber.Map{"error": "Kullanıcı bulunamadı."})
	}

	return c.JSON(user)
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
			nextDate, err := getNextRoutineDate(*r.SonYapilmaTarihi, r.PeriyotAy)
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
	if gida.HatirlatmaGunKala == 0 {
		gida.HatirlatmaGunKala = 3
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
	if fatura.HatirlatmaGunKala == 0 {
		fatura.HatirlatmaGunKala = 5
	}
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
	if garanti.HatirlatmaGunKala == 0 {
		garanti.HatirlatmaGunKala = 30
	}

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
	err := h.DB.Table("rutinler r").
		Select("r.*, k.klasor_adi").
		Joins("LEFT JOIN rutin_klasorleri k ON r.klasor_id = k.id").
		Where("r.kullanici_id = ?", userID).
		Order("r.son_yapilma_tarihi ASC").
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

	if rutin.GorevAdi == "" || rutin.PeriyotAy <= 0 {
		return c.Status(400).JSON(fiber.Map{"error": "Görev adı ve Periyot (ay) gereklidir."})
	}

	rutin.KullaniciID = userID
	if rutin.HatirlatmaGunKala == 0 {
		rutin.HatirlatmaGunKala = 15
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

	rutin.KlasorID = updateData.KlasorID
	rutin.GorevAdi = updateData.GorevAdi
	rutin.PeriyotAy = updateData.PeriyotAy
	rutin.HatirlatmaGunKala = updateData.HatirlatmaGunKala
	rutin.HedefKM = updateData.HedefKM
	rutin.MevcutKM = updateData.MevcutKM
	rutin.SonYapilmaTarihi = updateData.SonYapilmaTarihi

	if err := h.DB.Save(&rutin).Error; err != nil {
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
	if err := h.DB.Select("telegram_chat_id").Where("id = ?", userID).First(&user).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	var tokenRow, bildirimSaatiRow Ayarlar
	h.DB.Where("anahtar = ?", "telegram_token").First(&tokenRow)
	h.DB.Where("anahtar = ?", "bildirim_saati").First(&bildirimSaatiRow)

	bildirimSaati := bildirimSaatiRow.Deger
	if bildirimSaati == "" {
		bildirimSaati = "09:00"
	}

	return c.JSON(fiber.Map{
		"telegram_token":    tokenRow.Deger,
		"telegram_chat_id": user.TelegramChatID,
		"bildirim_saati":   bildirimSaati,
	})
}

type SaveAyarlarReq struct {
	TelegramToken  string `json:"telegram_token"`
	TelegramChatID string `json:"telegram_chat_id"`
	BildirimSaati  string `json:"bildirim_saati"`
}

func (h *AppHandler) SaveAyarlar(c *fiber.Ctx) error {
	userID := c.Locals("userID").(uint)

	var req SaveAyarlarReq
	if err := c.BodyParser(&req); err != nil {
		return c.Status(400).JSON(fiber.Map{"error": "Geçersiz veri biçimi."})
	}

	tokenSetting := Ayarlar{Anahtar: "telegram_token", Deger: req.TelegramToken}
	if err := h.DB.Save(&tokenSetting).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	chatIDSetting := Ayarlar{Anahtar: "telegram_chat_id", Deger: req.TelegramChatID}
	if err := h.DB.Save(&chatIDSetting).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	if req.BildirimSaati != "" {
		bildirimSaatiSetting := Ayarlar{Anahtar: "bildirim_saati", Deger: req.BildirimSaati}
		if err := h.DB.Save(&bildirimSaatiSetting).Error; err != nil {
			return c.Status(500).JSON(fiber.Map{"error": err.Error()})
		}
	}

	if err := h.DB.Model(&Kullanici{}).Where("id = ?", userID).Update("telegram_chat_id", req.TelegramChatID).Error; err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{"message": "Ayarlar başarıyla kaydedildi."})
}

// -------------------------------------------------------------
// BİLDİRİM MANUEL TETİKLEME / TEST HANDLERS
// -------------------------------------------------------------

func (h *AppHandler) TestBildirim(c *fiber.Ctx) error {
	success, sentCount, alertsCount, err := checkAndNotify(h.DB)
	if err != nil {
		return c.Status(500).JSON(fiber.Map{"error": err.Error()})
	}

	return c.JSON(fiber.Map{
		"success":        success,
		"sent":           sentCount > 0,
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
