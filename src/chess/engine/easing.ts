import gsap from 'gsap';

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Maps v from [a,b] to 0..1 (clamped). */
export const seg = (v: number, a: number, b: number): number => clamp01((v - a) / (b - a));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Default scroll easing (power4.inOut) and camera / snap easing (expo.inOut). Never overshoot. */
export const E: (t: number) => number = gsap.parseEase('power4.inOut');
export const EXPO: (t: number) => number = gsap.parseEase('expo.inOut');
