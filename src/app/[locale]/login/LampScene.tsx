'use client';

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import gsap from 'gsap';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import type { Locale } from '@/i18n/config';

const STORAGE_KEY = 'hotelos-lamp-on';

const LampGlowContext = createContext(true);
/** Lets the submit button (rendered inside LoginForm, a sibling file) react to lamp state without prop-drilling through the page. */
export function useLampGlow(): boolean {
  return useContext(LampGlowContext);
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Full-screen dark hospitality scene — deliberately not tied to the app's
 * light/dark CSS variables (this page always renders dark, regardless of
 * the visitor's OS theme, the same way a hotel lobby doesn't change its own
 * lighting because a guest prefers a bright phone theme). Card content is
 * passed as children so LoginForm/page copy stays a normal server-rendered
 * tree; only the scene chrome around it is a client component.
 */
export function LampScene({
  locale,
  languageSwitchPath,
  wordmark,
  tagline,
  footer,
  children,
}: {
  locale: Locale;
  languageSwitchPath: string;
  wordmark: string;
  tagline: string;
  footer: ReactNode;
  children: ReactNode;
}) {
  const [lampOn, setLampOn] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const glowRef = useRef<HTMLDivElement>(null);
  const ambientRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const bulbRef = useRef<SVGCircleElement>(null);
  const chainRef = useRef<SVGGElement>(null);
  const dragState = useRef({ dragging: false, startY: 0 });

  useEffect(() => {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored !== null) setLampOn(stored === '1');
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(STORAGE_KEY, lampOn ? '1' : '0');

    const reduced = prefersReducedMotion();
    const duration = reduced ? 0 : 0.6;
    const ease = 'power2.out';

    gsap.to(glowRef.current, { opacity: lampOn ? 1 : 0, scale: lampOn ? 1 : 0.85, duration, ease });
    gsap.to(ambientRef.current, { opacity: lampOn ? 1 : 0, duration, ease });
    gsap.to(cardRef.current, {
      opacity: lampOn ? 1 : 0.88,
      filter: lampOn ? 'brightness(1)' : 'brightness(0.82)',
      duration,
      ease,
    });
    gsap.to(bulbRef.current, { opacity: lampOn ? 1 : 0.35, duration, ease });
  }, [lampOn, hydrated]);

  function toggle() {
    setLampOn((v) => !v);
  }

  function onChainPointerDown(e: React.PointerEvent) {
    dragState.current = { dragging: true, startY: e.clientY };
    (e.target as Element).setPointerCapture(e.pointerId);
  }

  function onChainPointerMove(e: React.PointerEvent) {
    if (!dragState.current.dragging || !chainRef.current) return;
    const delta = Math.max(0, Math.min(24, e.clientY - dragState.current.startY));
    gsap.set(chainRef.current, { y: delta });
  }

  function onChainPointerUp(e: React.PointerEvent) {
    if (!dragState.current.dragging) return;
    const delta = e.clientY - dragState.current.startY;
    dragState.current.dragging = false;
    gsap.to(chainRef.current, { y: 0, duration: prefersReducedMotion() ? 0 : 0.4, ease: 'elastic.out(1, 0.5)' });
    if (delta > 14) toggle();
  }

  return (
    <LampGlowContext.Provider value={lampOn}>
      <main
        className="relative flex min-h-screen flex-col overflow-hidden px-6 py-8 sm:px-10 md:px-16"
        style={{ backgroundColor: '#1a140f' }}
      >
        {/* Base scene depth: warm brown/charcoal radial vignette, always present regardless of lamp state so the page is never pitch black. */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 30% 40%, #2e2115 0%, #1a140f 55%, #100c09 100%)',
          }}
        />
        {/* Ambient warm wash that fades in when the lamp is on. */}
        <div
          ref={ambientRef}
          className="pointer-events-none absolute inset-0 opacity-0"
          style={{
            background: 'radial-gradient(ellipse 70% 55% at 28% 38%, hsl(38 70% 45% / 0.35) 0%, transparent 70%)',
          }}
        />

        <div className="relative z-10 flex items-center justify-between">
          <span className="text-sm font-semibold tracking-wide text-white/90">{wordmark}</span>
          <LanguageSwitch locale={locale} path={languageSwitchPath} />
        </div>

        <div className="relative z-10 flex flex-1 flex-col items-center justify-center gap-8 py-8 md:flex-row md:gap-16">
          {/* Lamp + glow */}
          <div className="relative flex shrink-0 items-end justify-center" style={{ width: 180, height: 220 }}>
            <div
              ref={glowRef}
              className="pointer-events-none absolute opacity-0"
              style={{
                width: 420,
                height: 420,
                top: -40,
                background: 'radial-gradient(circle, hsl(38 80% 55% / 0.55) 0%, hsl(38 70% 45% / 0.18) 45%, transparent 72%)',
                filter: 'blur(2px)',
              }}
              aria-hidden="true"
            />
            <LampFigure
              bulbRef={bulbRef}
              chainRef={chainRef}
              onToggle={toggle}
              onChainPointerDown={onChainPointerDown}
              onChainPointerMove={onChainPointerMove}
              onChainPointerUp={onChainPointerUp}
              lampOn={lampOn}
            />
          </div>

          {/* Card */}
          <div
            ref={cardRef}
            className="w-full max-w-sm rounded-2xl border border-white/10 p-8 shadow-2xl backdrop-blur-xl"
            style={{ background: 'linear-gradient(160deg, hsl(30 25% 18% / 0.72), hsl(20 20% 10% / 0.72))' }}
          >
            <p className="text-xs font-medium uppercase tracking-widest text-[hsl(38_55%_65%)]">{tagline}</p>
            {children}
          </div>
        </div>

        <p className="relative z-10 text-center text-xs text-white/45">{footer}</p>
      </main>
    </LampGlowContext.Provider>
  );
}

