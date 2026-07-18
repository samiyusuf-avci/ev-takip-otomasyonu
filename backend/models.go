package main

import (
	"time"
)

type Kullanici struct {
	ID              uint      `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	Isim            string    `json:"isim" gorm:"not null;column:isim"`
	Eposta          string    `json:"eposta" gorm:"unique;not null;column:eposta"`
	Sifre           string    `json:"-" gorm:"not null;column:sifre"`
	TelegramChatID  string    `json:"telegram_chat_id" gorm:"column:telegram_chat_id"`
	OlusturmaTarihi time.Time `json:"olusturma_tarihi" gorm:"default:CURRENT_TIMESTAMP;column:olusturma_tarihi"`
}

func (Kullanici) TableName() string {
	return "kullanicilar"
}

type Gida struct {
	ID                uint   `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	KullaniciID       uint   `json:"kullanici_id" gorm:"column:kullanici_id"`
	UrunAdi           string `json:"urun_adi" gorm:"not null;column:urun_adi"`
	Kategori          string `json:"kategori" gorm:"column:kategori"`
	SKT               string `json:"skt" gorm:"not null;column:skt"` // YYYY-MM-DD
	HatirlatmaGunKala int    `json:"hatirlatma_gun_kala" gorm:"default:3;column:hatirlatma_gun_kala"`
	Durum             string `json:"durum" gorm:"default:bekliyor;column:durum"` // 'tuketildi', 'atildi', 'bekliyor'
}

func (Gida) TableName() string {
	return "gidalar"
}

type Fatura struct {
	ID                uint     `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	KullaniciID       uint     `json:"kullanici_id" gorm:"column:kullanici_id"`
	FaturaAdi         string   `json:"fatura_adi" gorm:"not null;column:fatura_adi"`
	Tutar             *float64 `json:"tutar" gorm:"column:tutar"`
	SonOdemeTarihi    string   `json:"son_odeme_tarihi" gorm:"not null;column:son_odeme_tarihi"` // YYYY-MM-DD
	HatirlatmaGunKala int      `json:"hatirlatma_gun_kala" gorm:"default:5;column:hatirlatma_gun_kala"`
	Durum             string   `json:"durum" gorm:"default:odenmedi;column:durum"` // 'odendi', 'odenmedi'
}

func (Fatura) TableName() string {
	return "faturalar"
}

type Garanti struct {
	ID                uint   `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	KullaniciID       uint   `json:"kullanici_id" gorm:"column:kullanici_id"`
	CihazAdi          string `json:"cihaz_adi" gorm:"not null;column:cihaz_adi"`
	MarkaModel        string `json:"marka_model" gorm:"column:marka_model"`
	GarantiBitis      string `json:"garanti_bitis" gorm:"not null;column:garanti_bitis"` // YYYY-MM-DD
	HatirlatmaGunKala int    `json:"hatirlatma_gun_kala" gorm:"default:30;column:hatirlatma_gun_kala"`
	Notlar            string `json:"notlar" gorm:"column:notlar"`
}

func (Garanti) TableName() string {
	return "garantiler"
}

type RutinKlasor struct {
	ID          uint   `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	KullaniciID uint   `json:"kullanici_id" gorm:"column:kullanici_id"`
	KlasorAdi   string `json:"klasor_adi" gorm:"not null;column:klasor_adi"`
}

func (RutinKlasor) TableName() string {
	return "rutin_klasorleri"
}

type Rutin struct {
	ID                uint    `json:"id" gorm:"primaryKey;autoIncrement;column:id"`
	KlasorID          *uint   `json:"klasor_id" gorm:"column:klasor_id"`
	KullaniciID       uint    `json:"kullanici_id" gorm:"column:kullanici_id"`
	GorevAdi          string  `json:"gorev_adi" gorm:"not null;column:gorev_adi"`
	PeriyotAy         int     `json:"periyot_ay" gorm:"not null;column:periyot_ay"`
	HatirlatmaGunKala int     `json:"hatirlatma_gun_kala" gorm:"default:15;column:hatirlatma_gun_kala"`
	HedefKM           *int    `json:"hedef_km" gorm:"column:hedef_km"`
	MevcutKM          *int    `json:"mevcut_km" gorm:"column:mevcut_km"`
	SonYapilmaTarihi  *string `json:"son_yapilma_tarihi" gorm:"column:son_yapilma_tarihi"` // YYYY-MM-DD
}

func (Rutin) TableName() string {
	return "rutinler"
}

type RutinWithKlasor struct {
	Rutin
	KlasorAdi string `json:"klasor_adi" gorm:"column:klasor_adi"`
}

type Ayarlar struct {
	Anahtar string `json:"anahtar" gorm:"primaryKey;column:anahtar"`
	Deger   string `json:"deger" gorm:"column:deger"`
}

func (Ayarlar) TableName() string {
	return "ayarlar"
}
