import React, { useEffect } from 'react';
import * as FiIcons from 'react-icons/fi';
import SafeIcon from '../../common/SafeIcon';

function useEscape(onClose) {
  useEffect(() => {
    const onKey = event => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
}

/** Centered dialog. Pass `onSubmit` to render the card as a <form>. */
export function Modal({ eyebrow, title, onClose, onSubmit, footer, children, wide = false }) {
  useEscape(onClose);
  const Card = onSubmit ? 'form' : 'section';
  return (
    <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <Card className={`modal-card${wide ? ' modal-wide' : ''}`} onSubmit={onSubmit} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-heading">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}><SafeIcon icon={FiIcons.FiX} /></button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </Card>
    </div>
  );
}

/** Right-hand side panel for record details. */
export function Drawer({ title, subtitle, onClose, actions, children }) {
  useEscape(onClose);
  return (
    <div className="drawer-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <aside className="drawer-panel" role="dialog" aria-modal="true" aria-label={title}>
        <header className="drawer-heading">
          <div className="drawer-title"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-button" type="button" aria-label="Close" onClick={onClose}><SafeIcon icon={FiIcons.FiX} /></button>
        </header>
        {actions && <div className="drawer-actions">{actions}</div>}
        <div className="drawer-body">{children}</div>
      </aside>
    </div>
  );
}

export function Field({ label, required, wide, children }) {
  return <label className={`field-label${wide ? ' field-wide' : ''}`}>{label}{required && <em>*</em>}{children}</label>;
}
