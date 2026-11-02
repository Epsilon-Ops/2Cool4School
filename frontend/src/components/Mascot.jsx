/** Mascotte qui respire, saute quand tu réussis, tremble quand tu te trompes. */
import React from 'react';
export default function Mascot({ mood = 'idle', size = 64 }) {
  return (
    <div className={`mascot mood-${mood}`} style={{ width: size, height: size }} aria-hidden="true">
      <div className="body">
        <span className="eye l" />
        <span className="eye r" />
        <span className="mouth" />
      </div>
    </div>
  );
}
