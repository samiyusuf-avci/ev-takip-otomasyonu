import React from 'react';
import logoImg from '../assets/logo.png';
import {
  Apple,
  Receipt,
  ShieldCheck,
  RefreshCw,
  Bell,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Zap,
  Shield,
  Clock,
  ChevronRight,
  FolderCog,
  UserPlus,
  LogIn,
  Heart,
  LayoutDashboard,
  PlusCircle
} from 'lucide-react';

export default function LandingPage({ onLogin, onRegister }) {
  const scrollToSection = (e, id) => {
    e.preventDefault();
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 90;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const features = [
    {
      icon: Apple,
      title: 'Gıda & SKT Takibi',
      desc: 'Buzdolabı ve kilerinizdeki gıdaların son kullanma tarihlerini takip edin, bayatlamadan tüketin ve gıda israfını önleyin.',
      tag: 'Mutfak & Kiler',
      badge: 'İsraf Önleme 🥦',
      color: 'from-emerald-400 via-teal-500 to-green-600',
      badgeStyle: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
      shadow: 'shadow-[0_10px_30px_rgba(16,185,129,0.2)]',
      hoverBorder: 'hover:border-emerald-500/50'
    },
    {
      icon: Receipt,
      title: 'Fatura & Ödeme Takibi',
      desc: 'Elektrik, su, doğalgaz ve dijital abonelik faturalarınızın son ödeme tarihlerini izleyin, gecikme cezalarından korunun.',
      tag: 'Bütçe & Ödeme',
      badge: 'Zamanında Ödeme 💡',
      color: 'from-amber-400 via-orange-500 to-yellow-600',
      badgeStyle: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      shadow: 'shadow-[0_10px_30px_rgba(245,158,11,0.2)]',
      hoverBorder: 'hover:border-amber-500/50'
    },
    {
      icon: ShieldCheck,
      title: 'Elektronik Garanti Takibi',
      desc: 'Evdeki tüm beyaz eşya ve cihazların garanti bitiş sürelerini, fatura görselleri ile dijital arşivde saklayın.',
      tag: 'Cihaz & Garanti',
      badge: 'Dijital Arşiv 🛡️',
      color: 'from-sky-400 via-blue-500 to-indigo-600',
      badgeStyle: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
      shadow: 'shadow-[0_10px_30px_rgba(56,189,248,0.2)]',
      hoverBorder: 'hover:border-sky-500/50'
    },
    {
      icon: RefreshCw,
      title: 'Rutin Ev Görevleri',
      desc: 'Kombi bakımı, klima temizliği, filtre değişimi gibi periyodik ev işlerini takvime bağlayıp düzenli sürdürün.',
      tag: 'Ev Bakım & Temizlik',
      badge: 'Periyodik Takip 🔄',
      color: 'from-purple-400 via-indigo-500 to-violet-600',
      badgeStyle: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
      shadow: 'shadow-[0_10px_30px_rgba(168,85,247,0.2)]',
      hoverBorder: 'hover:border-purple-500/50'
    },
    {
      icon: Bell,
      title: 'Telegram Rapor Entegrasyonu',
      desc: 'Yaklaşan son ödeme tarihleri ve kritik SKT uyarıları belirlediğiniz saatte anlık olarak Telegram cebinize ulaşsın.',
      tag: 'Anlık Bildirim',
      badge: 'Otomatik Bot 🔔',
      color: 'from-rose-400 via-pink-500 to-red-600',
      badgeStyle: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
      shadow: 'shadow-[0_10px_30px_rgba(244,63,94,0.2)]',
      hoverBorder: 'hover:border-rose-500/50'
    },
    {
      icon: FolderCog,
      title: 'Özel Klasörleme & Düzen',
      desc: 'Tüm rutin ve ev işlerini özel kategoriler ve klasörler altında organize ederek evinizin düzenini kolaylaştırın.',
      tag: 'Kategori Yönetimi',
      badge: 'Kolay Organizasyon 📁',
      color: 'from-cyan-400 via-teal-500 to-emerald-600',
      badgeStyle: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
      shadow: 'shadow-[0_10px_30px_rgba(6,182,212,0.2)]',
      hoverBorder: 'hover:border-cyan-500/50'
    }
  ];

  const steps = [
    {
      num: '01',
      stepBadge: 'Adım 1',
      tag: 'Ücretsiz & 30 Saniye',
      icon: UserPlus,
      gradient: 'from-purple-500 via-indigo-500 to-pink-500',
      badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
      glow: 'shadow-[0_10px_30px_rgba(168,85,247,0.2)]',
      hoverBorder: 'hover:border-purple-500/60',
      title: 'Hızlıca Kayıt Olun',
      desc: 'Saniyeler içinde ücretsiz hesabınızı oluşturun ve kişisel ev asistanınıza anında erişin.'
    },
    {
      num: '02',
      stepBadge: 'Adım 2',
      tag: 'Gıda, Fatura & Garanti',
      icon: PlusCircle,
      gradient: 'from-cyan-500 via-blue-500 to-teal-500',
      badgeBg: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
      glow: 'shadow-[0_10px_30px_rgba(6,182,212,0.2)]',
      hoverBorder: 'hover:border-cyan-500/60',
      title: 'Verilerinizi Ekleyin',
      desc: 'Gıdalarınızı, faturalarınızı, garantili eşyalarınızı ve rutin ev işlerinizi sisteminize kaydedin.'
    },
    {
      num: '03',
      stepBadge: 'Adım 3',
      tag: 'Telegram & Otomatik Rapor',
      icon: Sparkles,
      gradient: 'from-emerald-500 via-teal-500 to-green-500',
      badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      glow: 'shadow-[0_10px_30px_rgba(16,185,129,0.2)]',
      hoverBorder: 'hover:border-emerald-500/60',
      title: 'Arkanıza Yaslanın',
      desc: 'Akıllı Asistan ve Telegram entegrasyonu zamanı gelen her şeyi size zamanında ve otomatik hatırlatsın.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0d0e15] text-white selection:bg-purple-500/30 selection:text-purple-300 relative overflow-hidden font-sans">
      {/* Background Glow Orbs */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-purple-600/15 via-indigo-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[600px] left-[-200px] w-[600px] h-[600px] bg-rose-600/10 blur-3xl rounded-full pointer-events-none -z-10" />
      <div className="absolute top-[1200px] right-[-200px] w-[600px] h-[600px] bg-blue-600/10 blur-3xl rounded-full pointer-events-none -z-10" />

      {/* HEADER / NAVIGATION */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0d0e15]/80 border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-70 group-hover:opacity-100 transition duration-300"></div>
              <img
                src={logoImg}
                alt="Akıllı Yaşam Logo"
                className="relative w-11 h-11 rounded-xl object-cover border border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
              />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight flex items-center gap-1.5">
                Akıllı Yaşam <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">Pro</span>
              </span>
              <p className="text-[11px] text-gray-400 font-medium hidden sm:block">Ev Takip & Otomasyon Sistemi</p>
            </div>
          </div>

          {/* Quick Nav Links (Desktop Glass Pill Capsule) */}
          <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/5 border border-white/10 backdrop-blur-md shadow-lg">
            <a
              href="#ozellikler"
              onClick={(e) => scrollToSection(e, 'ozellikler')}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white hover:bg-purple-500/20 hover:border-purple-500/30 border border-transparent transition-all duration-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              Özellikler
            </a>
            <a
              href="#nasil-calisir"
              onClick={(e) => scrollToSection(e, 'nasil-calisir')}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white hover:bg-indigo-500/20 hover:border-indigo-500/30 border border-transparent transition-all duration-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              Nasıl Çalışır?
            </a>
            <a
              href="#avantajlar"
              onClick={(e) => scrollToSection(e, 'avantajlar')}
              className="px-4 py-1.5 rounded-full text-xs font-semibold text-gray-300 hover:text-white hover:bg-emerald-500/20 hover:border-emerald-500/30 border border-transparent transition-all duration-300 flex items-center gap-1.5 cursor-pointer"
            >
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              Avantajlar
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={onLogin}
              className="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer flex items-center gap-2"
            >
              <LogIn className="w-4 h-4 text-purple-400" />
              Giriş Yap
            </button>
            <button
              onClick={onRegister}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-[0_4px_20px_rgba(168,85,247,0.35)] hover:shadow-[0_6px_25px_rgba(168,85,247,0.5)] cursor-pointer flex items-center gap-2 glow-btn"
            >
              <UserPlus className="w-4 h-4" />
              Kayıt Ol
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Top Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs sm:text-sm font-medium mb-8 backdrop-blur-md animate-pulse">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Evinizin Akıllı Dijital Asistanı</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-[1.15]">
          Evinizin Tüm Düzeni, <br className="hidden sm:block" />
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
            Tek Bir Akıllı Panelde.
          </span>
        </h1>

        {/* Hero Description */}
        <p className="mt-5 text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
          Gıdalar, faturalar, garantiler ve rutin ev işleri... Tüm son tarihlerinizi otomatik takip edin, sürprizlerle karşılaşmayın.
        </p>

        {/* Hero CTAs */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-lg mx-auto">
          <button
            onClick={onRegister}
            className="w-full sm:w-auto px-8 py-3.5 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base tracking-wide shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_40px_rgba(168,85,247,0.6)] transition-all duration-300 hover:scale-[1.03] cursor-pointer flex items-center justify-center gap-2.5 group whitespace-nowrap glow-btn"
          >
            <span>Hemen Ücretsiz Başla</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={onLogin}
            className="w-full sm:w-auto px-7 py-3.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 hover:border-purple-500/40 text-gray-200 hover:text-white font-semibold text-sm sm:text-base transition-all duration-300 hover:scale-[1.03] cursor-pointer flex items-center justify-center gap-2 group backdrop-blur-md whitespace-nowrap shadow-lg"
          >
            <LogIn className="w-4 h-4 text-purple-400 group-hover:text-purple-300 transition-colors" />
            <span>Giriş Yap</span>
          </button>
        </div>

        {/* Feature Badges under Hero */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs sm:text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Kredi Kartı Gerekmez</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-purple-400" />
            <span>Telegram Bildirim Desteği</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-sky-400" />
            <span>Hızlı & Kolay Kullanım</span>
          </div>
        </div>

        {/* Dashboard Preview Mockup Card */}
        <div className="mt-16 relative max-w-5xl mx-auto">
          <div className="absolute -inset-1.5 bg-gradient-to-r from-purple-600/30 via-indigo-600/30 to-pink-600/30 rounded-3xl blur-2xl opacity-70"></div>
          <div className="glass-panel relative rounded-3xl border border-white/15 p-6 md:p-8 bg-[#13141f]/90 shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            {/* Mock Header */}
            <div className="flex items-center justify-between pb-6 border-b border-white/10">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                <span className="text-xs text-gray-400 ml-2 font-mono hidden sm:inline">akilli-yasam-asistani.app/dashboard</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-purple-300 bg-purple-500/10 px-3 py-1 rounded-lg border border-purple-500/20">
                <LayoutDashboard className="w-3.5 h-3.5" />
                <span>Canlı Panel Özeti</span>
              </div>
            </div>

            {/* Mock Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6 text-left">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400">
                    <Apple className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300">3 Gün Kaldı</span>
                </div>
                <h4 className="text-sm font-bold text-white">Süt & Yoğurt</h4>
                <p className="text-xs text-gray-400 mt-1">Buzdolabı - SKT: 28 Temmuz</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-amber-500/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl bg-amber-500/15 text-amber-400">
                    <Receipt className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300">Yaklaşıyor</span>
                </div>
                <h4 className="text-sm font-bold text-white">Elektrik Faturası</h4>
                <p className="text-xs text-gray-400 mt-1">Son Ödeme: ₺450,00</p>
              </div>

              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2 rounded-xl bg-purple-500/15 text-purple-400">
                    <Bell className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300">Otomatik</span>
                </div>
                <h4 className="text-sm font-bold text-white">Telegram Hatırlatma</h4>
                <p className="text-xs text-gray-400 mt-1">Her gün 09:00'da bildirim</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES SECTION */}
      <section id="ozellikler" className="min-h-[calc(100vh-80px)] scroll-mt-24 pt-8 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
        {/* Ultra-Shortened Header */}
        <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-2.5 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            <span>Öne Çıkan Modüller</span>
          </div>

          <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
            Tüm Takip Sistemleri{' '}
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
              Tek Bir Yerde.
            </span>
          </h3>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div
                key={idx}
                className={`glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 ${item.hoverBorder} bg-gradient-to-b from-[#161726]/95 via-[#121320]/90 to-[#0e0f19]/95 transition-all duration-300 group hover:-translate-y-1 ${item.shadow} relative overflow-hidden flex flex-col justify-between`}
              >
                {/* Background ambient glow effect */}
                <div className={`absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br ${item.color} opacity-10 blur-xl rounded-full group-hover:opacity-25 transition-opacity pointer-events-none`} />

                <div>
                  {/* Card Header: Icon Container + Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} p-0.5 shadow-md group-hover:scale-105 transition-transform duration-300`}>
                      <div className="w-full h-full bg-[#0d0e15] rounded-[9px] flex items-center justify-center">
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                    </div>

                    <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${item.badgeStyle}`}>
                      {item.badge}
                    </span>
                  </div>

                  {/* Sub-tag */}
                  <div className="text-[10px] font-semibold text-purple-300/90 mb-1 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                    {item.tag}
                  </div>

                  {/* Title */}
                  <h4 className="text-base font-bold text-white mb-1.5 group-hover:text-purple-300 transition-colors tracking-tight">
                    {item.title}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-gray-300 leading-relaxed font-normal">
                    {item.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="nasil-calisir" className="min-h-[calc(100vh-80px)] scroll-mt-24 pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-3">
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
            <span>Kolay Başlangıç Rehberi</span>
          </div>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            3 Basit Adımda Evinizi Otomatize Edin
          </h3>
          <p className="mt-3 text-gray-400 text-sm sm:text-base">
            Karmaşık kurulumlar yok. Birkaç dakika içinde evinizin tüm takibini başlatın.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connecting line for desktop */}
          <div className="hidden md:block absolute top-[88px] left-[15%] right-[15%] h-1 bg-gradient-to-r from-purple-500/40 via-cyan-500/40 to-emerald-500/40 rounded-full z-0 pointer-events-none" />

          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div
                key={idx}
                className={`glass-panel p-8 rounded-3xl border border-white/10 ${step.hoverBorder} bg-[#13141f]/80 relative z-10 flex flex-col items-start transition-all duration-300 hover:-translate-y-2 ${step.glow} group`}
              >
                {/* Header Row: Icon + Number Badge */}
                <div className="w-full flex items-center justify-between mb-6">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${step.gradient} p-0.5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <div className="w-full h-full bg-[#0d0e15] rounded-[14px] flex items-center justify-center">
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className={`text-xs font-bold px-3 py-1 rounded-full border ${step.badgeBg}`}>
                      {step.stepBadge}
                    </span>
                  </div>
                </div>

                <div className="inline-block px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-medium text-gray-300 mb-3">
                  ⚡ {step.tag}
                </div>

                <h4 className="text-xl font-bold text-white mb-2 group-hover:text-purple-300 transition-colors">
                  {step.title}
                </h4>

                <p className="text-sm text-gray-400 leading-relaxed">
                  {step.desc}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ADVANTAGES & TELEGRAM PROMO */}
      <section id="avantajlar" className="min-h-[calc(100vh-80px)] scroll-mt-24 pt-12 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="glass-panel rounded-3xl border border-purple-500/30 p-8 sm:p-12 bg-gradient-to-br from-[#161426] via-[#111322] to-[#0f0e1a] relative overflow-hidden shadow-[0_0_50px_rgba(168,85,247,0.15)]">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center relative z-10">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-4">
                <Bell className="w-4 h-4 text-purple-400" />
                Telegram Bot Bildirimleri
              </div>

              <h3 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Son Tarihleri Asla Kaçırmayın, Raporlar Doğrudan Cebinizde!
              </h3>

              <p className="mt-4 text-gray-300 text-sm sm:text-base leading-relaxed">
                Telegram Bot entegrasyonu sayesinde SKT'si yaklaşan gıdalar, ödeme vakti gelen faturalar ve garanti süreleri belirlediğiniz saatte otomatik olarak cebinize mesaj olarak ulaşır.
              </p>

              <div className="mt-6 space-y-3">
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  <span>Günlük veya anlık durum raporu gönderme</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0" />
                  <span>Kolay kurulum (Bot Token & Chat ID ile 1 dakikada aktifleştirme)</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-300">
                  <CheckCircle2 className="w-5 h-5 text-sky-400 flex-shrink-0" />
                  <span>Tek tıkla bildirim testi ve anında rapor alma</span>
                </div>
              </div>
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-[#0b0c13]/90 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2 text-xs text-purple-300 font-semibold">
                  <Bell className="w-4 h-4 text-purple-400" />
                  <span>Telegram Bildirim Mesajı (Örnek)</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">Bugün 09:00</span>
              </div>
              <div className="text-xs sm:text-sm text-gray-300 space-y-2 font-sans leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                <p className="font-bold text-purple-300">🔔 AKILLI YAŞAM GÜNLÜK RAPORU</p>
                <p>⚠️ <b>Süt & Yoğurt</b> SKT bitimine 2 gün kaldı!</p>
                <p>💡 <b>Elektrik Faturası</b> son ödeme tarihine 3 gün kaldı (₺450,00)</p>
                <p>🛡️ <b>Kombi Garantisi</b> bütünüyle kontrol edildi.</p>
                <p className="text-gray-400 text-[11px] pt-1 border-t border-white/5">Güne huzurla devam edin! 🚀</p>
              </div>
            </div>
          </div>
        </div>
      </section>



      {/* FOOTER */}
      <footer className="py-10 px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Akıllı Yaşam Logo" className="w-6 h-6 rounded-lg object-cover" />
            <span className="font-semibold text-gray-300 text-sm">Akıllı Yaşam Asistanı</span>
          </div>
          <p>© {new Date().getFullYear()} Akıllı Yaşam Ev Takip Otomasyonu. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