function LampFigure({
  bulbRef,
  chainRef,
  onToggle,
  onChainPointerDown,
  onChainPointerMove,
  onChainPointerUp,
  lampOn,
}: {
  bulbRef: React.RefObject<SVGCircleElement>;
  chainRef: React.RefObject<SVGGElement>;
  onToggle: () => void;
  onChainPointerDown: (e: React.PointerEvent) => void;
  onChainPointerMove: (e: React.PointerEvent) => void;
  onChainPointerUp: (e: React.PointerEvent) => void;
  lampOn: boolean;
}) {
  return (
    <svg viewBox="0 0 180 220" width={180} height={220} className="relative" aria-hidden="true">
      {/* Base */}
      <ellipse cx="90" cy="210" rx="30" ry="7" fill="#0d0a08" opacity="0.6" />
      <rect x="82" y="120" width="16" height="88" rx="3" fill="#3a2f24" />
      {/* Shade */}
      <path d="M 45 118 L 60 60 A 32 10 0 0 1 120 60 L 135 118 Z" fill="#f3ead9" opacity="0.94" />
      <path d="M 45 118 L 135 118 L 130 126 L 50 126 Z" fill="#e4d7bd" />
      {/* Bulb glow visible under the shade */}
      <circle ref={bulbRef} cx="90" cy="108" r="10" fill="hsl(42 90% 72%)" opacity="1" />
      {/* Pull chain */}
      <g
        ref={chainRef}
        onPointerDown={onChainPointerDown}
        onPointerMove={onChainPointerMove}
        onPointerUp={onChainPointerUp}
        onClick={onToggle}
        className="cursor-pointer"
        role="button"
        tabIndex={0}
        aria-pressed={lampOn}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
      >
        <line x1="90" y1="112" x2="90" y2="150" stroke="#8a7a63" strokeWidth="1.5" />
        <circle cx="90" cy="155" r="6" fill="#c9a25a" stroke="#8a7a63" strokeWidth="1" />
        {/* Larger invisible touch target for mobile */}
        <circle cx="90" cy="130" r="26" fill="transparent" />
      </g>
    </svg>
  );
}
