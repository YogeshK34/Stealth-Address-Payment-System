'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function LandingMotion(): React.JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    if (!rootRef.current) return;

    const revealElements = Array.from(document.querySelectorAll('[data-reveal]'));
    const glowCards = Array.from(document.querySelectorAll('[data-glow]'));
    const listeners: Array<{
      element: Element;
      hoverIn: () => void;
      hoverOut: () => void;
    }> = [];

    const ctx = gsap.context(() => {
      revealElements.forEach((element) => {
        gsap.set(element, { y: 28, opacity: 0, filter: 'blur(6px)' });

        ScrollTrigger.create({
          trigger: element,
          start: 'top 88%',
          end: 'bottom 8%',
          onEnter: () =>
            gsap.to(element, {
              y: 0,
              opacity: 1,
              filter: 'blur(0px)',
              duration: 0.8,
              ease: 'power2.out',
              overwrite: 'auto',
            }),
          onEnterBack: () =>
            gsap.to(element, {
              y: 0,
              opacity: 1,
              filter: 'blur(0px)',
              duration: 0.6,
              ease: 'power2.out',
              overwrite: 'auto',
            }),
          onLeave: () =>
            gsap.to(element, {
              opacity: 0.5,
              y: -8,
              duration: 0.45,
              ease: 'power1.out',
              overwrite: 'auto',
            }),
          onLeaveBack: () =>
            gsap.to(element, {
              opacity: 0,
              y: 20,
              filter: 'blur(4px)',
              duration: 0.45,
              ease: 'power1.out',
              overwrite: 'auto',
            }),
          fastScrollEnd: true,
        });
      });

      glowCards.forEach((element) => {
        const hoverIn = () => {
          gsap.to(element, {
            y: -4,
            boxShadow: '0 24px 70px rgba(232,121,249,0.18)',
            duration: 0.35,
            ease: 'power2.out',
          });
        };
        const hoverOut = () => {
          gsap.to(element, {
            y: 0,
            boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
            duration: 0.35,
            ease: 'power2.out',
          });
        };

        element.addEventListener('mouseenter', hoverIn);
        element.addEventListener('mouseleave', hoverOut);

        listeners.push({ element, hoverIn, hoverOut });
      });
    }, rootRef);

    return () => {
      listeners.forEach(({ element, hoverIn, hoverOut }) => {
        element.removeEventListener('mouseenter', hoverIn);
        element.removeEventListener('mouseleave', hoverOut);
      });
      ctx.revert();
    };
  }, []);

  return <div ref={rootRef} className="hidden" aria-hidden="true" />;
}
