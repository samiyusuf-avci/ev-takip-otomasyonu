package main

import (
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	tgbotapi "github.com/go-telegram-bot-api/telegram-bot-api/v5"
	"gorm.io/gorm"
)

// Helper to get today at 00:00:00 local time
func getTodayZeroTime() time.Time {
	now := time.Now()
	return time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, now.Location())
}

// Helper to parse date strings in various formats (YYYY-MM-DD, ISO 8601 with T/Z/space, etc.)
func parseDateStr(dateStr string) (time.Time, error) {
	if dateStr == "" {
		return time.Time{}, fmt.Errorf("empty date")
	}
	cleanStr := strings.TrimSpace(dateStr)
	cleanStr = strings.Split(cleanStr, "T")[0]
	cleanStr = strings.Split(cleanStr, " ")[0]
	return time.ParseInLocation("2006-01-02", cleanStr, time.Local)
}

// Calculate days remaining between targetDateStr and today
func getDaysRemaining(targetDateStr string) (int, error) {
	targetTime, err := parseDateStr(targetDateStr)
	if err != nil {
		return 0, err
	}
	today := getTodayZeroTime()
	diff := targetTime.Sub(today)
	days := int(math.Round(diff.Hours() / 24.0))
	return days, nil
}

// Calculate next routine date by adding months to the last done date
func getNextRoutineDate(lastDoneStr string, periodMonths int) (time.Time, error) {
	t, err := parseDateStr(lastDoneStr)
	if err != nil {
		return time.Time{}, err
	}
	return t.AddDate(0, periodMonths, 0), nil
}

// Helper to send telegram message to default settings chat id
func sendTelegramMessage(db *gorm.DB, message string) (bool, error) {
	var tokenSetting, chatIDSetting Ayarlar
	if err := db.Where("anahtar = ?", "telegram_token").First(&tokenSetting).Error; err != nil {
		return false, err
	}
	if err := db.Where("anahtar = ?", "telegram_chat_id").First(&chatIDSetting).Error; err != nil {
		return false, err
	}

	token := tokenSetting.Deger
	chatID := chatIDSetting.Deger

	if token == "" || chatID == "" {
		return false, fmt.Errorf("Telegram token or Chat ID not found")
	}

	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		return false, err
	}

	chatIDInt, err := strconv.ParseInt(chatID, 10, 64)
	if err != nil {
		return false, err
	}

	msg := tgbotapi.NewMessage(chatIDInt, message)
	msg.ParseMode = "HTML"

	_, err = bot.Send(msg)
	if err != nil {
		return false, err
	}

	return true, nil
}

