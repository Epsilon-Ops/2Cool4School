import React from 'react';

/**
 * Mascotte « Hibou » en SVG.
 * - idle : respire en permanence (squash & stretch léger)
 * - happy : saut avec anticipation, étirement en l'air, écrasement à la réception
 * - sad : secoue la tête
 * Chaque montage du composant rejoue l'animation d'entrée : il suffit de changer `key`.
 */
export default function Mascot({ mood = 'idle', size = 72, color = '#58cc02' }) {
  return (
    <div className={`mascot mood-${mood}`} style={{ width: size, height: size }} aria-hidden="true">
      <svg className="owl" viewBox="0 0 120 120">
        <ellipse className="owl-shadow" cx="60" cy="114" rx="36" ry="5" />
        <ellipse cx="44" cy="106" rx="10" ry="5" fill="#ffc800" />
        <ellipse cx="76" cy="106" rx="10" ry="5" fill="#ffc800" />
        <path
          d="M60 12C92 12 110 38 110 72C110 98 88 108 60 108C32 108 10 98 10 72C10 38 28 12 60 12Z"
          fill={color}
        />
        <path d="M22 36L30 8L50 26Z" fill={color} />
        <path d="M98 36L90 8L70 26Z" fill={color} />
        <ellipse cx="60" cy="84" rx="32" ry="24" fill="#d7ffb8" />
        <g className="eyes-open">
          <circle cx="42" cy="52" r="16" fill="#ffffff" />
          <circle cx="78" cy="52" r="16" fill="#ffffff" />
          <circle cx="45" cy="55" r="7.5" fill="#3c3c3c" />
          <circle cx="81" cy="55" r="7.5" fill="#3c3c3c" />
          <circle cx="48" cy="51" r="2.6" fill="#ffffff" />
          <circle cx="84" cy="51" r="2.6" fill="#ffffff" />
        </g>
        <g className="eyes-happy" fill="none" stroke="#3c3c3c" strokeWidth="5" strokeLinecap="round">
          <path d="M28 56Q42 40 56 56" />
          <path d="M64 56Q78 40 92 56" />
        </g>
        <g className="brows" stroke="#3c3c3c" strokeWidth="4" strokeLinecap="round">
          <path d="M28 38L50 30" />
          <path d="M92 38L70 30" />
        </g>
        <path d="M54 62H66L60 74Z" fill="#ffc800" />
        <circle cx="24" cy="72" r="6" fill="#ff86d0" opacity=".6" />
        <circle cx="96" cy="72" r="6" fill="#ff86d0" opacity=".6" />
      </svg>
    </div>
  );
}
