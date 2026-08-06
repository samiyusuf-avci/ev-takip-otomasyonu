import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import API from './api';
import DatePicker from './components/DatePicker';
import TimePicker from './components/TimePicker';
import CustomSelect from './components/CustomSelect';
import LandingPage from './components/LandingPage';
import logoImg from './assets/logo.webp';
import {
  LayoutDashboard,
  BarChart2,
  Database,
  Apple,
  Receipt,
  ShieldCheck,
  RefreshCw,
  Settings,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
  X,
  AlertTriangle,
  Gauge,
  Bell,
  Calendar,
  FolderPlus,
  FolderCog,
  Info,
  DollarSign,
  User,
  Users,
  UserCheck,
  Eye,
  TrendingUp,
  PieChart,
  Activity,
  Mail,
  Lock,
  LogOut,
  Send,
  Clock,
  ChevronDown,
  MoreVertical,
  ArrowLeft,
  MessageSquare,
  Inbox,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowUpDown
} from 'lucide-react';

// -------------------------------------------------------------
// YARDIMCI GÖRSEL METOTLAR (Global scope'ta tanımlanarak yeniden oluşturulması engellendi)
// -------------------------------------------------------------
const formatInputDate = (dateStr) => {
  if (!dateStr) return '';
  if (typeof dateStr === 'string') {
    const cleaned = dateStr.trim();
    const match = cleaned.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const getDaysDiff = (dateStr) => {
  if (!dateStr) return null;
  const safeStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
  const target = new Date(safeStr);
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = target - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const safeStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
  const date = new Date(safeStr);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });
};

const isTodayOrYesterday = (dateStr) => {
  if (!dateStr) return false;
  const safeStr = typeof dateStr === 'string' ? dateStr.replace(' ', 'T') : dateStr;
  const date = new Date(safeStr);
  if (isNaN(date.getTime())) return false;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  return targetDate.getTime() === today.getTime() || targetDate.getTime() === yesterday.getTime();
};

const dayNameToIndex = {
  'Pazartesi': 1,
  'Salı': 2,
  'Çarşamba': 3,
  'Perşembe': 4,
  'Cuma': 5,
  'Cumartesi': 6,
  'Pazar': 0
};

const calcNextRoutineDate = (lastDoneDate, period = 1, unit = 'ay', seciliGunler = '') => {
  if (!lastDoneDate) return null;
  const safeStr = typeof lastDoneDate === 'string' ? lastDoneDate.replace(' ', 'T') : lastDoneDate;
  const base = new Date(safeStr);
  if (isNaN(base.getTime())) return null;

  const p = parseInt(period, 10) > 0 ? parseInt(period, 10) : 1;

  if (unit === 'gun') {
    const d = new Date(base);
    d.setDate(d.getDate() + p);
    return d;
  }

  if (unit === 'hafta') {
    const selectedList = typeof seciliGunler === 'string' && seciliGunler.trim()
      ? seciliGunler.split(',').map(s => s.trim()).filter(Boolean)
      : [];

    if (selectedList.length === 0) {
      const d = new Date(base);
      d.setDate(d.getDate() + p * 7);
      return d;
    }

    const targetDayNums = selectedList.map(name => dayNameToIndex[name]).filter(n => n !== undefined);
    if (targetDayNums.length === 0) {
      const d = new Date(base);
      d.setDate(d.getDate() + p * 7);
      return d;
    }

    let weekCount = 0;
    const curr = new Date(base);
    for (let i = 1; i <= 730; i++) {
      curr.setDate(curr.getDate() + 1);
      if (curr.getDay() === 1) {
        weekCount++;
      }
      if (targetDayNums.includes(curr.getDay())) {
        if (weekCount === 0 || weekCount % p === 0) {
          return new Date(curr);
        }
      }
    }
    const fallback = new Date(base);
    fallback.setDate(fallback.getDate() + p * 7);
    return fallback;
  }

  const d = new Date(base);
  d.setMonth(d.getMonth() + p);
  return d;
};

const formatPeriyotText = (rutin) => {
  if (!rutin) return '';
  const period = rutin.periyot_ay || 1;
  if (rutin.periyot_birim === 'gun') {
    return `${period} Günde Bir`;
  }
  if (rutin.periyot_birim === 'hafta') {
    const weekText = period === 1 ? 'Her Hafta' : `${period} Haftada Bir`;
    if (rutin.secili_gunler && rutin.secili_gunler.trim()) {
      return `${weekText} (${rutin.secili_gunler.split(',').join(', ')})`;
    }
    return weekText;
  }
  return `${period} Ayda Bir`;
};

const getStatusColor = (days, limit, durum) => {
  if (durum === 'tuketildi' || durum === 'odendi') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (durum === 'atildi') return 'text-orange-400 bg-orange-500/10 border-orange-500/20';
  if (days === null) return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
  if (days < 0) return 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse';
  if (days <= limit) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
};

const getRutinMaxWarningDays = (rutinForm) => {
  if (!rutinForm) return 15;
  const unit = rutinForm.periyot_birim || 'ay';
  const isWeeklyWithDays = (unit === 'hafta') && Boolean(rutinForm.secili_gunler && rutinForm.secili_gunler.trim());
  const periodNum = isWeeklyWithDays ? 1 : (parseInt(rutinForm.periyot_ay, 10) > 0 ? parseInt(rutinForm.periyot_ay, 10) : 1);

  if (unit === 'gun') {
    return Math.max(0, Math.floor(periodNum / 2));
  }

  if (unit === 'ay') {
    return Math.max(0, Math.floor((periodNum * 30) / 2));
  }

  // unit === 'hafta'
  const selectedList = typeof rutinForm.secili_gunler === 'string' && rutinForm.secili_gunler.trim()
    ? rutinForm.secili_gunler.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  if (selectedList.length === 0) {
    const periodDays = periodNum * 7;
    return Math.max(0, Math.floor(periodDays / 2));
  }

  const rawDayNums = Array.from(new Set(selectedList.map(name => dayNameToIndex[name]).filter(n => n !== undefined)));

  if (rawDayNums.length === 0) {
    const periodDays = periodNum * 7;
    return Math.max(0, Math.floor(periodDays / 2));
  }

  // Map Sunday (0) to 7 for week ordering (Pazartesi=1 ... Pazar=7)
  const normalizedDays = Array.from(new Set(rawDayNums.map(n => n === 0 ? 7 : n))).sort((a, b) => a - b);

  if (normalizedDays.length === 1) {
    const minGap = periodNum * 7;
    return Math.max(0, Math.floor(minGap / 2));
  }

  let minGap = 999;
  for (let i = 0; i < normalizedDays.length - 1; i++) {
    const gap = normalizedDays[i + 1] - normalizedDays[i];
    if (gap < minGap) minGap = gap;
  }
  const wrapGap = (7 - normalizedDays[normalizedDays.length - 1]) + normalizedDays[0] + (periodNum - 1) * 7;
  if (wrapGap < minGap) minGap = wrapGap;

  return Math.max(0, Math.floor(minGap / 2));
};

const getDateMaxWarningDays = (dateStr) => {
  if (!dateStr) return null;
  const diff = getDaysDiff(dateStr);
  if (diff === null || diff <= 0) return 0;
  return Math.max(0, Math.floor(diff / 2));
};