// checkAndNotify scans all reminders and sends Telegram notifications if needed
func checkAndNotify(db *gorm.DB) (bool, int, int, error) {
	fmt.Println("Hatırlatıcılar taranıyor...")

	var users []Kullanici
	if err := db.Find(&users).Error; err != nil {
		return false, 0, 0, err
	}

	// Eğer kullanıcıların telegram_chat_id'si boşsa ama ayarlar tablosunda varsa doldur
	var chatIDSetting Ayarlar
	defaultChatID := ""
	if err := db.Where("anahtar = ? AND deger != ''", "telegram_chat_id").First(&chatIDSetting).Error; err == nil {
		defaultChatID = chatIDSetting.Deger
	}

	var tokenSetting Ayarlar
	if err := db.Where("anahtar = ?", "telegram_token").First(&tokenSetting).Error; err != nil {
		return false, 0, 0, fmt.Errorf("Telegram bot token bulunamadı: %v", err)
	}
	token := tokenSetting.Deger
	if token == "" {
		return false, 0, 0, fmt.Errorf("Telegram bot token bulunamadı")
	}

	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		return false, 0, 0, fmt.Errorf("Telegram bot başlatılamadı: %v", err)
	}

	totalSent := 0
	totalAlertsCount := 0
	todayStr := time.Now().Format("02.01.2006")

	for _, user := range users {
		userChatID := user.TelegramChatID
		if userChatID == "" {
			userChatID = defaultChatID
		}

		var alerts []string

		// 1. GIDALAR KONTROLÜ
		var gidalar []Gida
		if err := db.Where("durum = 'bekliyor' AND kullanici_id = ?", user.ID).Find(&gidalar).Error; err == nil {
			var gidaAlerts []string
			for _, gida := range gidalar {
				days, err := getDaysRemaining(gida.SKT)
				if err == nil {
					if days < 0 {
						gidaAlerts = append(gidaAlerts, fmt.Sprintf("⚠️ <b>%s</b> (S.K.T. %d gün geçti!)", gida.UrunAdi, -days))
					} else if days <= gida.HatirlatmaGunKala {
						if days == 0 {
							gidaAlerts = append(gidaAlerts, fmt.Sprintf("⏰ <b>%s</b> (Bugün son gün!)", gida.UrunAdi))
						} else {
							gidaAlerts = append(gidaAlerts, fmt.Sprintf("⏰ <b>%s</b> (%d gün kaldı)", gida.UrunAdi, days))
						}
					}
				}
			}
			if len(gidaAlerts) > 0 {
				totalAlertsCount += len(gidaAlerts)
				alerts = append(alerts, fmt.Sprintf("🥑 <b>Gıda Son Kullanma Uyarıları:</b>\n%s", strings.Join(gidaAlerts, "\n")))
			}
		}

		// 2. FATURALAR KONTROLÜ
		var faturalar []Fatura
		if err := db.Where("durum = 'odenmedi' AND kullanici_id = ?", user.ID).Find(&faturalar).Error; err == nil {
			var faturaAlerts []string
			for _, fatura := range faturalar {
				days, err := getDaysRemaining(fatura.SonOdemeTarihi)
				if err == nil {
					tutar := 0.0
					if fatura.Tutar != nil {
						tutar = *fatura.Tutar
					}
					if days < 0 {
						faturaAlerts = append(faturaAlerts, fmt.Sprintf("⚠️ <b>%s</b> (Son ödeme tarihi %d gün geçti! Tutar: %.2f TL)", fatura.FaturaAdi, -days, tutar))
					} else if days <= fatura.HatirlatmaGunKala {
						if days == 0 {
							faturaAlerts = append(faturaAlerts, fmt.Sprintf("💵 <b>%s</b> (Bugün son ödeme günü! - Tutar: %.2f TL)", fatura.FaturaAdi, tutar))
						} else {
							faturaAlerts = append(faturaAlerts, fmt.Sprintf("💵 <b>%s</b> (%d gün kaldı - Tutar: %.2f TL)", fatura.FaturaAdi, days, tutar))
						}
					}
				}
			}
			if len(faturaAlerts) > 0 {
				totalAlertsCount += len(faturaAlerts)
				alerts = append(alerts, fmt.Sprintf("💸 <b>Fatura Son Ödeme Uyarıları:</b>\n%s", strings.Join(faturaAlerts, "\n")))
			}
		}

		// 3. GARANTİLER KONTROLÜ
		var garantiler []Garanti
		if err := db.Where("kullanici_id = ?", user.ID).Find(&garantiler).Error; err == nil {
			var garantiAlerts []string
			for _, garanti := range garantiler {
				days, err := getDaysRemaining(garanti.GarantiBitis)
				if err == nil {
					if days < 0 {
						garantiAlerts = append(garantiAlerts, fmt.Sprintf("⚠️ <b>%s</b> (%s) - Garanti süresi %d gün önce bitti!", garanti.CihazAdi, garanti.MarkaModel, -days))
					} else if days <= garanti.HatirlatmaGunKala {
						garantiAlerts = append(garantiAlerts, fmt.Sprintf("🔌 <b>%s</b> (%s) - Garanti bitimine %d gün kaldı.", garanti.CihazAdi, garanti.MarkaModel, days))
					}
				}
			}
			if len(garantiAlerts) > 0 {
				totalAlertsCount += len(garantiAlerts)
				alerts = append(alerts, fmt.Sprintf("🛡️ <b>Garanti Süresi Uyarıları:</b>\n%s", strings.Join(garantiAlerts, "\n")))
			}
		}

		// 4. RUTİNLER KONTROLÜ
		var rutinler []RutinWithKlasor
		if err := db.Table("rutinler r").
			Select("r.*, k.klasor_adi").
			Joins("LEFT JOIN rutin_klasorleri k ON r.klasor_id = k.id").
			Where("r.kullanici_id = ?", user.ID).
			Scan(&rutinler).Error; err == nil {
			var rutinAlerts []string
			for _, rutin := range rutinler {
				folderText := ""
				if rutin.KlasorAdi != "" {
					folderText = fmt.Sprintf("[%s] ", rutin.KlasorAdi)
				}

				if rutin.SonYapilmaTarihi != nil && *rutin.SonYapilmaTarihi != "" {
					nextDate, err := getNextRoutineDate(*rutin.SonYapilmaTarihi, rutin.PeriyotAy)
					if err == nil {
						today := getTodayZeroTime()
						diffDays := int(math.Round(nextDate.Sub(today).Hours() / 24.0))
						if diffDays <= rutin.HatirlatmaGunKala {
							if diffDays < 0 {
								rutinAlerts = append(rutinAlerts, fmt.Sprintf("🔁 <b>%s%s</b> (Zamanı %d gün geçti!)", folderText, rutin.GorevAdi, -diffDays))
							} else if diffDays == 0 {
								rutinAlerts = append(rutinAlerts, fmt.Sprintf("🔁 <b>%s%s</b> (Yapılmasına bugün son!)", folderText, rutin.GorevAdi))
							} else {
								rutinAlerts = append(rutinAlerts, fmt.Sprintf("🔁 <b>%s%s</b> (Yapılmasına %d gün kaldı)", folderText, rutin.GorevAdi, diffDays))
							}
						}
					}
				} else {
					rutinAlerts = append(rutinAlerts, fmt.Sprintf("🔁 <b>%s%s</b> (Henüz hiç yapılmadı!)", folderText, rutin.GorevAdi))
				}
			}
			if len(rutinAlerts) > 0 {
				totalAlertsCount += len(rutinAlerts)
				alerts = append(alerts, fmt.Sprintf("📅 <b>Rutin Görev Zamanı Uyarıları:</b>\n%s", strings.Join(rutinAlerts, "\n")))
			}
		}

		// UYARI VARSA GÖNDER
		if len(alerts) > 0 && userChatID != "" {
			header := fmt.Sprintf("🏠 <b>Akıllı Ev ve Yaşam Asistanı Günlük Özeti</b>\n<i>Tarih: %s</i>\n\n", todayStr)
			finalMessage := header + strings.Join(alerts, "\n\n")

			chatIDInt, err := strconv.ParseInt(userChatID, 10, 64)
			if err == nil {
				msg := tgbotapi.NewMessage(chatIDInt, finalMessage)
				msg.ParseMode = "HTML"
				_, err = bot.Send(msg)
				if err == nil {
					totalSent++
				} else {
					fmt.Printf("User %d için Telegram bildirim gönderme hatası: %v\n", user.ID, err)
				}
			}
		}
	}

	fmt.Printf("Bildirim özeti %d kullanıcıya gönderildi (%d toplam uyarı).\n", totalSent, totalAlertsCount)
	return true, totalSent, totalAlertsCount, nil
}
