import React from 'react';

interface PreferenceTileProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  value: boolean;
  onChanged: (val: boolean) => void;
  disabled?: boolean;
}

export const PreferenceTile: React.FC<PreferenceTileProps> = ({
  icon,
  title,
  subtitle,
  value,
  onChanged,
  disabled = false,
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 flex items-center justify-between gap-3 mb-2.5 transition-colors">
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="text-[#126B55] shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-[15px] text-slate-800 leading-snug">
            {title}
          </h4>
          <p className="text-xs text-slate-500 leading-tight mt-0.5">
            {subtitle}
          </p>
        </div>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={value}
        disabled={disabled}
        onClick={() => onChanged(!value)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
          value ? 'bg-[#126B55]' : 'bg-slate-300'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
            value ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
