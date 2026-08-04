import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export default function CustomSelect({
  value,
  onChange,
  options = [],
  placeholder = 'Seçiniz...',
  className = '',
  required = false,
  disabled = false
}) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef(null);
  const popoverRef = useRef(null);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0, width: 200 });

  // Options normalizasyonu
  const normalizedOptions = options.map(opt => {
    if (typeof opt === 'object' && opt !== null) {
      return { value: opt.value, label: opt.label || opt.value, icon: opt.icon };
    }
    return { value: opt, label: String(opt), icon: null };
  });

  const selectedOption = normalizedOptions.find(opt => String(opt.value) === String(value));

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(normalizedOptions.length * 44 + 16, 260);
    const dropdownWidth = Math.max(rect.width, 140);

    let top = rect.bottom + 6;
    if (rect.bottom + dropdownHeight > window.innerHeight && rect.top > dropdownHeight) {
      top = rect.top - dropdownHeight - 6;
    }
    top = Math.max(12, Math.min(top, window.innerHeight - dropdownHeight - 12));

    let left = rect.left;
    if (left + dropdownWidth > window.innerWidth - 12) {
      left = window.innerWidth - dropdownWidth - 12;
    }
    left = Math.max(12, left);

    setPopoverPos({ top, left, width: dropdownWidth });
  }, [normalizedOptions.length]);

  useEffect(() => {
    if (isOpen) {
      updatePosition();
      window.addEventListener('resize', updatePosition);
      window.addEventListener('scroll', updatePosition, true);
    }
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, updatePosition]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        triggerRef.current && !triggerRef.current.contains(e.target) &&
        popoverRef.current && !popoverRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    if (onChange) {
      onChange({ target: { value: optionValue } });
    }
    setIsOpen(false);
  };

  return (
    <div className={`relative ${className}`} ref={triggerRef}>
      {/* Gizli HTML Input (Form validation için) */}
      <input
        type="text"
        required={required}
        value={value !== undefined && value !== null ? String(value) : ''}
        onChange={() => {}}
        tabIndex={-1}
        className="sr-only"
      />

      {/* Tetikleyici Buton */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className={`w-full bg-white/5 border rounded-xl py-2.5 px-3.5 text-sm transition-all duration-200 cursor-pointer flex items-center justify-between select-none ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        } ${
          isOpen
            ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
            : 'border-white/10 hover:border-purple-500/40 hover:bg-white/[0.07]'
        }`}
      >
        <span className={`truncate flex items-center gap-2 ${selectedOption ? 'text-white font-medium' : 'text-gray-400'}`}>
          {selectedOption?.icon && <span>{selectedOption.icon}</span>}
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0 ml-1 ${isOpen ? 'rotate-180 text-purple-400' : ''}`} />
      </button>

      {/* Portal Popover */}
      {isOpen && createPortal(
        <div
          ref={popoverRef}
          style={{
            position: 'fixed',
            top: `${popoverPos.top}px`,
            left: `${popoverPos.left}px`,
            width: `${popoverPos.width}px`,
            maxHeight: '260px',
            zIndex: 99999
          }}
          className="bg-[#161722]/95 backdrop-blur-2xl border border-purple-500/40 rounded-2xl shadow-[0_16px_50px_rgba(0,0,0,0.85)] p-1.5 overflow-y-auto animate-scale-in custom-scrollbar space-y-1"
        >
          {normalizedOptions.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full px-3 py-2 rounded-xl text-xs md:text-sm font-medium text-left flex items-center justify-between transition-all duration-150 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40 font-semibold shadow-sm'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  {opt.icon && <span>{opt.icon}</span>}
                  {opt.label}
                </span>
                {isSelected && <Check className="w-4 h-4 text-purple-400 flex-shrink-0 ml-1.5" />}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
}
