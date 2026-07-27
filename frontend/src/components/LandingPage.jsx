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
      tag: 'Anlık Telegram Raporu',
      icon: Bell,
      gradient: 'from-emerald-500 via-teal-500 to-green-500',
      badgeBg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
      glow: 'shadow-[0_10px_30px_rgba(16,185,129,0.2)]',
      hoverBorder: 'hover:border-emerald-500/60',
      title: 'Arkanıza Yaslanın',
      desc: 'Akıllı Asistan ve Telegram entegrasyonu zamanı gelen her şeyi size zamanında ve otomatik hatırlatsın.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0d0e15] text-white selection:bg-purple-500 selection:text-white font-sans relative overflow-x-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[500px] bg-gradient-to-b from-purple-600/15 via-indigo-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="absolute top-[600px] left-[-200px] w-[600px] h-[600px] bg-rose-600/10 blur-3xl rounded-full pointer-events-none -z-10" />
      <div className="absolute top-[1200px] right-[-200px] w-[600px] h-[600px] bg-blue-600/10 blur-3xl rounded-full pointer-events-none -z-10" />

      <header className="sticky top-0 z-50 backdrop-blur-xl bg-[#0d0e15]/85 border-b border-white/10 transition-all">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 sm:h-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink-0">
            <div className="relative group flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl sm:rounded-2xl blur opacity-70 group-hover:opacity-100 transition duration-300"></div>
              <img
                src={logoImg}
                alt="Akıllı Yaşam Logo"
                fetchpriority="high"
                loading="eager"
                width="44"
                height="44"
                className="relative w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl object-cover border border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.4)]"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs xs:text-sm sm:text-lg font-bold text-white tracking-tight flex items-center gap-1 sm:gap-1.5 whitespace-nowrap">
                Akıllı Yaşam <span className="text-xs px-1.5 py-0.5 sm:px-2 rounded-full bg-purple-500/20 text-purple-200 border border-purple-500/30 font-semibold flex-shrink-0">Pro</span>
              </span>
              <p className="text-xs text-gray-300 font-medium hidden sm:block">Ev Takip & Otomasyon Sistemi</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-3 flex-shrink-0">
            <button
              onClick={onLogin}
              className="px-2.5 py-1.5 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold text-gray-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer flex items-center gap-1 sm:gap-2 whitespace-nowrap"
            >
              <span>Giriş Yap</span>
            </button>
            <button
              onClick={onRegister}
              className="px-3 py-1.5 sm:px-5 sm:py-2.5 rounded-lg sm:rounded-xl text-xs sm:text-sm font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-[0_4px_20px_rgba(168,85,247,0.35)] cursor-pointer flex items-center gap-1 sm:gap-2 whitespace-nowrap"
            >
              <span>Kayıt Ol</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        <section className="relative pt-12 pb-20 md:pt-20 md:pb-32 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs sm:text-sm font-medium mb-8 backdrop-blur-md animate-pulse">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Evinizin Akıllı Dijital Asistanı</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight max-w-4xl mx-auto leading-[1.15]">
            Evinizin Tüm Düzeni, <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-indigo-400 bg-clip-text text-transparent">
              Tek Bir Akıllı Panelde.
            </span>
          </h1>

          <p className="mt-5 text-base sm:text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Gıdalar, faturalar, garantiler ve rutin ev işleri... Tüm son tarihlerinizi otomatik takip edin, sürprizlerle karşılaşmayın.
          </p>

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={onRegister}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-bold text-white bg-purple-600 hover:bg-purple-500 transition-all shadow-[0_10px_35px_rgba(168,85,247,0.4)] cursor-pointer flex items-center justify-center gap-3 glow-btn group"
            >
              <span>Hemen Ücretsiz Başla</span>
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={onLogin}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl text-base font-semibold text-gray-200 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Mevcut Hesaba Giriş Yap</span>
            </button>
          </div>

          <div className="mt-12 pt-8 border-t border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                <Apple className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white">Gıda SKT Takibi</h2>
                <p className="text-xs text-gray-300">İsrafı %40 Azaltın</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Receipt className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white">Fatura Uyarıları</h2>
                <p className="text-xs text-gray-300">Sıfır Gecikme Faizi</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white">Garanti Arşivi</h2>
                <p className="text-xs text-gray-300">Fatura Görselleri</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs font-bold text-white">Telegram Botu</h2>
                <p className="text-xs text-gray-300">Anlık Özet Rapor</p>
              </div>
            </div>
          </div>
        </section>

        <section id="ozellikler" className="min-h-0 md:min-h-[calc(100vh-80px)] scroll-mt-20 pt-6 pb-12 sm:pt-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold mb-2 sm:mb-3">
              <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              <span>Modüler Akıllı Özellikler</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Tüm Ev İhtiyaçlarınız İçin Özel Modüller
            </h2>
            <p className="mt-2 sm:mt-3 text-gray-300 text-xs sm:text-base">
              Her biri kendi alanında uzmanlaşmış 4 ana takip modülü ile evinizi sorunsuz yönetin.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-6">
            {features.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div key={idx} className={`glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 ${item.hoverBorder} bg-gradient-to-b from-[#161726]/95 via-[#121320]/90 to-[#0e0f19]/95 transition-all duration-300 group hover:-translate-y-1 ${item.shadow} relative overflow-hidden flex flex-col justify-between`}>
                  <div className={`absolute -top-10 -right-10 w-24 h-24 bg-gradient-to-br ${item.color} opacity-10 blur-xl rounded-full group-hover:opacity-25 transition-opacity pointer-events-none`} />
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${item.color} p-0.5 shadow-md group-hover:scale-105 transition-transform duration-300`}>
                        <div className="w-full h-full bg-[#0d0e15] rounded-[9px] flex items-center justify-center">
                          <Icon className="w-5 h-5 text-white" />
                        </div>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-0.5 rounded-full border ${item.badgeStyle}`}>
                        {item.badge}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-purple-200 mb-1 flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-purple-400"></span>
                      {item.tag}
                    </div>
                    <h3 className="text-base font-bold text-white mb-1.5 group-hover:text-purple-300 transition-colors tracking-tight">
                      {item.title}
                    </h3>
                    <p className="text-xs text-gray-300 leading-relaxed font-normal">
                      {item.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section id="nasil-calisir" className="min-h-0 md:min-h-[calc(100vh-80px)] scroll-mt-20 pt-6 pb-12 sm:pt-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
          <div className="text-center max-w-3xl mx-auto mb-6 sm:mb-14">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-semibold mb-2 sm:mb-3">
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Kolay Başlangıç Rehberi</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              3 Basit Adımda Evinizi Otomatize Edin
            </h2>
            <p className="mt-2 sm:mt-3 text-gray-300 text-xs sm:text-base">
              Karmaşık kurulumlar yok. Birkaç dakika içinde evinizin tüm takibini başlatın.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-8 relative">
            <div className="hidden md:block absolute top-[88px] left-[15%] right-[15%] h-1 bg-gradient-to-r from-purple-500/40 via-cyan-500/40 to-emerald-500/40 rounded-full z-0 pointer-events-none" />
            {steps.map((step, idx) => {
              const Icon = step.icon;
              return (
                <div key={idx} className={`glass-panel p-4 sm:p-8 rounded-2xl sm:rounded-3xl border border-white/10 ${step.hoverBorder} bg-[#13141f]/80 relative z-10 flex flex-col items-start transition-all duration-300 hover:-translate-y-1 sm:hover:-translate-y-2 ${step.glow} group`}>
                  <div className="w-full flex items-center justify-between mb-3 sm:mb-6">
                    <div className={`w-10 h-10 sm:w-14 sm:h-14 rounded-xl sm:rounded-2xl bg-gradient-to-br ${step.gradient} p-0.5 shadow-lg group-hover:scale-105 sm:group-hover:scale-110 transition-transform duration-300`}>
                      <div className="w-full h-full bg-[#0d0e15] rounded-[10px] sm:rounded-[14px] flex items-center justify-center">
                        <Icon className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className={`text-xs font-bold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full border ${step.badgeBg}`}>
                        {step.stepBadge}
                      </span>
                    </div>
                  </div>
                  <div className="inline-block px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-md bg-white/5 border border-white/10 text-xs font-medium text-gray-300 mb-1.5 sm:mb-3">
                    ⚡ {step.tag}
                  </div>
                  <h3 className="text-base sm:text-xl font-bold text-white mb-1 sm:mb-2 group-hover:text-purple-300 transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-normal">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section id="avantajlar" className="min-h-0 md:min-h-[calc(100vh-80px)] scroll-mt-20 pt-6 pb-12 sm:pt-12 sm:pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative">
          <div className="glass-panel p-6 sm:p-12 rounded-3xl border border-purple-500/20 bg-gradient-to-br from-[#151625] via-[#10111d] to-[#0c0d17] relative overflow-hidden">
            <div className="absolute top-0 right-0 w-96 h-96 bg-purple-600/10 blur-3xl rounded-full pointer-events-none" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center relative z-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <Shield className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Akıllı Bildirim Mimarisi</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                  Tüm Bildirimler Doğrudan Cebinizde! 📱
                </h2>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed">
                  Akıllı Yaşam Asistanı, Telegram Bot entegrasyonu sayesinde yaklaşan son tarihlerinizi, SKT’si dolan gıdalarınızı ve faturalarınızı her gün belirlediğiniz saatte tek bir şık özet mesajı olarak telefonunuza gönderir.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span>Her sabah saat 09:00 ve akşam 20:00'de otomatik özet rapor</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span>Kritik gıdalar ve gecikmiş ödemeler için anında kırmızı uyarılar</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs sm:text-sm text-gray-200">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span>Uygulamayı açmadan tüm günlük ev ajandanızı görün</span>
                  </div>
                </div>
              </div>
              <div className="glass-panel p-6 rounded-2xl border border-white/10 bg-[#0b0c13]/90 shadow-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2 text-xs text-purple-300 font-semibold">
                    <Bell className="w-4 h-4 text-purple-400" />
                    <span>Telegram Bildirim Mesajı (Örnek)</span>
                  </div>
                  <span className="text-xs text-gray-300 font-mono">Bugün 09:00</span>
                </div>
                <div className="text-xs sm:text-sm text-gray-300 space-y-2 font-sans leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                  <p className="font-bold text-purple-300">🔔 AKILLI YAŞAM GÜNLÜK RAPORU</p>
                  <p>⚠️ <b>Süt & Yoğurt</b> SKT bitimine 2 gün kaldı!</p>
                  <p>💡 <b>Elektrik Faturası</b> son ödeme tarihine 3 gün kaldı (₺450,00)</p>
                  <p>🛡️ <b>Kombi Garantisi</b> bütünüyle kontrol edildi.</p>
                  <p className="text-gray-300 text-xs pt-1 border-t border-white/5">Güne huzurla devam edin! 🚀</p>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-10 px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-300">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="Akıllı Yaşam Logo" loading="lazy" width="24" height="24" className="w-6 h-6 rounded-lg object-cover" />
            <span className="font-semibold text-gray-200 text-sm">Akıllı Yaşam Asistanı</span>
          </div>
          <p>© {new Date().getFullYear()} Akıllı Yaşam Ev Takip Otomasyonu. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}
