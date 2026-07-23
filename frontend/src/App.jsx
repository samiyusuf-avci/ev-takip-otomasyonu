import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import API from './api';
import {
  LayoutDashboard,
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
  AlertTriangle,
  Gauge,
  Bell,
  Calendar,
  FolderPlus,
  Info,
  DollarSign,
  User,
  Mail,
  Lock,
  LogOut
} from 'lucide-react';

// -------------------------------------------------------------
// YARDIMCI GÖRSEL METOTLAR (Global scope'ta tanımlanarak yeniden oluşturulması engellendi)
// -------------------------------------------------------------
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

const getStatusColor = (days, limit, durum) => {
  if (durum === 'tuketildi' || durum === 'odendi') return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (durum === 'atildi') return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
  if (days === null) return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
  if (days < 0) return 'text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse';
  if (days <= limit) return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  return 'text-sky-400 bg-sky-500/10 border-sky-500/20';
};

function App() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotificationMenu, setShowNotificationMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Toast Zamanlayıcı Referansı (Bellek sızıntısını önler)
  const toastTimeoutRef = useRef(null);

  // Auth Stateleri
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || null);
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
  const [ayarlar, setAyarlar] = useState({ telegram_token: '', telegram_chat_id: '' });
  const [profileForm, setProfileForm] = useState({ isim: '', eposta: '', mevcut_sifre: '', sifre: '' });
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({
        isim: user.isim || '',
        eposta: user.eposta || '',
        mevcut_sifre: '',
        sifre: ''
      });
      setShowPasswordForm(false);
    }
  }, [user]);

  // Filtre Durumları
  const [gidaFiltre, setGidaFiltre] = useState('bekliyor'); // 'hepsi', 'bekliyor', 'tuketildi', 'atildi'
  const [faturaFiltre, setFaturaFiltre] = useState('odenmedi'); // 'hepsi', 'odenmedi', 'odendi'
  const [garantiFiltre, setGarantiFiltre] = useState('aktif'); // 'hepsi', 'aktif', 'gecen'
  const [seciliRutinKlasor, setSeciliRutinKlasor] = useState('hepsi'); // 'hepsi' veya klasor_id

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

  // Form Modalları ve State'leri
  const [showGidaModal, setShowGidaModal] = useState(false);
  const [gidaForm, setGidaForm] = useState({ urun_adi: '', kategori: '', skt: '', hatirlatma_gun_kala: 3, durum: 'bekliyor' });
  const [editingGida, setEditingGida] = useState(null);

  const [showFaturaModal, setShowFaturaModal] = useState(false);
  const [faturaForm, setFaturaForm] = useState({ fatura_adi: '', tutar: '', son_odeme_tarihi: '', hatirlatma_gun_kala: 5, durum: 'odenmedi' });
  const [editingFatura, setEditingFatura] = useState(null);

  const [showGarantiModal, setShowGarantiModal] = useState(false);
  const [garantiForm, setGarantiForm] = useState({ cihaz_adi: '', marka_model: '', garanti_bitis: '', hatirlatma_gun_kala: 30, notlar: '' });
  const [editingGaranti, setEditingGaranti] = useState(null);

  const [showKlasorModal, setShowKlasorModal] = useState(false);
  const [klasorForm, setKlasorForm] = useState({ klasor_adi: '' });

  const [showRutinModal, setShowRutinModal] = useState(false);
  const [rutinForm, setRutinForm] = useState({ klasor_id: '', gorev_adi: '', periyot_ay: '', hatirlatma_gun_kala: 15, son_yapilma_tarihi: '' });
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
  const showToast = useCallback((msg, type = 'success') => {
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }
    if (type === 'success') {
      setSuccessMsg(msg);
      toastTimeoutRef.current = setTimeout(() => setSuccessMsg(''), 4000);
    } else {
      setError(msg);
      toastTimeoutRef.current = setTimeout(() => setError(''), 4000);
    }
  }, []);
  const handleLogout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setCurrentPage('dashboard');
    showToast('Oturum kapatıldı.');
  }, [showToast]);

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
    setAuthError('');
    setAuthLoading(true);
    try {
      if (authMode === 'login') {
        const res = await API.post('/auth/login', {
          eposta: authForm.eposta,
          sifre: authForm.sifre
        });
        setToken(res.data.token);
        setUser(res.data.user);
        showToast(`Hoş geldiniz, ${res.data.user.isim}!`);
      } else {
        const res = await API.post('/auth/register', {
          isim: authForm.isim,
          eposta: authForm.eposta,
          sifre: authForm.sifre
        });
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
      showToast('Hesap bilgileriniz başarıyla güncellendi!');
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      showToast(err.response?.data?.error || 'Profil güncellenirken hata oluştu.', 'error');
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchDashboardSummary = useCallback(async () => {
    try {
      const res = await API.get('/dashboard-summary');
      setSummary(res.data);
    } catch (err) {
      console.error('Dashboard özeti yüklenemedi:', err);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      if (currentPage === 'dashboard') {
        await fetchDashboardSummary();
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
        setAyarlar({
          telegram_token: res.data.telegram_token || '',
          telegram_chat_id: res.data.telegram_chat_id || ''
        });
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
      setGidaForm({ urun_adi: '', kategori: '', skt: '', hatirlatma_gun_kala: 3, durum: 'bekliyor' });
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
      skt: gida.skt,
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
      setFaturaForm({ fatura_adi: '', tutar: '', son_odeme_tarihi: '', hatirlatma_gun_kala: 5, durum: 'odenmedi' });
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
      son_odeme_tarihi: fatura.son_odeme_tarihi,
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
      setGarantiForm({ cihaz_adi: '', marka_model: '', garanti_bitis: '', hatirlatma_gun_kala: 30, notlar: '' });
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
      garanti_bitis: garanti.garanti_bitis,
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
    try {
      await API.post('/rutin_klasorleri', klasorForm);
      showToast('Rutin klasörü oluşturuldu.');
      setShowKlasorModal(false);
      setKlasorForm({ klasor_adi: '' });
      fetchData();
    } catch (err) {
      showToast('Klasör oluşturulurken hata oluştu.', 'error');
    }
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
    try {
      const data = {
        ...rutinForm,
        klasor_id: rutinForm.klasor_id ? parseInt(rutinForm.klasor_id, 10) : null,
        periyot_ay: parseInt(rutinForm.periyot_ay, 10),
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
      setRutinForm({ klasor_id: '', gorev_adi: '', periyot_ay: '', hatirlatma_gun_kala: 15, son_yapilma_tarihi: '' });
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
      hatirlatma_gun_kala: rutin.hatirlatma_gun_kala,
      son_yapilma_tarihi: rutin.son_yapilma_tarihi || ''
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
  const handleSaveAyarlar = async (e) => {
    e.preventDefault();
    try {
      await API.post('/ayarlar', ayarlar);
      showToast('Telegram ayarları başarıyla kaydedildi.');
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



  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0e15] p-4 relative overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/10 blur-3xl rounded-full"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-rose-600/10 blur-3xl rounded-full"></div>

        <div className="glass-panel w-full max-w-md p-8 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(168,85,247,0.15)] relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="p-3.5 bg-purple-500/20 text-purple-400 rounded-2xl border border-purple-500/30 shadow-[0_0_20px_rgba(168,85,247,0.3)] mb-4">
              <RefreshCw className="w-8 h-8 animate-[spin_8s_linear_infinite]" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Akıllı Yaşam Asistanı</h1>
            <p className="text-xs text-purple-400/80 font-medium mt-1">
              {authMode === 'login' ? 'Hesabınıza giriş yapın' : 'Yeni bir hesap oluşturun'}
            </p>
          </div>

          {authError && (
            <div className="mb-4 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2 text-xs">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
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

          <div className="mt-6 text-center text-xs text-gray-400">
            {authMode === 'login' ? (
              <p>
                Hesabınız yok mu?{' '}
                <button
                  type="button"
                  onClick={() => { setAuthMode('register'); setAuthError(''); }}
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
                  onClick={() => { setAuthMode('login'); setAuthError(''); }}
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
      <header className="md:hidden mobile-header fixed top-0 left-0 right-0 z-40 border-b border-white/15 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-purple-500/20 text-purple-400 rounded-lg border border-purple-500/30">
            <RefreshCw className="w-4 h-4 animate-[spin_6s_linear_infinite]" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">Akıllı Yaşam</h1>
            <p className="text-[9px] text-purple-400/70 font-medium">Ev Takip Otomasyonu</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowNotificationMenu(!showNotificationMenu)}
            title="Bildirim Test Et"
            className="p-2 rounded-xl bg-purple-600/10 hover:bg-purple-600/20 text-purple-400 border border-purple-500/20 transition-all cursor-pointer"
          >
            <Bell className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            title="Hesap Ayarları"
            className="w-8 h-8 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 active:scale-95 border border-purple-500/20 text-purple-400 font-bold text-xs flex items-center justify-center transition-all cursor-pointer"
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
            
            <div className="absolute right-14 top-16 z-50 w-64 bg-[#13141f] border border-white/10 p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-scale-in flex flex-col gap-3">
              <div className="flex items-center gap-2 pb-2 border-b border-white/5 text-purple-400">
                <Bell className="w-4 h-4 animate-bounce" />
                <h4 className="text-xs font-bold text-white">Sistem Bildirim Testi 🔔</h4>
              </div>
              
              <p className="text-[10px] text-gray-400 leading-relaxed">
                Yaklaşan tüm görevleri ve son tarihleri tarayarak Telegram'a anlık durum raporu gönderir.
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
            
            <div className="absolute right-4 top-16 z-50 w-64 bg-[#13141f] border border-white/10 p-4 rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-scale-in flex flex-col gap-3">
              <div className="flex items-center gap-2.5 pb-2.5 border-b border-white/5">
                <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 font-extrabold text-sm flex items-center justify-center flex-shrink-0">
                  {user.isim ? user.isim.charAt(0).toUpperCase() : 'U'}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate leading-none">{user.isim}</p>
                  <p className="text-[10px] text-gray-400 truncate mt-1">{user.eposta}</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <button
                  onClick={() => { setCurrentPage('ayarlar'); setShowProfileMenu(false); }}
                  className="w-full flex items-center gap-2 py-2 px-3 text-xs text-gray-300 hover:text-white hover:bg-white/5 rounded-lg transition-all text-left"
                >
                  <Settings className="w-3.5 h-3.5 text-gray-400" />
                  Ayarlar ve Hesap Yönetimi
                </button>
                
                <button
                  onClick={() => { handleLogout(); setShowProfileMenu(false); }}
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
      <aside className="hidden md:flex w-64 glass-panel min-h-screen p-5 flex-col justify-between border-r border-white/10">
        <div>
          <div className="flex items-center gap-3 mb-8 px-2">
            <div className="p-2.5 bg-purple-500/20 text-purple-400 rounded-xl border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.3)]">
              <RefreshCw className="w-6 h-6 animate-[spin_6s_linear_infinite]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Akıllı Yaşam</h1>
              <p className="text-xs text-purple-400/80 font-medium">Ev Takip Otomasyonu</p>
            </div>
          </div>

          <nav className="space-y-1">
            {[
              { id: 'dashboard', name: 'Ana Sayfa', icon: LayoutDashboard },
              { id: 'gidalar', name: 'Gıda Takibi', icon: Apple },
              { id: 'faturalar', name: 'Fatura Takibi', icon: Receipt },
              { id: 'garantiler', name: 'Garanti Takibi', icon: ShieldCheck },
              { id: 'rutinler', name: 'Rutinler', icon: RefreshCw },
              { id: 'ayarlar', name: 'Ayarlar', icon: Settings }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setCurrentPage(item.id)}
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
            Bildirim Test Et
          </button>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-500/20 font-semibold text-sm transition-all duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* ANA İÇERİK BÖLGESİ */}
      <main className="flex-1 p-4 pt-20 md:pt-10 md:p-10 pb-28 md:pb-10 overflow-y-auto">
        {/* TOAST / BİLDİRİM BANNERLARI (Fixed & Her zaman görünür) */}
        {successMsg && (
          <div className="fixed top-20 md:top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm p-4 rounded-xl bg-emerald-950 border border-emerald-500/30 text-emerald-400 flex items-center gap-2.5 text-sm shadow-[0_10px_30px_rgba(16,185,129,0.2)] animate-scale-in">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span className="font-semibold">{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="fixed top-20 md:top-6 left-1/2 -translate-x-1/2 z-[100] w-[90%] max-w-sm p-4 rounded-xl bg-rose-950 border border-rose-500/30 text-rose-400 flex items-center gap-2.5 text-sm shadow-[0_10px_30px_rgba(244,63,94,0.2)] animate-scale-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 animate-pulse" />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: DASHBOARD
           ------------------------------------------------------------- */}
        {currentPage === 'dashboard' && (
          <div className="space-y-4 md:space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4">
              <div>
                <h2 className="text-xl md:text-3xl font-bold text-white tracking-tight">Hoş Geldiniz 🏠</h2>
                <p className="text-gray-400 mt-0.5 text-xs md:text-base">Evinizin tüm düzenini buradan yönetin.</p>
              </div>
              <div className="text-xs font-semibold py-1.5 px-3 rounded-xl bg-white/5 border border-white/10 text-purple-400">
                📅 Bugün: {formatDate(new Date().toISOString().split('T')[0])}
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
                    onClick={() => setCurrentPage(card.page)}
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

            {/* Telegram Hatırlatma Bilgisi */}
            <div className="glass-panel p-6 rounded-2xl border border-purple-500/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/5 blur-3xl rounded-full pointer-events-none"></div>
              <div className="flex gap-4 relative z-10">
                <div className="p-3 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-2xl flex-shrink-0 self-start">
                  <Bell className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Anlık Telegram Hatırlatıcısı Aktif</h3>
                  <p className="text-sm text-gray-400 mt-1 max-w-2xl">
                    Sistem her gece saat 00:00'da son kullanma tarihleri, fatura son ödeme günleri ve periyodik rutin görevlerinizi
                    otomatik olarak tarar ve belirlediğiniz uyarı limitlerine ulaşıldığında Telegram botunuz üzerinden size anlık
                    detaylı bir rapor gönderir.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCurrentPage('ayarlar')}
                className="relative z-10 py-2.5 px-5 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-sm font-semibold transition-all duration-200 flex-shrink-0 cursor-pointer"
              >
                Telegram Botu Yapılandır
              </button>
            </div>
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
                onClick={() => { setEditingGida(null); setGidaForm({ urun_adi: '', kategori: '', skt: '', hatirlatma_gun_kala: 3, durum: 'bekliyor' }); setShowGidaModal(true); }}
                className="flex items-center gap-1.5 py-2 px-3 md:py-3 md:px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="p-1 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-xl flex items-center gap-1 overflow-x-auto filter-tabs-scroll shadow-inner w-full min-w-0">
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
                    className={`flex-1 md:flex-initial px-1.5 py-1.5 xs:px-2 md:px-3.5 md:py-2 rounded-lg md:rounded-xl text-[10.5px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer select-none ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-[0_2px_12px_rgba(147,51,234,0.4)] font-bold scale-[1.01]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.mobileLabel}</span>
                    <span
                      className={`text-[9px] sm:text-[10px] md:text-xs px-1 py-0.2 sm:px-1.5 md:py-0.5 rounded-full font-bold transition-colors ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {tab.count}
                    </span>
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
                              <button onClick={() => handleUpdateGidaDurum(gida, 'atildi')} className="flex-1 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-semibold text-xs border border-rose-500/20 transition-all cursor-pointer flex justify-center items-center gap-1">
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
                onClick={() => { setEditingFatura(null); setFaturaForm({ fatura_adi: '', tutar: '', son_odeme_tarihi: '', hatirlatma_gun_kala: 5, durum: 'odenmedi' }); setShowFaturaModal(true); }}
                className="flex items-center gap-1.5 py-2 px-3 md:py-3 md:px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="p-1 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-xl flex items-center gap-1 overflow-x-auto filter-tabs-scroll shadow-inner w-full min-w-0">
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
                    className={`flex-1 md:flex-initial px-1.5 py-1.5 xs:px-2 md:px-3.5 md:py-2 rounded-lg md:rounded-xl text-[10.5px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer select-none ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-[0_2px_12px_rgba(147,51,234,0.4)] font-bold scale-[1.01]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.mobileLabel}</span>
                    <span
                      className={`text-[9px] sm:text-[10px] md:text-xs px-1 py-0.2 sm:px-1.5 md:py-0.5 rounded-full font-bold transition-colors ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {tab.count}
                    </span>
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
                onClick={() => { setEditingGaranti(null); setGarantiForm({ cihaz_adi: '', marka_model: '', garanti_bitis: '', hatirlatma_gun_kala: 30, notlar: '' }); setShowGarantiModal(true); }}
                className="flex items-center gap-1.5 py-2 px-3 md:py-3 md:px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer flex-shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Ekle</span>
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="p-1 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-xl flex items-center gap-1 overflow-x-auto filter-tabs-scroll shadow-inner w-full min-w-0">
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
                    className={`flex-1 md:flex-initial px-1.5 py-1.5 xs:px-2 md:px-3.5 md:py-2 rounded-lg md:rounded-xl text-[10.5px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer select-none ${
                      isActive
                        ? 'bg-purple-600 text-white shadow-[0_2px_12px_rgba(147,51,234,0.4)] font-bold scale-[1.01]'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.mobileLabel}</span>
                    <span
                      className={`text-[9px] sm:text-[10px] md:text-xs px-1 py-0.2 sm:px-1.5 md:py-0.5 rounded-full font-bold transition-colors ${
                        isActive ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                      }`}
                    >
                      {tab.count}
                    </span>
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
                  onClick={() => { setKlasorForm({ klasor_adi: '' }); setShowKlasorModal(true); }}
                  className="flex items-center gap-1 py-2 px-2.5 md:px-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-xl text-sm transition-all duration-200 cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4 text-purple-400" />
                  <span className="hidden md:inline">Klasör Oluştur</span>
                </button>
                <button
                  onClick={() => { setEditingRutin(null); setRutinForm({ klasor_id: seciliRutinKlasor === 'hepsi' ? '' : seciliRutinKlasor, gorev_adi: '', periyot_ay: '', hatirlatma_gun_kala: 15, son_yapilma_tarihi: '' }); setShowRutinModal(true); }}
                  className="flex items-center gap-1.5 py-2 px-3 md:py-3 md:px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-sm transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Ekle</span>
                </button>
              </div>
            </div>

            {/* KLASÖR YÖNETİMİ & SEÇİM BARBARI */}
            <div className="p-1 bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-xl flex items-center gap-1 overflow-x-auto filter-tabs-scroll shadow-inner w-full min-w-0">
              <button
                onClick={() => setSeciliRutinKlasor('hepsi')}
                className={`px-2 py-1.5 sm:px-3.5 sm:py-2 rounded-lg md:rounded-xl text-[10.5px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center justify-center gap-0.5 sm:gap-1.5 cursor-pointer flex-shrink-0 select-none ${
                  seciliRutinKlasor === 'hepsi'
                    ? 'bg-purple-600 text-white shadow-[0_2px_12px_rgba(147,51,234,0.4)] font-bold scale-[1.01]'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                <span>Hepsi</span>
                <span
                  className={`text-[9px] sm:text-[10px] md:text-xs px-1 py-0.2 sm:px-1.5 md:py-0.5 rounded-full font-bold transition-colors ${
                    seciliRutinKlasor === 'hepsi' ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
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
                  <div key={klasor.id} className="relative flex items-center group flex-shrink-0">
                    <button
                      onClick={() => setSeciliRutinKlasor(klasor.id.toString())}
                      className={`px-2 py-1.5 pl-2 pr-6 sm:px-3.5 sm:py-2 sm:pr-8 rounded-lg md:rounded-xl text-[10.5px] xs:text-xs md:text-sm font-semibold whitespace-nowrap transition-all duration-200 flex items-center gap-0.5 sm:gap-1.5 cursor-pointer select-none ${
                        isSelected
                          ? 'bg-purple-600 text-white shadow-[0_2px_12px_rgba(147,51,234,0.4)] font-bold scale-[1.01]'
                          : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <span>📂 {klasor.klasor_adi}</span>
                      <span
                        className={`text-[9px] sm:text-[10px] md:text-xs px-1 py-0.2 sm:px-1.5 md:py-0.5 rounded-full font-bold transition-colors ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-white/10 text-gray-400'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                    <button
                      onClick={() => handleDeleteKlasor(klasor.id)}
                      className="absolute right-1 text-rose-400 hover:text-rose-300 p-0.5 rounded hover:bg-white/10 opacity-75 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Klasörü Sil"
                    >
                      <Trash2 className="w-3 h-3 md:w-3.5 md:h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* GÖREV KARTLARI */}
            <div className="space-y-2 md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-6 md:space-y-0">
              {filteredRutinler.map((rutin) => {
                  if (!rutin || !rutin.id) return null;
                  let nextDate = null;
                  let days = null;
                  if (rutin.son_yapilma_tarihi) {
                    const safeStr = typeof rutin.son_yapilma_tarihi === 'string' ? rutin.son_yapilma_tarihi.replace(' ', 'T') : rutin.son_yapilma_tarihi;
                    const last = new Date(safeStr);
                    const periyot = parseInt(rutin.periyot_ay, 10) || 1;
                    if (!isNaN(last.getTime()) && !isNaN(periyot)) {
                      last.setMonth(last.getMonth() + periyot);
                      if (!isNaN(last.getTime())) {
                        try {
                          nextDate = last.toISOString().split('T')[0];
                          days = getDaysDiff(nextDate);
                        } catch (e) {
                          console.error("Date formatting error:", e);
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
                            {rutin.periyot_ay} Ayda Bir
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
                            <div className="flex justify-between"><span>Periyot:</span><span className="font-semibold text-gray-300">{rutin.periyot_ay} Ayda Bir</span></div>
                            <div className="flex justify-between"><span>Son Yapılma:</span><span className="font-semibold text-gray-300">{formatDate(rutin.son_yapilma_tarihi)}</span></div>
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
            PAGE: AYARLAR
           ------------------------------------------------------------- */}
        {currentPage === 'ayarlar' && (
          <div className="space-y-4 md:space-y-6 max-w-2xl">
            <div>
              <h2 className="text-lg md:text-3xl font-bold text-white tracking-tight">Sistem Ayarları ⚙️</h2>
              <p className="text-xs md:text-sm text-gray-400 mt-0.5">Telegram bot entegrasyonu ve kontrol tetikleyicileri.</p>
            </div>

            {/* Telegram Bot Ayarları */}
            <div className="glass-panel p-4 md:p-6 rounded-2xl border-white/5">
              <h3 className="text-sm md:text-lg font-bold text-white mb-3 md:mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 md:w-5 md:h-5 text-purple-400" /> Telegram Bildirim Yapılandırması
              </h3>

              <form onSubmit={handleSaveAyarlar} className="space-y-3.5">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-300 mb-1">Telegram Bot Token</label>
                  <input
                    type="password"
                    placeholder="Botunuzun Token Kodu (örn: 123456:ABC-DEF...)"
                    value={ayarlar.telegram_token}
                    onChange={(e) => setAyarlar({ ...ayarlar, telegram_token: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none focus:border-purple-500 transition-all"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">@BotFather üzerinden aldığınız token.</p>
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-300 mb-1">Telegram Chat ID</label>
                  <input
                    type="text"
                    placeholder="Alıcı Sohbet/Grup ID (örn: 987654321)"
                    value={ayarlar.telegram_chat_id}
                    onChange={(e) => setAyarlar({ ...ayarlar, telegram_chat_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none focus:border-purple-500 transition-all"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">Kişisel veya grup sohbet kimliğiniz (Chat ID).</p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2 md:py-3 px-4 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center glow-btn"
                  >
                    Ayarları Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={loading}
                    className="py-2 md:py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center"
                  >
                    Bağlantıyı Test Et
                  </button>
                </div>
              </form>
            </div>

            {/* Manuel Tetikleyici Paneli */}
            <div className="glass-panel p-4 md:p-6 rounded-2xl border-white/5">
              <h3 className="text-sm md:text-lg font-bold text-white mb-1.5 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" /> Sistem Test Araçları
              </h3>
              <p className="text-[10px] md:text-sm text-gray-400 mb-3 leading-relaxed">
                Süresi yaklaşan görevlerin ve son kullanma tarihli ürünlerin kontrolünü gece yarısını beklemeden şimdi tetikleyin.
              </p>

              <button
                onClick={handleTriggerDailyReport}
                disabled={loading}
                className="py-2 md:py-2.5 px-4 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 font-semibold rounded-xl transition-all cursor-pointer text-xs"
              >
                Bildirim Taramasını Manuel Başlat
              </button>
            </div>

            {/* Hesap Yönetimi (Mobil & Genel) */}
            <div className="glass-panel p-4 md:p-6 rounded-2xl border-white/5">
              <h3 className="text-sm md:text-lg font-bold text-white mb-3 md:mb-4 flex items-center gap-2">
                <User className="w-4 h-4 md:w-5 md:h-5 text-purple-400" /> Hesap Yönetimi
              </h3>
              
              <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-300 mb-1">Ad Soyad</label>
                  <input
                    type="text"
                    required
                    value={profileForm.isim}
                    onChange={(e) => setProfileForm({ ...profileForm, isim: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs md:text-sm font-semibold text-gray-300 mb-1">E-posta Adresi</label>
                  <input
                    type="email"
                    required
                    value={profileForm.eposta}
                    onChange={(e) => setProfileForm({ ...profileForm, eposta: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2 md:py-3 px-3.5 text-white text-xs md:text-sm outline-none focus:border-purple-500 transition-all"
                  />
                </div>

                {/* Şifre Değiştirme Butonu & Alanları */}
                {!showPasswordForm ? (
                  <button
                    type="button"
                    onClick={() => setShowPasswordForm(true)}
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
                  <button
                    type="submit"
                    disabled={
                      profileLoading || 
                      (!(showPasswordForm && profileForm.mevcut_sifre !== '' && profileForm.sifre !== '') &&
                       profileForm.isim === (user?.isim || '') && 
                       profileForm.eposta === (user?.eposta || ''))
                    }
                    className="flex-1 py-2 md:py-2.5 px-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center glow-btn"
                  >
                    {profileLoading ? 'Güncelleniyor...' : 'Bilgileri Güncelle'}
                  </button>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="py-2 md:py-2.5 px-4 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-500/20 font-semibold rounded-xl text-xs md:text-sm transition-all cursor-pointer text-center"
                  >
                    Oturumu Kapat
                  </button>
                </div>
              </form>
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
            <form onSubmit={handleSaveGida} className="space-y-4">
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
                <input
                  type="date"
                  required
                  value={gidaForm.skt}
                  onChange={(e) => setGidaForm({ ...gidaForm, skt: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Kaç Gün Kala Hatırlatılsın? *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={gidaForm.hatirlatma_gun_kala}
                  onChange={(e) => setGidaForm({ ...gidaForm, hatirlatma_gun_kala: parseInt(e.target.value, 10) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                />
              </div>

              {editingGida && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Durum</label>
                  <select
                    value={gidaForm.durum}
                    onChange={(e) => setGidaForm({ ...gidaForm, durum: e.target.value })}
                    className="w-full bg-[#1e202d] border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  >
                    <option value="bekliyor">Bekliyor (Tüketilmedi)</option>
                    <option value="tuketildi">Tüketildi</option>
                    <option value="atildi">Atıldı / Bozuldu</option>
                  </select>
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
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  Kaydet
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
            <form onSubmit={handleSaveFatura} className="space-y-4">
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
                <input
                  type="date"
                  required
                  value={faturaForm.son_odeme_tarihi}
                  onChange={(e) => setFaturaForm({ ...faturaForm, son_odeme_tarihi: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Kaç Gün Kala Hatırlatılsın? *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={faturaForm.hatirlatma_gun_kala}
                  onChange={(e) => setFaturaForm({ ...faturaForm, hatirlatma_gun_kala: parseInt(e.target.value, 10) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                />
              </div>

              {editingFatura && (
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Ödeme Durumu</label>
                  <select
                    value={faturaForm.durum}
                    onChange={(e) => setFaturaForm({ ...faturaForm, durum: e.target.value })}
                    className="w-full bg-[#1e202d] border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                  >
                    <option value="odenmedi">Ödenmedi</option>
                    <option value="odendi">Ödendi</option>
                  </select>
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
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  Kaydet
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
            <form onSubmit={handleSaveGaranti} className="space-y-4">
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
                <input
                  type="date"
                  required
                  value={garantiForm.garanti_bitis}
                  onChange={(e) => setGarantiForm({ ...garantiForm, garanti_bitis: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Kaç Gün Kala Hatırlatılsın? *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={garantiForm.hatirlatma_gun_kala}
                  onChange={(e) => setGarantiForm({ ...garantiForm, hatirlatma_gun_kala: parseInt(e.target.value, 10) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                />
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
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KLASÖR OLUŞTUR */}
      {showKlasorModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm p-6 rounded-3xl relative">
            <h3 className="text-xl font-bold text-white mb-4">Yeni Rutin Klasörü 📂</h3>
            <form onSubmit={handleSaveKlasor} className="space-y-4">
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
                  onClick={() => setShowKlasorModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-sm"
                >
                  Vazgeç
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  Oluştur
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
            <form onSubmit={handleSaveRutin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Bağlı Olduğu Klasör</label>
                <select
                  value={rutinForm.klasor_id}
                  onChange={(e) => setRutinForm({ ...rutinForm, klasor_id: e.target.value })}
                  className="w-full bg-[#1e202d] border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                >
                  <option value="">Klasör Seçin (İsteğe Bağlı)</option>
                  {rutinKlasorleri.map((k) => (
                    <option key={k.id} value={k.id}>{k.klasor_adi}</option>
                  ))}
                </select>
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
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Periyot (Kaç Ayda Bir) *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={rutinForm.periyot_ay}
                    onChange={(e) => setRutinForm({ ...rutinForm, periyot_ay: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                    placeholder="örn: 12"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1">Kaç Gün Kala Uyarsın? *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={rutinForm.hatirlatma_gun_kala}
                    onChange={(e) => setRutinForm({ ...rutinForm, hatirlatma_gun_kala: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
                    placeholder="örn: 15"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-1">Son Yapılma Tarihi (İlk başlangıç için)</label>
                <input
                  type="date"
                  value={rutinForm.son_yapilma_tarihi}
                  onChange={(e) => setRutinForm({ ...rutinForm, son_yapilma_tarihi: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 px-3.5 text-white outline-none focus:border-purple-500 text-sm transition-all"
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
                  className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm glow-btn"
                >
                  Kaydet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOBİL ALT SEKME ÇUBUĞU (Sadece küçük ekranlarda görünür) */}
      <nav className="md:hidden mobile-bottom-nav fixed bottom-0 left-0 right-0 z-40 border-t border-white/15">
        <div className="flex items-stretch justify-around px-1 py-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Ana Sayfa' },
            { id: 'gidalar', icon: Apple, label: 'Gıdalar' },
            { id: 'faturalar', icon: Receipt, label: 'Faturalar' },
            { id: 'garantiler', icon: ShieldCheck, label: 'Garanti' },
            { id: 'rutinler', icon: RefreshCw, label: 'Rutinler' },
            { id: 'ayarlar', icon: Settings, label: 'Ayarlar' }
          ].map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                id={`mobile-nav-${item.id}`}
                onClick={() => setCurrentPage(item.id)}
                className={`relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 px-0.5 rounded-xl transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'text-purple-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {/* Aktif göstergesi - üst çizgi */}
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.8)]" />
                )}
                {/* İkon arka plan - aktif halde */}
                <span className={`p-1.5 rounded-lg transition-all duration-200 ${
                  isActive ? 'bg-purple-500/15' : ''
                }`}>
                  <Icon className={`w-4 h-4 transition-all duration-200 ${
                    isActive ? 'scale-110' : ''
                  }`} />
                </span>
                <span className={`text-[9px] font-semibold leading-none transition-all duration-200 ${
                  isActive ? 'text-purple-300' : 'text-gray-500'
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
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm p-6 rounded-3xl relative border border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.15)] animate-scale-in">
            <div className="flex items-center gap-3 mb-4 text-rose-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0 animate-pulse" />
              <h3 className="text-lg font-bold text-white">{deleteConfirm.title}</h3>
            </div>

            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              {deleteConfirm.message}
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm({ show: false, title: '', message: '', onConfirm: null })}
                className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-semibold border border-white/10 transition-all cursor-pointer text-sm"
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
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl font-semibold transition-all cursor-pointer text-sm shadow-[0_4px_20px_rgba(244,63,94,0.3)] glow-btn"
              >
                Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
