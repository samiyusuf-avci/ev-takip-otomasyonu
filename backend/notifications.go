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
	today := getTodayZeroTime()
	if t.After(today) {
		return t, nil
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

// sendAdminSummaryReport calculates daily registered users, daily site visitors, and daily complaints, then sends a Telegram report to admin users.
func sendAdminSummaryReport(db *gorm.DB) (bool, error) {
	todayZero := getTodayZeroTime()
	todayStr := time.Now().Format("02.01.2006")

	// 1. Günlük Kayıt Olan İnsan Sayısı
	var dailyUsersCount int64
	db.Model(&Kullanici{}).Where("olusturma_tarihi >= ?", todayZero).Count(&dailyUsersCount)

	// 2. Günlük Şikayet Sayısı
	var dailyComplaintsCount int64
	db.Model(&Sikayet{}).Where("olusturma_tarihi >= ?", todayZero).Count(&dailyComplaintsCount)

	// 3. Günlük Siteyi Ziyaret Eden Sayısı
	var visitSetting Ayarlar
	dailyVisitsCount := int64(0)
	if err := db.Where("anahtar = ?", "daily_visits").First(&visitSetting).Error; err == nil && visitSetting.Deger != "" {
		if val, err := strconv.ParseInt(visitSetting.Deger, 10, 64); err == nil {
			dailyVisitsCount = val
		}
	}

	reportMsg := fmt.Sprintf(
		"📊 <b>Akıllı Ev Asistanı - Günlük Admin Özeti</b>\n"+
			"📅 <i>Tarih: %s</i>\n\n"+
			"👤 <b>Günlük Kayıt Olan Kullanıcı:</b> %d kişi\n"+
			"🌐 <b>Günlük Site Ziyaretçisi:</b> %d kişi\n"+
			"📩 <b>Günlük Gönderilen Şikayet:</b> %d adet\n\n"+
			"⚡ <i>Sistem Durumu: Aktif & Çalışıyor</i>",
		todayStr, dailyUsersCount, dailyVisitsCount, dailyComplaintsCount,
	)

	// Telegram alıcıları: Admin rolüne sahip kullanıcıların chat ID'leri veya genel telegram_chat_id
	var adminUsers []Kullanici
	db.Where("role = ? AND telegram_chat_id != ''", "admin").Find(&adminUsers)

	sentAny := false
	var tokenSetting Ayarlar
	if err := db.Where("anahtar = ?", "telegram_token").First(&tokenSetting).Error; err == nil && tokenSetting.Deger != "" {
		bot, err := tgbotapi.NewBotAPI(tokenSetting.Deger)
		if err == nil {
			// Gönderilecek chat_id listesi
			chatIDMap := make(map[string]bool)

			// 1. Admin kullanıcıların chat_id'leri
			for _, admin := range adminUsers {
				if admin.TelegramChatID != "" {
					chatIDMap[admin.TelegramChatID] = true
				}
			}

			// 2. Genel Ayarlardaki telegram_chat_id
			var defaultChatID Ayarlar
			if err := db.Where("anahtar = ? AND deger != ''", "telegram_chat_id").First(&defaultChatID).Error; err == nil {
				chatIDMap[defaultChatID.Deger] = true
			}

			for chatID := range chatIDMap {
				if chatIDInt, err := strconv.ParseInt(chatID, 10, 64); err == nil {
					msg := tgbotapi.NewMessage(chatIDInt, reportMsg)
					msg.ParseMode = "HTML"
					_, err = bot.Send(msg)
					if err == nil {
						sentAny = true
					}
				}
			}
		}
	}

	if !sentAny {
		// Fallback to sendTelegramMessage
		sentAny, _ = sendTelegramMessage(db, reportMsg)
	}

	return sentAny, nil
}

// checkAndNotifyUsers scans reminders for the given users and sends Telegram notifications if needed
func checkAndNotifyUsers(db *gorm.DB, users []Kullanici) (bool, int, int, error) {
	fmt.Printf("%d kullanıcı için hatırlatıcılar taranıyor...\n", len(users))

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

		if userChatID == "" {
			continue
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
						if days == -1 {
							gidaAlerts = append(gidaAlerts, fmt.Sprintf("⚠️ <b>%s</b> (S.K.T. 1 gün geçti!)", gida.UrunAdi))
						}
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
						if days == -1 {
							faturaAlerts = append(faturaAlerts, fmt.Sprintf("⚠️ <b>%s</b> (Son ödeme tarihi 1 gün geçti! Tutar: %.2f TL)", fatura.FaturaAdi, tutar))
						}
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
						if days == -1 {
							garantiAlerts = append(garantiAlerts, fmt.Sprintf("⚠️ <b>%s</b> (%s) - Garanti süresi 1 gün önce bitti!", garanti.CihazAdi, garanti.MarkaModel))
						}
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
								if diffDays == -1 {
									rutinAlerts = append(rutinAlerts, fmt.Sprintf("🔁 <b>%s%s</b> (Zamanı 1 gün geçti!)", folderText, rutin.GorevAdi))
								}
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

// checkAndNotify scans all reminders for all users
func checkAndNotify(db *gorm.DB) (bool, int, int, error) {
	var users []Kullanici
	if err := db.Find(&users).Error; err != nil {
		return false, 0, 0, err
	}
	return checkAndNotifyUsers(db, users)
}

// checkAndNotifyForTime scans reminders for users whose bildirim_saati matches currentHM
func checkAndNotifyForTime(db *gorm.DB, currentHM string) (bool, int, int, error) {
	var users []Kullanici
	if currentHM == "09:00" {
		if err := db.Where("bildirim_saati = ? OR bildirim_saati IS NULL OR bildirim_saati = ''", currentHM).Find(&users).Error; err != nil {
			return false, 0, 0, err
		}
	} else {
		if err := db.Where("bildirim_saati = ?", currentHM).Find(&users).Error; err != nil {
			return false, 0, 0, err
		}
	}

	if len(users) == 0 {
		return false, 0, 0, nil
	}

	return checkAndNotifyUsers(db, users)
}

// checkAndNotifyForUser scans reminders for a specific user and sends Telegram notification if needed
func checkAndNotifyForUser(db *gorm.DB, userID uint) (bool, bool, int, error) {
	var user Kullanici
	if err := db.First(&user, userID).Error; err != nil {
		return false, false, 0, fmt.Errorf("Kullanıcı bulunamadı: %v", err)
	}

	var chatIDSetting Ayarlar
	defaultChatID := ""
	if err := db.Where("anahtar = ? AND deger != ''", "telegram_chat_id").First(&chatIDSetting).Error; err == nil {
		defaultChatID = chatIDSetting.Deger
	}

	userChatID := user.TelegramChatID
	if userChatID == "" {
		userChatID = defaultChatID
	}

	if userChatID == "" {
		return false, false, 0, fmt.Errorf("Telegram Chat ID tanımlı değil")
	}

	var tokenSetting Ayarlar
	if err := db.Where("anahtar = ?", "telegram_token").First(&tokenSetting).Error; err != nil {
		return false, false, 0, fmt.Errorf("Telegram bot token bulunamadı: %v", err)
	}
	token := tokenSetting.Deger
	if token == "" {
		return false, false, 0, fmt.Errorf("Telegram bot token bulunamadı")
	}

	bot, err := tgbotapi.NewBotAPI(token)
	if err != nil {
		return false, false, 0, fmt.Errorf("Telegram bot başlatılamadı: %v", err)
	}

	todayStr := time.Now().Format("02.01.2006")
	var alerts []string
	alertsCount := 0

	// 1. GIDALAR KONTROLÜ
	var gidalar []Gida
	if err := db.Where("durum = 'bekliyor' AND kullanici_id = ?", user.ID).Find(&gidalar).Error; err == nil {
		var gidaAlerts []string
		for _, gida := range gidalar {
			days, err := getDaysRemaining(gida.SKT)
			if err == nil {
				if days < 0 {
					if days == -1 {
						gidaAlerts = append(gidaAlerts, fmt.Sprintf("⚠️ <b>%s</b> (S.K.T. 1 gün geçti!)", gida.UrunAdi))
					}
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
			alertsCount += len(gidaAlerts)
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
					if days == -1 {
						faturaAlerts = append(faturaAlerts, fmt.Sprintf("⚠️ <b>%s</b> (Son ödeme tarihi 1 gün geçti! Tutar: %.2f TL)", fatura.FaturaAdi, tutar))
					}
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
			alertsCount += len(faturaAlerts)
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
					if days == -1 {
						garantiAlerts = append(garantiAlerts, fmt.Sprintf("⚠️ <b>%s</b> (%s) - Garanti süresi 1 gün önce bitti!", garanti.CihazAdi, garanti.MarkaModel))
					}
				} else if days <= garanti.HatirlatmaGunKala {
					garantiAlerts = append(garantiAlerts, fmt.Sprintf("🔌 <b>%s</b> (%s) - Garanti bitimine %d gün kaldı.", garanti.CihazAdi, garanti.MarkaModel, days))
				}
			}
		}
		if len(garantiAlerts) > 0 {
			alertsCount += len(garantiAlerts)
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
							if diffDays == -1 {
								rutinAlerts = append(rutinAlerts, fmt.Sprintf("🔁 <b>%s%s</b> (Zamanı 1 gün geçti!)", folderText, rutin.GorevAdi))
							}
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
			alertsCount += len(rutinAlerts)
			alerts = append(alerts, fmt.Sprintf("📅 <b>Rutin Görev Zamanı Uyarıları:</b>\n%s", strings.Join(rutinAlerts, "\n")))
		}
	}

	if len(alerts) > 0 {
		header := fmt.Sprintf("🏠 <b>Akıllı Ev ve Yaşam Asistanı Günlük Özeti</b>\n<i>Kullanıcı: %s</i>\n<i>Tarih: %s</i>\n\n", user.Isim, todayStr)
		finalMessage := header + strings.Join(alerts, "\n\n")

		chatIDInt, err := strconv.ParseInt(userChatID, 10, 64)
		if err != nil {
			return true, false, alertsCount, fmt.Errorf("Geçersiz Telegram Chat ID: %v", err)
		}

		msg := tgbotapi.NewMessage(chatIDInt, finalMessage)
		msg.ParseMode = "HTML"
		_, err = bot.Send(msg)
		if err != nil {
			return true, false, alertsCount, fmt.Errorf("Telegram bildirim hatası: %v", err)
		}

		return true, true, alertsCount, nil
	}

	return true, false, 0, nil
}