function App() {
  const [currentPage, setCurrentPage] = useState(() => {
    const hash = window.location.hash.replace('#', '').split('-')[0];
    return hash || 'dashboard';
  });
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Toast Zamanlayıcı Referansı (Bellek sızıntısını önler)
  const toastTimeoutRef = useRef(null);

  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    // Yeni bildirim geldiğinde eski tüm bildirimleri (başarı/hata) anında temizle
    setSuccessMsg('');
    setError('');

    if (type === 'success') {
      setSuccessMsg(msg);
      toastTimeoutRef.current = setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setError(msg);
      toastTimeoutRef.current = setTimeout(() => setError(''), 4000);
    }
  }, []);

  // Auth Stateleri
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
  const [showLanding, setShowLanding] = useState(true);
  const [authMode, setAuthMode] = useState('login'); // 'login' veya 'register'
  const [authForm, setAuthForm] = useState({ isim: '', eposta: '', sifre: '' });
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Veri Durumları
  const [summary, setSummary] = useState(null);
  const [gidalar, setGidalar] = useState([]);
  const [faturalar, setFaturalar] = useState([]);
  const [garantiler, setGarantiler] = useState([]);
  const [rutinKlasorleri, setRutinKlasorleri] = useState([]);
  const [rutinler, setRutinler] = useState([]);
  const [ayarlar, setAyarlar] = useState({ telegram_token: '', telegram_chat_id: '', bildirim_saati: '09:00', admin_bildirim_saati: '09:00' });
  const [savedAyarlar, setSavedAyarlar] = useState({ telegram_token: '', telegram_chat_id: '', bildirim_saati: '09:00', admin_bildirim_saati: '09:00' });
  const [isEditingTelegram, setIsEditingTelegram] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ isim: '', eposta: '', mevcut_sifre: '', sifre: '' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showTelegramGuide, setShowTelegramGuide] = useState(false);
  const [showSikayetGuide, setShowSikayetGuide] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [deleteAccountLoading, setDeleteAccountLoading] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState('');
  const [deleteAccountError, setDeleteAccountError] = useState('');

  // Admin Bilgi Paneli Durumları
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [adminUsersLoading, setAdminUsersLoading] = useState(false);
  const [adminUsersError, setAdminUsersError] = useState('');
  const [adminSearchQuery, setAdminSearchQuery] = useState('');
  const [adminSortField, setAdminSortField] = useState('olusturma_tarihi');
  const [adminSortOrder, setAdminSortOrder] = useState('desc');
  const [hoveredTrafficIdx, setHoveredTrafficIdx] = useState(null);

  const handleAdminSort = (field) => {
    if (adminSortField === field) {
      setAdminSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
    } else {
      setAdminSortField(field);
      setAdminSortOrder('desc');
    }
  };

  const fetchAdminUsers = useCallback(async () => {
    setAdminUsersLoading(true);
    setAdminUsersError('');
    try {
      const res = await API.get('/admin/users');
      if (res.data && res.data.users) {
        setAdminUsers(res.data.users);
        setAdminStats({
          totalUsers: res.data.total_users,
          adminCount: res.data.admin_count,
          userCount: res.data.user_count,
          activeUsers: res.data.active_users || res.data.total_users,
          siteVisits: res.data.site_visits ?? 0,
          dailyVisits: res.data.daily_visits ?? 0,
          totalGida: res.data.total_gida || 0,
          totalFatura: res.data.total_fatura || 0,
          totalGaranti: res.data.total_garanti || 0,
          totalRutin: res.data.total_rutin || 0,
          weeklyVisits: res.data.weekly_visits || [],
          hourlyTraffic: res.data.hourly_traffic || [],
        });
      } else {
        setAdminUsers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      setAdminUsersError(err.response?.data?.error || 'Sistem verileri yüklenemedi.');
    } finally {
      setAdminUsersLoading(false);
    }
  }, []);

  // Şikayet & Geri Bildirim Durumları
  const [sikayetForm, setSikayetForm] = useState({ baslik: '', mesaj: '' });
  const [sikayetLoading, setSikayetLoading] = useState(false);
  const [adminSikayetler, setAdminSikayetler] = useState([]);
  const [adminSikayetStats, setAdminSikayetStats] = useState({ toplam: 0, bekliyor: 0, incelendi: 0, cozuldu: 0 });
  const [adminSikayetlerLoading, setAdminSikayetlerLoading] = useState(false);
  const [adminSikayetFilter, setAdminSikayetFilter] = useState('tum');
  const [openSikayetDropdownId, setOpenSikayetDropdownId] = useState(null);

  useEffect(() => {
    if (openSikayetDropdownId === null) return;
    const handleClickOutside = (e) => {
      if (!e.target.closest('.sikayet-dropdown-container')) {
        setOpenSikayetDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSikayetDropdownId]);

  const fetchAdminSikayetler = useCallback(async () => {
    setAdminSikayetlerLoading(true);
    try {
      const res = await API.get('/admin/sikayetler');
      setAdminSikayetler(res.data?.sikayetler || []);
      setAdminSikayetStats({
        toplam: res.data?.toplam || 0,
        bekliyor: res.data?.bekliyor_sayisi || 0,
        incelendi: res.data?.incelendi_sayisi || 0,
        cozuldu: res.data?.cozuldu_sayisi || 0,
      });
    } catch (err) {
      console.error('Şikayetler çekilemedi:', err);
    } finally {
      setAdminSikayetlerLoading(false);
    }
  }, []);

  const handleSendSikayet = async (e) => {
    if (e) e.preventDefault();
    if (!sikayetForm.baslik.trim() || !sikayetForm.mesaj.trim()) {
      showToast('Lütfen şikayet başlığı ve mesajını doldurun.', 'error');
      return;
    }
    setSikayetLoading(true);
    try {
      const res = await API.post('/sikayetler', sikayetForm);
      setSikayetForm({ baslik: '', mesaj: '' });
      showToast(res.data?.message || 'Şikayetiniz yöneticilere iletildi.');
    } catch (err) {
      showToast(err.response?.data?.error || 'Şikayet gönderilemedi.', 'error');
    } finally {
      setSikayetLoading(false);
    }
  };

  const handleUpdateSikayetDurum = async (id, newStatus) => {
    try {
      await API.put(`/admin/sikayetler/${id}/durum`, { durum: newStatus });
      showToast('Şikayet durumu güncellendi.');
      fetchAdminSikayetler();
    } catch (err) {
      showToast(err.response?.data?.error || 'Durum güncellenirken hata oluştu.', 'error');
    }
  };

  const handleDeleteSikayet = (id) => {
    askConfirm(
      'Şikayet Kaydını Sil 🗑️',
      'Bu şikayet kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
      async () => {
        try {
          await API.delete(`/admin/sikayetler/${id}`);
          showToast('Şikayet başarıyla silindi.');
          fetchAdminSikayetler();
        } catch (err) {
          showToast(err.response?.data?.error || 'Silinirken hata oluştu.', 'error');
        }
      }
    );
  };

  const handleDeleteAccount = async (e) => {
    if (e) e.preventDefault();
    setDeleteAccountError('');
    if (!deleteAccountPassword?.trim()) {
      setDeleteAccountError('Lütfen onaylamak için mevcut şifrenizi girin.');
      return;
    }
    setDeleteAccountLoading(true);
    try {
      const res = await API.delete('/auth/delete-account', {
        data: { sifre: deleteAccountPassword }
      });
      setShowDeleteAccountModal(false);
      setDeleteAccountPassword('');
      setDeleteAccountError('');
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setShowLanding(true);
      changePage('dashboard');
      showToast(res.data?.message || 'Hesabınız ve tüm verileriniz kalıcı olarak silindi.');
    } catch (err) {
      const errMsg = err.response?.data?.error || err.response?.data?.message || 'Hesap silinirken bir hata oluştu.';
      setDeleteAccountError(errMsg);
      showToast(errMsg, 'error');
    } finally {
      setDeleteAccountLoading(false);
    }
  };

  const promptLogout = useCallback(() => {
    setShowProfileMenu(false);
    setShowLogoutConfirm(true);
  }, []);

  useEffect(() => {
    if (user) {
      setProfileForm({
        isim: user.isim || '',
        eposta: user.eposta || '',
        mevcut_sifre: '',
        sifre: ''
      });
      setShowPasswordForm(false);
      setIsEditingProfile(false);
    }
  }, [user]);

  // Sayfa değiştirildiğinde aktif düzenleme modlarını ve henüz kaydedilmemiş form verilerini otomatik iptal et
  useEffect(() => {
    setIsEditingProfile(false);
    setShowPasswordForm(false);
    setShowProfileMenu(false);
    setShowNotificationMenu(false);
    if (user) {
      setProfileForm({
        isim: user.isim || '',
        eposta: user.eposta || '',
        mevcut_sifre: '',
        sifre: ''
      });
    }
    setAyarlar(savedAyarlar);
    if (savedAyarlar.telegram_token || savedAyarlar.telegram_chat_id) {
      setIsEditingTelegram(false);
    }
  }, [currentPage]);

  // Filtre Durumları
  const [gidaFiltre, setGidaFiltre] = useState('bekliyor'); // 'hepsi', 'bekliyor', 'tuketildi', 'atildi'
  const [faturaFiltre, setFaturaFiltre] = useState('odenmedi'); // 'hepsi', 'odenmedi', 'odendi'
  const [garantiFiltre, setGarantiFiltre] = useState('aktif'); // 'hepsi', 'aktif', 'gecen'
  const [seciliRutinKlasor, setSeciliRutinKlasor] = useState('hepsi'); // 'hepsi' veya klasor_id
  const [dashboardNotifTab, setDashboardNotifTab] = useState('yaklasanlar'); // 'yaklasanlar' | 'gecenler'

  // Form Modalları ve State'leri

  // Memoized Filtrelenmiş Veri Listeleri (RAM/CPU tüketimini optimize eder)
  const filteredGidalar = useMemo(() => {
    return gidalar.filter((g) => gidaFiltre === 'hepsi' || g.durum === gidaFiltre);
  }, [gidalar, gidaFiltre]);

  const filteredFaturalar = useMemo(() => {
    return faturalar.filter((f) => faturaFiltre === 'hepsi' || f.durum === faturaFiltre);
  }, [faturalar, faturaFiltre]);

  const filteredGarantiler = useMemo(() => {
    return garantiler.filter((garanti) => {
      const days = getDaysDiff(garanti.garanti_bitis);
      const isExpired = days !== null && days < 0;
      if (garantiFiltre === 'hepsi') return true;
      if (garantiFiltre === 'aktif') return !isExpired;
      if (garantiFiltre === 'gecen') return isExpired;
      return true;
    });
  }, [garantiler, garantiFiltre]);

  const filteredRutinler = useMemo(() => {
    if (!Array.isArray(rutinler)) return [];
    return rutinler.filter((r) => r && (seciliRutinKlasor === 'hepsi' || r.klasor_id?.toString() === seciliRutinKlasor));
  }, [rutinler, seciliRutinKlasor]);

  // Anlık Bildirim Listesi Memosu (Ana sayfa bildirim ekranı için)
  const activeNotifications = useMemo(() => {
    const list = [];

    // 1. GIDALAR KONTROLÜ
    if (Array.isArray(gidalar)) {
      gidalar.forEach((gida) => {
        if (gida.durum === 'bekliyor') {
          const days = getDaysDiff(gida.skt);
          if (days !== null) {
            const limit = gida.hatirlatma_gun_kala ?? 3;
            if ((days < 0 && days >= -7) || (days >= 0 && days <= limit)) {
              const isOverdue = days < 0;
              const isToday = days === 0;
              list.push({
                id: `gida-${gida.id}`,
                rawId: gida.id,
                category: 'gida',
                categoryName: 'Gıda Takibi 🥑',
                title: gida.urun_adi,
                subtitle: gida.kategori || 'Genel Mutfak',
                dateStr: gida.skt,
                days,
                isOverdue,
                isToday,
                message: isOverdue
                  ? `Son Tüketim Tarihi ${Math.abs(days)} gün geçti!`
                  : isToday
                    ? 'Son Tüketim Tarihi BUGÜN!'
                    : `Son Tüketim Tarihine ${days} gün kaldı.`,
                icon: Apple,
                badgeBg: isOverdue ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : isToday ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-orange-500/15 text-orange-400 border-orange-500/30',
                badgeText: isOverdue ? `${Math.abs(days)} Gün Geçti!` : isToday ? 'Bugün Son!' : `${days} Gün Kaldı`,
                targetPage: 'gidalar',
                rawItem: gida
              });
            }
          }
        }
      });
    }

    // 2. FATURALAR KONTROLÜ
    if (Array.isArray(faturalar)) {
      faturalar.forEach((fatura) => {
        if (fatura.durum === 'odenmedi') {
          const days = getDaysDiff(fatura.son_odeme_tarihi);
          if (days !== null) {
            const limit = fatura.hatirlatma_gun_kala ?? 5;
            if ((days < 0 && days >= -7) || (days >= 0 && days <= limit)) {
              const isOverdue = days < 0;
              const isToday = days === 0;
              const tutarText = fatura.tutar ? `${fatura.tutar} TL` : 'Tutar Belirtilmedi';
              list.push({
                id: `fatura-${fatura.id}`,
                rawId: fatura.id,
                category: 'fatura',
                categoryName: 'Fatura Takibi 💸',
                title: fatura.fatura_adi,
                subtitle: `Tutar: ${tutarText}`,
                dateStr: fatura.son_odeme_tarihi,
                days,
                isOverdue,
                isToday,
                message: isOverdue
                  ? `Son Ödeme Tarihi ${Math.abs(days)} gün geçti! (${tutarText})`
                  : isToday
                    ? `Bugün Son Ödeme Günü! (${tutarText})`
                    : `Son Ödeme Gününe ${days} gün kaldı. (${tutarText})`,
                icon: Receipt,
                badgeBg: isOverdue ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : isToday ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-rose-500/10 text-rose-300 border-rose-500/20',
                badgeText: isOverdue ? `${Math.abs(days)} Gün Geçti!` : isToday ? 'Bugün Son Ödeme!' : `${days} Gün Kaldı`,
                targetPage: 'faturalar',
                rawItem: fatura
              });
            }
          }
        }
      });
    }

    // 3. GARANTİLER KONTROLÜ
    if (Array.isArray(garantiler)) {
      garantiler.forEach((garanti) => {
        const days = getDaysDiff(garanti.garanti_bitis);
        if (days !== null) {
          const limit = garanti.hatirlatma_gun_kala ?? 30;
          if ((days < 0 && days >= -7) || (days >= 0 && days <= limit)) {
            const isOverdue = days < 0;
            const isToday = days === 0;
            list.push({
              id: `garanti-${garanti.id}`,
              rawId: garanti.id,
              category: 'garanti',
              categoryName: 'Garanti Takibi 🛡️',
              title: garanti.cihaz_adi,
              subtitle: garanti.marka_model || 'Elektronik / Cihaz',
              dateStr: garanti.garanti_bitis,
              days,
              isOverdue,
              isToday,
              message: isOverdue
                ? `Garanti süresi ${Math.abs(days)} gün önce bitti!`
                : isToday
                  ? 'Garanti süresi bugün doluyor!'
                  : `Garanti bitimine ${days} gün kaldı.`,
              icon: ShieldCheck,
              badgeBg: isOverdue ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : isToday ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
              badgeText: isOverdue ? `Süresi ${Math.abs(days)} Gün Önce Bitti` : isToday ? 'Bugün Bitiyor' : `${days} Gün Kaldı`,
              targetPage: 'garantiler',
              rawItem: garanti
            });
          }
        }
      });
    }

    // 4. RUTİNLER KONTROLÜ
    if (Array.isArray(rutinler)) {
      rutinler.forEach((rutin) => {
        if (!rutin) return;
        const limit = rutin.hatirlatma_gun_kala ?? 15;
        if (!rutin.son_yapilma_tarihi) {
          list.push({
            id: `rutin-${rutin.id}`,
            rawId: rutin.id,
            category: 'rutin',
            categoryName: 'Rutin Görev 📅',
            title: rutin.gorev_adi,
            subtitle: rutin.klasor_adi ? `Klasör: ${rutin.klasor_adi}` : 'Genel Rutin',
            days: -999,
            isOverdue: true,
            isToday: false,
            message: 'Bu rutin görev henüz hiç yapılmadı!',
            icon: RefreshCw,
            badgeBg: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
            badgeText: 'Hiç Yapılmadı!',
            targetPage: 'rutinler',
            rawItem: rutin
          });
        } else {
          const safeStr = typeof rutin.son_yapilma_tarihi === 'string' ? rutin.son_yapilma_tarihi.replace(' ', 'T') : rutin.son_yapilma_tarihi;
          const inputDate = new Date(safeStr);
          if (!isNaN(inputDate.getTime())) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const compareDate = new Date(inputDate);
            compareDate.setHours(0, 0, 0, 0);

            let nextDate;
            if (compareDate > today) {
              nextDate = compareDate;
            } else {
              nextDate = calcNextRoutineDate(rutin.son_yapilma_tarihi, rutin.periyot_ay, rutin.periyot_birim, rutin.secili_gunler);
            }
            nextDate.setHours(0, 0, 0, 0);
            const diffDays = Math.ceil((nextDate - today) / (1000 * 60 * 60 * 24));
            if ((diffDays < 0 && diffDays >= -7) || (diffDays >= 0 && diffDays <= limit)) {
              const isOverdue = diffDays < 0;
              const isToday = diffDays === 0;
              list.push({
                id: `rutin-${rutin.id}`,
                rawId: rutin.id,
                category: 'rutin',
                categoryName: 'Rutin Görev 📅',
                title: rutin.gorev_adi,
                subtitle: rutin.klasor_adi ? `Klasör: ${rutin.klasor_adi}` : 'Genel Rutin',
                days: diffDays,
                isOverdue,
                isToday,
                message: isOverdue
                  ? `Bakım/Görev zamanı ${Math.abs(diffDays)} gün geçti!`
                  : isToday
                    ? 'Yapılması için bugün son gün!'
                    : `Bakım zamanına ${diffDays} gün kaldı.`,
                icon: RefreshCw,
                badgeBg: isOverdue ? 'bg-rose-500/15 text-rose-400 border-rose-500/30' : isToday ? 'bg-amber-500/15 text-amber-400 border-amber-500/30' : 'bg-purple-500/15 text-purple-300 border-purple-500/30',
                badgeText: isOverdue ? `${Math.abs(diffDays)} Gün Geçti!` : isToday ? 'Bugün Son!' : `${diffDays} Gün Kaldı`,
                targetPage: 'rutinler',
                rawItem: rutin
              });
            }
          }
        }
      });
    }

    return list.sort((a, b) => {
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      return a.days - b.days;
    });
  }, [gidalar, faturalar, garantiler, rutinler]);

  const filteredActiveNotifications = useMemo(() => {
    const list = activeNotifications.filter((n) => {
      if (dashboardNotifTab === 'gecenler') {
        return n.isOverdue;
      }
      return !n.isOverdue;
    });

    return list.sort((a, b) => {
      if (dashboardNotifTab === 'gecenler') {
        return b.days - a.days;
      }
      return a.days - b.days;
    });
  }, [activeNotifications, dashboardNotifTab]);

  // Form Modalları ve State'leri
  const [showGidaModal, setShowGidaModal] = useState(false);
  const [gidaForm, setGidaForm] = useState({ urun_adi: '', kategori: '', skt: '', hatirlatma_gun_kala: 0, durum: 'bekliyor' });
  const [editingGida, setEditingGida] = useState(null);

  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [faturaForm, setFaturaForm] = useState({ fatura_adi: '', tutar: '', son_odeme_tarihi: '', hatirlatma_gun_kala: 0, durum: 'odenmedi' });
  const [editingFatura, setEditingFatura] = useState(null);

  const [showGarantiModal, setShowGarantiModal] = useState(false);
  const [garantiForm, setGarantiForm] = useState({ cihaz_adi: '', marka_model: '', garanti_bitis: '', hatirlatma_gun_kala: 0, notlar: '' });
  const [editingGaranti, setEditingGaranti] = useState(null);

  const [showKlasorYonetimModal, setShowKlasorYonetimModal] = useState(false);
  const [showKlasorModal, setShowKlasorModal] = useState(false);
  const [klasorForm, setKlasorForm] = useState({ klasor_adi: '' });
  const [editingKlasor, setEditingKlasor] = useState(null);

  const [showRutinModal, setShowRutinModal] = useState(false);
  const [rutinForm, setRutinForm] = useState({ klasor_id: '', gorev_adi: '', periyot_ay: '', periyot_birim: 'ay', secili_gunler: '', hatirlatma_gun_kala: 0, son_yapilma_tarihi: '' });
  const [editingRutin, setEditingRutin] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ show: false, title: '', message: '', onConfirm: null });

  const askConfirm = (title, message, onConfirm) => {
    setDeleteConfirm({
      show: true,
      title,
      message,
      onConfirm
    });
  };

  // Tarayıcı Geri/İleri (Popstate) Tuş Kontrolü ve Sayfa Geçiş Yönetimi
  const changePage = useCallback((newPage) => {
    if (!newPage) return;
    setShowProfileMenu(false);
    setShowNotificationMenu(false);

    setCurrentPage((prevPage) => {
      if (prevPage === newPage) return prevPage;
      if (window.location.hash !== `#${newPage}`) {
        window.history.pushState({ page: newPage }, '', `#${newPage}`);
      }
      return newPage;
    });
  }, []);

  const closeAllModals = useCallback(() => {
    setShowGidaModal(false);
    setShowFaturaModal(false);
    setShowGarantiModal(false);
    setShowKlasorYonetimModal(false);
    setShowKlasorModal(false);
    setShowRutinModal(false);
    setShowProfileMenu(false);
    setShowNotificationMenu(false);
    setShowLogoutConfirm(false);
    setShowDeleteAccountModal(false);
    setDeleteAccountPassword('');
    setDeleteAccountError('');
    setDeleteConfirm(prev => ({ ...prev, show: false }));
  }, []);

  const isAnyModalOpen = Boolean(
    showGidaModal ||
    showFaturaModal ||
    showGarantiModal ||
    showKlasorYonetimModal ||
    showKlasorModal ||
    showRutinModal ||
    showProfileMenu ||
    showNotificationMenu ||
    deleteConfirm.show ||
    showLogoutConfirm ||
    showDeleteAccountModal
  );

  const lastModalOpenRef = useRef(false);

  // Modal açıldığında/kapatıldığında history durumunu güncelle
  useEffect(() => {
    if (isAnyModalOpen && !lastModalOpenRef.current) {
      if (!window.history.state?.isModal) {
        window.history.pushState({ page: currentPage, isModal: true }, '', `#${currentPage}-modal`);
      }
    } else if (!isAnyModalOpen && lastModalOpenRef.current) {
      if (window.history.state?.isModal) {
        window.history.back();
      }
    }
    lastModalOpenRef.current = isAnyModalOpen;
  }, [isAnyModalOpen, currentPage]);

  // ESC tuşuna basıldığında açık olan modalları kapat
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isAnyModalOpen) {
        closeAllModals();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAnyModalOpen, closeAllModals]);

  // Giriş yapmamış kullanıcılar için tarayıcı geri/ileri (Popstate) ve URL takibi
  useEffect(() => {
    if (user) return;

    const handleAuthPopState = () => {
      const currentHash = window.location.hash.replace('#', '');
      if (currentHash === 'login' || currentHash === 'register') {
        setAuthMode(currentHash);
        setShowLanding(false);
      } else {
        setShowLanding(true);
      }
    };

    const initialHash = window.location.hash.replace('#', '');
    if (initialHash === 'login' || initialHash === 'register') {
      setAuthMode(initialHash);
      setShowLanding(false);
    } else {
      setShowLanding(true);
      if (!window.location.hash || window.location.hash === '#' || window.location.hash === '#dashboard') {
        window.history.replaceState({ isLanding: true }, '', '#landing');
      }
    }

    window.addEventListener('popstate', handleAuthPopState);
    return () => window.removeEventListener('popstate', handleAuthPopState);
  }, [user]);

  const navigateToAuth = useCallback((mode = 'login') => {
    setAuthMode(mode);
    setAuthError('');
    setShowLanding(false);
    if (window.location.hash !== `#${mode}`) {
      window.history.pushState({ authMode: mode }, '', `#${mode}`);
    }
  }, []);

  const navigateToLanding = useCallback(() => {
    setShowLanding(true);
    setAuthError('');
    if (window.location.hash !== '#landing') {
      window.history.pushState({ isLanding: true }, '', '#landing');
    }
  }, []);

  // Google OAuth Client ID & Script Yapılandırması
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '937396352861-g56gevbo7ke9edlu3pq2iu1hp1jmtl8o.apps.googleusercontent.com';

  const handleGoogleLoginCallback = useCallback(async (response) => {
    if (!response || !response.credential) return;
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await API.post('/auth/google', {
        credential: response.credential
      });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      showToast(`Hoş geldiniz, ${res.data.user.isim}!`);
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Google ile giriş yapma başarısız oldu.');
    } finally {
      setAuthLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (token || showLanding) return;

    const initGoogleSDK = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleLoginCallback,
        });

        const btnContainer = document.getElementById('googleSignInContainer');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: 320,
            text: authMode === 'login' ? 'signin_with' : 'signup_with',
            locale: 'tr',
            shape: 'pill',
            logo_alignment: 'left'
          });
        }
      }
    };

    if (!document.getElementById('google-gsi-script')) {
      const script = document.createElement('script');
      script.id = 'google-gsi-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = initGoogleSDK;
      document.body.appendChild(script);
    } else {
      initGoogleSDK();
    }
  }, [token, showLanding, authMode, handleGoogleLoginCallback, GOOGLE_CLIENT_ID]);

  // Oturum açmış kullanıcılar için tarayıcı yönlendirme ve popstate dinleyicisi
  useEffect(() => {
    if (!user) return;

    const isAdmin = user.role === 'admin';
    const validPages = isAdmin
      ? ['admin', 'istatistikler', 'sikayetler', 'ayarlar']
      : ['dashboard', 'gidalar', 'faturalar', 'garantiler', 'rutinler', 'ayarlar'];

    const currentHash = window.location.hash.replace('#', '').split('-')[0];

    setCurrentPage((prevPage) => {
      let activePage = prevPage;
      if (validPages.includes(currentHash)) {
        activePage = currentHash;
      }

      if (isAdmin && !validPages.includes(activePage)) {
        if (window.location.hash !== '#admin') {
          window.history.replaceState({ page: 'admin' }, '', '#admin');
        }
        return 'admin';
      } else if (!isAdmin && !validPages.includes(activePage)) {
        if (window.location.hash !== '#dashboard') {
          window.history.replaceState({ page: 'dashboard' }, '', '#dashboard');
        }
        return 'dashboard';
      }
      return activePage;
    });

    const handlePopState = (event) => {
      closeAllModals();

      const statePage = event.state?.page;
      const hash = window.location.hash.replace('#', '').split('-')[0];
      let targetPage = isAdmin ? 'admin' : 'dashboard';

      if (statePage && validPages.includes(statePage)) {
        targetPage = statePage;
      } else if (hash && validPages.includes(hash)) {
        targetPage = hash;
      }
      setCurrentPage(targetPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [user?.id, user?.role, closeAllModals]);

  // Admin/Sistem verisini Admin, İstatistikler veya Şikayetler sekmesindeyken 1 kez çek
  useEffect(() => {
    if ((currentPage === 'admin' || currentPage === 'istatistikler' || currentPage === 'sikayetler') && user) {
      fetchAdminUsers();
      if (user.role === 'admin') {
        fetchAdminSikayetler();
      }
    }
  }, [currentPage, user, fetchAdminUsers, fetchAdminSikayetler]);






  const handleRefreshStats = useCallback(async () => {
    setAdminUsersLoading(true);
    const minWait = new Promise(resolve => setTimeout(resolve, 500));
    try {
      await Promise.all([fetchAdminUsers(), fetchAdminSikayetler(), minWait]);
      showToast('Sistem verileri ve grafikler güncellendi', 'success');
    } catch (err) {
      showToast('Veriler güncellenirken bir hata oluştu', 'error');
    } finally {
      setAdminUsersLoading(false);
    }
  }, [fetchAdminUsers, showToast]);
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setShowLanding(true);
    changePage('dashboard');
    showToast('Oturum kapatıldı.');
  }, [showToast, changePage]);

  const verifyUser = useCallback(async () => {
    try {
      const res = await API.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      handleLogout();
    }
  }, [handleLogout]);

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    if (authMode === 'register' && !authForm.isim?.trim()) {
      setAuthError('Lütfen Ad Soyad alanını doldurun.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!authForm.eposta?.trim() || !emailRegex.test(authForm.eposta.trim())) {
      setAuthError('Geçerli bir e-posta adresi giriniz (örnek: isim@domain.com).');
      return;
    }

    if (!authForm.sifre?.trim()) {
      setAuthError('Lütfen Şifre alanını doldurun.');
      return;
    }

    if (authMode === 'register' && authForm.sifre.length < 6) {
      setAuthError('Şifreniz en az 6 karakter olmalıdır.');
      return;
    }

    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const res = await API.post('/auth/login', {
          eposta: authForm.eposta,
          sifre: authForm.sifre
        });
        localStorage.setItem('token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        showToast(`Hoş geldiniz, ${res.data.user.isim}!`);
      } else {
        const res = await API.post('/auth/register', {
          isim: authForm.isim,
          eposta: authForm.eposta,
          sifre: authForm.sifre
        });
        localStorage.setItem('token', res.data.token);
        setToken(res.data.token);
        setUser(res.data.user);
        showToast('Hesabınız başarıyla oluşturuldu!');
      }
      setAuthForm({ isim: '', eposta: '', sifre: '' });
    } catch (err) {
      setAuthError(err.response?.data?.error || 'Giriş veya kayıt başarısız.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();

    if (!profileForm.isim?.trim()) {
      showToast('Lütfen Ad Soyad alanını doldurun.', 'error');
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!profileForm.eposta?.trim() || !emailRegex.test(profileForm.eposta.trim())) {
      showToast('Geçerli bir e-posta adresi giriniz (örnek: isim@domain.com).', 'error');
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Frontend şifre uzunluk doğrulaması
    if (showPasswordForm) {
      if (!profileForm.mevcut_sifre || !profileForm.sifre) {
        showToast('Lütfen tüm şifre alanlarını doldurun.', 'error');
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (profileForm.sifre.length < 6) {
        showToast('Yeni şifreniz en az 6 karakter olmalıdır.', 'error');
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (profileForm.mevcut_sifre === profileForm.sifre) {
        showToast('Yeni şifreniz mevcut şifrenizle aynı olamaz.', 'error');
        document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
    }

    setProfileLoading(true);
    try {
      const res = await API.put('/auth/update-profile', profileForm);
      setUser(res.data.user);
      setProfileForm(prev => ({ ...prev, mevcut_sifre: '', sifre: '' }));
      setShowPasswordForm(false);
      setIsEditingProfile(false);
      showToast('Hesap bilgileriniz başarıyla güncellendi!');
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showToast(err.response?.data?.error || 'Profil güncellenirken hata oluştu.', 'error');
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchAyarlar = useCallback(async () => {
    try {
      const res = await API.get('/ayarlar');
      const token = res.data.telegram_token || '';
      const chatId = res.data.telegram_chat_id || '';
      const bildirimSaati = res.data.bildirim_saati || '09:00';
      const adminBildirimSaati = res.data.admin_bildirim_saati || '09:00';
      const loadedAyarlar = { telegram_token: token, telegram_chat_id: chatId, bildirim_saati: bildirimSaati, admin_bildirim_saati: adminBildirimSaati };
      setAyarlar(loadedAyarlar);
      setSavedAyarlar(loadedAyarlar);
      if (token || chatId) {
        setIsEditingTelegram(false);
      } else {
        setIsEditingTelegram(true);
      }
    } catch (err) {
      console.error('Ayarlar yüklenemedi:', err);
    }
  }, []);

  const fetchDashboardSummary = useCallback(async () => {
    try {
      const res = await API.get('/dashboard-summary');
      setSummary(res.data);
      fetchAyarlar();
    } catch (err) {
      console.error('Dashboard özeti yüklenemedi:', err);
    }
  }, [fetchAyarlar]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (currentPage === 'dashboard') {
        const [summaryRes, gidaRes, faturaRes, garantiRes, rutinRes, rutinFolderRes] = await Promise.allSettled([
          API.get('/dashboard-summary'),
          API.get('/gidalar'),
          API.get('/faturalar'),
          API.get('/garantiler'),
          API.get('/rutinler'),
          API.get('/rutin_klasorleri')
        ]);
        if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
        if (gidaRes.status === 'fulfilled') setGidalar(Array.isArray(gidaRes.value.data) ? gidaRes.value.data : []);
        if (faturaRes.status === 'fulfilled') setFaturalar(Array.isArray(faturaRes.value.data) ? faturaRes.value.data : []);
        if (garantiRes.status === 'fulfilled') setGarantiler(Array.isArray(garantiRes.value.data) ? garantiRes.value.data : []);
        if (rutinRes.status === 'fulfilled') setRutinler(Array.isArray(rutinRes.value.data) ? rutinRes.value.data : []);
        if (rutinFolderRes.status === 'fulfilled') setRutinKlasorleri(Array.isArray(rutinFolderRes.value.data) ? rutinFolderRes.value.data : []);
        fetchAyarlar();
      } else if (currentPage === 'gidalar') {
        const res = await API.get('/gidalar');
        setGidalar(Array.isArray(res.data) ? res.data : []);
      } else if (currentPage === 'faturalar') {
        const res = await API.get('/faturalar');
        setFaturalar(Array.isArray(res.data) ? res.data : []);
      } else if (currentPage === 'garantiler') {
        const res = await API.get('/garantiler');
        setGarantiler(Array.isArray(res.data) ? res.data : []);
      } else if (currentPage === 'rutinler') {
        const foldersRes = await API.get('/rutin_klasorleri');
        const routinesRes = await API.get('/rutinler');
        setRutinKlasorleri(Array.isArray(foldersRes.data) ? foldersRes.data : []);
        setRutinler(Array.isArray(routinesRes.data) ? routinesRes.data : []);
      } else if (currentPage === 'ayarlar') {
        const res = await API.get('/ayarlar');
        const token = res.data.telegram_token || '';
        const chatId = res.data.telegram_chat_id || '';
        const bildirimSaati = res.data.bildirim_saati || '09:00';
        const adminBildirimSaati = res.data.admin_bildirim_saati || '09:00';
        const loadedAyarlar = { telegram_token: token, telegram_chat_id: chatId, bildirim_saati: bildirimSaati, admin_bildirim_saati: adminBildirimSaati };
        setAyarlar(loadedAyarlar);
        setSavedAyarlar(loadedAyarlar);
        if (token || chatId) {
          setIsEditingTelegram(false);
        } else {
          setIsEditingTelegram(true);
        }
      }
    } catch (err) {
      setError('Veriler sunucudan yüklenirken hata oluştu.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, fetchDashboardSummary]);



  // Veri yükleme ve Auth doğrulama
  useEffect(() => {
    if (token) {
      localStorage.setItem('token', token);
      verifyUser();
    } else {
      setUser(null);
      localStorage.removeItem('token');
    }
  }, [token, verifyUser]);

  useEffect(() => {
    if (user) {
      fetchDashboardSummary();
      fetchData();
    }
  }, [currentPage, user, fetchDashboardSummary, fetchData]);

  // Toast zamanlayıcılarının temizlenmesi (Component unmount durumunda sızıntıyı önler)
  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // -------------------------------------------------------------
  // GIDALAR İŞLEMLERİ
  // -------------------------------------------------------------
  const handleSaveGida = async (e) => {
    e.preventDefault();
    if (!gidaForm.urun_adi?.trim()) {
      showToast('Lütfen Ürün Adı alanını doldurun.', 'error');
      return;
    }
    if (!gidaForm.skt) {
      showToast('Lütfen Son Kullanma Tarihi seçin.', 'error');
      return;
    }
    const maxDays = getDateMaxWarningDays(gidaForm.skt);
    const hatirlatmaNum = parseInt(gidaForm.hatirlatma_gun_kala, 10) || 0;
    if (hatirlatmaNum < 0) {
      showToast('Hatırlatma gün sayısı 0 veya daha büyük bir sayı olmalıdır.', 'error');
      return;
    }
    if (maxDays !== null && hatirlatmaNum > maxDays) {
      showToast(`Hatırlatma gün sayısı sürenin yarısından (en fazla ${maxDays} gün) fazla olamaz.`, 'error');
      return;
    }
    try {
      if (editingGida) {
        await API.put(`/gidalar/${editingGida.id}`, gidaForm);
        showToast('Gıda maddesi başarıyla güncellendi.');
      } else {
        await API.post('/gidalar', gidaForm);
        showToast('Gıda maddesi başarıyla eklendi.');
      }
      setShowGidaModal(false);
      setEditingGida(null);
      setGidaForm({ urun_adi: '', kategori: '', skt: '', hatirlatma_gun_kala: 0, durum: 'bekliyor' });
      fetchData();
    } catch (err) {
      showToast('Gıda kaydedilirken hata oluştu.', 'error');
    }
  };

  const handleEditGida = (gida) => {
    setEditingGida(gida);
    setGidaForm({
      urun_adi: gida.urun_adi,
      kategori: gida.kategori,
      skt: formatInputDate(gida.skt),
      hatirlatma_gun_kala: gida.hatirlatma_gun_kala,
      durum: gida.durum
    });
    setShowGidaModal(true);
  };

  const handleDeleteGida = (id) => {
    askConfirm(
      'Gıda Silme Onayı 🥑',
      'Bu gıda kaydını silmek istediğinize emin misiniz?',
      async () => {
        try {
          await API.delete(`/gidalar/${id}`);
          showToast('Gıda maddesi silindi.');
          fetchData();
        } catch (err) {
          showToast('Gıda silinirken hata oluştu.', 'error');
        }
      }
    );
  };

  const handleUpdateGidaDurum = async (gida, yeniDurum) => {
    try {
      await API.put(`/gidalar/${gida.id}`, { ...gida, durum: yeniDurum });
      showToast(`Ürün durumu "${yeniDurum === 'tuketildi' ? 'Tüketildi' : 'Atıldı'}" olarak güncellendi.`);
      fetchData();
    } catch (err) {
      showToast('Durum güncellenirken hata oluştu.', 'error');
    }
  };

  // -------------------------------------------------------------
  // FATURA İŞLEMLERİ
  // -------------------------------------------------------------
  const handleSaveFatura = async (e) => {
    e.preventDefault();
    if (!faturaForm.fatura_adi?.trim()) {
      showToast('Lütfen Fatura Adı alanını doldurun.', 'error');
      return;
    }
    if (!faturaForm.tutar) {
      showToast('Lütfen Tutar girin.', 'error');
      return;
    }
    if (!faturaForm.son_odeme_tarihi) {
      showToast('Lütfen Son Ödeme Tarihi seçin.', 'error');
      return;
    }
    const maxDays = getDateMaxWarningDays(faturaForm.son_odeme_tarihi);
    const hatirlatmaNum = parseInt(faturaForm.hatirlatma_gun_kala, 10) || 0;
    if (hatirlatmaNum < 0) {
      showToast('Hatırlatma gün sayısı 0 veya daha büyük bir sayı olmalıdır.', 'error');
      return;
    }
    if (maxDays !== null && hatirlatmaNum > maxDays) {
      showToast(`Hatırlatma gün sayısı sürenin yarısından (en fazla ${maxDays} gün) fazla olamaz.`, 'error');
      return;
    }
    try {
      if (editingFatura) {
        await API.put(`/faturalar/${editingFatura.id}`, faturaForm);
        showToast('Fatura başarıyla güncellendi.');
      } else {
        await API.post('/faturalar', faturaForm);
        showToast('Fatura başarıyla eklendi.');
      }
      setShowFaturaModal(false);
      setEditingFatura(null);
      setFaturaForm({ fatura_adi: '', tutar: '', son_odeme_tarihi: '', hatirlatma_gun_kala: 0, durum: 'odenmedi' });
      fetchData();
    } catch (err) {
      showToast('Fatura kaydedilirken hata oluştu.', 'error');
    }
  };

  const handleEditFatura = (fatura) => {
    setEditingFatura(fatura);
    setFaturaForm({
      fatura_adi: fatura.fatura_adi,
      tutar: fatura.tutar,
      son_odeme_tarihi: formatInputDate(fatura.son_odeme_tarihi),
      hatirlatma_gun_kala: fatura.hatirlatma_gun_kala,
      durum: fatura.durum
    });
    setShowFaturaModal(true);
  };

  const handleDeleteFatura = (id) => {
    askConfirm(
      'Fatura Silme Onayı 💸',
      'Bu faturayı silmek istediğinize emin misiniz?',
      async () => {
        try {
          await API.delete(`/faturalar/${id}`);
          showToast('Fatura silindi.');
          fetchData();
        } catch (err) {
          showToast('Fatura silinirken hata oluştu.', 'error');
        }
      }
    );
  };

  const handlePayFatura = async (fatura) => {
    try {
      await API.put(`/faturalar/${fatura.id}`, { ...fatura, durum: 'odendi' });
      showToast('Fatura ödenmiş olarak işaretlendi.');
      fetchData();
    } catch (err) {
      showToast('Fatura güncellenirken hata oluştu.', 'error');
    }
  };

  // -------------------------------------------------------------
  // GARANTİ İŞLEMLERİ
  // -------------------------------------------------------------
  const handleSaveGaranti = async (e) => {
    e.preventDefault();
    if (!garantiForm.cihaz_adi?.trim()) {
      showToast('Lütfen Cihaz / Ürün Adı alanını doldurun.', 'error');
      return;
    }
    if (!garantiForm.garanti_bitis) {
      showToast('Lütfen Garanti Bitiş Tarihi seçin.', 'error');
      return;
    }
    const maxDays = getDateMaxWarningDays(garantiForm.garanti_bitis);
    const hatirlatmaNum = parseInt(garantiForm.hatirlatma_gun_kala, 10) || 0;
    if (hatirlatmaNum < 0) {
      showToast('Hatırlatma gün sayısı 0 veya daha büyük bir sayı olmalıdır.', 'error');
      return;
    }
    if (maxDays !== null && hatirlatmaNum > maxDays) {
      showToast(`Hatırlatma gün sayısı sürenin yarısından (en fazla ${maxDays} gün) fazla olamaz.`, 'error');
      return;
    }
    try {
      if (editingGaranti) {
        await API.put(`/garantiler/${editingGaranti.id}`, garantiForm);
        showToast('Garanti kaydı güncellendi.');
      } else {
        await API.post('/garantiler', garantiForm);
        showToast('Garanti kaydı eklendi.');
      }
      setShowGarantiModal(false);
      setEditingGaranti(null);
      setGarantiForm({ cihaz_adi: '', marka_model: '', garanti_bitis: '', hatirlatma_gun_kala: 0, notlar: '' });
      fetchData();
    } catch (err) {
      showToast('Garanti kaydedilirken hata oluştu.', 'error');
    }
  };

  const handleEditGaranti = (garanti) => {
    setEditingGaranti(garanti);
    setGarantiForm({
      cihaz_adi: garanti.cihaz_adi,
      marka_model: garanti.marka_model,
      garanti_bitis: formatInputDate(garanti.garanti_bitis),
      hatirlatma_gun_kala: garanti.hatirlatma_gun_kala,
      notlar: garanti.notlar
    });
    setShowGarantiModal(true);
  };

  const handleDeleteGaranti = (id) => {
    askConfirm(
      'Garanti Silme Onayı 🛡️',
      'Bu garanti kaydını silmek istediğinize emin misiniz?',
      async () => {
        try {
          await API.delete(`/garantiler/${id}`);
          showToast('Garanti kaydı silindi.');
          fetchData();
        } catch (err) {
          showToast('Garanti kaydı silinirken hata oluştu.', 'error');
        }
      }
    );
  };

  // -------------------------------------------------------------
  // RUTİN & KLASÖR İŞLEMLERİ
  // -------------------------------------------------------------
  const handleSaveKlasor = async (e) => {
    e.preventDefault();
    if (!klasorForm.klasor_adi?.trim()) {
      showToast('Lütfen Klasör Adı alanını doldurun.', 'error');
      return;
    }
    try {
      if (editingKlasor) {
        await API.put(`/rutin_klasorleri/${editingKlasor.id}`, klasorForm);
        showToast('Klasör adı güncellendi.');
      } else {
        await API.post('/rutin_klasorleri', klasorForm);
        showToast('Rutin klasörü oluşturuldu.');
      }
      setShowKlasorModal(false);
      setEditingKlasor(null);
      setKlasorForm({ klasor_adi: '' });
      fetchData();
    } catch (err) {
      showToast('Klasör kaydedilirken hata oluştu.', 'error');
    }
  };

  const handleEditKlasor = (klasor) => {
    setEditingKlasor(klasor);
    setKlasorForm({ klasor_adi: klasor.klasor_adi });
    setShowKlasorModal(true);
  };

  const handleDeleteKlasor = (id) => {
    askConfirm(
      'Klasör Silme Onayı 📂',
      'Bu klasörü sildiğinizde, içindeki TÜM rutinler de silinecektir. Devam etmek istiyor musunuz?',
      async () => {
        try {
          await API.delete(`/rutin_klasorleri/${id}`);
          showToast('Klasör ve ilişkili rutin görevler silindi.');
          if (seciliRutinKlasor === id.toString()) {
            setSeciliRutinKlasor('hepsi');
          }
          fetchData();
        } catch (err) {
          showToast('Klasör silinirken hata oluştu.', 'error');
        }
      }
    );
  };

  const handleSaveRutin = async (e) => {
    e.preventDefault();
    if (!rutinForm.gorev_adi?.trim()) {
      showToast('Lütfen Görev Adı alanını doldurun.', 'error');
      return;
    }
    const isWeeklyWithDays = (rutinForm.periyot_birim === 'hafta') && Boolean(rutinForm.secili_gunler && rutinForm.secili_gunler.trim());
    if (!rutinForm.periyot_ay && !isWeeklyWithDays) {
      showToast('Lütfen Tekrar Periyodu seçin.', 'error');
      return;
    }
    if (!rutinForm.son_yapilma_tarihi) {
      showToast('Lütfen Son Yapılma Tarihi seçin.', 'error');
      return;
    }
    const maxDays = getRutinMaxWarningDays(rutinForm);
    const hatirlatmaNum = parseInt(rutinForm.hatirlatma_gun_kala, 10) || 0;
    if (hatirlatmaNum < 0) {
      showToast('Hatırlatma gün sayısı 0 veya daha büyük bir sayı olmalıdır.', 'error');
      return;
    }
    if (hatirlatmaNum > maxDays) {
      showToast(`Hatırlatma gün sayısı periyot süresinin yarısından (en fazla ${maxDays} gün) fazla olamaz.`, 'error');
      return;
    }
    try {
      const data = {
        ...rutinForm,
        klasor_id: rutinForm.klasor_id ? parseInt(rutinForm.klasor_id, 10) : null,
        periyot_ay: isWeeklyWithDays ? 1 : (parseInt(rutinForm.periyot_ay, 10) || 1),
        periyot_birim: rutinForm.periyot_birim || 'ay',
        hatirlatma_gun_kala: parseInt(rutinForm.hatirlatma_gun_kala, 10),
        hedef_km: null,
        mevcut_km: null
      };

      if (editingRutin) {
        await API.put(`/rutinler/${editingRutin.id}`, data);
        showToast('Rutin görev güncellendi.');
      } else {
        await API.post('/rutinler', data);
        showToast('Rutin görev eklendi.');
      }
      setShowRutinModal(false);
      setEditingRutin(null);
      setRutinForm({ klasor_id: '', gorev_adi: '', periyot_ay: '', periyot_birim: 'ay', secili_gunler: '', hatirlatma_gun_kala: 0, son_yapilma_tarihi: '' });
      fetchData();
    } catch (err) {
      showToast('Rutin görev kaydedilirken hata oluştu.', 'error');
    }
  };

  const handleEditRutin = (rutin) => {
    setEditingRutin(rutin);
    setRutinForm({
      klasor_id: rutin.klasor_id || '',
      gorev_adi: rutin.gorev_adi,
      periyot_ay: rutin.periyot_ay,
      periyot_birim: rutin.periyot_birim || 'ay',
      secili_gunler: rutin.secili_gunler || '',
      hatirlatma_gun_kala: rutin.hatirlatma_gun_kala,
      son_yapilma_tarihi: formatInputDate(rutin.son_yapilma_tarihi)
    });
    setShowRutinModal(true);
  };

  const handleDeleteRutin = (id) => {
    askConfirm(
      'Rutin Görev Silme Onayı 🔁',
      'Bu rutin görevi silmek istediğinize emin misiniz?',
      async () => {
        try {
          await API.delete(`/rutinler/${id}`);
          showToast('Rutin görev silindi.');
          fetchData();
        } catch (err) {
          showToast('Rutin silinirken hata oluştu.', 'error');
        }
      }
    );
  };

  const handleCompleteRutin = async (id) => {
    try {
      await API.post(`/rutinler/${id}/done`, {});
      showToast('Rutin görev yapıldı olarak işaretlendi ve periyot sıfırlandı.');
      fetchData();
    } catch (err) {
      showToast('İşlem tamamlanırken hata oluştu.', 'error');
    }
  };

  // -------------------------------------------------------------
  // AYARLAR VE TEKNİK HİZMETLER
  // -------------------------------------------------------------
  const startEditingTelegram = useCallback(() => {
    // Profil düzenleme açıksa sıfırlayıp kapat
    setIsEditingProfile(false);
    setShowPasswordForm(false);
    if (user) {
      setProfileForm({
        isim: user.isim || '',
        eposta: user.eposta || '',
        mevcut_sifre: '',
        sifre: ''
      });
    }
    setIsEditingTelegram(true);
  }, [user]);

  const startEditingProfile = useCallback(() => {
    // Telegram düzenleme açıksa sıfırlayıp kapat
    setAyarlar(savedAyarlar);
    setIsEditingTelegram(false);
    setIsEditingProfile(true);
  }, [savedAyarlar]);

  const handleSaveAyarlar = async (e) => {
    e.preventDefault();
    try {
      await API.post('/ayarlar', ayarlar);
      setSavedAyarlar(ayarlar);
      showToast('Telegram ayarları başarıyla kaydedildi.');
      setIsEditingTelegram(false);
    } catch (err) {
      showToast('Ayarlar kaydedilemedi.', 'error');
    }
  };

  const handleTestTelegram = async () => {
    if (!ayarlar.telegram_token || !ayarlar.telegram_chat_id) {
      showToast('Lütfen önce Token ve Chat ID alanlarını doldurun.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await API.post('/send-test-telegram', ayarlar);
      if (res.data.success) {
        showToast('Telegram botunuza test mesajı gönderildi! Lütfen kontrol edin.');
      }
    } catch (err) {
      showToast(`Telegram Test Hatası: ${err.response?.data || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerDailyReport = async () => {
    if (user?.role === 'admin') {
      return handleSendAdminReport();
    }
    setLoading(true);
    try {
      const res = await API.post('/test-bildirim');
      if (res.data.success) {
        if (res.data.sent) {
          showToast(`Günlük kontrol tetiklendi. ${res.data.alertsCount} adet uyarı Telegram'a iletildi!`);
        } else if (res.data.alertsCount > 0) {
          showToast(`Kontrol tetiklendi (${res.data.alertsCount} adet uyarı bulundu), ancak Telegram Chat ID / Token ayarı yapılmadığı için gönderilemedi.`, 'error');
        } else {
          showToast('Kontrol tetiklendi. Yaklaşan veya acil uyarınız olmadığı için bildirim gönderilmedi.');
        }
      }
    } catch (err) {
      showToast(`Manuel tetikleme sırasında bir hata oluştu: ${err.response?.data?.error || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendAdminReport = async () => {
    setLoading(true);
    try {
      const res = await API.post('/admin/send-report');
      if (res.data.success) {
        showToast('Günlük Admin Özeti (Kullanıcı, Ziyaretçi, Şikayet) Telegram üzerinden gönderildi! 📊');
      } else {
        showToast(res.data.error || 'Admin raporu gönderilemedi.', 'error');
      }
    } catch (err) {
      showToast(`Admin raporu gönderilirken hata oluştu: ${err.response?.data?.error || err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };



  if (!user) {
    if (showLanding) {
      return (
        <LandingPage
          onLogin={() => navigateToAuth('login')}
          onRegister={() => navigateToAuth('register')}
        />
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0e15] p-4 relative overflow-hidden">
        {/* TOAST / BİLDİRİM BANNERLARI (Giriş & Hesap Silindi Bilgilendirmesi) */}
        {successMsg && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-md p-3.5 px-4 rounded-2xl bg-[#0f1f18]/95 border border-emerald-500/40 text-emerald-300 flex items-start justify-between gap-3 text-xs md:text-sm shadow-[0_10px_35px_rgba(16,185,129,0.3)] backdrop-blur-2xl animate-scale-in">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="font-semibold break-words leading-snug">{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg('')}
              className="text-emerald-400/60 hover:text-emerald-300 p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer flex-shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {error && (
          <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-md p-3.5 px-4 rounded-2xl bg-[#1a0f1c]/95 border border-rose-500/40 text-rose-300 flex items-start justify-between gap-3 text-xs md:text-sm shadow-[0_10px_35px_rgba(244,63,94,0.3)] backdrop-blur-2xl animate-scale-in">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 flex-shrink-0 animate-pulse mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="font-semibold break-words leading-snug">{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-400/60 hover:text-rose-300 p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer flex-shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Glow Effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/10 blur-3xl rounded-full"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-rose-600/10 blur-3xl rounded-full"></div>

        <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(168,85,247,0.15)] relative z-10">
          <button
            type="button"
            onClick={navigateToLanding}
            className="mb-6 inline-flex items-center gap-1.5 text-xs text-purple-400 hover:text-purple-300 transition-colors font-semibold cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Tanıtım Sayfasına Dön
          </button>

          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4 group">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl blur opacity-75 group-hover:opacity-100 transition duration-500"></div>
              <img
                src={logoImg}
                alt="Akıllı Yaşam Logosu"
                fetchpriority="high"
                loading="eager"
                width="80"
                height="80"
                className="relative w-20 h-20 rounded-2xl object-cover border border-purple-400/40 shadow-[0_0_30px_rgba(168,85,247,0.5)] transform transition duration-500 hover:scale-105"
              />
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Akıllı Yaşam Asistanı</h2>
            <p className="text-xs text-purple-300 font-medium mt-1">
              {authMode === 'login' ? 'Hesabınıza giriş yapın' : 'Yeni bir hesap oluşturun'}
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form noValidate onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Ad Soyad</label>
                <div className="relative">
                  <User className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    required
                    value={authForm.isim}
                    onChange={(e) => setAuthForm({ ...authForm, isim: e.target.value })}
                    className="w-full bg-[#161824] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white outline-none focus:border-purple-500 text-sm transition-all"
                    placeholder="Adınız ve Soyadınız"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">E-posta Adresi</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type="email"
                  required
                  value={authForm.eposta}
                  onChange={(e) => setAuthForm({ ...authForm, eposta: e.target.value })}
                  className="w-full bg-[#161824] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="eposta@adresiniz.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-400 mb-1">Şifre</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-500" />
                <input
                  type="password"
                  required
                  value={authForm.sifre}
                  onChange={(e) => setAuthForm({ ...authForm, sifre: e.target.value })}
                  className="w-full bg-[#161824] border border-white/10 rounded-xl py-2.5 pl-10 pr-4 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 text-white font-bold rounded-xl transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer text-sm mt-2"
            >
              {authLoading ? 'Lütfen Bekleyin...' : authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </form>

          <div className="relative my-5 flex items-center justify-center">
            <div className="border-t border-white/10 w-full"></div>
            <span className="bg-[#12141f] px-3 text-xs text-gray-400 font-medium absolute">veya</span>
          </div>

          <div className="relative w-full">
            {/* Estetik Koyu Temalı Glassmorphism Google Butonu */}
            <div className="w-full py-3 px-4 rounded-xl bg-white/[0.05] hover:bg-white/[0.09] border border-white/10 hover:border-purple-500/40 shadow-lg hover:shadow-[0_0_25px_rgba(168,85,247,0.25)] flex items-center justify-center gap-3 transition-all duration-300 group cursor-pointer">
              <svg className="w-5 h-5 transition-transform duration-300 group-hover:scale-110 flex-shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span className="text-sm font-semibold text-gray-200 group-hover:text-white transition-colors">
                Google ile {authMode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
              </span>
            </div>

            {/* Görünmez Google SDK iframe katmanı */}
            <div 
              id="googleSignInContainer" 
              className="absolute inset-0 w-full h-full opacity-[0.001] overflow-hidden cursor-pointer z-10 flex justify-center items-center scale-150"
            ></div>
          </div>

          <div className="mt-6 text-center text-xs text-gray-400">
            {authMode === 'login' ? (
              <p>
                Hesabınız yok mu?{' '}
                <button
                  type="button"
                  onClick={() => navigateToAuth('register')}
                  className="text-purple-400 font-bold hover:underline"
                >
                  Kayıt Olun
                </button>
              </p>
            ) : (
              <p>
                Zaten hesabınız var mı?{' '}
                <button
                  type="button"
                  onClick={() => navigateToAuth('login')}
                  className="text-purple-400 font-bold hover:underline"
                >
                  Giriş Yapın
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row">

      {/* MOBİL HEADER (Sadece küçük ekranlarda görünür) */}
      <header className="md:hidden mobile-header fixed top-0 left-0 right-0 z-40 border-b border-white/15 px-3.5 py-2.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <img
            src={logoImg}
            alt="Akıllı Yaşam Logo"
            fetchpriority="high"
            loading="eager"
            width="40"
            height="40"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-cover border border-purple-500/40 shadow-[0_0_14px_rgba(168,85,247,0.45)] flex-shrink-0"
          />
          <div className="min-w-0">
            <span className="text-sm sm:text-base font-bold text-white leading-tight truncate whitespace-nowrap block">Akıllı Yaşam</span>
            <p className="text-xs text-purple-300 font-medium truncate whitespace-nowrap">Ev Takip Otomasyonu</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 relative z-50">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowProfileMenu(false);
              setShowNotificationMenu(prev => !prev);
            }}
            title="Raporu Şimdi Gönder"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 active:scale-95 text-purple-400 border border-purple-500/20 transition-all cursor-pointer flex items-center justify-center flex-shrink-0"
          >
            <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowNotificationMenu(false);
              setShowProfileMenu(prev => !prev);
            }}
            title="Hesap Ayarları"
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 active:scale-95 border border-purple-500/20 text-purple-400 font-bold text-xs sm:text-sm flex items-center justify-center transition-all cursor-pointer flex-shrink-0"
          >
            {user.isim ? user.isim.charAt(0).toUpperCase() : 'U'}
          </button>
        </div>

        {/* Floating Bildirim Test Açıklama Pop-up */}
        {showNotificationMenu && (
          <>
            {/* Click-away backdrop */}
            <div
              className="fixed inset-0 z-40 bg-transparent w-screen h-screen"
              onClick={() => setShowNotificationMenu(false)}
            />

            <div className="absolute right-14 top-[72px] z-50 w-64 bg-[#13141f] border border-white/10 p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-scale-in flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-purple-400">
                <Bell className="w-4 h-4 animate-bounce" />
                <h4 className="text-xs font-bold text-white">Sistem Bildirim Testi 🔔</h4>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">
                {user?.role === 'admin'
                  ? "Sistemdeki kullanıcı, ziyaretçi ve şikayet istatistiklerini Telegram'a admin özeti olarak gönderir."
                  : "Yaklaşan tüm görevleri ve son tarihleri tarayarak Telegram'a anlık durum raporu gönderir."
                }
              </p>

              <button
                onClick={async () => {
                  setShowNotificationMenu(false);
                  await handleTriggerDailyReport();
                }}
                disabled={loading}
                className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-[0_4px_12px_rgba(168,85,247,0.2)]"
              >
                {loading ? 'Gönderiliyor...' : 'Raporu Şimdi Gönder'}
              </button>
            </div>
          </>
        )}

        {/* Floating Profil / Hesap Bilgileri Pop-up */}
        {showProfileMenu && (
          <>
            {/* Click-away backdrop (tüm ekranı kaplar ve tıklanınca kapatır) */}
            <div
              className="fixed inset-0 z-40 bg-transparent w-screen h-screen"
              onClick={() => setShowProfileMenu(false)}
            />

            <div className="absolute right-4 top-[72px] z-50 w-64 bg-[#13141f] border border-white/10 p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-scale-in flex flex-col gap-3">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/5">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                  {user.isim ? user.isim.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-none">{user.isim}</p>
                  <p className="text-xs text-gray-300 truncate mt-1">{user.eposta}</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => { changePage('ayarlar'); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-2 py-2 px-3 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all text-left"
                >
                  <Settings className="w-3.5 h-3.5 text-gray-400" />
                  Ayarlar ve Hesap Yönetimi
                </button>

                <button
                  onClick={promptLogout}
                  className="w-full flex items-center gap-2 py-2 px-3 text-xs text-rose-400 hover:bg-rose-500/10 rounded-lg transition-all text-left border border-rose-500/10"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Oturumu Kapat
                </button>
              </div>
            </div>
          </>
        )}
      </header>

      {/* SOL NAVİGASYON (Sadece desktop'ta görünür) */}
      <aside className="hidden md:flex w-64 glass-panel h-screen sticky top-0 p-5 flex-col justify-between border-r border-white/10 flex-shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="relative group flex-shrink-0">
              <div className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl blur opacity-60 group-hover:opacity-100 transition duration-500"></div>
              <img
                src={logoImg}
                alt="Akıllı Yaşam Logo"
                fetchpriority="high"
                loading="eager"
                width="44"
                height="44"
                className="relative w-11 h-11 rounded-xl object-cover border border-purple-400/40 shadow-[0_0_20px_rgba(168,85,247,0.4)] transition-transform hover:scale-105"
              />
            </div>
            <div>
              <span className="text-lg font-bold text-white tracking-tight leading-tight block">Akıllı Yaşam</span>
              <p className="text-xs text-purple-300 font-medium">Ev Takip Otomasyonu</p>
            </div>
          </div>

          <nav className="space-y-1">
            {(user?.role === 'admin' ? [
              { id: 'admin', name: 'Admin Paneli', icon: User },
              { id: 'istatistikler', name: 'Sistem İstatistikleri', icon: BarChart2 },
              { id: 'sikayetler', name: 'Şikayetler', icon: MessageSquare },
              { id: 'ayarlar', name: 'Ayarlar', icon: Settings }
            ] : [
              { id: 'dashboard', name: 'Ana Sayfa', icon: LayoutDashboard },
              { id: 'gidalar', name: 'Gıda Takibi', icon: Apple },
              { id: 'faturalar', name: 'Fatura Takibi', icon: Receipt },
              { id: 'garantiler', name: 'Garanti Takibi', icon: ShieldCheck },
              { id: 'rutinler', name: 'Rutinler', icon: RefreshCw },
              { id: 'ayarlar', name: 'Ayarlar', icon: Settings }
            ]).map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => changePage(item.id)}
                  className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200 text-left font-medium ${isActive
                    ? 'bg-purple-600/20 text-purple-300 border border-purple-500/30 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                    }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-purple-400' : 'text-gray-400'}`} />
                  {item.name}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Kullanıcı Profili ve Çıkış Yap */}
        <div className="mt-auto pt-5 border-t border-white/5 space-y-3.5">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-sm flex items-center justify-center flex-shrink-0">
              {user.isim ? user.isim.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate leading-tight">{user.isim}</p>
              <p className="text-[10px] text-gray-500 truncate mt-0.5">{user.eposta}</p>
            </div>
          </div>

          <button
            onClick={handleTriggerDailyReport}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 font-semibold text-sm transition-all duration-200 border border-purple-500/20 cursor-pointer"
          >
            <Bell className="w-4 h-4" />
            Raporu Şimdi Gönder
          </button>

          <button
            onClick={promptLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-500/20 font-semibold text-sm transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* ANA İÇERİK BÖLGESİ */}
      <main className="flex-1 p-4 pt-24 md:pt-10 md:p-10 pb-28 md:pb-10 overflow-y-auto">
        {/* TOAST / BİLDİRİM BANNERLARI (Fixed & Premium Estetik) */}
        {successMsg && (
          <div className="fixed top-24 md:top-6 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-md p-3.5 px-4 rounded-2xl bg-[#0f1f18]/95 border border-emerald-500/40 text-emerald-300 flex items-start justify-between gap-3 text-xs md:text-sm shadow-[0_10px_35px_rgba(16,185,129,0.3)] backdrop-blur-2xl animate-scale-in">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30 flex-shrink-0 mt-0.5">
                <CheckCircle className="w-4 h-4" />
              </div>
              <span className="font-semibold break-words leading-snug">{successMsg}</span>
            </div>
            <button
              onClick={() => setSuccessMsg('')}
              className="text-emerald-400/60 hover:text-emerald-300 p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer flex-shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {error && (
          <div className="fixed top-24 md:top-6 left-1/2 -translate-x-1/2 z-[99999] w-[92%] max-w-md p-3.5 px-4 rounded-2xl bg-[#1a0f1c]/95 border border-rose-500/40 text-rose-300 flex items-start justify-between gap-3 text-xs md:text-sm shadow-[0_10px_35px_rgba(244,63,94,0.3)] backdrop-blur-2xl animate-scale-in">
            <div className="flex items-start gap-3 min-w-0">
              <div className="p-1.5 bg-rose-500/20 text-rose-400 rounded-xl border border-rose-500/30 flex-shrink-0 animate-pulse mt-0.5">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <span className="font-semibold break-words leading-snug">{error}</span>
            </div>
            <button
              onClick={() => setError('')}
              className="text-rose-400/60 hover:text-rose-300 p-1 hover:bg-white/5 rounded-lg transition-colors cursor-pointer flex-shrink-0 mt-0.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: DASHBOARD
           ------------------------------------------------------------- */}
        {currentPage === 'dashboard' && (
          <div className="space-y-4 md:space-y-8">
            {/* KAPAK HERO BANNER */}
            <div className="relative overflow-hidden rounded-3xl border border-purple-500/30 p-5 md:p-7 bg-gradient-to-r from-purple-950/70 via-[#131422] to-slate-950 shadow-[0_10px_40px_rgba(168,85,247,0.15)] flex flex-col md:flex-row items-center justify-between gap-5">
              <div className="absolute top-0 right-0 w-72 h-72 bg-purple-600/15 blur-3xl rounded-full pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-72 h-72 bg-indigo-600/10 blur-3xl rounded-full pointer-events-none" />

              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-1.5">
                  <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                  Akıllı Yaşam Otomasyonu
                </div>
                <h1 className="text-xl md:text-3xl font-extrabold text-white tracking-tight">
                  Hoş Geldiniz, {user?.isim || 'Kullanıcı'} 👋
                </h1>
                <p className="text-gray-300/80 text-xs md:text-sm mt-0.5 max-w-xl">
                  Evinizin tüm gıda, fatura, garanti ve rutin takiplerini tek bir akıllı panel üzerinden kolayca yönetin.
                </p>
              </div>

              <div className="relative z-10 flex flex-row md:flex-col items-center md:items-end justify-between w-full md:w-auto border-t md:border-t-0 md:border-l border-white/10 pt-3 md:pt-0 md:pl-5 gap-2">
                <div className="text-xs font-semibold py-1.5 px-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-300">
                  📅 Bugün: {formatDate(new Date().toISOString().split('T')[0])}
                </div>
                <span className="text-[11px] text-gray-400 font-medium">Sistem Aktif & Senkronize</span>
              </div>
            </div>

            {/* İSTATİSTİK KARTLARI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6">
              {[
                {
                  title: 'Gıda Maddeleri',
                  count: summary?.gidalar?.toplam ?? 0,
                  alerts: summary?.gidalar?.uyarilar ?? 0,
                  alertText: 'SKT yaklaşan gıda',
                  icon: Apple,
                  color: 'from-amber-500/20 to-orange-500/20',
                  iconColor: 'text-amber-400',
                  iconBg: 'bg-amber-500/10 border-amber-500/20',
                  page: 'gidalar'
                },
                {
                  title: 'Faturalar',
                  count: summary?.faturalar?.toplam ?? 0,
                  alerts: summary?.faturalar?.uyarilar ?? 0,
                  extra: `${summary?.faturalar?.toplamBorc ?? 0} TL`,
                  alertText: 'Ödeme bekleyen',
                  icon: Receipt,
                  color: 'from-rose-500/20 to-red-500/20',
                  iconColor: 'text-rose-400',
                  iconBg: 'bg-rose-500/10 border-rose-500/20',
                  page: 'faturalar'
                },
                {
                  title: 'Garanti Belgeleri',
                  count: summary?.garantiler?.toplam ?? 0,
                  alerts: summary?.garantiler?.uyarilar ?? 0,
                  alertText: 'Süresi bitmek üzere',
                  icon: ShieldCheck,
                  color: 'from-cyan-500/20 to-sky-500/20',
                  iconColor: 'text-cyan-400',
                  iconBg: 'bg-cyan-500/10 border-cyan-500/20',
                  page: 'garantiler'
                },
                {
                  title: 'Rutin Görevler',
                  count: summary?.rutinler?.toplam ?? 0,
                  alerts: summary?.rutinler?.uyarilar ?? 0,
                  alertText: 'Bakımı yaklaşan',
                  icon: RefreshCw,
                  color: 'from-purple-500/20 to-indigo-500/20',
                  iconColor: 'text-purple-400',
                  iconBg: 'bg-purple-500/10 border-purple-500/20',
                  page: 'rutinler'
                }
              ].map((card, i) => {
                const CardIcon = card.icon;
                return (
                  <div
                    key={i}
                    onClick={() => changePage(card.page)}
                    className="glass-panel glass-panel-hover p-3 md:p-6 rounded-2xl cursor-pointer flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className={`absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-gradient-to-br ${card.color} opacity-40 blur-2xl rounded-full -mr-3 -mt-3 md:-mr-5 md:-mt-5`}></div>
                    <div className="flex justify-between items-start mb-2 md:mb-4">
                      <div className={`p-2 md:p-3 ${card.iconBg} rounded-xl border ${card.iconColor}`}>
                        <CardIcon className="w-4 h-4 md:w-6 md:h-6" />
                      </div>
                      {card.alerts > 0 && (
                        <span className="flex items-center gap-0.5 py-0.5 px-1.5 md:gap-1 md:py-1 md:px-2.5 rounded-full text-[10px] md:text-xs font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 animate-pulse">
                          <AlertTriangle className="w-2.5 h-2.5 md:w-3.5 md:h-3.5" />
                          {card.alerts}
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-gray-400 text-[10px] md:text-sm font-semibold uppercase tracking-wider leading-tight">{card.title}</h3>
                      <div className="flex items-baseline gap-1 mt-0.5 md:mt-1">
                        <span className="text-2xl md:text-3xl font-extrabold text-white">{card.count}</span>
                        {card.extra && <span className="text-xs md:text-lg font-bold text-gray-300 hidden sm:inline">({card.extra})</span>}
                      </div>
                      <p className="text-[10px] text-gray-500 mt-1 flex items-center gap-0.5">
                        <Info className="w-3 h-3 text-gray-600 flex-shrink-0" />
                        <span className="truncate">{card.alerts} {card.alertText}</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* ANLIK BİLDİRİMLER EKRANI / PANELİ */}
            <div className="glass-panel p-4 md:p-6 rounded-2xl border border-white/10 space-y-4 shadow-[0_10px_30px_rgba(0,0,0,0.3)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-purple-500/5 blur-3xl rounded-full pointer-events-none"></div>

              {/* Panel Başlığı ve Durum */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10 relative z-10">
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className="p-2.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-xl relative flex-shrink-0">
                    <Bell className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base md:text-lg font-bold text-white tracking-tight">Anlık Bildirimler & Acil Uyarı Ekranı 🔔</h3>
                      {activeNotifications.length > 0 ? (
                        <span className="px-2.5 py-0.5 text-xs font-extrabold bg-gradient-to-r from-rose-500/20 to-purple-500/20 text-rose-300 border border-rose-500/30 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 shadow-[0_0_12px_rgba(244,63,94,0.25)]">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                          </span>
                          {activeNotifications.length} Aktif Uyarı
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 text-xs font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-full inline-flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                          Uyarı Yok
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">Sisteminizdeki tüm yaklaşan son tarihler, ödeme bekleyen faturalar ve rutin bakımlar.</p>
                  </div>
                </div>
              </div>

              {/* 2 Sekme: Yaklaşanlar & Süresi Geçenler */}
              <div className="flex items-center gap-2 relative z-10">
                <div className="p-1 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl flex items-center gap-1 w-full sm:w-auto">
                  <button
                    onClick={() => setDashboardNotifTab('yaklasanlar')}
                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${dashboardNotifTab === 'yaklasanlar'
                      ? 'bg-purple-600 text-white border-purple-400/40 shadow-[0_2px_10px_rgba(147,51,234,0.35)]'
                      : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <span>⏰ Yaklaşanlar</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${dashboardNotifTab === 'yaklasanlar' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                      }`}>
                      {activeNotifications.filter(n => !n.isOverdue).length}
                    </span>
                  </button>

                  <button
                    onClick={() => setDashboardNotifTab('gecenler')}
                    className={`flex-1 sm:flex-initial px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer border ${dashboardNotifTab === 'gecenler'
                      ? 'bg-rose-600 text-white border-rose-400/40 shadow-[0_2px_10px_rgba(225,29,72,0.35)]'
                      : 'bg-transparent border-transparent text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                  >
                    <span>⚠️ Süresi Geçenler</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${dashboardNotifTab === 'gecenler' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                      }`}>
                      {activeNotifications.filter(n => n.isOverdue).length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Bildirim Listesi */}
              <div className="relative z-10">
                {filteredActiveNotifications.length === 0 ? (
                  <div className="p-8 text-center bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col items-center justify-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">
                        {dashboardNotifTab === 'gecenler' ? 'Süresi Geçen Uyarınız Yok 🎉' : 'Yaklaşan Uyarınız Yok 🎉'}
                      </h4>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {dashboardNotifTab === 'gecenler'
                          ? 'Günü geçen herhangi bir gıda, fatura veya bakım bulunmuyor.'
                          : 'Yaklaşan son tarihi olan herhangi bir hatırlatmanız yok.'}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filteredActiveNotifications.map((notif) => {
                      const Icon = notif.icon;
                      return (
                        <div
                          key={notif.id}
                          className={`p-3.5 rounded-xl border backdrop-blur-md transition-all flex flex-col justify-between gap-3 relative overflow-hidden group hover:border-white/20 ${notif.isOverdue
                            ? 'bg-rose-500/[0.06] border-rose-500/30'
                            : notif.isToday
                              ? 'bg-amber-500/[0.06] border-amber-500/30'
                              : 'bg-white/[0.03] border-white/10'
                            }`}
                        >
                          {/* Top Header */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <div className={`p-2 rounded-lg border flex-shrink-0 ${notif.badgeBg}`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block truncate">
                                  {notif.categoryName}
                                </span>
                                <h4 className="text-sm font-bold text-white truncate leading-tight group-hover:text-purple-300 transition-colors">
                                  {notif.title}
                                </h4>
                              </div>
                            </div>
                            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border flex-shrink-0 ${notif.badgeBg}`}>
                              {notif.badgeText}
                            </span>
                          </div>

                          {/* Detail Message */}
                          <div className="text-xs text-gray-300 font-medium bg-black/20 p-2.5 rounded-lg border border-white/5 space-y-0.5">
                            <p className="font-semibold text-gray-200">{notif.message}</p>
                            {notif.subtitle && <p className="text-[11px] text-gray-400 truncate">{notif.subtitle}</p>}
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                            <button
                              onClick={() => changePage(notif.targetPage)}
                              className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors cursor-pointer"
                            >
                              <span>Sayfaya Git</span>
                              <Info className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Telegram Hatırlatma Bilgisi */}
            {(() => {
              const isTelegramConfigured = Boolean(ayarlar.telegram_token && ayarlar.telegram_chat_id);
              return (
                <div className={`glass-panel p-6 rounded-2xl border ${isTelegramConfigured ? 'border-purple-500/30' : 'border-amber-500/20'} flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden`}>
                  <div className={`absolute top-0 right-0 w-64 h-64 ${isTelegramConfigured ? 'bg-purple-500/10' : 'bg-amber-500/5'} blur-3xl rounded-full pointer-events-none`}></div>
                  <div className="flex gap-4 relative z-10">
                    <div className={`p-3 ${isTelegramConfigured ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'} border rounded-2xl flex-shrink-0 self-start`}>
                      <Bell className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2.5 mb-1">
                        <h3 className="text-lg font-bold text-white tracking-tight">
                          {isTelegramConfigured ? 'Anlık Telegram Hatırlatıcısı Aktif' : 'Telegram Botunu Yapılandırın'}
                        </h3>
                        <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0 ${isTelegramConfigured
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isTelegramConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></span>
                          {isTelegramConfigured ? 'Bot Bağlı' : 'Yapılandırılmadı'}
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                        {isTelegramConfigured ? (
                          <>
                            Telegram botunuz bağlı ve aktif. Sistem her gün saat <span className="text-purple-300 font-semibold">{ayarlar.bildirim_saati || '09:00'}</span> TSİ'de gıdalarınızı, faturalarınızı, garantilerinizi ve rutin görevlerinizi otomatik olarak tarar. Dilerseniz <span className="hidden md:inline">sol menüdeki</span><span className="inline md:hidden">üst menüdeki</span> "Raporu Şimdi Gönder" butonuna tıklayarak istediğiniz an anlık rapor alabilirsiniz.
                          </>
                        ) : (
                          'Gıdalarınız, faturalarınız, garantileriniz ve rutin görevleriniz için Telegram üzerinden anlık bildirim almak istiyorsanız bot bilgilerinizi kolayca ekleyebilirsiniz.'
                        )}
                      </p>
                    </div>
                  </div>
                  {!isTelegramConfigured && (
                    <button
                      onClick={() => changePage('ayarlar')}
                      className="relative z-10 py-2.5 px-5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-sm font-semibold transition-all duration-200 flex-shrink-0 cursor-pointer"
                    >
                      Telegram Botu Ekle
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: GIDALAR
           ------------------------------------------------------------- */}
        {currentPage === 'gidalar' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-3xl font-bold text-white tracking-tight">Gıda Son Kullanma Takibi 🥑</h2>
                <p className="text-gray-400 mt-0.5 text-xs md:text-base hidden md:block">Gıdaların son tüketim tarihlerini kaydedin ve bozulmadan önce bildirim alın.</p>
              </div>
              <button
                onClick={() => { setEditingGida(null); setGidaForm({ urun_adi: '', kategori: '', skt: '', hatirlatma_gun_kala: 0, durum: 'bekliyor' }); setShowGidaModal(true); }}
                className="flex items-center gap-1.5 py-2 px-3 md:py-3 md:px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="p-1.5 bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-1.5 overflow-x-auto filter-tabs-scroll shadow-inner w-full min-w-0">
              {[
                { id: 'hepsi', mobileLabel: 'Tümü', label: 'Tüm Gıdalar', count: Array.isArray(gidalar) ? gidalar.length : 0 },
                { id: 'bekliyor', mobileLabel: 'Bekleyen ⏰', label: 'Bekleyenler ⏰', count: Array.isArray(gidalar) ? gidalar.filter(g => g.durum === 'bekliyor').length : 0 },
                { id: 'tuketildi', mobileLabel: 'Tüketilen ✅', label: 'Tüketilenler ✅', count: Array.isArray(gidalar) ? gidalar.filter(g => g.durum === 'tuketildi').length : 0 },
                { id: 'atildi', mobileLabel: 'Atılan 🗑️', label: 'Atılanlar 🗑️', count: Array.isArray(gidalar) ? gidalar.filter(g => g.durum === 'atildi').length : 0 }
              ].map((tab) => {
                const isActive = gidaFiltre === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setGidaFiltre(tab.id)}
                    className={`flex-1 md:flex-initial px-2.5 py-2 xs:px-3 md:px-4 md:py-2 rounded-xl text-[11px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none border ${isActive
                      ? 'bg-purple-600 text-white border-purple-400/30 shadow-[0_2px_14px_rgba(147,51,234,0.45)] font-bold scale-[1.01]'
                      : 'bg-white/[0.05] border-white/10 text-gray-300 hover:bg-purple-500/20 hover:border-purple-500/30 hover:text-purple-200'
                      }`}
                  >
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.mobileLabel}</span>
                    {tab.id === 'hepsi' && (
                      <span
                        className={`text-[9px] sm:text-[10px] md:text-xs px-1.5 py-0.5 rounded-full font-bold transition-colors ${isActive ? 'bg-white/20 text-white border border-white/20' : 'bg-white/10 text-gray-300 border border-white/5'
                          }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* GIDA KARTLARI */}
            <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
              {filteredGidalar.map((gida) => {
                const days = getDaysDiff(gida.skt);
                const statusClass = getStatusColor(days, gida.hatirlatma_gun_kala, gida.durum);
                return (
                  <div key={gida.id} className="glass-panel rounded-xl md:rounded-2xl border-white/5 relative overflow-hidden">

                    {/* MOBİL: Kompakt yatay liste görünümü */}
                    <div className="md:hidden flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-semibold text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-md">
                            {gida.kategori || 'Genel'}
                          </span>
                          <span className={`text-[10px] font-bold py-0.5 px-1.5 rounded-md border ${statusClass}`}>
                            {gida.durum === 'tuketildi' ? 'Tüketildi' : gida.durum === 'atildi' ? 'Atıldı' : days === 0 ? 'Bugün Son!' : days < 0 ? `${Math.abs(days)}g geçti` : `${days}g kaldı`}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white truncate">{gida.urun_adi}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(gida.skt)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {gida.durum === 'bekliyor' && (
                          <>
                            <button
                              onClick={() => handleUpdateGidaDurum(gida, 'tuketildi')}
                              className="p-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                              title="Tüketildi"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUpdateGidaDurum(gida, 'atildi')}
                              className="p-1.5 rounded-lg bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 border border-orange-500/20 transition-all cursor-pointer"
                              title="Atıldı / Bozuldu"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleEditGida(gida)}
                          className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 transition-all cursor-pointer"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteGida(gida.id)}
                          className="p-1.5 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-lg border border-rose-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* DESKTOP: Tam kart görünümü */}
                    <div className="hidden md:flex flex-col justify-between p-5 h-full">
                      {days !== null && days <= gida.hatirlatma_gun_kala && gida.durum === 'bekliyor' && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full"></div>
                      )}
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-semibold py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 text-purple-300">
                            {gida.kategori || 'Genel'}
                          </span>
                          <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${statusClass}`}>
                            {gida.durum === 'tuketildi' ? 'Tüketildi' : gida.durum === 'atildi' ? 'Atıldı' : days === 0 ? 'Bugün Son!' : days < 0 ? `${Math.abs(days)} Gün Geçti` : `${days} Gün Kaldı`}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{gida.urun_adi}</h3>
                        <div className="space-y-1.5 text-sm text-gray-400">
                          <div className="flex justify-between"><span>S.K.T:</span><span className="font-semibold text-gray-300">{formatDate(gida.skt)}</span></div>
                          <div className="flex justify-between"><span>Hatırlatma Limiti:</span><span className="font-semibold text-gray-300">{gida.hatirlatma_gun_kala} Gün Kala</span></div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
                        {gida.durum === 'bekliyor' && (
                          <>
                            <button onClick={() => handleUpdateGidaDurum(gida, 'tuketildi')} className="flex-1 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-semibold text-xs border border-emerald-500/20 transition-all cursor-pointer flex justify-center items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Tüketildi
                            </button>
                            <button onClick={() => handleUpdateGidaDurum(gida, 'atildi')} className="flex-1 py-2 rounded-xl bg-orange-600/10 hover:bg-orange-600/20 text-orange-400 font-semibold text-xs border border-orange-500/20 transition-all cursor-pointer flex justify-center items-center gap-1">
                              <Trash2 className="w-3.5 h-3.5" /> Atıldı
                            </button>
                          </>
                        )}
                        <button onClick={() => handleEditGida(gida)} className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all cursor-pointer">
                          <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteGida(gida.id)} className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                  </div>
                );
              })}
              {filteredGidalar.length === 0 && (
                <div className="col-span-full py-8 text-center glass-panel rounded-2xl border-white/5">
                  <p className="text-gray-500 text-sm">Gösterilecek gıda kaydı bulunmuyor.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: FATURALAR
           ------------------------------------------------------------- */}
        {currentPage === 'faturalar' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-3xl font-bold text-white tracking-tight">Fatura Takibi 💸</h2>
                <p className="text-gray-400 mt-0.5 text-xs md:text-base hidden md:block">Faturaların son ödeme tarihlerini yönetin.</p>
              </div>
              <button
                onClick={() => { setEditingFatura(null); setFaturaForm({ fatura_adi: '', tutar: '', son_odeme_tarihi: '', hatirlatma_gun_kala: 0, durum: 'odenmedi' }); setShowFaturaModal(true); }}
                className="flex items-center gap-1.5 py-2 px-3 md:py-3 md:px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="p-1.5 bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-1.5 overflow-x-auto filter-tabs-scroll shadow-inner w-full min-w-0">
              {[
                { id: 'hepsi', mobileLabel: 'Tümü', label: 'Tüm Faturalar', count: Array.isArray(faturalar) ? faturalar.length : 0 },
                { id: 'odenmedi', mobileLabel: 'Ödenmeyen 💵', label: 'Ödenmeyenler 💵', count: Array.isArray(faturalar) ? faturalar.filter(f => f.durum === 'odenmedi').length : 0 },
                { id: 'odendi', mobileLabel: 'Ödenen ✅', label: 'Ödenenler ✅', count: Array.isArray(faturalar) ? faturalar.filter(f => f.durum === 'odendi').length : 0 }
              ].map((tab) => {
                const isActive = faturaFiltre === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFaturaFiltre(tab.id)}
                    className={`flex-1 md:flex-initial px-2.5 py-2 xs:px-3 md:px-4 md:py-2 rounded-xl text-[11px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none border ${isActive
                      ? 'bg-purple-600 text-white border-purple-400/30 shadow-[0_2px_14px_rgba(147,51,234,0.45)] font-bold scale-[1.01]'
                      : 'bg-white/[0.05] border-white/10 text-gray-300 hover:bg-purple-500/20 hover:border-purple-500/30 hover:text-purple-200'
                      }`}
                  >
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.mobileLabel}</span>
                    {tab.id === 'hepsi' && (
                      <span
                        className={`text-[9px] sm:text-[10px] md:text-xs px-1.5 py-0.5 rounded-full font-bold transition-colors ${isActive ? 'bg-white/20 text-white border border-white/20' : 'bg-white/10 text-gray-300 border border-white/5'
                          }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* FATURA KARTLARI */}
            <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
              {filteredFaturalar.map((fatura) => {
                const days = getDaysDiff(fatura.son_odeme_tarihi);
                const statusClass = getStatusColor(days, fatura.hatirlatma_gun_kala, fatura.durum);
                return (
                  <div key={fatura.id} className="glass-panel rounded-xl md:rounded-2xl border-white/5 relative overflow-hidden">

                    {/* MOBİL: Kompakt yatay liste */}
                    <div className="md:hidden flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <DollarSign className="w-3 h-3 text-purple-400 flex-shrink-0" />
                          <span className="text-sm font-extrabold text-white">{fatura.tutar || 0} TL</span>
                          <span className={`text-[10px] font-bold py-0.5 px-1.5 rounded-md border ${statusClass}`}>
                            {fatura.durum === 'odendi' ? 'Ödendi' : days === 0 ? 'Bugün!' : days < 0 ? `${Math.abs(days)}g gecikti` : `${days}g kaldı`}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white truncate">{fatura.fatura_adi}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(fatura.son_odeme_tarihi)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {fatura.durum === 'odenmedi' && (
                          <button
                            onClick={() => handlePayFatura(fatura)}
                            className="p-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                            title="Ödendi"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button onClick={() => handleEditFatura(fatura)} className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 transition-all cursor-pointer">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteFatura(fatura.id)} className="p-1.5 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-lg border border-rose-500/20 transition-all cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* DESKTOP: Tam kart */}
                    <div className="hidden md:flex flex-col justify-between p-5 h-full">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-lg font-extrabold text-white flex items-center gap-1">
                            <DollarSign className="w-5 h-5 text-purple-400" />
                            {fatura.tutar || 0} <span className="text-sm font-semibold text-gray-400">TL</span>
                          </span>
                          <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${statusClass}`}>
                            {fatura.durum === 'odendi' ? 'Ödendi' : days === 0 ? 'Son Ödeme Günü!' : days < 0 ? `${Math.abs(days)} Gün Gecikti` : `${days} Gün Kaldı`}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{fatura.fatura_adi}</h3>
                        <div className="space-y-1.5 text-sm text-gray-400">
                          <div className="flex justify-between"><span>Son Ödeme Tarihi:</span><span className="font-semibold text-gray-300">{formatDate(fatura.son_odeme_tarihi)}</span></div>
                          <div className="flex justify-between"><span>Hatırlatma Limiti:</span><span className="font-semibold text-gray-300">{fatura.hatirlatma_gun_kala} Gün Kala</span></div>
                        </div>
                      </div>
                      <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
                        {fatura.durum === 'odenmedi' && (
                          <button onClick={() => handlePayFatura(fatura)} className="flex-1 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-semibold text-xs border border-emerald-500/20 transition-all cursor-pointer flex justify-center items-center gap-1.5">
                            <CheckCircle className="w-3.5 h-3.5" /> Ödendi İşaretle
                          </button>
                        )}
                        <button onClick={() => handleEditFatura(fatura)} className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all cursor-pointer"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteFatura(fatura.id)} className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>

                  </div>
                );
              })}
              {filteredFaturalar.length === 0 && (
                <div className="col-span-full py-8 text-center glass-panel rounded-2xl border-white/5">
                  <p className="text-gray-500 text-sm">Gösterilecek fatura kaydı bulunmuyor.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: GARANTİLER
           ------------------------------------------------------------- */}
        {currentPage === 'garantiler' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-3xl font-bold text-white tracking-tight">Garanti Belgeleri 🛡️</h2>
                <p className="text-gray-400 mt-0.5 text-xs md:text-base hidden md:block">Cihazlarınızın garanti sürelerini kaydedin, bitmeden önce uyarı alın.</p>
              </div>
              <button
                onClick={() => { setEditingGaranti(null); setGarantiForm({ cihaz_adi: '', marka_model: '', garanti_bitis: '', hatirlatma_gun_kala: 0, notlar: '' }); setShowGarantiModal(true); }}
                className="flex items-center gap-1.5 py-2 px-3 md:py-3 md:px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="p-1.5 bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-1.5 overflow-x-auto filter-tabs-scroll shadow-inner w-full min-w-0">
              {[
                { id: 'hepsi', mobileLabel: 'Tümü', label: 'Tüm Garantiler', count: Array.isArray(garantiler) ? garantiler.length : 0 },
                { id: 'aktif', mobileLabel: 'Devam Eden 🛡️', label: 'Devam Edenler 🛡️', count: Array.isArray(garantiler) ? garantiler.filter(g => { const d = getDaysDiff(g.garanti_bitis); return d === null || d >= 0; }).length : 0 },
                { id: 'gecen', mobileLabel: 'Süresi Dolan ⏰', label: 'Süresi Dolanlar ⏰', count: Array.isArray(garantiler) ? garantiler.filter(g => { const d = getDaysDiff(g.garanti_bitis); return d !== null && d < 0; }).length : 0 }
              ].map((tab) => {
                const isActive = garantiFiltre === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setGarantiFiltre(tab.id)}
                    className={`flex-1 md:flex-initial px-2.5 py-2 xs:px-3 md:px-4 md:py-2 rounded-xl text-[11px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer select-none border ${isActive
                      ? 'bg-purple-600 text-white border-purple-400/30 shadow-[0_2px_14px_rgba(147,51,234,0.45)] font-bold scale-[1.01]'
                      : 'bg-white/[0.05] border-white/10 text-gray-300 hover:bg-purple-500/20 hover:border-purple-500/30 hover:text-purple-200'
                      }`}
                  >
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.mobileLabel}</span>
                    {tab.id === 'hepsi' && (
                      <span
                        className={`text-[9px] sm:text-[10px] md:text-xs px-1.5 py-0.5 rounded-full font-bold transition-colors ${isActive ? 'bg-white/20 text-white border border-white/20' : 'bg-white/10 text-gray-300 border border-white/5'
                          }`}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* GARANTİ KARTLARI */}
            <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
              {filteredGarantiler.map((garanti) => {
                const days = getDaysDiff(garanti.garanti_bitis);
                const isExpired = days !== null && days < 0;
                const statusClass = getStatusColor(days, garanti.hatirlatma_gun_kala, 'bekliyor');
                return (
                  <div
                    key={garanti.id}
                    className={`glass-panel rounded-xl md:rounded-2xl border-white/5 relative overflow-hidden transition-all ${isExpired ? 'opacity-60' : ''}`}
                  >
                    {/* MOBİL: Kompakt liste */}
                    <div className="md:hidden flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs text-purple-300 font-semibold bg-purple-500/10 px-1.5 py-0.5 rounded-md truncate max-w-[100px]">{garanti.marka_model || 'Belirtilmemiş'}</span>
                          <span className={`text-[10px] font-bold py-0.5 px-1.5 rounded-md border ${statusClass}`}>
                            {days === 0 ? 'Bugün!' : isExpired ? 'Bitti' : `${days}g kaldı`}
                          </span>
                        </div>
                        <h3 className={`text-sm font-bold truncate ${isExpired ? 'line-through text-gray-400' : 'text-white'}`}>{garanti.cihaz_adi}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">{formatDate(garanti.garanti_bitis)}</p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => handleEditGaranti(garanti)} className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 transition-all cursor-pointer">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteGaranti(garanti.id)} className="p-1.5 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-lg border border-rose-500/20 transition-all cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* DESKTOP: Tam kart */}
                    <div className="hidden md:flex flex-col justify-between p-5 h-full">
                      {days !== null && days <= garanti.hatirlatma_gun_kala && !isExpired && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full"></div>
                      )}
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-semibold py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 text-purple-300">{garanti.marka_model || 'Marka Belirtilmemiş'}</span>
                          <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${statusClass}`}>
                            {days === 0 ? 'Bugün Bitiyor!' : isExpired ? 'Süresi Bitti' : `${days} Gün Kaldı`}
                          </span>
                        </div>
                        <h3 className={`text-lg font-bold text-white mb-2 ${isExpired ? 'line-through text-gray-400' : ''}`}>{garanti.cihaz_adi}</h3>
                        <div className="space-y-1.5 text-sm text-gray-400">
                          <div className="flex justify-between"><span>Garanti Bitiş Tarihi:</span><span className="font-semibold text-gray-300">{formatDate(garanti.garanti_bitis)}</span></div>
                          <div className="flex justify-between"><span>Hatırlatma Limiti:</span><span className="font-semibold text-gray-300">{garanti.hatirlatma_gun_kala} Gün Kala</span></div>
                          {garanti.notlar && (<div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400">{garanti.notlar}</div>)}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
                        <button onClick={() => handleEditGaranti(garanti)} className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs border border-white/10 transition-all cursor-pointer flex justify-center items-center gap-1.5"><Edit className="w-3.5 h-3.5" /> Düzenle</button>
                        <button onClick={() => handleDeleteGaranti(garanti.id)} className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>

                  </div>
                );
              })}
              {filteredGarantiler.length === 0 && (
                <div className="col-span-full py-8 text-center glass-panel rounded-2xl border-white/5">
                  <p className="text-gray-500 text-sm">Gösterilecek garanti kaydı bulunmuyor.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: RUTİNLER & KLASÖRLER
           ------------------------------------------------------------- */}
        {currentPage === 'rutinler' && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg md:text-3xl font-bold text-white tracking-tight">Rutin Görevler 📅</h2>
                <p className="text-gray-400 mt-0.5 text-xs md:text-base hidden md:block">Periyodik görevlerinizi klasörler altında gruplayın.</p>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setShowKlasorYonetimModal(true)}
                  className="flex items-center gap-1.5 py-2 px-2.5 md:px-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
                >
                  <FolderCog className="w-4 h-4 text-purple-400" />
                  <span className="hidden md:inline">Klasör Yönetimi</span>
                </button>
                <button
                  onClick={() => { setEditingRutin(null); setRutinForm({ klasor_id: seciliRutinKlasor === 'hepsi' ? '' : seciliRutinKlasor, gorev_adi: '', periyot_ay: '', periyot_birim: 'ay', secili_gunler: '', hatirlatma_gun_kala: 0, son_yapilma_tarihi: '' }); setShowRutinModal(true); }}
                  className="flex items-center gap-1.5 py-2 px-3 md:py-3 md:px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ekle</span>
                </button>
              </div>
            </div>

            {/* KLASÖR YÖNETİMİ & SEÇİM BARBARI */}
            <div className="p-1.5 bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl flex items-center gap-1.5 overflow-x-auto filter-tabs-scroll shadow-inner w-full min-w-0">
              <button
                onClick={() => setSeciliRutinKlasor('hepsi')}
                className={`px-2.5 py-2 sm:px-4 sm:py-2 rounded-xl text-[11px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer flex-shrink-0 select-none border ${seciliRutinKlasor === 'hepsi'
                  ? 'bg-purple-600 text-white border-purple-400/30 shadow-[0_2px_14px_rgba(147,51,234,0.45)] font-bold scale-[1.01]'
                  : 'bg-white/[0.05] border-white/10 text-gray-300 hover:bg-purple-500/20 hover:border-purple-500/30 hover:text-purple-200'
                  }`}
              >
                <span>Hepsi</span>
                <span
                  className={`text-[9px] sm:text-[10px] md:text-xs px-1.5 py-0.5 rounded-full font-bold transition-colors ${seciliRutinKlasor === 'hepsi' ? 'bg-white/20 text-white border border-white/20' : 'bg-white/10 text-gray-300 border border-white/5'
                    }`}
                >
                  {Array.isArray(rutinler) ? rutinler.length : 0}
                </span>
              </button>
              {Array.isArray(rutinKlasorleri) && rutinKlasorleri.map((klasor) => {
                if (!klasor || !klasor.id) return null;
                const isSelected = seciliRutinKlasor === klasor.id.toString();
                const count = Array.isArray(rutinler) ? rutinler.filter(r => r.klasor_id === klasor.id || r.klasor_id === klasor.id.toString()).length : 0;
                return (
                  <button
                    key={klasor.id}
                    onClick={() => setSeciliRutinKlasor(klasor.id.toString())}
                    className={`px-2.5 py-2 sm:px-4 sm:py-2 rounded-xl text-[11px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-1.5 cursor-pointer flex-shrink-0 select-none border ${isSelected
                      ? 'bg-purple-600 text-white border-purple-400/30 shadow-[0_2px_14px_rgba(147,51,234,0.45)] font-bold scale-[1.01]'
                      : 'bg-white/[0.05] border-white/10 text-gray-300 hover:bg-purple-500/20 hover:border-purple-500/30 hover:text-purple-200'
                      }`}
                  >
                    <span>{klasor.klasor_adi}</span>
                  </button>
                );
              })}
            </div>

            {/* GÖREV KARTLARI */}
            <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
              {filteredRutinler.map((rutin) => {
                if (!rutin || !rutin.id) return null;
                let nextDate = null;
                let days = null;
                let displayLastDone = 'Henüz Yapılmadı';

                if (rutin.son_yapilma_tarihi) {
                  const safeStr = typeof rutin.son_yapilma_tarihi === 'string' ? rutin.son_yapilma_tarihi.replace(' ', 'T') : rutin.son_yapilma_tarihi;
                  const inputDate = new Date(safeStr);
                  const periyot = parseInt(rutin.periyot_ay, 10) || 1;
                  if (!isNaN(inputDate.getTime()) && !isNaN(periyot)) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const compareDate = new Date(inputDate);
                    compareDate.setHours(0, 0, 0, 0);

                    if (compareDate > today) {
                      displayLastDone = 'Henüz Yapılmadı';
                      nextDate = safeStr.split('T')[0];
                      days = getDaysDiff(nextDate);
                    } else {
                      displayLastDone = formatDate(rutin.son_yapilma_tarihi);
                      const calcNext = calcNextRoutineDate(rutin.son_yapilma_tarihi, periyot, rutin.periyot_birim, rutin.secili_gunler);
                      if (!isNaN(calcNext.getTime())) {
                        try {
                          nextDate = calcNext.toISOString().split('T')[0];
                          days = getDaysDiff(nextDate);
                        } catch (e) {
                          console.error("Date formatting error:", e);
                        }
                      }
                    }
                  }
                }

                const isKmRoutine = rutin.hedef_km && rutin.mevcut_km;
                const kmKalan = isKmRoutine ? (rutin.hedef_km - rutin.mevcut_km) : null;

                let isOverdue = false;
                let isWarning = false;

                if (days !== null && days < 0) isOverdue = true;
                if (!isOverdue) {
                  if (days !== null && days <= (rutin.hatirlatma_gun_kala || 15)) isWarning = true;
                  else if (!rutin.son_yapilma_tarihi) isWarning = true;
                }

                let statusText = 'Stabil ✅';
                let statusClass = 'text-sky-400 bg-sky-500/10 border-sky-500/20';
                let glowColor = '';

                if (isOverdue) {
                  statusText = 'Gecikti! ⚠️';
                  statusClass = 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse';
                  glowColor = 'bg-rose-500/10';
                } else if (isWarning) {
                  statusText = 'Yaklaştı! ⏰';
                  statusClass = 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse';
                  glowColor = 'bg-amber-500/5';
                }

                return (
                  <div key={rutin.id} className="glass-panel rounded-xl md:rounded-2xl border-white/5 relative overflow-hidden">

                    {/* MOBİL: Kompakt liste */}
                    <div className="md:hidden flex items-center gap-3 p-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-[10px] font-semibold text-purple-300 bg-purple-500/10 px-1.5 py-0.5 rounded-md truncate max-w-[90px]">
                            📂 {rutin.klasor_adi || 'Klasörsüz'}
                          </span>
                          <span className={`text-[10px] font-bold py-0.5 px-1.5 rounded-md border ${statusClass}`}>
                            {statusText}
                          </span>
                        </div>
                        <h3 className="text-sm font-bold text-white truncate">{rutin.gorev_adi}</h3>
                        <p className="text-[10px] text-gray-500 mt-0.5">
                          {formatPeriyotText(rutin)}
                          {nextDate && days !== null && <span className="ml-1">• {days < 0 ? `${Math.abs(days)}g gecikti` : `${days}g kaldı`}</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => handleCompleteRutin(rutin.id)}
                          className="p-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 transition-all cursor-pointer"
                          title="Yapıldı"
                        >
                          <CheckCircle className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleEditRutin(rutin)} className="p-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg border border-white/10 transition-all cursor-pointer">
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDeleteRutin(rutin.id)} className="p-1.5 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-lg border border-rose-500/20 transition-all cursor-pointer">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* DESKTOP: Tam kart */}
                    <div className="hidden md:flex flex-col justify-between p-5 h-full">
                      {glowColor && (
                        <div className={`absolute top-0 right-0 w-32 h-32 ${glowColor} blur-3xl rounded-full`}></div>
                      )}
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-semibold py-1 px-2.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            📂 {rutin.klasor_adi || 'Klasörsüz'}
                          </span>
                          <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${statusClass}`}>
                            {isOverdue ? 'Bakım Gecikti! ⚠️' : isWarning ? 'Bakım Yaklaştı! ⏰' : 'Durum Stabil ✅'}
                          </span>
                        </div>
                        <h3 className="text-lg font-bold text-white mb-2">{rutin.gorev_adi}</h3>
                        <div className="space-y-1.5 text-sm text-gray-400">
                          <div className="flex justify-between"><span>Periyot:</span><span className="font-semibold text-gray-300">{formatPeriyotText(rutin)}</span></div>
                          <div className="flex justify-between"><span>Son Yapılma:</span><span className="font-semibold text-gray-300">{displayLastDone}</span></div>
                          {nextDate && (
                            <div className="flex justify-between text-xs text-purple-300 font-medium">
                              <span>Planlanan Sonraki:</span>
                              <span>{formatDate(nextDate)} (<span className={days !== null && days < 0 ? 'text-rose-400 font-bold' : ''}>{days !== null ? (days < 0 ? `${Math.abs(days)} Gün Gecikti` : `${days} gün kaldı`) : '-'}</span>)</span>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
                        <button onClick={() => handleCompleteRutin(rutin.id)} className="flex-1 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-semibold text-xs border border-emerald-500/20 transition-all cursor-pointer flex justify-center items-center gap-1.5">
                          <CheckCircle className="w-3.5 h-3.5" /> Yapıldı İşaretle
                        </button>
                        <button onClick={() => handleEditRutin(rutin)} className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all cursor-pointer"><Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDeleteRutin(rutin.id)} className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>

                  </div>
                );
              })}
              {filteredRutinler.length === 0 && (
                <div className="col-span-full py-8 text-center glass-panel rounded-2xl border-white/5">
                  <p className="text-gray-500 text-sm">Gösterilecek rutin görev bulunmuyor.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: ŞİKAYETLER & GERİ BİLDİRİMLER (ADMIN DEDICATED TAB)
           ------------------------------------------------------------- */}
        {currentPage === 'sikayetler' && user?.role === 'admin' && (
          <div className="space-y-6 w-full animate-fade-in">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Kullanıcı Destek & Geri Bildirim Merkezi
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Gelen Şikayetler & Geri Bildirimler
                </h2>
                <p className="text-gray-400 text-xs md:text-sm mt-0.5">
                  Kullanıcılardan gelen destek, istek ve bildirim mesajlarını inceleyin ve durumlarını yönetin.
                </p>
              </div>

              <button
                onClick={fetchAdminSikayetler}
                disabled={adminSikayetlerLoading}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 active:scale-95 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adminSikayetlerLoading ? 'animate-spin' : ''}`} />
                {adminSikayetlerLoading ? 'Yenileniyor...' : 'Yenile'}
              </button>
            </div>

            {/* YEKPARE BİLEŞİK İSTATİSTİK VE FİLTRE BAR SİSTEMİ (KART YERİNE SIFIR-KART TASARIM) */}
            <div className="bg-[#121421]/80 border border-white/10 rounded-2xl p-2.5 shadow-xl backdrop-blur-xl space-y-2.5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {/* Tümü */}
                <button
                  onClick={() => setAdminSikayetFilter('tum')}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer group ${adminSikayetFilter === 'tum'
                    ? 'bg-purple-600/20 border-purple-500/50 text-white shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/40'
                    : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-white/10 hover:text-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg border transition-colors ${adminSikayetFilter === 'tum' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-white/5 text-gray-400 border-white/10 group-hover:text-purple-400'
                      }`}>
                      <MessageSquare className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Toplam Bildirim</p>
                      <p className="text-[11px] text-gray-400 group-hover:text-gray-300">Tüm Kayıtlar</p>
                    </div>
                  </div>
                  <span className={`text-lg font-extrabold px-2.5 py-0.5 rounded-lg ${adminSikayetFilter === 'tum' ? 'bg-purple-500/30 text-purple-200' : 'bg-white/5 text-gray-300'
                    }`}>
                    {adminSikayetStats.toplam}
                  </span>
                </button>

                {/* Bekleyenler */}
                <button
                  onClick={() => setAdminSikayetFilter('bekliyor')}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer group ${adminSikayetFilter === 'bekliyor'
                    ? 'bg-amber-500/20 border-amber-500/50 text-white shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/40'
                    : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-white/10 hover:text-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg border transition-colors ${adminSikayetFilter === 'bekliyor' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-white/5 text-gray-400 border-white/10 group-hover:text-amber-400'
                      }`}>
                      <Inbox className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Bekleyenler</p>
                      <p className="text-[11px] text-amber-400/80">İncelenmesi Gereken</p>
                    </div>
                  </div>
                  <span className={`text-lg font-extrabold px-2.5 py-0.5 rounded-lg ${adminSikayetFilter === 'bekliyor' ? 'bg-amber-500/30 text-amber-200' : 'bg-white/5 text-amber-400'
                    }`}>
                    {adminSikayetStats.bekliyor}
                  </span>
                </button>

                {/* İncelenenler */}
                <button
                  onClick={() => setAdminSikayetFilter('incelendi')}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer group ${adminSikayetFilter === 'incelendi'
                    ? 'bg-sky-500/20 border-sky-500/50 text-white shadow-lg shadow-sky-500/10 ring-1 ring-sky-500/40'
                    : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-white/10 hover:text-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg border transition-colors ${adminSikayetFilter === 'incelendi' ? 'bg-sky-500/20 text-sky-300 border-sky-500/30' : 'bg-white/5 text-gray-400 border-white/10 group-hover:text-sky-400'
                      }`}>
                      <Clock className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">İncelenenler</p>
                      <p className="text-[11px] text-sky-400/80">İşlemdeki Bildirimler</p>
                    </div>
                  </div>
                  <span className={`text-lg font-extrabold px-2.5 py-0.5 rounded-lg ${adminSikayetFilter === 'incelendi' ? 'bg-sky-500/30 text-sky-200' : 'bg-white/5 text-sky-400'
                    }`}>
                    {adminSikayetStats.incelendi}
                  </span>
                </button>

                {/* Çözülenler */}
                <button
                  onClick={() => setAdminSikayetFilter('cozuldu')}
                  className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 text-left cursor-pointer group ${adminSikayetFilter === 'cozuldu'
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-white shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/40'
                    : 'bg-white/[0.02] border-white/5 text-gray-400 hover:bg-white/[0.05] hover:border-white/10 hover:text-gray-200'
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-lg border transition-colors ${adminSikayetFilter === 'cozuldu' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-white/5 text-gray-400 border-white/10 group-hover:text-emerald-400'
                      }`}>
                      <CheckCircle className="w-4 h-4" />
                    </div>
                    <div className="truncate">
                      <p className="text-[11px] font-bold uppercase tracking-wider opacity-80">Çözülenler</p>
                      <p className="text-[11px] text-emerald-400/80">Tamamlananlar</p>
                    </div>
                  </div>
                  <span className={`text-lg font-extrabold px-2.5 py-0.5 rounded-lg ${adminSikayetFilter === 'cozuldu' ? 'bg-emerald-500/30 text-emerald-200' : 'bg-white/5 text-emerald-400'
                    }`}>
                    {adminSikayetStats.cozuldu}
                  </span>
                </button>
              </div>

              {/* VISUAL STATUS DISTRIBUTION PROGRESS BAR */}
              {adminSikayetStats.toplam > 0 && (
                <div className="px-1 space-y-1">
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden flex gap-0.5">
                    {adminSikayetStats.bekliyor > 0 && (
                      <div
                        style={{ width: `${(adminSikayetStats.bekliyor / adminSikayetStats.toplam) * 100}%` }}
                        className="h-full bg-amber-400 transition-all duration-500"
                        title={`Bekleyen: ${adminSikayetStats.bekliyor}`}
                      />
                    )}
                    {adminSikayetStats.incelendi > 0 && (
                      <div
                        style={{ width: `${(adminSikayetStats.incelendi / adminSikayetStats.toplam) * 100}%` }}
                        className="h-full bg-sky-400 transition-all duration-500"
                        title={`İncelenen: ${adminSikayetStats.incelendi}`}
                      />
                    )}
                    {adminSikayetStats.cozuldu > 0 && (
                      <div
                        style={{ width: `${(adminSikayetStats.cozuldu / adminSikayetStats.toplam) * 100}%` }}
                        className="h-full bg-emerald-400 transition-all duration-500"
                        title={`Çözülen: ${adminSikayetStats.cozuldu}`}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* TABLO CONTAINER */}
            <div className="glass-panel rounded-3xl border border-white/10 overflow-visible shadow-2xl space-y-4">
              <div className="p-5 md:p-6 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base md:text-lg font-bold text-white flex items-center gap-2">
                    <span>Şikayet Listesi ve Detaylar</span>
                    <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
                      {adminSikayetFilter === 'tum' && 'Tüm Bildirimler'}
                      {adminSikayetFilter === 'bekliyor' && 'Bekleyen Bildirimler'}
                      {adminSikayetFilter === 'incelendi' && 'İşlemdeki Bildirimler'}
                      {adminSikayetFilter === 'cozuldu' && 'Çözülen Bildirimler'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">Tüm bildirimleri durumlarına göre yukarıdaki sekmelerden filtreleyerek inceleyebilirsiniz.</p>
                </div>
              </div>

              <div className="overflow-x-auto pb-36 min-h-[340px]">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="px-6 py-4 font-semibold">ID</th>
                      <th className="px-6 py-4 font-semibold">Gönderen Kullanıcı</th>
                      <th className="px-6 py-4 font-semibold">Başlık & Mesaj Detayı</th>
                      <th className="px-6 py-4 font-semibold">Durum</th>
                      <th className="px-6 py-4 font-semibold">Tarih</th>
                      <th className="px-6 py-4 font-semibold text-right">Durum Değiştir / İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {adminSikayetlerLoading ? (
                      <tr>
                        <td colSpan="6" className="px-6 py-10 text-center text-gray-400 font-medium">Şikayetler yükleniyor...</td>
                      </tr>
                    ) : (() => {
                      const filteredList = adminSikayetler.filter((s) => {
                        if (adminSikayetFilter === 'tum') return true;
                        return s.durum === adminSikayetFilter;
                      });

                      if (filteredList.length === 0) {
                        return (
                          <tr>
                            <td colSpan="6" className="px-6 py-10 text-center text-gray-500 font-medium">
                              Henüz bildirilen şikayet veya geri bildirim bulunmuyor.
                            </td>
                          </tr>
                        );
                      }

                      return filteredList.map((s) => {
                        const statusBadge =
                          s.durum === 'cozuldu'
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            : s.durum === 'incelendi'
                              ? 'bg-sky-500/10 text-sky-400 border-sky-500/20'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

                        const statusText =
                          s.durum === 'cozuldu'
                            ? 'Çözüldü'
                            : s.durum === 'incelendi'
                              ? 'İncelendi'
                              : 'Bekliyor';
                        return (
                          <tr key={`sikayet-tab-${s.id}`} className="hover:bg-white/[0.02] transition-colors">
                            <td className="px-6 py-4 font-mono text-xs text-gray-400">#{s.id}</td>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-white">{s.kullanici_isim || 'Kullanıcı'}</div>
                              <div className="text-xs text-gray-400">{s.kullanici_eposta}</div>
                            </td>
                            <td className="px-6 py-4 max-w-md">
                              <div className="font-bold text-white mb-1">{s.baslik}</div>
                              <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">{s.mesaj}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge}`}>
                                {statusText}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-xs text-gray-400 whitespace-nowrap">
                              {s.olusturma_tarihi ? formatDate(s.olusturma_tarihi) : '-'}
                            </td>
                            <td className="px-6 py-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-2">
                                <div className="relative inline-block text-left sikayet-dropdown-container">
                                  <button
                                    type="button"
                                    onClick={() => setOpenSikayetDropdownId(openSikayetDropdownId === s.id ? null : s.id)}
                                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border inline-flex items-center gap-1.5 transition-all cursor-pointer shadow-sm ${s.durum === 'bekliyor'
                                      ? 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 ring-1 ring-amber-500/20'
                                      : s.durum === 'incelendi'
                                        ? 'bg-sky-500/15 text-sky-300 border-sky-500/30 hover:bg-sky-500/25 ring-1 ring-sky-500/20'
                                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25 ring-1 ring-emerald-500/20'
                                      }`}
                                  >
                                    <span>
                                      {s.durum === 'bekliyor' && 'Bekliyor'}
                                      {s.durum === 'incelendi' && 'İncelendi'}
                                      {s.durum === 'cozuldu' && 'Çözüldü'}
                                    </span>
                                    <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${openSikayetDropdownId === s.id ? 'rotate-180' : ''}`} />
                                  </button>

                                  {openSikayetDropdownId === s.id && (
                                    <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-[#161828] border border-white/15 rounded-xl shadow-2xl p-1 animate-scale-in space-y-0.5 origin-top-right">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateSikayetDurum(s.id, 'bekliyor');
                                          setOpenSikayetDropdownId(null);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-left ${s.durum === 'bekliyor'
                                          ? 'bg-amber-500/20 text-amber-300'
                                          : 'text-gray-300 hover:bg-amber-500/10 hover:text-amber-300'
                                          }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                                          Bekliyor
                                        </div>
                                        {s.durum === 'bekliyor' && <Check className="w-3.5 h-3.5 text-amber-300" />}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateSikayetDurum(s.id, 'incelendi');
                                          setOpenSikayetDropdownId(null);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-left ${s.durum === 'incelendi'
                                          ? 'bg-sky-500/20 text-sky-300'
                                          : 'text-gray-300 hover:bg-sky-500/10 hover:text-sky-300'
                                          }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-sky-400" />
                                          İncelendi
                                        </div>
                                        {s.durum === 'incelendi' && <Check className="w-3.5 h-3.5 text-sky-300" />}
                                      </button>

                                      <button
                                        type="button"
                                        onClick={() => {
                                          handleUpdateSikayetDurum(s.id, 'cozuldu');
                                          setOpenSikayetDropdownId(null);
                                        }}
                                        className={`w-full flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer text-left ${s.durum === 'cozuldu'
                                          ? 'bg-emerald-500/20 text-emerald-300'
                                          : 'bg-white/5 text-gray-300 hover:bg-emerald-500/10 hover:text-emerald-300'
                                          }`}
                                      >
                                        <div className="flex items-center gap-2">
                                          <span className="w-2 h-2 rounded-full bg-emerald-400" />
                                          Çözüldü
                                        </div>
                                        {s.durum === 'cozuldu' && <Check className="w-3.5 h-3.5 text-emerald-300" />}
                                      </button>
                                    </div>
                                  )}
                                </div>

                                <button
                                  onClick={() => handleDeleteSikayet(s.id)}
                                  className="px-3.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-xs font-semibold transition-all cursor-pointer"
                                >
                                  Sil
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: AYARLAR
           ------------------------------------------------------------- */}
        {currentPage === 'ayarlar' && (
          <div className="space-y-4 md:space-y-6 w-full animate-fade-in">
            <div>
              <h2 className="text-lg md:text-3xl font-bold text-white tracking-tight">Sistem Ayarları ⚙️</h2>
              <p className="text-xs md:text-sm text-gray-400 mt-0.5">Telegram bot entegrasyonu ve kontrol tetikleyicileri.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6 items-start">
              {/* SOL KOLON: Bot & Hesap Ayarları */}
              <div className="space-y-4 md:space-y-6">
                {/* Telegram Bot Ayarları */}
                <div className="glass-panel p-4 md:p-6 rounded-2xl border-white/5">
                  <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
                    <h3 className="text-sm md:text-lg font-bold text-white flex items-center gap-2 min-w-0">
                      <Bell className="w-4 h-4 md:w-5 md:h-5 text-purple-400 flex-shrink-0" />
                      <span className="whitespace-nowrap">Telegram Bildirimleri</span>
                    </h3>
                    {Boolean(ayarlar.telegram_token || ayarlar.telegram_chat_id) && (
                      <span className={`text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full border flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 ${isEditingTelegram
                        ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                        : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                        }`}>
                        {isEditingTelegram ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            Düzenleme Modu
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-emerald-400" />
                            Bilgiler Kilitli
                          </>
                        )}
                      </span>
                    )}
                  </div>

                  <form noValidate onSubmit={handleSaveAyarlar} className="space-y-3.5">
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs md:text-sm font-semibold text-gray-300">Telegram Bot Token</label>
                        {!isEditingTelegram && Boolean(ayarlar.telegram_token) && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-purple-400" /> Kilitli
                          </span>
                        )}
                      </div>
                      <input
                        type="password"
                        disabled={!isEditingTelegram}
                        placeholder="Botunuzun Token Kodu (örn: 123456:ABC-DEF...)"
                        value={ayarlar.telegram_token}
                        onChange={(e) => setAyarlar({ ...ayarlar, telegram_token: e.target.value })}
                        className={`w-full border rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none transition-all ${!isEditingTelegram
                          ? 'bg-white/[0.02] border-white/5 text-gray-400 cursor-not-allowed opacity-75 select-none'
                          : 'bg-white/5 border-white/10 focus:border-purple-500'
                          }`}
                      />
                      <p className="text-[10px] text-gray-500 mt-0.5">@BotFather üzerinden aldığınız token.</p>
                    </div>

                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs md:text-sm font-semibold text-gray-300">Telegram Chat ID</label>
                        {!isEditingTelegram && Boolean(ayarlar.telegram_chat_id) && (
                          <span className="text-[10px] text-gray-500 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-purple-400" /> Kilitli
                          </span>
                        )}
                      </div>
                      <input
                        type="text"
                        disabled={!isEditingTelegram}
                        placeholder="Alıcı Sohbet/Grup ID (örn: 987654321)"
                        value={ayarlar.telegram_chat_id}
                        onChange={(e) => setAyarlar({ ...ayarlar, telegram_chat_id: e.target.value })}
                        className={`w-full border rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none transition-all ${!isEditingTelegram
                          ? 'bg-white/[0.02] border-white/5 text-gray-400 cursor-not-allowed opacity-75 select-none'
                          : 'bg-white/5 border-white/10 focus:border-purple-500'
                          }`}
                      />
                      <p className="text-[10px] text-gray-500 mt-0.5">Kişisel veya grup sohbet kimliğiniz (Chat ID).</p>
                    </div>

                    {user?.role === 'admin' ? (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs md:text-sm font-semibold text-gray-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                            Yönetici Günlük Özet Rapor Saati (TSİ)
                          </label>
                          {!isEditingTelegram && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-purple-400" /> Kilitli
                            </span>
                          )}
                        </div>
                        <TimePicker
                          disabled={!isEditingTelegram}
                          value={ayarlar.admin_bildirim_saati || '09:00'}
                          onChange={(newTime) => setAyarlar({ ...ayarlar, admin_bildirim_saati: newTime })}
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">Sistem istatistikleri, yeni kayıtlar ve şikayet özetinin yöneticiye gönderileceği saat.</p>
                      </div>
                    ) : (
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs md:text-sm font-semibold text-gray-300 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-purple-400" />
                            Otomatik Bildirim Saati (TSİ)
                          </label>
                          {!isEditingTelegram && (
                            <span className="text-[10px] text-gray-500 flex items-center gap-1">
                              <Lock className="w-3 h-3 text-purple-400" /> Kilitli
                            </span>
                          )}
                        </div>
                        <TimePicker
                          disabled={!isEditingTelegram}
                          value={ayarlar.bildirim_saati || '09:00'}
                          onChange={(newTime) => setAyarlar({ ...ayarlar, bildirim_saati: newTime })}
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">Her gün kişisel ev takibi özet bildiriminizin size gönderileceği saat.</p>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {!isEditingTelegram ? (
                        <>
                          <button
                            type="button"
                            onClick={startEditingTelegram}
                            className="flex-1 py-2 md:py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center flex items-center justify-center gap-2 glow-btn"
                          >
                            <Edit className="w-4 h-4" />
                            Bilgileri Düzenle
                          </button>
                          {Boolean(ayarlar.telegram_token && ayarlar.telegram_chat_id) && (
                            <button
                              type="button"
                              onClick={handleTestTelegram}
                              disabled={loading}
                              className="w-full sm:w-48 py-2 md:py-2.5 px-4 bg-white/5 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed border border-white/10 text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 flex-shrink-0"
                            >
                              <Send className="w-3.5 h-3.5 text-purple-400" />
                              Bağlantıyı Test Et
                            </button>
                          )}
                        </>
                      ) : (
                        <>
                          {(() => {
                            const isTelegramChanged = ayarlar.telegram_token !== savedAyarlar.telegram_token || ayarlar.telegram_chat_id !== savedAyarlar.telegram_chat_id || ayarlar.bildirim_saati !== savedAyarlar.bildirim_saati || ayarlar.admin_bildirim_saati !== savedAyarlar.admin_bildirim_saati;
                            return (
                              <button
                                type="submit"
                                disabled={!isTelegramChanged || loading}
                                className="flex-1 py-2 md:py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:shadow-none text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center glow-btn flex items-center justify-center gap-2"
                              >
                                <CheckCircle className="w-4 h-4" />
                                Ayarları Kaydet
                              </button>
                            );
                          })()}
                          {Boolean(ayarlar.telegram_token || ayarlar.telegram_chat_id) && (
                            <button
                              type="button"
                              onClick={() => {
                                setAyarlar(savedAyarlar);
                                setIsEditingTelegram(false);
                              }}
                              className="w-full sm:w-48 py-2 md:py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 flex-shrink-0"
                            >
                              Vazgeç
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </form>

                  {/* Telegram Botu Kurulum Rehberi Bilgi Notu (Açılır Kapanır Accordion) */}
                  <div className="mt-5 pt-4 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowTelegramGuide((prev) => !prev)}
                      className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group py-1"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:bg-purple-500/20 transition-all flex-shrink-0">
                          <Info className="w-4 h-4" />
                        </div>
                        <h4 className="text-xs md:text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                          Telegram Botu Nasıl Oluşturulur ve Eklenir?
                        </h4>
                      </div>
                      <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0">
                        <span className="text-[10px] font-medium hidden sm:inline text-purple-400">
                          {showTelegramGuide ? 'Gizle' : 'Rehberi Göster'}
                        </span>
                        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showTelegramGuide ? 'rotate-180 text-purple-400' : ''}`} />
                      </div>
                    </button>

                    {showTelegramGuide && (
                      <div className="mt-3 bg-purple-500/[0.04] border border-purple-500/15 rounded-xl p-3.5 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                        <div className="flex items-start gap-2.5 text-xs text-gray-300">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px] flex items-center justify-center mt-0.5">1</span>
                          <span>Telegram uygulamasında <code className="bg-white/10 px-1.5 py-0.5 rounded text-purple-300 font-mono text-[11px]">@BotFather</code> kullanıcısını aratın ve sohbet başlatın.</span>
                        </div>

                        <div className="flex items-start gap-2.5 text-xs text-gray-300">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px] flex items-center justify-center mt-0.5">2</span>
                          <span><code className="bg-white/10 px-1.5 py-0.5 rounded text-purple-300 font-mono text-[11px]">/newbot</code> komutunu gönderip talimatları izleyerek yeni bot oluşturun. Size verilen <b>API Token</b> kodunu yukarıdaki <b>Telegram Bot Token</b> alanına yapıştırın.</span>
                        </div>

                        <div className="flex items-start gap-2.5 text-xs text-gray-300">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px] flex items-center justify-center mt-0.5">3</span>
                          <span>Telegram'da <code className="bg-white/10 px-1.5 py-0.5 rounded text-purple-300 font-mono text-[11px]">@userinfobot</code> hesabına mesaj atarak <b>Chat ID</b> sayısal kimliğinizi öğrenin ve yukarıdaki <b>Telegram Chat ID</b> alanına yazın.</span>
                        </div>

                        <div className="flex items-start gap-2.5 text-xs text-gray-300">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px] flex items-center justify-center mt-0.5">4</span>
                          <span>Oluşturduğunuz kendi botunuza Telegram'dan en az 1 kez <code className="bg-white/10 px-1.5 py-0.5 rounded text-purple-300 font-mono text-[11px]">/start</code> mesajı attıktan sonra <b>"Bağlantıyı Test Et"</b> butonuna tıklayarak kurulumu doğrulayın.</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Hesap Yönetimi (Mobil & Genel) */}
                <div className="glass-panel p-4 md:p-6 rounded-2xl border-white/5">
                  <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
                    <h3 className="text-sm md:text-lg font-bold text-white flex items-center gap-2 min-w-0">
                      <User className="w-4 h-4 md:w-5 md:h-5 text-purple-400 flex-shrink-0" />
                      <span>Hesap Yönetimi</span>
                    </h3>
                    {!isEditingProfile && (
                      <span className="text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full border bg-emerald-500/10 text-emerald-300 border-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
                        <Lock className="w-3 h-3 text-emerald-400" />
                        Bilgiler Kilitli
                      </span>
                    )}
                  </div>

                  <form noValidate onSubmit={handleUpdateProfile} className="space-y-3.5">
                    <div>
                      <label className="block text-xs md:text-sm font-semibold text-gray-300 mb-1">Ad Soyad</label>
                      <input
                        type="text"
                        required
                        disabled={!isEditingProfile}
                        value={profileForm.isim}
                        onChange={(e) => setProfileForm({ ...profileForm, isim: e.target.value })}
                        className={`w-full border rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none transition-all ${!isEditingProfile
                          ? 'bg-white/[0.02] border-white/5 text-gray-400 cursor-not-allowed opacity-75 select-none'
                          : 'bg-white/5 border-white/10 focus:border-purple-500'
                          }`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs md:text-sm font-semibold text-gray-300 mb-1">E-posta Adresi</label>
                      <input
                        type="email"
                        required
                        disabled={!isEditingProfile}
                        value={profileForm.eposta}
                        onChange={(e) => setProfileForm({ ...profileForm, eposta: e.target.value })}
                        className={`w-full border rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none transition-all ${!isEditingProfile
                          ? 'bg-white/[0.02] border-white/5 text-gray-400 cursor-not-allowed opacity-75 select-none'
                          : 'bg-white/5 border-white/10 focus:border-purple-500'
                          }`}
                      />
                    </div>

                    {/* Şifre Değiştirme Butonu & Alanları */}
                    {!showPasswordForm ? (
                      <button
                        type="button"
                        onClick={() => {
                          startEditingProfile();
                          setShowPasswordForm(true);
                        }}
                        className="py-2 px-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5"
                      >
                        <Lock className="w-3.5 h-3.5 text-purple-400" />
                        Şifre Değiştir
                      </button>
                    ) : (
                      <div className="p-3.5 rounded-xl bg-black/20 border border-white/5 space-y-3 animate-fade-in relative">
                        <button
                          type="button"
                          onClick={() => {
                            setShowPasswordForm(false);
                            setProfileForm(prev => ({ ...prev, mevcut_sifre: '', sifre: '' }));
                          }}
                          className="absolute right-3 top-3 text-[10px] text-gray-500 hover:text-gray-400 font-semibold cursor-pointer"
                        >
                          İptal Et
                        </button>
                        <h4 className="text-xs font-bold text-purple-300 flex items-center gap-1">
                          <Lock className="w-3.5 h-3.5" /> Güvenli Şifre Değişimi
                        </h4>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1 font-semibold">Mevcut Şifre *</label>
                          <input
                            type="password"
                            required={showPasswordForm}
                            placeholder="Mevcut şifreniz"
                            value={profileForm.mevcut_sifre}
                            onChange={(e) => setProfileForm({ ...profileForm, mevcut_sifre: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-xs outline-none focus:border-purple-500 transition-all"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-400 mb-1 font-semibold">Yeni Şifre *</label>
                          <input
                            type="password"
                            required={showPasswordForm}
                            placeholder="En az 6 karakter girin"
                            value={profileForm.sifre}
                            onChange={(e) => setProfileForm({ ...profileForm, sifre: e.target.value })}
                            className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-white text-xs outline-none focus:border-purple-500 transition-all"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 pt-1">
                      {!isEditingProfile ? (
                        <>
                          <button
                            type="button"
                            onClick={startEditingProfile}
                            className="flex-1 py-2 md:py-2.5 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center flex items-center justify-center gap-2 glow-btn"
                          >
                            <Edit className="w-4 h-4" />
                            Bilgileri Düzenle
                          </button>
                          <button
                            type="button"
                            onClick={promptLogout}
                            className="w-full sm:w-48 py-2 md:py-2.5 px-4 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-500/20 font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 flex-shrink-0"
                          >
                            <LogOut className="w-3.5 h-3.5 text-rose-400" />
                            Oturumu Kapat
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="submit"
                            disabled={
                              profileLoading ||
                              (!(showPasswordForm && profileForm.mevcut_sifre !== '' && profileForm.sifre !== '') &&
                                profileForm.isim === (user?.isim || '') &&
                                profileForm.eposta === (user?.eposta || ''))
                            }
                            className="flex-1 py-2 md:py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center glow-btn flex items-center justify-center gap-2"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {profileLoading ? 'Güncelleniyor...' : 'Bilgileri Güncelle'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setProfileForm({
                                isim: user?.isim || '',
                                eposta: user?.eposta || '',
                                mevcut_sifre: '',
                                sifre: ''
                              });
                              setShowPasswordForm(false);
                              setIsEditingProfile(false);
                            }}
                            className="w-full sm:w-48 py-2 md:py-2.5 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center flex items-center justify-center gap-1.5 flex-shrink-0"
                          >
                            Vazgeç
                          </button>
                        </>
                      )}
                    </div>
                  </form>
                </div>

                {/* Tehlikeli Bölge / Hesabı Sil (Sadece Masaüstünde Sol Kolonda Görünür) */}
                <div className="hidden lg:block glass-panel p-4 md:p-6 rounded-2xl border border-rose-500/20 bg-rose-500/[0.02]">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h3 className="text-sm md:text-lg font-bold text-white">Hesabı Sil</h3>
                  </div>
                  <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                    Hesabınızı ve hesabınıza bağlı tüm gıda, fatura, garanti ve rutin görev verilerini kalıcı olarak siler. Bu işlem geri alınamaz.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowDeleteAccountModal(true)}
                    className="w-full sm:w-auto py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-500 text-rose-300 hover:text-white font-semibold rounded-xl text-xs md:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Hesabımı Kalıcı Olarak Sil
                  </button>
                </div>
              </div>

              {/* SAĞ KOLON: Şikayet & Geri Bildirim (Sadece Admin Olmayan Normal Kullanıcılar Görebilir) */}
              {user?.role !== 'admin' && (
                <div>
                  {/* Şikayet ve Geri Bildirim Bildirme Kartı */}
                  <div className="glass-panel p-4 md:p-6 rounded-2xl border-white/5">
                    {/* Header: Telegram Bildirimleri ile birebir aynı yapıda */}
                    <div className="flex items-center justify-between gap-2 mb-3 md:mb-4">
                      <h3 className="text-sm md:text-lg font-bold text-white flex items-center gap-2 min-w-0">
                        <MessageSquare className="w-4 h-4 md:w-5 md:h-5 text-purple-400 flex-shrink-0" />
                        <span className="whitespace-nowrap">Şikayet & Geri Bildirim</span>
                      </h3>
                      <span className="text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full border bg-amber-500/10 text-amber-300 border-amber-500/20 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0">
                        <Send className="w-3 h-3 text-amber-400" />
                        Canlı Destek
                      </span>
                    </div>

                    <form noValidate onSubmit={handleSendSikayet} className="space-y-3.5">
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs md:text-sm font-semibold text-gray-300">Konu / Başlık *</label>
                        </div>
                        <input
                          type="text"
                          required
                          placeholder="örn: Bildirim saati uyarısı, Sayfa açılış hatası vb."
                          value={sikayetForm.baslik}
                          onChange={(e) => setSikayetForm({ ...sikayetForm, baslik: e.target.value })}
                          className="w-full border rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none transition-all bg-white/5 border-white/10 focus:border-purple-500"
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">Yöneticilere iletmek istediğiniz ana konuyu yazın.</p>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-xs md:text-sm font-semibold text-gray-300">Detaylı Açıklama *</label>
                        </div>
                        <textarea
                          required
                          rows={6}
                          placeholder="Karşılaştığınız durumu veya geliştirilmesini istediğiniz özelliği detaylıca açıklayınız..."
                          value={sikayetForm.mesaj}
                          onChange={(e) => setSikayetForm({ ...sikayetForm, mesaj: e.target.value })}
                          className="w-full border rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none transition-all bg-white/5 border-white/10 focus:border-purple-500 resize-y h-[146px] min-h-[146px]"
                        />
                        <p className="text-[10px] text-gray-500 mt-0.5">Sorunu veya talebinizi ayrıntılı olarak açıklayın.</p>
                      </div>

                      <div className="pt-1">
                        <button
                          type="submit"
                          disabled={sikayetLoading || !sikayetForm.baslik.trim() || !sikayetForm.mesaj.trim()}
                          className="w-full py-2 md:py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer flex items-center justify-center gap-2 glow-btn"
                        >
                          <Send className="w-4 h-4" />
                          {sikayetLoading ? 'Gönderiliyor...' : 'Yöneticilere İlet'}
                        </button>
                      </div>
                    </form>

                    {/* Telegram Rehberi ile Birebir Uyumlu Açılır Kapanır Accordion */}
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => setShowSikayetGuide((prev) => !prev)}
                        className="w-full flex items-center justify-between gap-2 text-left cursor-pointer group py-1"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20 group-hover:bg-purple-500/20 transition-all flex-shrink-0">
                            <Info className="w-4 h-4" />
                          </div>
                          <h4 className="text-xs md:text-sm font-bold text-white group-hover:text-purple-300 transition-colors truncate">
                            Geri Bildirim Süreci Nasıl İşler?
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5 text-gray-400 group-hover:text-white transition-colors flex-shrink-0">
                          <span className="text-[10px] font-medium hidden sm:inline text-purple-400">
                            {showSikayetGuide ? 'Gizle' : 'Rehberi Göster'}
                          </span>
                          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${showSikayetGuide ? 'rotate-180 text-purple-400' : ''}`} />
                        </div>
                      </button>

                      {showSikayetGuide && (
                        <div className="mt-3 bg-purple-500/[0.04] border border-purple-500/15 rounded-xl p-3.5 space-y-2.5 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="flex items-center gap-2.5 text-xs text-gray-300">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px] flex items-center justify-center">1</span>
                            <span>Gönderdiğiniz tüm mesajlar doğrudan sistem yönetici paneline anlık düşer.</span>
                          </div>

                          <div className="flex items-center gap-2.5 text-xs text-gray-300">
                            <span className="flex-shrink-0 w-5 h-5 rounded-full bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold text-[10px] flex items-center justify-center">2</span>
                            <span>Geliştirme ve hata düzeltme talepleri yöneticiler tarafından öncelikle değerlendirilir.</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tehlikeli Bölge / Hesabı Sil (Sadece Mobil Görünümde En Altta Görünür) */}
            <div className="block lg:hidden glass-panel p-4 md:p-6 rounded-2xl border border-rose-500/20 bg-rose-500/[0.02]">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h3 className="text-sm md:text-lg font-bold text-white">Hesabı Sil</h3>
              </div>
              <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                Hesabınızı ve hesabınıza bağlı tüm gıda, fatura, garanti ve rutin görev verilerini kalıcı olarak siler. Bu işlem geri alınamaz.
              </p>
              <button
                type="button"
                onClick={() => setShowDeleteAccountModal(true)}
                className="w-full sm:w-auto py-2.5 px-4 bg-rose-600/20 hover:bg-rose-600 border border-rose-500/30 hover:border-rose-500 text-rose-300 hover:text-white font-semibold rounded-xl text-xs md:text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Hesabımı Kalıcı Olarak Sil
              </button>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: ADMIN PANEL (BİLGİ & SİSTEM İZLEME MERKEZİ)
           ------------------------------------------------------------- */}
        {currentPage === 'admin' && (
          <div className="space-y-6 w-full animate-fade-in">
            {/* SADE & ŞIK HEADER */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Sistem İzleme & Bilgi Modu (Salt Okunur)
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Yönetici Bilgi Portalı
                </h2>
                <p className="text-gray-400 text-xs md:text-sm mt-0.5">
                  Sistem genelindeki kayıtlı hesaplar, veri miktarları ve teknik istatistiklerin özet görünümü.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={handleRefreshStats}
                  disabled={adminUsersLoading}
                  className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 active:scale-95 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${adminUsersLoading ? 'animate-spin' : ''}`} />
                  {adminUsersLoading ? 'Yenileniyor...' : 'Yenile'}
                </button>
              </div>
            </div>

            {adminUsersError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-sm font-semibold">
                {adminUsersError}
              </div>
            )}

            {/* ISTATISTIK & BİLGİ KARTLARI */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
              <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Toplam Kullanıcı</span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Users className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white">
                    {adminStats ? adminStats.totalUsers : adminUsers.length}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1 font-medium">
                    {adminStats ? `${adminStats.adminCount} Admin / ${adminStats.userCount} Normal` : 'Kayıtlı Hesap'}
                  </p>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Aktif Kullanıcılar</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <UserCheck className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white">
                    {adminStats ? adminStats.activeUsers : adminUsers.length}
                  </h3>
                  <p className="text-[11px] text-emerald-400/80 mt-1 font-medium">Son 24 Saat İçinde Aktif</p>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Tekil Ziyaretçiler</span>
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Eye className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white">
                    {adminStats ? adminStats.siteVisits : 0}
                  </h3>
                  <p className="text-[11px] text-indigo-400/80 mt-1 font-medium">Toplam Farklı Kişi (IP)</p>
                </div>
              </div>

              <div className="glass-panel p-5 rounded-2xl border border-white/10 flex flex-col justify-between">
                <div className="flex items-center justify-between text-gray-400 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider">Günlük Tekil Kişi</span>
                  <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                </div>
                <div>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-white">
                    {adminStats ? adminStats.dailyVisits : 0}
                  </h3>
                  <p className="text-[11px] text-sky-400/80 mt-1 font-medium">Bugün Giriş Yapan Farklı Kişiler</p>
                </div>
              </div>
            </div>

            {/* KULLANICI DETAY REHBERİ */}
            <div className="glass-panel rounded-3xl border border-white/10 overflow-hidden shadow-2xl">
              <div className="p-5 md:p-6 border-b border-white/10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-base md:text-lg font-bold text-white">Kullanıcı Bilgi Rehberi</h3>
                  <p className="text-xs text-gray-400 mt-0.5">Sistemdeki aktif ve geçmiş tüm kullanıcı profilleri</p>
                </div>

                <div className="w-full sm:w-64">
                  <input
                    type="text"
                    value={adminSearchQuery}
                    onChange={(e) => setAdminSearchQuery(e.target.value)}
                    placeholder="İsim veya e-posta ile ara..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white outline-none focus:border-indigo-500 transition-all placeholder:text-gray-500"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-gray-300">
                  <thead className="bg-white/5 text-gray-400 text-xs uppercase tracking-wider border-b border-white/5">
                    <tr>
                      <th className="px-6 py-4 font-semibold">ID</th>
                      <th className="px-6 py-4 font-semibold">Ad Soyad</th>
                      <th className="px-6 py-4 font-semibold">E-Posta</th>
                      <th className="px-6 py-4 font-semibold">Rol</th>
                      <th className="px-6 py-4 font-semibold">Telegram Chat Status</th>
                      <th
                        onClick={() => handleAdminSort('olusturma_tarihi')}
                        className="px-6 py-4 font-semibold cursor-pointer select-none hover:text-white transition-colors group"
                        title="Kayıt tarihine göre sıralamak için tıklayın"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Kayıt Tarihi</span>
                          {adminSortField === 'olusturma_tarihi' ? (
                            adminSortOrder === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-500/50 group-hover:text-gray-300 transition-colors" />
                          )}
                        </div>
                      </th>
                      <th
                        onClick={() => handleAdminSort('son_aktif_tarihi')}
                        className="px-6 py-4 font-semibold cursor-pointer select-none hover:text-white transition-colors group"
                        title="Son aktiflik tarihine göre sıralamak için tıklayın"
                      >
                        <div className="flex items-center gap-1.5">
                          <span>Son Aktiflik</span>
                          {adminSortField === 'son_aktif_tarihi' ? (
                            adminSortOrder === 'desc' ? (
                              <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />
                            )
                          ) : (
                            <ArrowUpDown className="w-3.5 h-3.5 text-gray-500/50 group-hover:text-gray-300 transition-colors" />
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {adminUsersLoading ? (
                      <tr>
                        <td colSpan="7" className="px-6 py-10 text-center text-gray-400 font-medium">Sistem verileri yükleniyor...</td>
                      </tr>
                    ) : (() => {
                      const filtered = adminUsers
                        .filter((u) =>
                          (u.isim || '').toLowerCase().includes(adminSearchQuery.toLowerCase()) ||
                          (u.eposta || '').toLowerCase().includes(adminSearchQuery.toLowerCase())
                        )
                        .sort((a, b) => {
                          let valA, valB;
                          if (adminSortField === 'son_aktif_tarihi') {
                            valA = a.son_aktif_tarihi ? new Date(a.son_aktif_tarihi).getTime() : 0;
                            valB = b.son_aktif_tarihi ? new Date(b.son_aktif_tarihi).getTime() : 0;
                          } else {
                            valA = a.olusturma_tarihi ? new Date(a.olusturma_tarihi).getTime() : 0;
                            valB = b.olusturma_tarihi ? new Date(b.olusturma_tarihi).getTime() : 0;
                          }

                          if (valA === valB) {
                            const idA = Number(a.id) || 0;
                            const idB = Number(b.id) || 0;
                            return adminSortOrder === 'desc' ? idB - idA : idA - idB;
                          }
                          return adminSortOrder === 'desc' ? valB - valA : valA - valB;
                        });

                      if (filtered.length === 0) {
                        return (
                          <tr>
                            <td colSpan="7" className="px-6 py-10 text-center text-gray-500 font-medium">Arama kriterlerine uygun kullanıcı bulunamadı.</td>
                          </tr>
                        );
                      }

                      return filtered.map((u) => (
                        <tr key={u.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-mono text-xs text-gray-400">#{u.id}</td>
                          <td className="px-6 py-4 font-bold text-white flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 font-bold text-xs flex items-center justify-center flex-shrink-0">
                              {u.isim ? u.isim.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <span>{u.isim}</span>
                          </td>
                          <td className="px-6 py-4 text-gray-300">{u.eposta}</td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${u.role === 'admin'
                              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                              : 'bg-gray-800 text-gray-400 border border-gray-700'
                              }`}>
                              {u.role || 'user'}
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-xs">
                            {u.telegram_chat_id ? (
                              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Bağlı ({u.telegram_chat_id})
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">Bağlı Değil</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-xs text-gray-400">
                            {u.olusturma_tarihi ? formatDate(u.olusturma_tarihi) : '-'}
                          </td>
                          <td className="px-6 py-4 text-xs">
                            {u.son_aktif_tarihi ? (
                              <span className={isTodayOrYesterday(u.son_aktif_tarihi) ? "text-emerald-400 font-medium" : "text-gray-400 font-medium"}>
                                {formatDate(u.son_aktif_tarihi)}
                              </span>
                            ) : u.olusturma_tarihi ? (
                              <span className={isTodayOrYesterday(u.olusturma_tarihi) ? "text-emerald-400 font-medium" : "text-gray-400"}>
                                {formatDate(u.olusturma_tarihi)}
                              </span>
                            ) : (
                              '-'
                            )}
                          </td>
                        </tr>
                      ));
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: SISTEM İSTATİSTİKLERİ (GÖRSEL GRAFİK VE ANALİTİK PANELİ)
           ------------------------------------------------------------- */}
        {currentPage === 'istatistikler' && user?.role === 'admin' && (
          <div className="space-y-6 w-full animate-fade-in">
            {/* SADE & ŞIK HEADER */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-semibold mb-2">
                  <BarChart2 className="w-3.5 h-3.5" />
                  Görsel Analitik Grafikleri
                </div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">
                  Sistem İstatistik Grafikleri
                </h2>
                <p className="text-gray-400 text-xs md:text-sm mt-0.5">
                  Veritabanı sayaçları, modül dağılımları ve haftalık trafik grafik görünümü
                </p>
              </div>

              <button
                onClick={handleRefreshStats}
                disabled={adminUsersLoading}
                className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 active:scale-95 text-purple-300 border border-purple-500/30 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${adminUsersLoading ? 'animate-spin' : ''}`} />
                {adminUsersLoading ? 'Yenileniyor...' : 'Yenile'}
              </button>
            </div>

            {/* BİRLEŞTİRİLMİŞ EN BAŞTAKİ GRAFİK: MODÜL VERİ ORANLARI VE HALKA DAĞILIM ANALİZİ */}
            {(() => {
              const gidaVal = adminStats?.totalGida || 0;
              const faturaVal = adminStats?.totalFatura || 0;
              const garantiVal = adminStats?.totalGaranti || 0;
              const rutinVal = adminStats?.totalRutin || 0;
              const totalVal = gidaVal + faturaVal + garantiVal + rutinVal;

              const safeTotal = totalVal > 0 ? totalVal : 1;
              const maxVal = Math.max(1, gidaVal, faturaVal, garantiVal, rutinVal);

              const gidaPct = Math.round((gidaVal / safeTotal) * 100);
              const faturaPct = Math.round((faturaVal / safeTotal) * 100);
              const garantiPct = Math.round((garantiVal / safeTotal) * 100);
              const rutinPct = Math.round((rutinVal / safeTotal) * 100);

              const gidaWidth = Math.max(8, Math.round((gidaVal / maxVal) * 100));
              const faturaWidth = Math.max(8, Math.round((faturaVal / maxVal) * 100));
              const garantiWidth = Math.max(8, Math.round((garantiVal / maxVal) * 100));
              const rutinWidth = Math.max(8, Math.round((rutinVal / maxVal) * 100));

              const offsetFatura = -gidaPct;
              const offsetGaranti = -(gidaPct + faturaPct);
              const offsetRutin = -(gidaPct + faturaPct + garantiPct);

              return (
                <div className="bg-[#121422]/90 p-6 rounded-3xl border border-white/10 space-y-6 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-4 gap-2">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                        <PieChart className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">Sistem Veri Oranları ve Halka Analizi</h3>
                        <p className="text-xs text-gray-400">Veritabanındaki modül sayaçları ve dairesel oran dağılımı</p>
                      </div>
                    </div>
                    <span className="text-xs font-mono font-bold text-purple-300 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 self-start sm:self-auto">
                      TOPLAM: {totalVal} KAYIT
                    </span>
                  </div>

                  {/* İKİ SÜTUNLU BİRLEŞİK İÇERİK (SOL: DONUT HALKA GRAFİK, SAĞ: BAR ORAN GRAFİĞİ) */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                    {/* SOL TARAFTAKİ HALKA (DONUT) GRAFİK */}
                    <div className="md:col-span-5 flex flex-col items-center justify-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
                      <div className="relative flex items-center justify-center">
                        <svg className="w-40 h-40 -rotate-90 transform" viewBox="0 0 36 36">
                          <path
                            className="text-white/5"
                            strokeWidth="3.8"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {/* Gıda Segment (Amber) */}
                          <path
                            className="text-amber-400 transition-all duration-1000"
                            strokeDasharray={`${gidaPct}, 100`}
                            strokeWidth="3.8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {/* Fatura Segment (Rose) */}
                          <path
                            className="text-rose-400 transition-all duration-1000"
                            strokeDasharray={`${faturaPct}, 100`}
                            strokeDashoffset={offsetFatura}
                            strokeWidth="3.8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {/* Garanti Segment (Cyan) */}
                          <path
                            className="text-cyan-400 transition-all duration-1000"
                            strokeDasharray={`${garantiPct}, 100`}
                            strokeDashoffset={offsetGaranti}
                            strokeWidth="3.8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                          {/* Rutin Segment (Purple) */}
                          <path
                            className="text-purple-400 transition-all duration-1000"
                            strokeDasharray={`${rutinPct}, 100`}
                            strokeDashoffset={offsetRutin}
                            strokeWidth="3.8"
                            strokeLinecap="round"
                            stroke="currentColor"
                            fill="none"
                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                          />
                        </svg>

                        <div className="absolute flex flex-col items-center justify-center text-center">
                          <span className="text-2xl font-extrabold text-white">
                            {totalVal}
                          </span>
                          <span className="text-[10px] text-gray-400 font-medium">Toplam Kayıt</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs font-semibold text-gray-300 w-full max-w-[260px] mx-auto pt-3 border-t border-white/10">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 flex-shrink-0" />
                          <span className="truncate">Gıda (%{gidaPct})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-400 flex-shrink-0" />
                          <span className="truncate">Fatura (%{faturaPct})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 flex-shrink-0" />
                          <span className="truncate">Garanti (%{garantiPct})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 flex-shrink-0" />
                          <span className="truncate">Rutin (%{rutinPct})</span>
                        </div>
                      </div>
                    </div>

                    {/* SAĞ TARAFTAKİ VERİ MİKTAR BARLARI */}
                    <div className="md:col-span-7 space-y-4">
                      {/* Gıdalar Barı */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-amber-300 flex items-center gap-2">
                            <Apple className="w-4 h-4 text-amber-400" />
                            Gıda Stokları
                          </span>
                          <span className="text-white font-mono">{gidaVal} Ürün</span>
                        </div>
                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(245,158,11,0.5)]"
                            style={{ width: `${gidaWidth}%` }}
                          />
                        </div>
                      </div>

                      {/* Faturalar Barı */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-rose-300 flex items-center gap-2">
                            <Receipt className="w-4 h-4 text-rose-400" />
                            Fatura & Ödeme Kayıtları
                          </span>
                          <span className="text-white font-mono">{faturaVal} Kayıt</span>
                        </div>
                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 to-pink-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                            style={{ width: `${faturaWidth}%` }}
                          />
                        </div>
                      </div>

                      {/* Garantiler Barı */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-cyan-300 flex items-center gap-2">
                            <ShieldCheck className="w-4 h-4 text-cyan-400" />
                            Cihaz Garanti Belgeleri
                          </span>
                          <span className="text-white font-mono">{garantiVal} Garanti</span>
                        </div>
                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                          <div
                            className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(6,182,212,0.5)]"
                            style={{ width: `${garantiWidth}%` }}
                          />
                        </div>
                      </div>

                      {/* Rutinler Barı */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-purple-300 flex items-center gap-2">
                            <RefreshCw className="w-4 h-4 text-purple-400" />
                            Periyodik Rutin Görevler
                          </span>
                          <span className="text-white font-mono">{rutinVal} Rutin</span>
                        </div>
                        <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden p-0.5 border border-white/5">
                          <div
                            className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(168,85,247,0.5)]"
                            style={{ width: `${rutinWidth}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* GRAFİK 2 & 4: TRAFİK VE AKTİVİTE GRAFİKLERİ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* HAFTALIK SİTE TRAFİK SÜTUN GRAFİĞİ (PREMIUM ANALİTİK TASARIMI) */}
              <div className="relative overflow-hidden bg-gradient-to-b from-[#13172e] via-[#0f1224] to-[#0a0c18] border border-indigo-500/20 rounded-3xl p-5 sm:p-6 space-y-5 shadow-[0_15px_40px_rgba(0,0,0,0.5)] flex flex-col justify-between group h-full">
                {/* AMBİYANS IŞIKLARI */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />

                {/* SÜTÜN GRAFİĞİ BAŞLIĞI */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)] flex-shrink-0">
                      <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                        Haftalık Ziyaret Trafiği
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">Son 7 günlük canlı sayfa erişim analizi</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-mono font-bold shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                    CANLI TRAFİK TRENDİ
                  </div>
                </div>

                {/* SÜTUN GRAFİĞİ BÖLGESİ (GRID ÇİZGİLERİ İLE) */}
                <div className="relative z-10 flex-1 flex flex-col justify-between pt-2">
                  {/* ARKA PLAN YATAY IZGARA ÇİZGİLERİ */}
                  <div className="absolute inset-x-0 top-8 bottom-24 flex flex-col justify-between pointer-events-none z-0">
                    <div className="w-full border-t border-white/[0.06] border-dashed" />
                    <div className="w-full border-t border-white/[0.06] border-dashed" />
                    <div className="w-full border-t border-white/[0.06] border-dashed" />
                    <div className="w-full border-t border-white/[0.06] border-dashed" />
                  </div>

                  {(() => {
                    const itemsRaw = (adminStats && adminStats.weeklyVisits && adminStats.weeklyVisits.length === 7)
                      ? adminStats.weeklyVisits.map((item, idx) => ({
                        day: item.day,
                        val: item.val,
                        isToday: item.is_today,
                        color: item.is_today
                          ? 'from-amber-600 via-amber-500 to-yellow-400'
                          : idx === 5
                            ? 'from-teal-600 via-emerald-500 to-emerald-400'
                            : 'from-indigo-600 via-blue-500 to-cyan-400'
                      }))
                      : [
                        { day: 'Pzt', val: 18, color: 'from-indigo-600 via-blue-500 to-cyan-400' },
                        { day: 'Sal', val: 24, color: 'from-indigo-600 via-blue-500 to-cyan-400' },
                        { day: 'Çar', val: 32, color: 'from-purple-600 via-indigo-500 to-purple-400' },
                        { day: 'Per', val: 21, color: 'from-indigo-600 via-blue-500 to-cyan-400' },
                        { day: 'Cum', val: 28, color: 'from-indigo-600 via-blue-500 to-cyan-400' },
                        { day: 'Cmt', val: 39, color: 'from-teal-600 via-emerald-500 to-emerald-400' },
                        { day: 'Paz', val: adminStats ? adminStats.dailyVisits : 28, color: 'from-amber-600 via-amber-500 to-yellow-400', isToday: true }
                      ];
                    const maxVal = Math.max(...itemsRaw.map(i => i.val), 1);
                    const peakItem = itemsRaw.reduce((prev, curr) => (curr.val > prev.val ? curr : prev), itemsRaw[0]);

                    const items = itemsRaw.map(item => ({
                      ...item,
                      isPeak: item.day === peakItem.day
                    }));

                    const totalWeeklyVisits = items.reduce((sum, item) => sum + item.val, 0);
                    const avgTraffic = (totalWeeklyVisits / items.length).toFixed(1);

                    // Dinamik haftalık trend hesabı (Haftanın 2. yarısı vs 1. yarısı ortalaması)
                    const firstHalfAvg = items.slice(0, 3).reduce((sum, i) => sum + i.val, 0) / 3;
                    const secondHalfAvg = items.slice(3, 7).reduce((sum, i) => sum + i.val, 0) / 4;
                    const trendPctVal = (((secondHalfAvg - firstHalfAvg) / (firstHalfAvg || 1)) * 100).toFixed(1);
                    const trendDisplay = `${trendPctVal >= 0 ? '+' : ''}%${trendPctVal}`;

                    return (
                      <>
                        {/* SÜTUNLAR */}
                        <div className="relative z-10 h-60 flex items-end justify-between gap-2.5 md:gap-4 px-2 pt-6 pb-2">
                          {items.map((item, idx) => {
                            const heightPct = Math.max(18, Math.round((item.val / maxVal) * 100));
                            return (
                              <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer">
                                {/* GÖRÜNÜR DEĞER BADGE */}
                                <div className={`px-2 py-0.5 rounded-lg border text-[11px] font-mono font-extrabold transition-all duration-200 shadow-md ${item.isToday
                                  ? 'bg-gradient-to-r from-amber-500/30 to-yellow-500/20 text-amber-300 border-amber-400/50 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                                  : item.isPeak
                                    ? 'bg-gradient-to-r from-emerald-500/30 to-teal-500/20 text-emerald-300 border-emerald-400/50 shadow-[0_0_12px_rgba(16,185,129,0.35)]'
                                    : 'bg-[#1a1d36] text-gray-200 border-white/15 group-hover:border-cyan-400/60 group-hover:text-cyan-300 group-hover:bg-cyan-500/20 group-hover:shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                                  }`}>
                                  {item.val}
                                </div>

                                {/* SÜTUN ÇUBUĞU */}
                                <div className="w-full bg-white/[0.04] rounded-2xl overflow-hidden flex items-end p-1 border border-white/10 h-full group-hover:border-cyan-500/40 transition-all duration-200">
                                  <div
                                    className={`w-full bg-gradient-to-t ${item.color} rounded-xl transition-all duration-300 group-hover:brightness-125 group-hover:shadow-[0_0_20px_rgba(6,182,212,0.6)] relative overflow-hidden`}
                                    style={{ height: `${heightPct}%` }}
                                  >
                                    {/* Sütun Üstü Parlama Çizgisi */}
                                    <div className="absolute top-0 inset-x-0 h-1 bg-white/40 rounded-t-xl" />
                                  </div>
                                </div>

                                {/* GÜN ETİKETİ */}
                                <span className={`text-xs font-mono transition-colors duration-200 ${item.isToday
                                  ? 'text-amber-400 font-extrabold'
                                  : item.isPeak
                                    ? 'text-emerald-400 font-extrabold'
                                    : 'text-gray-400 font-semibold group-hover:text-cyan-300'
                                  }`}>
                                  {item.day}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        {/* GRAFİK ALT KPI ÖZET KARTLARI */}
                        <div className="relative z-10 grid grid-cols-3 gap-2.5 pt-2 border-t border-white/10 text-xs mt-4">
                          <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all flex flex-col items-center justify-center text-center group/kpi">
                            <span className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1 group-hover/kpi:text-white transition-colors">
                              <TrendingUp className="w-3 h-3 text-cyan-400" /> Ort. Trafik
                            </span>
                            <span className="font-mono font-extrabold text-white text-xs sm:text-sm mt-1">
                              {avgTraffic} <span className="text-[10px] text-gray-400 font-normal">/ Gün</span>
                            </span>
                          </div>

                          <div className="p-3 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col items-center justify-center text-center group/kpi shadow-[0_0_15px_rgba(16,185,129,0.08)]">
                            <span className="text-[10px] text-emerald-400/90 uppercase font-semibold flex items-center gap-1 group-hover/kpi:text-emerald-300 transition-colors">
                              <Calendar className="w-3 h-3 text-emerald-400" /> Zirve Gün
                            </span>
                            <span className="font-mono font-extrabold text-emerald-300 text-xs sm:text-sm mt-1">
                              {peakItem.day} <span className="text-[10px] text-emerald-400/80 font-bold">({peakItem.val})</span>
                            </span>
                          </div>

                          <div className="p-3 rounded-2xl bg-cyan-500/[0.06] border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex flex-col items-center justify-center text-center group/kpi shadow-[0_0_15px_rgba(6,182,212,0.08)]">
                            <span className="text-[10px] text-cyan-400/90 uppercase font-semibold flex items-center gap-1 group-hover/kpi:text-cyan-300 transition-colors">
                              <TrendingUp className="w-3 h-3 text-cyan-400" /> Haftalık Artış
                            </span>
                            <span className="font-mono font-extrabold text-cyan-300 text-xs sm:text-sm mt-1">
                              {trendDisplay}
                            </span>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* GÜN İÇİ SAAT-SAAT KULLANIM DALGA GRAFİĞİ (ULTRA PREMİUM GLASSMORPHISM ANALİTİK TASARIMI) */}
              <div className="relative overflow-hidden bg-gradient-to-b from-[#111428]/95 via-[#0d0f20]/95 to-[#090b16]/95 border border-emerald-500/25 rounded-3xl p-5 sm:p-6 space-y-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)] backdrop-blur-xl flex flex-col justify-between group">
                {/* AMBİYANS IŞIKLARI */}
                <div className="absolute -top-16 -right-16 w-56 h-56 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-emerald-500/15 transition-all duration-700" />
                <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-cyan-500/10 blur-3xl rounded-full pointer-events-none group-hover:bg-cyan-500/15 transition-all duration-700" />

                {/* GRAFİK BAŞLIĞI */}
                <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-2xl bg-gradient-to-br from-emerald-500/20 via-teal-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.25)] flex-shrink-0">
                      <Activity className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
                        Saatlik Trafik Yoğunluğu
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">24 saatlik sunucu kapasite kullanımı ve işlem yükü oranı</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)]">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                    </span>
                    24 SAAT CANLI
                  </div>
                </div>

                {/* SVG SPARKLINE / WAVE GRAFİĞİ BÖLGESİ */}
                {(() => {
                  const staticPositions = [
                    { cx: 25, cy: 85 },
                    { cx: 90, cy: 72 },
                    { cx: 155, cy: 34 },
                    { cx: 220, cy: 62 },
                    { cx: 285, cy: 76 },
                    { cx: 350, cy: 42 },
                    { cx: 415, cy: 12 },
                    { cx: 480, cy: 64 },
                  ];

                  const trafficDataRaw = (adminStats && adminStats.hourlyTraffic && adminStats.hourlyTraffic.length === 8)
                    ? adminStats.hourlyTraffic.map((item, idx) => {
                      const calcCy = Math.max(12, Math.min(105, Math.round(110 - (item.pct / 100) * 98)));
                      return {
                        time: item.time,
                        pct: item.pct,
                        cx: staticPositions[idx].cx,
                        cy: calcCy,
                        desc: item.desc
                      };
                    })
                    : [
                      { time: '03:00', pct: 33, cx: 25, cy: 85, desc: '%33 Gece Sakinliği' },
                      { time: '06:00', pct: 45, cx: 90, cy: 72, desc: '%45 Sabah Başlangıcı' },
                      { time: '09:00', pct: 75, cx: 155, cy: 34, desc: '%75 Sabah Zirvesi' },
                      { time: '12:00', pct: 52, cx: 220, cy: 62, desc: '%52 Öğle Dengesi' },
                      { time: '15:00', pct: 40, cx: 285, cy: 76, desc: '%40 Stabil Akış' },
                      { time: '18:00', pct: 68, cx: 350, cy: 42, desc: '%68 Akşam Yükselişi' },
                      { time: '20:00', pct: 95, cx: 415, cy: 12, desc: '%95 ANA ZİRVE' },
                      { time: '00:00', pct: 50, cx: 480, cy: 64, desc: '%50 Gece Dengesi' },
                    ];

                  const minPct = Math.min(...trafficDataRaw.map(t => t.pct));
                  const maxPct = Math.max(...trafficDataRaw.map(t => t.pct));

                  const mainPeak = trafficDataRaw.reduce((prev, curr) => (curr.pct > prev.pct ? curr : prev), trafficDataRaw[0]);
                  // Distinct subPeak (second highest point at a different time)
                  const remaining = trafficDataRaw.filter(t => t.time !== mainPeak.time);
                  const subPeak = remaining.length > 0
                    ? remaining.reduce((prev, curr) => (curr.pct > prev.pct ? curr : prev), remaining[0])
                    : mainPeak;

                  const trafficData = trafficDataRaw.map(pt => ({
                    ...pt,
                    isMainPeak: pt.time === mainPeak.time,
                    isPeak: pt.time === subPeak.time
                  }));

                  const totalDensity = trafficData.reduce((sum, pt) => sum + pt.pct, 0);
                  const avgDensity = (totalDensity / trafficData.length).toFixed(1);

                  const activePoint = hoveredTrafficIdx !== null ? trafficData[hoveredTrafficIdx] : null;

                  // Dinamik SVG yumuşak dalga eğrisi oluşturucu
                  const generateCurve = (points) => {
                    if (!points || points.length === 0) return "";
                    let d = `M 0,${points[0].cy}`;
                    for (let i = 0; i < points.length; i++) {
                      const curr = points[i];
                      const prev = points[i - 1] || { cx: 0, cy: curr.cy };
                      const cp1x = prev.cx + (curr.cx - prev.cx) * 0.45;
                      const cp1y = prev.cy;
                      const cp2x = prev.cx + (curr.cx - prev.cx) * 0.55;
                      const cp2y = curr.cy;
                      d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${curr.cx},${curr.cy}`;
                    }
                    const last = points[points.length - 1];
                    d += ` C ${last.cx + 10},${last.cy} 495,${last.cy} 500,${last.cy}`;
                    return d;
                  };

                  const curvePath = generateCurve(trafficData);
                  const areaPath = `${curvePath} L 500,125 L 0,125 Z`;

                  return (
                    <>
                      <div className="relative z-10 pt-2 space-y-4">
                        {/* DİNAMİK CANLI BİLGİ BADGE / HOVER TOOLTIP MERKEZİ */}
                        <div className="min-h-[26px] flex items-center justify-between px-1">
                          <span className="text-[11px] font-mono font-medium text-gray-400 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                            {activePoint ? (
                              <span className="text-cyan-300 font-bold">
                                Seçili: {activePoint.time} &bull; {activePoint.desc}
                              </span>
                            ) : (
                              'Detay için noktaların üzerine gelin'
                            )}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300">
                              Min: %{minPct}
                            </span>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                              Max: %{maxPct}
                            </span>
                          </div>
                        </div>

                        {/* SVG HASSAS GRAFİK TUVALİ */}
                        <div className="relative pt-4 pb-2">
                          {/* AKILLI ZİRVE ROZETLERİ (DİNAMİK KONUM) */}
                          <div
                            className="absolute top-0 -translate-x-1/2 z-20 pointer-events-none transition-all duration-300"
                            style={{ left: `${(subPeak.cx / 500) * 100}%` }}
                          >
                            <span className="bg-emerald-950/80 backdrop-blur-md border border-emerald-500/50 text-emerald-300 text-[10px] font-mono font-extrabold px-2 py-0.5 rounded-lg shadow-[0_4px_12px_rgba(16,185,129,0.3)] flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              %{subPeak.pct}
                            </span>
                          </div>

                          <div
                            className="absolute -top-1 -translate-x-1/2 z-20 pointer-events-none transition-all duration-300"
                            style={{ left: `${(mainPeak.cx / 500) * 100}%` }}
                          >
                            <span className="bg-gradient-to-r from-emerald-600/90 via-teal-600/90 to-cyan-600/90 backdrop-blur-md border border-emerald-300/60 text-white text-[10px] font-mono font-black px-2.5 py-0.5 rounded-lg shadow-[0_0_15px_rgba(16,185,129,0.5)] flex items-center gap-1 tracking-wider uppercase">
                              <span className="w-1.5 h-1.5 rounded-full bg-white" />
                              %{mainPeak.pct} ZİRVE
                            </span>
                          </div>

                          <svg className="w-full h-40 overflow-visible" viewBox="0 0 500 130">
                            <defs>
                              {/* Çoklu Renk Dalga Dolgu Gradyanı */}
                              <linearGradient id="multiColorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#10b981" stopOpacity="0.4" />
                                <stop offset="40%" stopColor="#06b6d4" stopOpacity="0.2" />
                                <stop offset="85%" stopColor="#8b5cf6" stopOpacity="0.05" />
                                <stop offset="100%" stopColor="#000000" stopOpacity="0.0" />
                              </linearGradient>

                              {/* Çizgi Parlaklık Gradyanı */}
                              <linearGradient id="trafficLineGrad" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" stopColor="#10b981" />
                                <stop offset="30%" stopColor="#34d399" />
                                <stop offset="60%" stopColor="#06b6d4" />
                                <stop offset="85%" stopColor="#38bdf8" />
                                <stop offset="100%" stopColor="#a855f7" />
                              </linearGradient>

                              {/* Yumuşak Neon Glow Filtresi */}
                              <filter id="neonGlowFilter" x="-20%" y="-30%" width="140%" height="160%">
                                <feGaussianBlur stdDeviation="4" result="blur" />
                                <feComponentTransfer in="blur" result="glow">
                                  <feFuncA type="linear" slope="1.5" />
                                </feComponentTransfer>
                                <feMerge>
                                  <feMergeNode in="glow" />
                                  <feMergeNode in="SourceGraphic" />
                                </feMerge>
                              </filter>
                            </defs>

                            {/* Arka Plan Izgara Çizgileri */}
                            <line x1="0" y1="20" x2="500" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                            <line x1="0" y1="60" x2="500" y2="60" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                            <line x1="0" y1="100" x2="500" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

                            {/* Dikey Kesikli İndikatör Çizgileri */}
                            {trafficData.map((pt, idx) => {
                              const isHovered = hoveredTrafficIdx === idx;
                              return (
                                <line
                                  key={`line-${idx}`}
                                  x1={pt.cx}
                                  y1={pt.cy}
                                  x2={pt.cx}
                                  y2={120}
                                  stroke={isHovered ? '#34d399' : 'rgba(255,255,255,0.08)'}
                                  strokeWidth={isHovered ? '1.5' : '1'}
                                  strokeDasharray={isHovered ? 'none' : '3 3'}
                                  className="transition-all duration-300"
                                />
                              );
                            })}

                            {/* Dalga Dolgusu (Dinamik Area Fill) */}
                            <path
                              d={areaPath}
                              fill="url(#multiColorAreaGrad)"
                            />

                            {/* Arka Plan Yumuşak Glow Stroke Layer */}
                            <path
                              d={curvePath}
                              fill="none"
                              stroke="url(#trafficLineGrad)"
                              strokeWidth="7"
                              strokeLinecap="round"
                              opacity="0.35"
                              filter="blur(5px)"
                            />

                            {/* Keskin Ana Dalga Çizgisi (Dinamik Curve) */}
                            <path
                              d={curvePath}
                              fill="none"
                              stroke="url(#trafficLineGrad)"
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              filter="url(#neonGlowFilter)"
                            />

                            {/* İnteraktif Veri Noktaları (Circles) */}
                            {trafficData.map((pt, idx) => {
                              const isHovered = hoveredTrafficIdx === idx;
                              return (
                                <g
                                  key={`node-${idx}`}
                                  onMouseEnter={() => setHoveredTrafficIdx(idx)}
                                  onMouseLeave={() => setHoveredTrafficIdx(null)}
                                  className="cursor-pointer group/node"
                                >
                                  {/* Şeffaf Geniş Hitbox */}
                                  <circle cx={pt.cx} cy={pt.cy} r="14" fill="transparent" />

                                  {/* Ana Zirve Dış Daire Animasyonu */}
                                  {pt.isMainPeak && (
                                    <circle
                                      cx={pt.cx}
                                      cy={pt.cy}
                                      r="14"
                                      fill="none"
                                      stroke="#38bdf8"
                                      strokeWidth="1.5"
                                      opacity="0.8"
                                    />
                                  )}

                                  {/* Zirve 1 Dış Daire */}
                                  {pt.isPeak && (
                                    <circle
                                      cx={pt.cx}
                                      cy={pt.cy}
                                      r="10"
                                      fill="none"
                                      stroke="#34d399"
                                      strokeWidth="1.5"
                                      opacity="0.6"
                                    />
                                  )}

                                  {/* Hover / Aktif Dış Halka */}
                                  <circle
                                    cx={pt.cx}
                                    cy={pt.cy}
                                    r={isHovered ? (pt.isMainPeak ? '12' : '10') : pt.isMainPeak ? '9' : '7'}
                                    fill="none"
                                    stroke={isHovered ? '#6ee7b7' : pt.isMainPeak ? '#38bdf8' : '#34d399'}
                                    strokeWidth={isHovered ? '2.5' : '1.5'}
                                    className="transition-all duration-300"
                                  />

                                  {/* İç Çekirdek Nokta */}
                                  <circle
                                    cx={pt.cx}
                                    cy={pt.cy}
                                    r={isHovered ? '5.5' : pt.isMainPeak ? '5' : '4'}
                                    fill={isHovered ? '#ffffff' : pt.isMainPeak ? '#38bdf8' : '#34d399'}
                                    className="transition-all duration-300 drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]"
                                  />
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        {/* ZAMAN ETİKETLERİ X-AKSİ (İNTERAKTİF PİLL STİLİ) */}
                        <div className="grid grid-cols-8 gap-1 pt-2 border-t border-white/10 text-center">
                          {trafficData.map((pt, idx) => {
                            const isHovered = hoveredTrafficIdx === idx;
                            return (
                              <button
                                key={`lbl-${idx}`}
                                onMouseEnter={() => setHoveredTrafficIdx(idx)}
                                onMouseLeave={() => setHoveredTrafficIdx(null)}
                                className={`py-1 rounded-xl text-[10px] sm:text-xs font-mono transition-all duration-200 cursor-pointer ${isHovered
                                  ? 'bg-emerald-500/25 text-emerald-200 font-bold border border-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]'
                                  : pt.isMainPeak
                                    ? 'bg-cyan-500/15 text-cyan-300 font-extrabold border border-cyan-500/30'
                                    : pt.isPeak
                                      ? 'bg-emerald-500/10 text-emerald-400 font-bold border border-emerald-500/20'
                                      : 'text-gray-400 hover:text-white hover:bg-white/5 border border-transparent'
                                  }`}
                              >
                                {pt.time}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* GRAFİK ALT KPI ÖZET KARTLARI */}
                      <div className="relative z-10 grid grid-cols-3 gap-2.5 pt-2 border-t border-white/10 text-xs">
                        <div className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 hover:border-white/15 transition-all flex flex-col items-center justify-center text-center group/kpi">
                          <span className="text-[10px] text-gray-400 uppercase font-semibold flex items-center gap-1 group-hover/kpi:text-white transition-colors">
                            <Activity className="w-3 h-3 text-emerald-400" /> Ort. Yoğunluk
                          </span>
                          <span className="font-mono font-extrabold text-white text-xs sm:text-sm mt-1">
                            %{avgDensity} <span className="text-[10px] text-gray-400 font-normal">/ Saat</span>
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-emerald-500/[0.06] border border-emerald-500/20 hover:border-emerald-500/40 transition-all flex flex-col items-center justify-center text-center group/kpi shadow-[0_0_15px_rgba(16,185,129,0.08)]">
                          <span className="text-[10px] text-emerald-400/90 uppercase font-semibold flex items-center gap-1 group-hover/kpi:text-emerald-300 transition-colors">
                            <TrendingUp className="w-3 h-3 text-emerald-400" /> Zirve Saat
                          </span>
                          <span className="font-mono font-extrabold text-emerald-300 text-xs sm:text-sm mt-1">
                            {mainPeak.time} <span className="text-[10px] text-emerald-400/80 font-bold">(%{mainPeak.pct})</span>
                          </span>
                        </div>

                        <div className="p-3 rounded-2xl bg-cyan-500/[0.06] border border-cyan-500/20 hover:border-cyan-500/40 transition-all flex flex-col items-center justify-center text-center group/kpi shadow-[0_0_15px_rgba(6,182,212,0.08)]">
                          <span className="text-[10px] text-cyan-400/90 uppercase font-semibold flex items-center gap-1 group-hover/kpi:text-cyan-300 transition-colors">
                            <Gauge className="w-3 h-3 text-cyan-400" /> Sunucu Hızı
                          </span>
                          <span className="font-mono font-extrabold text-cyan-300 text-xs sm:text-sm mt-1">
                            12 ms <span className="text-[10px] text-cyan-400/80 font-bold">(Hızlı)</span>
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* EN ALTTAKİ SİSTEM BİLGİLERİ KARTI */}
            <div className="bg-[#121422]/90 p-4 sm:p-5 rounded-3xl border border-white/10 space-y-3.5 shadow-xl">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex-shrink-0">
                    <Info className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight truncate">Sistem Bilgileri</h3>
                    <p className="text-[11px] text-gray-400 truncate">Altyapı ve servis durumu</p>
                  </div>
                </div>
                <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5 whitespace-nowrap flex-shrink-0 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Aktif (200 OK)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-1 min-w-0">
                  <span className="text-gray-400 text-[11px] font-medium truncate">Veritabanı</span>
                  <span className="font-mono text-white font-bold text-xs flex-shrink-0">SQLite3</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-1 min-w-0">
                  <span className="text-gray-400 text-[11px] font-medium truncate">Rapor Saati</span>
                  <span className="font-mono text-emerald-400 font-bold text-xs flex-shrink-0">09:00 &amp; 20:00</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-1 min-w-0">
                  <span className="text-gray-400 text-[11px] font-medium truncate">Güvenlik</span>
                  <span className="font-mono text-purple-300 font-bold text-xs flex-shrink-0">JWT Token</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex items-center justify-between gap-1 min-w-0">
                  <span className="text-gray-400 text-[11px] font-medium truncate">Bildirim</span>
                  <span className="font-mono text-cyan-400 font-bold text-xs flex-shrink-0">Telegram Bot</span>
                </div>
              </div>
            </div>
          </div>
        )}


      </main>

      {/* -------------------------------------------------------------
          MODALS & OVERLAYS
         ------------------------------------------------------------- */}

      {/* MODAL: GIDA EKLE / DÜZENLE */}
      {showGidaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl relative">
            <h3 className="text-xl font-bold text-white mb-4">{editingGida ? 'Gıda Düzenle 🥑' : 'Yeni Gıda Ekle 🥑'}</h3>
            <form noValidate onSubmit={handleSaveGida} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Ürün Adı *</label>
                <input
                  type="text"
                  required
                  value={gidaForm.urun_adi}
                  onChange={(e) => setGidaForm({ ...gidaForm, urun_adi: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="örn: Yumurta, Süt"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Kategori</label>
                <input
                  type="text"
                  value={gidaForm.kategori}
                  onChange={(e) => setGidaForm({ ...gidaForm, kategori: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="örn: Şarküteri, Manav, Süt Ürünü"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Son Kullanma Tarihi *</label>
                <DatePicker
                  required
                  value={gidaForm.skt}
                  onChange={(e) => setGidaForm({ ...gidaForm, skt: e.target.value })}
                  placeholder="Son kullanma tarihi seçin..."
                />
              </div>

              <div>
                {(() => {
                  const maxDays = getDateMaxWarningDays(gidaForm.skt);
                  return (
                    <>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Kaç Gün Kala Hatırlatılsın? *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max={maxDays !== null ? maxDays : undefined}
                        value={gidaForm.hatirlatma_gun_kala}
                        onChange={(e) => setGidaForm({ ...gidaForm, hatirlatma_gun_kala: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                      />
                    </>
                  );
                })()}
              </div>

              {editingGida && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Durum</label>
                  <CustomSelect
                    value={gidaForm.durum}
                    onChange={(e) => setGidaForm({ ...gidaForm, durum: e.target.value })}
                    options={[
                      { value: 'bekliyor', label: 'Bekliyor (Tüketilmedi)' },
                      { value: 'tuketildi', label: 'Tüketildi' },
                      { value: 'atildi', label: 'Atıldı / Bozuldu' }
                    ]}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGidaModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-sm"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={
                    Boolean(
                      editingGida &&
                      gidaForm.urun_adi === editingGida.urun_adi &&
                      (gidaForm.kategori || '') === (editingGida.kategori || '') &&
                      gidaForm.skt === formatInputDate(editingGida.skt) &&
                      Number(gidaForm.hatirlatma_gun_kala) === Number(editingGida.hatirlatma_gun_kala) &&
                      gidaForm.durum === editingGida.durum
                    )
                  }
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-600 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  {editingGida ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FATURA EKLE / DÜZENLE */}
      {showFaturaModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl relative">
            <h3 className="text-xl font-bold text-white mb-4">{editingFatura ? 'Fatura Düzenle 💵' : 'Yeni Fatura Ekle 💵'}</h3>
            <form noValidate onSubmit={handleSaveFatura} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Fatura Adı *</label>
                <input
                  type="text"
                  required
                  value={faturaForm.fatura_adi}
                  onChange={(e) => setFaturaForm({ ...faturaForm, fatura_adi: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="örn: Elektrik Faturası, İnternet"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Tutar (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={faturaForm.tutar}
                  onChange={(e) => setFaturaForm({ ...faturaForm, tutar: e.target.value ? parseFloat(e.target.value) : '' })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="örn: 450.50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Son Ödeme Tarihi *</label>
                <DatePicker
                  required
                  value={faturaForm.son_odeme_tarihi}
                  onChange={(e) => setFaturaForm({ ...faturaForm, son_odeme_tarihi: e.target.value })}
                  placeholder="Son ödeme tarihi seçin..."
                />
              </div>

              <div>
                {(() => {
                  const maxDays = getDateMaxWarningDays(faturaForm.son_odeme_tarihi);
                  return (
                    <>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Kaç Gün Kala Hatırlatılsın? *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max={maxDays !== null ? maxDays : undefined}
                        value={faturaForm.hatirlatma_gun_kala}
                        onChange={(e) => setFaturaForm({ ...faturaForm, hatirlatma_gun_kala: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                      />
                    </>
                  );
                })()}
              </div>

              {editingFatura && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Ödeme Durumu</label>
                  <CustomSelect
                    value={faturaForm.durum}
                    onChange={(e) => setFaturaForm({ ...faturaForm, durum: e.target.value })}
                    options={[
                      { value: 'odenmedi', label: 'Ödenmedi' },
                      { value: 'odendi', label: 'Ödendi' }
                    ]}
                  />
                </div>
              )}

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowFaturaModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-sm"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={
                    Boolean(
                      editingFatura &&
                      faturaForm.fatura_adi === editingFatura.fatura_adi &&
                      (faturaForm.tutar === '' ? null : Number(faturaForm.tutar)) === (editingFatura.tutar === null || editingFatura.tutar === undefined ? null : Number(editingFatura.tutar)) &&
                      faturaForm.son_odeme_tarihi === formatInputDate(editingFatura.son_odeme_tarihi) &&
                      Number(faturaForm.hatirlatma_gun_kala) === Number(editingFatura.hatirlatma_gun_kala) &&
                      faturaForm.durum === editingFatura.durum
                    )
                  }
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-600 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  {editingFatura ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GARANTİ EKLE / DÜZENLE */}
      {showGarantiModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl relative">
            <h3 className="text-xl font-bold text-white mb-4">{editingGaranti ? 'Garanti Kaydı Düzenle 🛡️' : 'Yeni Garanti Belgesi 🛡️'}</h3>
            <form noValidate onSubmit={handleSaveGaranti} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Cihaz Adı *</label>
                <input
                  type="text"
                  required
                  value={garantiForm.cihaz_adi}
                  onChange={(e) => setGarantiForm({ ...garantiForm, cihaz_adi: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="örn: Televizyon, Kahve Makinesi"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Marka & Model</label>
                <input
                  type="text"
                  value={garantiForm.marka_model}
                  onChange={(e) => setGarantiForm({ ...garantiForm, marka_model: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="örn: Sony Bravia, Philips Lattego"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Garanti Bitiş Tarihi *</label>
                <DatePicker
                  required
                  value={garantiForm.garanti_bitis}
                  onChange={(e) => setGarantiForm({ ...garantiForm, garanti_bitis: e.target.value })}
                  placeholder="Garanti bitiş tarihi seçin..."
                />
              </div>

              <div>
                {(() => {
                  const maxDays = getDateMaxWarningDays(garantiForm.garanti_bitis);
                  return (
                    <>
                      <label className="block text-xs font-semibold text-gray-400 mb-1">
                        Kaç Gün Kala Hatırlatılsın? *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        max={maxDays !== null ? maxDays : undefined}
                        value={garantiForm.hatirlatma_gun_kala}
                        onChange={(e) => setGarantiForm({ ...garantiForm, hatirlatma_gun_kala: e.target.value === '' ? '' : parseInt(e.target.value, 10) })}
                        className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                      />
                    </>
                  );
                })()}
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Ek Notlar (Firma Bilgisi, Telefon vb.)</label>
                <textarea
                  value={garantiForm.notlar}
                  onChange={(e) => setGarantiForm({ ...garantiForm, notlar: e.target.value })}
                  rows="3"
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all resize-none"
                  placeholder="Satıcı fatura no, müşteri hizmetleri tel no..."
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowGarantiModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-sm"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={
                    Boolean(
                      editingGaranti &&
                      garantiForm.cihaz_adi === editingGaranti.cihaz_adi &&
                      (garantiForm.marka_model || '') === (editingGaranti.marka_model || '') &&
                      garantiForm.garanti_bitis === formatInputDate(editingGaranti.garanti_bitis) &&
                      Number(garantiForm.hatirlatma_gun_kala) === Number(editingGaranti.hatirlatma_gun_kala) &&
                      (garantiForm.notlar || '') === (editingGaranti.notlar || '')
                    )
                  }
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-600 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  {editingGaranti ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KLASÖR YÖNETİMİ */}
      {showKlasorYonetimModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl relative border border-white/10 shadow-2xl animate-scale-in">
            <div className="flex items-center justify-between mb-5 border-b border-white/10 pb-3">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <FolderPlus className="w-5 h-5 text-purple-400" /> Klasör Yönetimi 📂
              </h3>
              <button
                onClick={() => setShowKlasorYonetimModal(false)}
                className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
              {Array.isArray(rutinKlasorleri) && rutinKlasorleri.length > 0 ? (
                rutinKlasorleri.map((klasor) => {
                  const count = Array.isArray(rutinler) ? rutinler.filter(r => r.klasor_id === klasor.id || r.klasor_id === klasor.id.toString()).length : 0;
                  return (
                    <div
                      key={klasor.id}
                      className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.04] border border-white/10 hover:border-purple-500/30 transition-all"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="text-base">📂</span>
                        <div className="truncate">
                          <h4 className="text-sm font-bold text-white truncate">{klasor.klasor_adi}</h4>
                          <p className="text-[11px] text-gray-400">{count} rutin görev</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => {
                            setShowKlasorYonetimModal(false);
                            handleEditKlasor(klasor);
                          }}
                          className="p-2 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/20 transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="Klasör Adını Düzenle"
                        >
                          <Edit className="w-3.5 h-3.5" />
                          <span>Düzenle</span>
                        </button>

                        <button
                          onClick={() => {
                            setShowKlasorYonetimModal(false);
                            handleDeleteKlasor(klasor.id);
                          }}
                          className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
                          title="Klasörü Sil"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Sil</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-gray-400 text-sm">
                  Henüz bir rutin klasörü eklenmemiş.
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-white/10 flex gap-3">
              <button
                onClick={() => {
                  setShowKlasorYonetimModal(false);
                  setEditingKlasor(null);
                  setKlasorForm({ klasor_adi: '' });
                  setShowKlasorModal(true);
                }}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all cursor-pointer flex items-center justify-center gap-2 glow-btn"
              >
                <FolderPlus className="w-4 h-4" />
                <span>Yeni Klasör Oluştur</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: KLASÖR OLUŞTUR / DÜZENLE */}
      {showKlasorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm p-6 rounded-3xl relative">
            <h3 className="text-xl font-bold text-white mb-4">{editingKlasor ? 'Klasör Adını Düzenle 📂' : 'Yeni Rutin Klasörü 📂'}</h3>
            <form noValidate onSubmit={handleSaveKlasor} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Klasör Adı *</label>
                <input
                  type="text"
                  required
                  value={klasorForm.klasor_adi}
                  onChange={(e) => setKlasorForm({ ...klasorForm, klasor_adi: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="örn: Araba Bakımı, Bahçe İşleri"
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => { setShowKlasorModal(false); setEditingKlasor(null); }}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-sm"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={
                    Boolean(
                      editingKlasor &&
                      klasorForm.klasor_adi.trim() === editingKlasor.klasor_adi.trim()
                    )
                  }
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-600 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  {editingKlasor ? 'Güncelle' : 'Oluştur'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RUTİN GÖREV EKLE / DÜZENLE */}
      {showRutinModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md p-6 rounded-3xl relative">
            <h3 className="text-xl font-bold text-white mb-4">{editingRutin ? 'Rutin Görev Düzenle 🔁' : 'Yeni Rutin Görev Ekle 🔁'}</h3>
            <form noValidate onSubmit={handleSaveRutin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Bağlı Olduğu Klasör</label>
                <CustomSelect
                  value={rutinForm.klasor_id}
                  onChange={(e) => setRutinForm({ ...rutinForm, klasor_id: e.target.value })}
                  placeholder="Klasör Seçin (İsteğe Bağlı)"
                  options={[
                    { value: '', label: 'Klasör Seçin (İsteğe Bağlı)' },
                    ...rutinKlasorleri.map((k) => ({
                      value: k.id,
                      label: k.klasor_adi,
                      icon: '📂'
                    }))
                  ]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Görev / İşlem Adı *</label>
                <input
                  type="text"
                  required
                  value={rutinForm.gorev_adi}
                  onChange={(e) => setRutinForm({ ...rutinForm, gorev_adi: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  placeholder="örn: Klima Temizliği, Bahçe Sulama"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Periyot *</label>
                  <div className="flex gap-2">
                    <CustomSelect
                      value={rutinForm.periyot_birim || 'ay'}
                      onChange={(e) => setRutinForm({ ...rutinForm, periyot_birim: e.target.value })}
                      className="w-1/2 min-w-0"
                      options={[
                        { value: 'gun', label: 'Gün' },
                        { value: 'hafta', label: 'Hafta' },
                        { value: 'ay', label: 'Ay' }
                      ]}
                    />
                    {(() => {
                      const isWeeklyWithDays = (rutinForm.periyot_birim === 'hafta') && Boolean(rutinForm.secili_gunler && rutinForm.secili_gunler.trim());
                      return (
                        <input
                          type="number"
                          required={!isWeeklyWithDays}
                          disabled={isWeeklyWithDays}
                          min="1"
                          value={isWeeklyWithDays ? '' : rutinForm.periyot_ay}
                          onChange={(e) => setRutinForm({ ...rutinForm, periyot_ay: e.target.value })}
                          className={`w-1/2 min-w-0 bg-white/5 border border-white/10 rounded-xl py-2.5 px-3 outline-none focus:border-purple-500 text-sm transition-all ${
                            isWeeklyWithDays ? 'opacity-30 cursor-not-allowed text-transparent bg-white/5 border-white/5 pointer-events-none select-none' : 'text-white'
                          }`}
                          placeholder={isWeeklyWithDays ? '' : (rutinForm.periyot_birim === 'hafta' ? '1' : rutinForm.periyot_birim === 'gun' ? 'örn: 7' : 'örn: 1')}
                          title={isWeeklyWithDays ? 'Gün seçimi yapıldığı için periyot pasiftir.' : ''}
                        />
                      );
                    })()}
                  </div>
                </div>
                <div>
                  {(() => {
                    const maxDays = getRutinMaxWarningDays(rutinForm);
                    return (
                      <>
                        <label className="block text-xs font-semibold text-gray-400 mb-1">
                          Kaç Gün Kala Uyarsın? *
                        </label>
                        <input
                          type="number"
                          required
                          min="0"
                          max={maxDays}
                          value={rutinForm.hatirlatma_gun_kala}
                          onChange={(e) => setRutinForm({ ...rutinForm, hatirlatma_gun_kala: e.target.value })}
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                          placeholder="örn: 0"
                        />
                      </>
                    );
                  })()}
                </div>
              </div>

              {rutinForm.periyot_birim === 'hafta' && (
                <div className="mt-3">
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">Tekrarlanacak Günler (Örn: Pazartesi, Çarşamba)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { full: 'Pazartesi', short: 'Pzt' },
                      { full: 'Salı', short: 'Sal' },
                      { full: 'Çarşamba', short: 'Çar' },
                      { full: 'Perşembe', short: 'Per' },
                      { full: 'Cuma', short: 'Cum' },
                      { full: 'Cumartesi', short: 'Cmt' },
                      { full: 'Pazar', short: 'Pzr' }
                    ].map((day) => {
                      const selectedDays = (rutinForm.secili_gunler || '').split(',').map(s => s.trim()).filter(Boolean);
                      const isSelected = selectedDays.includes(day.full);
                      return (
                        <button
                          key={day.full}
                          type="button"
                          onClick={() => {
                            let newDays;
                            if (isSelected) {
                              newDays = selectedDays.filter(d => d !== day.full);
                            } else {
                              const weekOrder = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi', 'Pazar'];
                              const updated = [...selectedDays, day.full];
                              newDays = weekOrder.filter(d => updated.includes(d));
                            }
                            setRutinForm({ ...rutinForm, secili_gunler: newDays.join(',') });
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer border ${isSelected
                              ? 'bg-purple-600/30 border-purple-500 text-purple-200 shadow-sm'
                              : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                        >
                          {day.short}
                        </button>
                      );
                    })}
                  </div>
                  {rutinForm.secili_gunler && (
                    <p className="text-[11px] text-purple-300/80 mt-1.5">
                      Seçilen Günler: <span className="font-medium text-purple-200">{rutinForm.secili_gunler.split(',').join(', ')}</span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Son Yapılma Tarihi (İlk başlangıç için)</label>
                <DatePicker
                  value={rutinForm.son_yapilma_tarihi}
                  onChange={(e) => setRutinForm({ ...rutinForm, son_yapilma_tarihi: e.target.value })}
                  placeholder="Son yapılma tarihi seçin..."
                />
              </div>

              <div className="flex gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowRutinModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-sm"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  disabled={
                    Boolean(
                      editingRutin &&
                      String(rutinForm.klasor_id || '') === String(editingRutin.klasor_id || '') &&
                      rutinForm.gorev_adi === editingRutin.gorev_adi &&
                      Number(rutinForm.periyot_ay) === Number(editingRutin.periyot_ay) &&
                      (rutinForm.periyot_birim || 'ay') === (editingRutin.periyot_birim || 'ay') &&
                      (rutinForm.secili_gunler || '') === (editingRutin.secili_gunler || '') &&
                      Number(rutinForm.hatirlatma_gun_kala) === Number(editingRutin.hatirlatma_gun_kala) &&
                      rutinForm.son_yapilma_tarihi === formatInputDate(editingRutin.son_yapilma_tarihi)
                    )
                  }
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-purple-600 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  {editingRutin ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBİL ALT SEKME ÇUBUĞU (Sadece küçük ekranlarda görünür) */}
      <nav className="md:hidden mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-white/15">
        <div className="flex items-stretch justify-around px-1 py-1">
          {(user?.role === 'admin' ? [
            { id: 'admin', icon: User, label: 'Admin' },
            { id: 'istatistikler', icon: BarChart2, label: 'İstatistik' },
            { id: 'sikayetler', icon: MessageSquare, label: 'Şikayetler' },
            { id: 'ayarlar', icon: Settings, label: 'Ayarlar' }
          ] : [
            { id: 'dashboard', icon: LayoutDashboard, label: 'Ana Sayfa' },
            { id: 'gidalar', icon: Apple, label: 'Gıdalar' },
            { id: 'faturalar', icon: Receipt, label: 'Faturalar' },
            { id: 'garantiler', icon: ShieldCheck, label: 'Garanti' },
            { id: 'rutinler', icon: RefreshCw, label: 'Rutinler' },
            { id: 'ayarlar', icon: Settings, label: 'Ayarlar' }
          ]).map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => changePage(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${isActive
                  ? 'text-purple-400'
                  : 'text-gray-500 hover:text-gray-300'
                  }`}
              >
                {/* Aktif göstergesi - üst çizgi */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                )}
                {/* İkon arka plan - aktif halde */}
                <span className={`p-1.5 rounded-lg transition-all duration-200 ${isActive ? 'bg-purple-500/15' : ''
                  }`}>
                  <Icon className={`w-4 h-4 transition-all duration-200 ${isActive ? 'scale-110' : ''
                    }`} />
                </span>
                <span className={`text-[9px] font-semibold leading-none transition-all duration-200 ${isActive ? 'text-purple-300' : 'text-gray-500'
                  }`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* MODAL: CUSTOM CONFIRM MODAL */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 z-[100] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-[#13141f] border border-rose-500/30 p-6 rounded-3xl max-w-sm w-full shadow-[0_10px_50px_rgba(244,63,94,0.25)] animate-scale-in flex flex-col items-center text-center">
            <div className="p-3.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl mb-4 shadow-[0_0_25px_rgba(244,63,94,0.25)] animate-pulse">
              <Trash2 className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">{deleteConfirm.title}</h3>
            <p className="text-xs md:text-sm text-gray-300 mb-6 leading-relaxed">
              {deleteConfirm.message}
            </p>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null })}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-xs md:text-sm"
              >
                Vazgeç
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (deleteConfirm.onConfirm) {
                    await deleteConfirm.onConfirm();
                  }
                  setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null });
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-all cursor-pointer text-xs md:text-sm shadow-[0_4px_20px_rgba(244,63,94,0.35)] glow-btn flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OTURUMU KAPAT ONAY MODALI */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
          <div className="bg-[#13141f] border border-white/10 p-6 rounded-2xl max-w-sm w-full shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-scale-in flex flex-col items-center text-center">
            <div className="p-3 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl mb-4 shadow-[0_0_20px_rgba(244,63,94,0.2)]">
              <LogOut className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-2">Oturumu Kapatmak İstiyor Musunuz?</h3>
            <p className="text-xs md:text-sm text-gray-400 mb-6 leading-relaxed">
              Oturumunuz kapatılacaktır. Hesabınıza tekrar erişmek için yeniden giriş yapmanız gerekecektir.
            </p>

            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-xs md:text-sm"
              >
                Vazgeç
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  handleLogout();
                }}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-all cursor-pointer text-xs md:text-sm shadow-[0_4px_20px_rgba(244,63,94,0.3)] glow-btn flex items-center justify-center gap-1.5"
              >
                <LogOut className="w-4 h-4" />
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HESAP SİLME ONAY MODALI (ŞİFRE DOĞRULAMALI) */}
      {showDeleteAccountModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#13141f] border border-rose-500/30 p-6 rounded-2xl max-w-sm w-full shadow-[0_10px_40px_rgba(244,63,94,0.3)] animate-scale-in flex flex-col items-center text-center">
            <div className="p-3.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl mb-3.5 shadow-[0_0_25px_rgba(244,63,94,0.25)] animate-pulse">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h3 className="text-lg font-bold text-white mb-1.5">Hesabınızı Silmek İstiyor Musunuz?</h3>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              Bu işlem <b className="text-rose-400">geri alınamaz</b>. Devam etmek için lütfen mevcut şifrenizi girin:
            </p>

            <form onSubmit={handleDeleteAccount} className="w-full space-y-4">
              <div className="relative">
                <input
                  type="password"
                  required
                  autoFocus
                  placeholder="Mevcut şifrenizi girin..."
                  value={deleteAccountPassword}
                  onChange={(e) => setDeleteAccountPassword(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-rose-500/60 rounded-xl py-2.5 px-3.5 text-white text-xs md:text-sm outline-none transition-all placeholder:text-gray-500 text-center"
                />
              </div>

              <div className="flex gap-2.5 w-full">
                <button
                  type="button"
                  disabled={deleteAccountLoading}
                  onClick={() => {
                    setShowDeleteAccountModal(false);
                    setDeleteAccountPassword('');
                    setDeleteAccountError('');
                  }}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-xs md:text-sm"
                >
                  Vazgeç
                </button>

                <button
                  type="submit"
                  disabled={deleteAccountLoading || !deleteAccountPassword.trim()}
                  className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all cursor-pointer text-xs md:text-sm shadow-[0_4px_20px_rgba(244,63,94,0.4)] glow-btn flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-4 h-4" />
                  {deleteAccountLoading ? 'Siliniyor...' : 'Evet, Hesabımı Sil'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
