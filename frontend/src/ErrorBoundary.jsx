import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0f1015] text-white flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-3xl max-w-md w-full text-center space-y-4 border border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.15)]">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-xl font-bold">Bir Hata Oluştu ⚠️</h2>
            <p className="text-xs text-gray-400 leading-relaxed">
              Sayfa yüklenirken bir görüntüleme hatası oluştu. Sayfayı yenileyerek tekrar deneyebilirsiniz.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 glow-btn cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Sayfayı Yenile
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
