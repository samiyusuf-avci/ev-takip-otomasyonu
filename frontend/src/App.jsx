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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  const diff = target - today;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
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
    return rutinler.filter((r) => seciliRutinKlasor === 'hepsi' || r.klasor_id?.toString() === seciliRutinKlasor);
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
        setGidalar(res.data);
      } else if (currentPage === 'faturalar') {
        const res = await API.get('/faturalar');
        setFaturalar(res.data);
      } else if (currentPage === 'garantiler') {
        const res = await API.get('/garantiler');
        setGarantiler(res.data);
      } else if (currentPage === 'rutinler') {
        const foldersRes = await API.get('/rutin_klasorleri');
        const routinesRes = await API.get('/rutinler');
        setRutinKlasorleri(foldersRes.data);
        setRutinler(routinesRes.data);
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
        } else {
          showToast('Kontrol tetiklendi. Yaklaşan veya acil uyarınız olmadığı için bildirim gönderilmedi.');
        }
      }
    } catch (err) {
      showToast('Manuel tetikleme sırasında bir hata oluştu.', 'error');
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
      {/* SOL NAVİGASYON (DEKSTOP) */}
      <aside className="w-full md:w-64 glass-panel md:min-h-screen p-5 flex flex-col justify-between border-b md:border-b-0 md:border-r border-white/10">
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
      <main className="flex-1 p-6 md:p-10 pb-24 md:pb-10 overflow-y-auto">
        {/* TOAST / BİLDİRİM BANNERLARI */}
        {successMsg && (
          <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center gap-2.5 text-sm animate-fade-in">
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center gap-2.5 text-sm animate-fade-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: DASHBOARD
           ------------------------------------------------------------- */}
        {currentPage === 'dashboard' && (
          <div className="space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Hoş Geldiniz 🏠</h2>
                <p className="text-gray-400 mt-1">Evinizin tüm düzenini ve yaklaşan son teslim tarihlerini buradan yönetin.</p>
              </div>
              <div className="text-sm font-semibold py-2 px-4 rounded-xl bg-white/5 border border-white/10 text-purple-400">
                📅 Bugün: {formatDate(new Date().toISOString().split('T')[0])}
              </div>
            </div>

            {/* İSTATİSTİK KARTLARI */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: 'Gıda Maddeleri',
                  count: summary?.gidalar?.toplam ?? 0,
                  alerts: summary?.gidalar?.uyarilar ?? 0,
                  alertText: 'SKT yaklaşan gıda',
                  icon: Apple,
                  color: 'from-amber-500/20 to-orange-500/20',
                  iconColor: 'text-amber-400',
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
                  page: 'rutinler'
                }
              ].map((card, i) => {
                const CardIcon = card.icon;
                return (
                  <div
                    key={i}
                    onClick={() => setCurrentPage(card.page)}
                    className="glass-panel glass-panel-hover p-6 rounded-2xl cursor-pointer flex flex-col justify-between relative overflow-hidden"
                  >
                    <div className={`absolute top-0 right-0 w-24 h-24 bg-gradient-to-br ${card.color} opacity-40 blur-2xl rounded-full -mr-5 -mt-5`}></div>
                    <div className="flex justify-between items-start mb-4">
                      <div className={`p-3 bg-white/5 rounded-xl border border-white/10 ${card.iconColor}`}>
                        <CardIcon className="w-6 h-6" />
                      </div>
                      {card.alerts > 0 && (
                        <span className="flex items-center gap-1 py-1 px-2.5 rounded-full text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400 animate-pulse">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {card.alerts} UYARI
                        </span>
                      )}
                    </div>
                    <div>
                      <h3 className="text-gray-400 text-sm font-semibold uppercase tracking-wider">{card.title}</h3>
                      <div className="flex items-baseline gap-2 mt-1">
                        <span className="text-3xl font-extrabold text-white">{card.count}</span>
                        {card.extra && <span className="text-lg font-bold text-gray-300">({card.extra})</span>}
                      </div>
                      <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
                        <Info className="w-3.5 h-3.5 text-gray-600" />
                        {card.alerts} {card.alertText}
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
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Gıda Son Kullanma Takibi 🥑</h2>
                <p className="text-gray-400 mt-1">Gıdaların son tüketim tarihlerini kaydedin ve bozulmadan önce bildirim alın.</p>
              </div>
              <button
                onClick={() => { setEditingGida(null); setGidaForm({ urun_adi: '', kategori: '', skt: '', hatirlatma_gun_kala: 3, durum: 'bekliyor' }); setShowGidaModal(true); }}
                className="flex items-center gap-2 py-3 px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                Gıda Ekle
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="flex border-b border-white/10">
              {[
                { id: 'hepsi', label: 'Tüm Gıdalar' },
                { id: 'bekliyor', label: 'Bekleyenler ⏰' },
                { id: 'tuketildi', label: 'Tüketilenler ✅' },
                { id: 'atildi', label: 'Atılanlar 🗑️' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setGidaFiltre(tab.id)}
                  className={`py-3 px-5 border-b-2 font-semibold text-sm transition-all duration-200 ${gidaFiltre === tab.id
                    ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* GIDA KARTLARI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGidalar.map((gida) => {
                  const days = getDaysDiff(gida.skt);
                  const statusClass = getStatusColor(days, gida.hatirlatma_gun_kala, gida.durum);
                  return (
                    <div key={gida.id} className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-white/5 relative overflow-hidden">
                      {/* Kart Arkaplan Işıması */}
                      {days !== null && days <= gida.hatirlatma_gun_kala && gida.durum === 'bekliyor' && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full"></div>
                      )}

                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-semibold py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 text-purple-300">
                            {gida.kategori || 'Genel'}
                          </span>
                          <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${statusClass}`}>
                            {gida.durum === 'tuketildi'
                              ? 'Tüketildi'
                              : gida.durum === 'atildi'
                                ? 'Atıldı'
                                : days === 0
                                  ? 'Bugün Son!'
                                  : days < 0
                                    ? `${Math.abs(days)} Gün Geçti`
                                    : `${days} Gün Kaldı`}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2">{gida.urun_adi}</h3>

                        <div className="space-y-1.5 text-sm text-gray-400">
                          <div className="flex justify-between">
                            <span>S.K.T:</span>
                            <span className="font-semibold text-gray-300">{formatDate(gida.skt)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hatırlatma Limiti:</span>
                            <span className="font-semibold text-gray-300">{gida.hatirlatma_gun_kala} Gün Kala</span>
                          </div>
                        </div>
                      </div>

                      {/* İşlem Butonları */}
                      <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
                        {gida.durum === 'bekliyor' && (
                          <>
                            <button
                              onClick={() => handleUpdateGidaDurum(gida, 'tuketildi')}
                              className="flex-1 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-semibold text-xs border border-emerald-500/20 transition-all cursor-pointer flex justify-center items-center gap-1"
                            >
                              <CheckCircle className="w-3.5 h-3.5" /> Tüketildi
                            </button>
                            <button
                              onClick={() => handleUpdateGidaDurum(gida, 'atildi')}
                              className="flex-1 py-2 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 font-semibold text-xs border border-rose-500/20 transition-all cursor-pointer flex justify-center items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" /> Bozuldu/Atıldı
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleEditGida(gida)}
                          className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteGida(gida.id)}
                          className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: FATURALAR
           ------------------------------------------------------------- */}
        {currentPage === 'faturalar' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Fatura Takibi 💸</h2>
                <p className="text-gray-400 mt-1">Ödemelerinizi unutmayın. Faturaların son ödeme tarihlerini yönetin.</p>
              </div>
              <button
                onClick={() => { setEditingFatura(null); setFaturaForm({ fatura_adi: '', tutar: '', son_odeme_tarihi: '', hatirlatma_gun_kala: 5, durum: 'odenmedi' }); setShowFaturaModal(true); }}
                className="flex items-center gap-2 py-3 px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                Fatura Ekle
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="flex border-b border-white/10">
              {[
                { id: 'hepsi', label: 'Tüm Faturalar' },
                { id: 'odenmedi', label: 'Ödenmeyenler 💵' },
                { id: 'odendi', label: 'Ödenenler ✅' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFaturaFiltre(tab.id)}
                  className={`py-3 px-5 border-b-2 font-semibold text-sm transition-all duration-200 ${faturaFiltre === tab.id
                    ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* FATURA KARTLARI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFaturalar.map((fatura) => {
                  const days = getDaysDiff(fatura.son_odeme_tarihi);
                  const statusClass = getStatusColor(days, fatura.hatirlatma_gun_kala, fatura.durum);
                  return (
                    <div key={fatura.id} className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-white/5 relative overflow-hidden">
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-lg font-extrabold text-white flex items-center gap-1">
                            <DollarSign className="w-5 h-5 text-purple-400" />
                            {fatura.tutar || 0} <span className="text-sm font-semibold text-gray-400">TL</span>
                          </span>
                          <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${statusClass}`}>
                            {fatura.durum === 'odendi'
                              ? 'Ödendi'
                              : days === 0
                                ? 'Son Ödeme Günü!'
                                : days < 0
                                  ? `${Math.abs(days)} Gün Gecikti`
                                  : `${days} Gün Kaldı`}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2">{fatura.fatura_adi}</h3>

                        <div className="space-y-1.5 text-sm text-gray-400">
                          <div className="flex justify-between">
                            <span>Son Ödeme Tarihi:</span>
                            <span className="font-semibold text-gray-300">{formatDate(fatura.son_odeme_tarihi)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hatırlatma Limiti:</span>
                            <span className="font-semibold text-gray-300">{fatura.hatirlatma_gun_kala} Gün Kala</span>
                          </div>
                        </div>
                      </div>

                      {/* İşlem Butonları */}
                      <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
                        {fatura.durum === 'odenmedi' && (
                          <button
                            onClick={() => handlePayFatura(fatura)}
                            className="flex-1 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-semibold text-xs border border-emerald-500/20 transition-all cursor-pointer flex justify-center items-center gap-1.5"
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Ödendi İşaretle
                          </button>
                        )}
                        <button
                          onClick={() => handleEditFatura(fatura)}
                          className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteFatura(fatura.id)}
                          className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: GARANTİLER
           ------------------------------------------------------------- */}
        {currentPage === 'garantiler' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Garanti Belgeleri Takibi 🛡️</h2>
                <p className="text-gray-400 mt-1">Cihazlarınızın garanti sürelerini kaydedin, bitmeden önce uyarı alın.</p>
              </div>
              <button
                onClick={() => { setEditingGaranti(null); setGarantiForm({ cihaz_adi: '', marka_model: '', garanti_bitis: '', hatirlatma_gun_kala: 30, notlar: '' }); setShowGarantiModal(true); }}
                className="flex items-center gap-2 py-3 px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer"
              >
                <Plus className="w-5 h-5" />
                Cihaz Garantisi Ekle
              </button>
            </div>

            {/* FİLTRE TABLARI */}
            <div className="flex border-b border-white/10">
              {[
                { id: 'hepsi', label: 'Tüm Garantiler' },
                { id: 'aktif', label: 'Devam Edenler 🛡️' },
                { id: 'gecen', label: 'Süresi Dolanlar ⏰' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setGarantiFiltre(tab.id)}
                  className={`py-3 px-5 border-b-2 font-semibold text-sm transition-all duration-200 ${garantiFiltre === tab.id
                    ? 'border-purple-500 text-purple-400 bg-purple-500/5'
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                    }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* GARANTİ KARTLARI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredGarantiler.map((garanti) => {
                  const days = getDaysDiff(garanti.garanti_bitis);
                  const isExpired = days !== null && days < 0;
                  const statusClass = getStatusColor(days, garanti.hatirlatma_gun_kala, 'bekliyor');
                  return (
                    <div
                      key={garanti.id}
                      className={`glass-panel p-5 rounded-2xl flex flex-col justify-between border-white/5 relative overflow-hidden transition-all ${isExpired ? 'opacity-60 hover:opacity-90' : ''
                        }`}
                    >
                      {/* Kart Arkaplan Işıması */}
                      {days !== null && days <= garanti.hatirlatma_gun_kala && !isExpired && (
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full"></div>
                      )}
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-semibold py-1 px-2.5 rounded-lg bg-white/5 border border-white/10 text-purple-300">
                            {garanti.marka_model || 'Marka Belirtilmemiş'}
                          </span>
                          <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${statusClass}`}>
                            {days === 0
                              ? 'Bugün Bitiyor!'
                              : isExpired
                                ? 'Süresi Bitti'
                                : `${days} Gün Kaldı`}
                          </span>
                        </div>

                        <h3 className={`text-lg font-bold text-white mb-2 ${isExpired ? 'line-through text-gray-400' : ''}`}>{garanti.cihaz_adi}</h3>

                        <div className="space-y-1.5 text-sm text-gray-400">
                          <div className="flex justify-between">
                            <span>Garanti Bitiş Tarihi:</span>
                            <span className="font-semibold text-gray-300">{formatDate(garanti.garanti_bitis)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Hatırlatma Limiti:</span>
                            <span className="font-semibold text-gray-300">{garanti.hatirlatma_gun_kala} Gün Kala</span>
                          </div>
                          {garanti.notlar && (
                            <div className="mt-3 p-3 rounded-lg bg-white/5 border border-white/10 text-xs text-gray-400">
                              {garanti.notlar}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* İşlem Butonları */}
                      <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
                        <button
                          onClick={() => handleEditGaranti(garanti)}
                          className="flex-1 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 font-semibold text-xs border border-white/10 transition-all cursor-pointer flex justify-center items-center gap-1.5"
                        >
                          <Edit className="w-3.5 h-3.5" /> Düzenle
                        </button>
                        <button
                          onClick={() => handleDeleteGaranti(garanti.id)}
                          className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
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
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Rutin Klasörleri ve Görevleri 📅</h2>
                <p className="text-gray-400 mt-1">Periyodik görevlerinizi (ev rutinleri, araç bakımları vb.) klasörler altında gruplayın.</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setKlasorForm({ klasor_adi: '' }); setShowKlasorModal(true); }}
                  className="flex items-center gap-2 py-3 px-4 bg-white/5 hover:bg-white/10 text-white border border-white/10 font-semibold rounded-xl transition-all duration-200 cursor-pointer"
                >
                  <FolderPlus className="w-5 h-5 text-purple-400" />
                  Klasör Oluştur
                </button>
                <button
                  onClick={() => {
                    setEditingRutin(null);
                    setRutinForm({
                      klasor_id: seciliRutinKlasor === 'hepsi' ? '' : seciliRutinKlasor,
                      gorev_adi: '',
                      periyot_ay: '',
                      hatirlatma_gun_kala: 15,
                      son_yapilma_tarihi: ''
                    });
                    setShowRutinModal(true);
                  }}
                  className="flex items-center gap-2 py-3 px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all duration-200 glow-btn shadow-[0_4px_20px_rgba(168,85,247,0.25)] cursor-pointer"
                >
                  <Plus className="w-5 h-5" />
                  Görev Ekle
                </button>
              </div>
            </div>

            {/* KLASÖR YÖNETİMİ & SEÇİM BARBARI */}
            <div className="flex flex-wrap gap-2.5 pb-4 border-b border-white/10">
              <button
                onClick={() => setSeciliRutinKlasor('hepsi')}
                className={`py-2 px-4 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${seciliRutinKlasor === 'hepsi'
                  ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                  : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
                  }`}
              >
                Hepsi
              </button>
              {rutinKlasorleri.map((klasor) => (
                <div key={klasor.id} className="relative flex items-center group">
                  <button
                    onClick={() => setSeciliRutinKlasor(klasor.id.toString())}
                    className={`py-2 pl-4 pr-10 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${seciliRutinKlasor === klasor.id.toString()
                      ? 'bg-purple-600/20 text-purple-300 border-purple-500/30'
                      : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'
                      }`}
                  >
                    📂 {klasor.klasor_adi}
                  </button>
                  <button
                    onClick={() => handleDeleteKlasor(klasor.id)}
                    className="absolute right-2 text-rose-500 hover:text-rose-400 p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    title="Klasörü Sil"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* GÖREV KARTLARI */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredRutinler.map((rutin) => {
                  let nextDate = null;
                  let days = null;
                  if (rutin.son_yapilma_tarihi) {
                    const last = new Date(rutin.son_yapilma_tarihi);
                    last.setMonth(last.getMonth() + rutin.periyot_ay);
                    nextDate = last.toISOString().split('T')[0];
                    days = getDaysDiff(nextDate);
                  }

                  const isKmRoutine = rutin.hedef_km && rutin.mevcut_km;
                  const kmKalan = isKmRoutine ? (rutin.hedef_km - rutin.mevcut_km) : null;

                  // Renk mantığı ve durum tespiti
                  let isOverdue = false;
                  let isWarning = false;

                  if (days !== null && days < 0) {
                    isOverdue = true;
                  }

                  if (!isOverdue) {
                    if (days !== null && days <= rutin.hatirlatma_gun_kala) {
                      isWarning = true;
                    } else if (!rutin.son_yapilma_tarihi) {
                      isWarning = true;
                    }
                  }

                  let statusText = "Durum Stabil ✅";
                  let statusClass = "text-sky-400 bg-sky-500/10 border-sky-500/20";
                  let glowColor = "";

                  if (isOverdue) {
                    statusText = "Bakım Gecikti! ⚠️";
                    statusClass = "text-rose-400 bg-rose-500/10 border-rose-500/20 animate-pulse";
                    glowColor = "bg-rose-500/10";
                  } else if (isWarning) {
                    statusText = "Bakım Yaklaştı! ⏰";
                    statusClass = "text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse";
                    glowColor = "bg-amber-500/5";
                  }

                  return (
                    <div key={rutin.id} className="glass-panel p-5 rounded-2xl flex flex-col justify-between border-white/5 relative overflow-hidden">
                      {glowColor && (
                        <div className={`absolute top-0 right-0 w-32 h-32 ${glowColor} blur-3xl rounded-full`}></div>
                      )}
                      <div>
                        <div className="flex justify-between items-start mb-3">
                          <span className="text-xs font-semibold py-1 px-2.5 rounded-lg bg-purple-500/10 text-purple-300 border border-purple-500/20">
                            📂 {rutin.klasor_adi || 'Klasörsüz'}
                          </span>
                          <span className={`text-xs font-bold py-1 px-2.5 rounded-lg border ${statusClass}`}>
                            {statusText}
                          </span>
                        </div>

                        <h3 className="text-lg font-bold text-white mb-2">{rutin.gorev_adi}</h3>

                        <div className="space-y-1.5 text-sm text-gray-400">
                          <div className="flex justify-between">
                            <span>Periyot:</span>
                            <span className="font-semibold text-gray-300">{rutin.periyot_ay} Ayda Bir</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Son Yapılma:</span>
                            <span className="font-semibold text-gray-300">{formatDate(rutin.son_yapilma_tarihi)}</span>
                          </div>
                          {nextDate && (
                            <div className="flex justify-between text-xs text-purple-300 font-medium">
                              <span>Planlanan Sonraki:</span>
                              <span>{formatDate(nextDate)} (<span className={days < 0 ? 'text-rose-400 font-bold' : ''}>{days < 0 ? `${Math.abs(days)} Gün Gecikti` : `${days} gün kaldı`}</span>)</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* İşlem Butonları */}
                      <div className="flex gap-2 mt-5 pt-4 border-t border-white/5">
                        <button
                          onClick={() => handleCompleteRutin(rutin.id)}
                          className="flex-1 py-2 rounded-xl bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 font-semibold text-xs border border-emerald-500/20 transition-all cursor-pointer flex justify-center items-center gap-1.5"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Yapıldı İşaretle
                        </button>
                        <button
                          onClick={() => handleEditRutin(rutin)}
                          className="p-2 bg-white/5 hover:bg-white/10 text-gray-300 rounded-xl border border-white/10 transition-all cursor-pointer"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRutin(rutin.id)}
                          className="p-2 bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 rounded-xl border border-rose-500/20 transition-all cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* -------------------------------------------------------------
            PAGE: AYARLAR
           ------------------------------------------------------------- */}
        {currentPage === 'ayarlar' && (
          <div className="space-y-6 max-w-2xl">
            <div>
              <h2 className="text-3xl font-bold text-white tracking-tight">Sistem Ayarları ⚙️</h2>
              <p className="text-gray-400 mt-1">Telegram bot entegrasyonu ve manuel kontrol tetikleyicileri.</p>
            </div>

            {/* Telegram Bot Ayarları */}
            <div className="glass-panel p-6 rounded-2xl border-white/5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Bell className="w-5 h-5 text-purple-400" /> Telegram Bildirim Yapılandırması
              </h3>

              <form onSubmit={handleSaveAyarlar} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Telegram Bot Token</label>
                  <input
                    type="password"
                    placeholder="Botunuzun Token Kodu (örn: 123456:ABC-DEF...)"
                    value={ayarlar.telegram_token}
                    onChange={(e) => setAyarlar({ ...ayarlar, telegram_token: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-purple-500 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">@BotFather üzerinden aldığınız tokenı buraya yapıştırın.</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-300 mb-1.5">Telegram Chat ID</label>
                  <input
                    type="text"
                    placeholder="Alıcı Sohbet/Grup ID (örn: 987654321)"
                    value={ayarlar.telegram_chat_id}
                    onChange={(e) => setAyarlar({ ...ayarlar, telegram_chat_id: e.target.value })}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white text-sm outline-none focus:border-purple-500 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">@userinfobot veya @GetMyChatID_Bot yardımıyla Chat ID bilginizi öğrenebilirsiniz.</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-5 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-xl transition-all cursor-pointer text-center glow-btn"
                  >
                    Ayarları Kaydet
                  </button>
                  <button
                    type="button"
                    onClick={handleTestTelegram}
                    disabled={loading}
                    className="py-3 px-5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-semibold rounded-xl transition-all cursor-pointer text-center"
                  >
                    Bağlantıyı Test Et
                  </button>
                </div>
              </form>
            </div>

            {/* Manuel Tetikleyici Paneli */}
            <div className="glass-panel p-6 rounded-2xl border-white/5">
              <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                <RefreshCw className="w-5 h-5 text-emerald-400" /> Sistem Test Araçları
              </h3>
              <p className="text-sm text-gray-400 mb-4">
                Süresi yaklaşan görevlerin ve son kullanma tarihli ürünlerin kontrolünü gece yarısını beklemeden şimdi tetikleyebilirsiniz.
              </p>

              <button
                onClick={handleTriggerDailyReport}
                disabled={loading}
                className="py-3 px-5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 font-semibold rounded-xl transition-all cursor-pointer text-sm"
              >
                Bildirim Taramasını Manuel Başlat
              </button>
            </div>

            {/* Hesap Yönetimi (Mobil & Genel) */}
            <div className="glass-panel p-6 rounded-2xl border-white/5">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" /> Hesap Yönetimi
              </h3>
              <div className="flex flex-col sm:flex-row justify-between sm:items-center p-4 rounded-xl bg-white/5 border border-white/10 gap-3">
                <div>
                  <p className="text-sm font-bold text-white">{user.isim}</p>
                  <p className="text-xs text-gray-400">{user.eposta}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="py-2.5 px-4 rounded-xl bg-rose-950/20 hover:bg-rose-900/30 text-rose-400 border border-rose-500/20 font-semibold text-xs transition-all cursor-pointer text-center"
                >
                  Oturumu Kapat
                </button>
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

      {/* MOBİL ALT MENÜ (Sadece küçük ekranlarda görünür) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 glass-panel border-t border-white/10 z-40 px-4 py-2 flex justify-around items-center">
        {[
          { id: 'dashboard', icon: LayoutDashboard, label: 'Ana Sayfa' },
          { id: 'gidalar', icon: Apple, label: 'Gıdalar' },
          { id: 'faturalar', icon: Receipt, label: 'Faturalar' },
          { id: 'garantiler', icon: ShieldCheck, label: 'Garantiler' },
          { id: 'rutinler', icon: RefreshCw, label: 'Rutinler' }
        ].map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`flex flex-col items-center gap-0.5 p-1 transition-all ${isActive ? 'text-purple-400' : 'text-gray-500'
                }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{item.label}</span>
            </button>
          );
        })}
        <button
          onClick={() => setCurrentPage('ayarlar')}
          className={`flex flex-col items-center gap-0.5 p-1 transition-all ${currentPage === 'ayarlar' ? 'text-purple-400' : 'text-gray-500'
            }`}
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px] font-semibold">Ayarlar</span>
        </button>
      </div>

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
