import React from 'react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

/** Avatar ที่มี fallback เป็น initials เมื่อไม่มีรูป */
export const Avatar: React.FC<AvatarProps> = ({ src, name = '', size = 40, className = '', onClick }) => {
  const initial = name.trim()[0]?.toUpperCase() ?? '?';
  const style = { width: size, height: size, minWidth: size };

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={style}
        className={`rounded-full object-cover ${className}`}
        onClick={onClick}
      />
    );
  }

  return (
    <div
      style={style}
      className={`rounded-full bg-[#5B65F2] flex items-center justify-center text-white font-bold select-none ${className}`}
      onClick={onClick}
    >
      <span style={{ fontSize: size * 0.4 }}>{initial}</span>
    </div>
  );
};
